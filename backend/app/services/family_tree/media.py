"""Real decode/sanitization and DB-serialized reference/pin/delete lifecycle."""
from datetime import UTC, datetime, timedelta
import io
import secrets
import warnings
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select, update, delete, exists, func
from app.models.family_tree import FamilyTreeMediaAsset as Asset, FamilyTreeMediaReference as Reference, FamilyTreeMediaPin as Pin, FamilyTreeStory, FamilyTreeCollection
from .access import authorize, collection, person, scoped, error
from . import storage

FORMATS = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'WEBP': 'image/webp'}


def sanitize(data, declared_mime=None):
    if not data or len(data) > storage.limit('IMAGE_MAX_BYTES', storage.MAX_IMAGE):
        error('resource_limit', 'Image exceeds the permitted size.', 413)
    magic = 'PNG' if data.startswith(b'\x89PNG\r\n\x1a\n') else 'JPEG' if data.startswith(b'\xff\xd8\xff') else 'WEBP' if data[:4] == b'RIFF' and data[8:12] == b'WEBP' else None
    if magic is None or (declared_mime and declared_mime != FORMATS[magic]):
        error('validation_error', 'Only matching JPEG, PNG or WebP images are supported.', 422)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data),formats=[magic]) as probe:
                if probe.format != magic or getattr(probe, 'n_frames', 1) != 1:
                    raise ValueError('Unsupported image structure')
                if probe.width * probe.height > storage.limit('IMAGE_MAX_PIXELS', storage.MAX_PIXELS):
                    error('resource_limit', 'Decoded image exceeds the pixel limit.', 413)
                probe.verify()
            with Image.open(io.BytesIO(data),formats=[magic]) as image:
                image.load()
                image = ImageOps.exif_transpose(image)
                image.thumbnail((2048, 2048))
                # A new pixel-only image cannot carry EXIF/GPS, comments or ICC.
                mode = 'RGB' if magic == 'JPEG' else 'RGBA'
                clean = Image.new(mode, image.size)
                clean.paste(image.convert(mode))
                output = io.BytesIO()
                clean.save(output, format=magic)
                result = output.getvalue()
                if len(result) > storage.MAX_IMAGE: error('resource_limit', 'Sanitized image exceeds the limit.', 413)
                return result, FORMATS[magic], clean.width, clean.height
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        error('validation_error', 'The image cannot be safely decoded.', 422)


def dto(asset):
    return {k: getattr(asset, k) for k in ['id','mime_type','byte_size','checksum','width','height','caption','state']}


def check_capacity(session, household_id, incoming_bytes):
    session.execute(update(FamilyTreeCollection).where(FamilyTreeCollection.household_id==household_id).values(revision=FamilyTreeCollection.revision))
    retained=session.scalar(select(func.coalesce(func.sum(Asset.byte_size),0)).where(Asset.household_id==household_id,Asset.state!='deleted'))
    if retained+incoming_bytes>storage.limit('HOUSEHOLD_MEDIA_MAX_BYTES',1024*1024*1024):
        error('resource_limit','Household managed media quota exceeded.',413)


def publish(session, actor, c, data, mime, width, height, caption=None):
    check_capacity(session, actor.household_id, len(data))
    authorize(session, actor, manage=True)
    key = storage.write(data)
    row = Asset(household_id=actor.household_id, collection_id=c.id, created_by_user_id=actor.id,
        object_key=key, mime_type=mime, byte_size=len(data), checksum=storage.checksum(data), width=width, height=height, caption=caption, state='ready')
    session.add(row); session.flush()
    return row


def upload(session, actor, data, declared_mime, caption=None):
    authorize(session, actor, manage=True)
    c = collection(session, actor.household_id)
    if c is None: error('validation_error', 'Create a person before staging images.', 422)
    clean, mime, width, height = sanitize(data, declared_mime)
    # File publication precedes SQL. A rollback leaves only collectible orphan
    # bytes, never a durable reference to absent content.
    row = publish(session, actor, c, clean, mime, width, height, caption)
    pin(session,row,secrets.token_hex(32),'upload',datetime.now(UTC)+timedelta(days=1))
    return dto(row)


def ready(session, household_id, asset_id):
    row = scoped(session, Asset, household_id, asset_id)
    # No-op conditional UPDATE takes the same SQLite write lock as a cleanup
    # claim. Trigger protects even direct SQL inserts against claimed objects.
    if session.execute(update(Asset).where(Asset.id==row.id, Asset.household_id==household_id, Asset.state=='ready').values(state='ready')).rowcount != 1:
        error('media_unavailable', 'This image is no longer available for attachment.')
    return row


def pin(session, asset, token, purpose, expires_at):
    ready(session, asset.household_id, asset.id)
    row = Pin(household_id=asset.household_id, collection_id=asset.collection_id,
        asset_id=asset.id, token=token, purpose=purpose, expires_at=expires_at)
    session.add(row); session.flush()
    return row


def attach(session, actor, c, asset_id, command):
    p = person(session, actor.household_id, command.person_id, editable=True)
    asset = ready(session, actor.household_id, asset_id)
    if command.story_id:
        story = scoped(session, FamilyTreeStory, actor.household_id, command.story_id)
        if story.person_id != p.id: error('validation_error', 'Story and person must match.', 422)
    existing = session.scalar(select(Reference).where(Reference.asset_id==asset.id, Reference.person_id==p.id, Reference.role==command.role, Reference.story_id==command.story_id))
    if existing: error('validation_error', 'This attachment already exists.', 422)
    bounds=storage.collection_limits()
    retained=select(Reference).where(Reference.household_id==actor.household_id)
    if command.role=='primary': retained=retained.where(~((Reference.person_id==p.id)&(Reference.role=='primary')))
    current=list(session.scalars(retained.limit(bounds['references']+1)))
    if len(current)>=bounds['references'] or len({r.asset_id for r in current}|{asset_id})>bounds['media']:
        error('resource_limit','Collection attachment limit exceeded.',413)
    if command.role == 'primary':
        session.execute(delete(Reference).where(Reference.household_id==actor.household_id, Reference.person_id==p.id, Reference.role=='primary'))
    row = Reference(household_id=actor.household_id, collection_id=c.id, created_by_user_id=actor.id,
        person_id=p.id, story_id=command.story_id, role=command.role, asset_id=asset.id)
    session.add(row); session.flush()
    return {'person_ids':[p.id], 'media_asset_ids':[asset.id], 'media_reference_ids':[row.id]}, []


def detach(session, actor, c, asset_id, reference_id):
    scoped(session, Asset, actor.household_id, asset_id)
    row = scoped(session, Reference, actor.household_id, reference_id)
    if row.asset_id != asset_id: error('validation_error', 'Attachment and image must match.', 422)
    person(session, actor.household_id, row.person_id, editable=True)
    session.delete(row)
    return {'person_ids':[row.person_id], 'media_asset_ids':[asset_id], 'media_reference_ids':[row.id]}, []


def references(session, actor, person_id):
    authorize(session, actor)
    person(session, actor.household_id, person_id)
    rows = list(session.scalars(select(Reference).where(Reference.household_id==actor.household_id,Reference.person_id==person_id).order_by(Reference.id).limit(1001)))
    if len(rows)>1000: error('resource_limit', 'Too many attachments for one person.', 413)
    return [{**{k:getattr(r,k) for k in ['id','asset_id','person_id','story_id','role']}, 'asset':dto(scoped(session, Asset, actor.household_id, r.asset_id))} for r in rows]


def content(session, actor, asset_id):
    authorize(session, actor)
    row = scoped(session, Asset, actor.household_id, asset_id)
    token = secrets.token_hex(32)
    pin(session, row, token, 'read', datetime.now(UTC)+timedelta(minutes=5))
    session.commit()
    try:
        data = storage.read(row.object_key)
        if len(data)!=row.byte_size or storage.checksum(data)!=row.checksum:
            error('media_unavailable', 'Managed content failed integrity verification.')
        return data, row.mime_type
    finally:
        session.execute(delete(Pin).where(Pin.token==token)); session.commit()


def claim_deletion(session, asset_id, now=None, grace_seconds=86400):
    now = now or datetime.now(UTC)
    token = secrets.token_hex(32)
    unreferenced = ~exists(select(Reference.id).where(Reference.asset_id==Asset.id))
    unpinned = ~exists(select(Pin.id).where(Pin.asset_id==Asset.id, Pin.expires_at>now))
    eligible = ((Asset.state=='ready') & (Asset.created_at < now-timedelta(seconds=grace_seconds))) | ((Asset.state=='deleting') & (Asset.claim_expires_at<=now))
    changed = session.execute(update(Asset).where(Asset.id==asset_id, eligible, unreferenced, unpinned).values(state='deleting', claim_token=token, claim_expires_at=now+timedelta(minutes=5))).rowcount
    session.commit()
    return token if changed==1 else None


def finish_deletion(session, asset_id, token):
    row = session.scalar(select(Asset).where(Asset.id==asset_id, Asset.state=='deleting', Asset.claim_token==token))
    if row is None: return False
    storage.unlink(row.object_key)
    session.execute(delete(Pin).where(Pin.asset_id==asset_id))
    result = session.execute(update(Asset).where(Asset.id==asset_id, Asset.state=='deleting', Asset.claim_token==token).values(state='deleted', claim_token=None, claim_expires_at=None)).rowcount
    session.commit()
    return result==1
