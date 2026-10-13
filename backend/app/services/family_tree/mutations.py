"""Single transaction revision claim, bounded receipts and content-free audit.

Receipt TTL defaults to 24 hours; expired keys may start a new command. The
caller must not retry ambiguous writes with a new key. SQLite waits at most the
existing five-second busy timeout; exhausted locks return retryable 503, never
partial success. No request bodies/names/stories are persisted in receipts.
"""
from datetime import UTC,datetime,timedelta
import hashlib
import json
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select, update, delete
from sqlalchemy.exc import IntegrityError,OperationalError
from app.config import get_settings
from app.models.family_tree import FamilyTreeCollection,FamilyTreeMutationReceipt
from app.security.audit import audit
from .access import authorize,collection,person,error

def execute(session,actor,operation,command,action):
    actor=authorize(session,actor,manage=True)
    # A merge alias can never authorize an ordinary addressed command, even
    # when that address has an older successful receipt. Do not redirect writes.
    targets=[]
    prefix,separator,address=operation.partition(':')
    if separator and prefix.startswith(('person.','story.create','story.reorder','residence.create','identity.')):
        targets.append(int(address))
    if hasattr(command,'anchor_person_id'):targets.append(command.anchor_person_id)
    for field in ['parent_person_id','child_person_id','caregiver_person_id','recipient_person_id','person_a_id','person_b_id']:
        value=getattr(command,field,None)
        if value:targets.append(value)
    for pid in targets:
        row=person(session,actor.household_id,pid)
        if row.merged_into_person_id is not None:
            error('person_merged','Open the canonical person before submitting a new command.',canonical_person_id=row.merged_into_person_id)
    now=datetime.now(UTC)
    key=getattr(command,'idempotency_key',None)
    body=command.model_dump(mode='json')
    digest=hashlib.sha256(json.dumps(body,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    key_hash=hashlib.sha256(key.encode()).hexdigest() if key else None
    filters=(FamilyTreeMutationReceipt.household_id==actor.household_id,FamilyTreeMutationReceipt.actor_user_id==actor.id,FamilyTreeMutationReceipt.operation==operation,FamilyTreeMutationReceipt.key_hash==key_hash)
    def replay():
        if key_hash is None: return None
        authorize(session,actor,manage=True)
        receipt=session.scalar(select(FamilyTreeMutationReceipt).where(*filters,FamilyTreeMutationReceipt.expires_at>now))
        if receipt is None: return None
        if receipt.body_digest!=digest: error('idempotency_conflict','This key was used for a different command.')
        c=collection(session,actor.household_id)
        return {**receipt.result,'replayed':True,'current_revision':c.revision}
    try:
        old=replay()
        if old is not None: return old
        expected=command.expected_graph_revision
        c=collection(session,actor.household_id)
        if c is None:
            if expected!=0: error('revision_conflict','Refresh the collection before submitting.')
            c=FamilyTreeCollection(household_id=actor.household_id,revision=1,created_by_user_id=actor.id)
            session.add(c); session.flush()
        else:
            claimed=session.execute(update(FamilyTreeCollection).where(FamilyTreeCollection.id==c.id,FamilyTreeCollection.household_id==actor.household_id,FamilyTreeCollection.revision==expected).values(revision=FamilyTreeCollection.revision+1,updated_at=now)).rowcount
            if claimed!=1:
                # A concurrent exact same-key request may have just committed.
                old=replay()
                if old is not None: return old
                error('revision_conflict','Refresh the collection before submitting.')
            session.refresh(c)
        # Bound retained receipt history by TTL on every successful write.
        session.execute(delete(FamilyTreeMutationReceipt).where(FamilyTreeMutationReceipt.household_id==actor.household_id,FamilyTreeMutationReceipt.expires_at<=now))
        # Recheck authority after the revision claim owns the write lock.
        authorize(session,actor,manage=True)
        affected,warnings=action(c)
        if 'chronology_review' in warnings and 'chronology_review' not in command.reviewed_warnings:
            error('chronology_review','Review the uncertain or overlapping chronology before committing.',422,warnings=['chronology_review'])
        session.flush()
        result={'committed_revision':c.revision,'current_revision':c.revision,'replayed':False,'affected':affected,'warnings':warnings}
        if key_hash:
            session.add(FamilyTreeMutationReceipt(household_id=actor.household_id,collection_id=c.id,actor_user_id=actor.id,operation=operation,key_hash=key_hash,body_digest=digest,result=result,expires_at=now+timedelta(seconds=get_settings().family_tree_receipt_ttl_seconds)))
        audit(session,'family_tree.'+operation.split(':',1)[0],actor=actor,details={'revision':c.revision,'affected':affected,'outcome':'committed'})
        session.flush()
        return result
    except HTTPException:
        session.rollback(); raise
    except (ValidationError,ValueError):
        session.rollback(); error('validation_error','The combined facts are invalid.',422)
    except IntegrityError:
        session.rollback()
        old=replay()
        if old is not None: return old
        error('integrity_conflict','A conflicting record or concurrent command exists.')
    except OperationalError:
        session.rollback(); error('server_busy','The server is busy. Refresh and retry with the same key.',503)
