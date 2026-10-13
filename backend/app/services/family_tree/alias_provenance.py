"""Per-entry portable history stays separate from local immutable attribution."""
import secrets
from sqlalchemy import select
from app.models.family_tree import FamilyTreeOtherName as Name
from app.schemas.family_tree import PersonCreate
from app.schemas.family_tree_transfer import AliasProvenance


def local_marker():
    """Private durable origin evidence; never accepted in ordinary Alias DTOs."""
    return {'origin': 'local'}


def entries(session, person):
    return list(session.scalars(select(Name).where(
        Name.household_id == person.household_id,
        Name.collection_id == person.collection_id,
        Name.person_id == person.id).order_by(Name.position, Name.id)))


def export_aliases(session, person, contributors):
    result = []
    for row in entries(session, person):
        if row.portable_provenance is not None and row.portable_provenance != local_marker():
            history = AliasProvenance.model_validate(row.portable_provenance)
        else:
            # NULL legacy local entries and explicit new local markers derive
            # attribution from immutable operational fields, not quoted history.
            # A fresh opaque snapshot label identifies distinct contributors;
            # it contains no account ID, account name, email, or reconnect key.
            contributor = row.created_by_user_id
            if contributor is not None and contributor not in contributors:
                contributors[contributor] = 'Contributor ' + secrets.token_hex(16)
            history = AliasProvenance(
                status='known' if contributor is not None else 'unknown',
                created_at=row.created_at.isoformat(),
                attribution=contributors.get(contributor))
        result.append({'name': row.name, 'label': row.label,
                       'provenance': history.model_dump(mode='json')})
    return result


def local_person(data):
    """Only ordinary caller facts enter local account-attributed creation."""
    values = data.model_dump(mode='json')
    values['aliases'] = [{'name': a.name, 'label': a.label} for a in data.aliases]
    return PersonCreate.model_validate(values)


def retain_import(session, person, data):
    session.flush()
    rows = entries(session, person)
    # Index-based one-to-one mapping preserves even identical name/label rows.
    if len(rows) != len(data.aliases):
        raise ValueError('Imported alias inventory does not match local entries.')
    for row, original in zip(rows, data.aliases, strict=True):
        if (row.name, row.label) != (original.name, original.label):
            raise ValueError('Imported alias order does not match local entries.')
        row.portable_provenance = original.provenance.model_dump(mode='json')
