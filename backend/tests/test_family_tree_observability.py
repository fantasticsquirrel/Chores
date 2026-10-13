"""Content-free domain signals, actual HTTP and operator failure contracts."""
import asyncio
from datetime import UTC, datetime, timedelta
import json
import logging
import os
from pathlib import Path
import subprocess
import sys
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services.family_tree import access, jobs
from app.security import family_tree_limits as limits
from test_family_tree_api import BASE, create, person_id, tree

PRIVATE = 'PRIVATE_NAME_story_1899_photo_password_bundle_/secret/path'
ROOT = Path(__file__).resolve().parents[2]
LOGGER = 'app.services.family_tree.observability'


def events(caplog):
    return [json.loads(r.getMessage()) for r in caplog.records if r.name == LOGGER]


def assert_private_absent(caplog):
    for record in caplog.records:
        if record.name == LOGGER:
            assert PRIVATE not in str(record.__dict__)
            assert record.exc_info is None and record.stack_info is None


@pytest.mark.parametrize('code,status', [('revision_conflict',409),('relationship_cycle',409),('resource_limit',413),('validation_error',422),('transfer_expired',409)])
def test_domain_rejection_is_observable_without_exception_text(code, status, caplog):
    caplog.set_level(logging.INFO)
    with pytest.raises(HTTPException) as caught:
        access.error(code, PRIVATE, status)
    assert caught.value.status_code == status
    assert any(e['event'] == 'domain_rejected' and e['code'] == code for e in events(caplog))
    assert_private_absent(caplog)


def test_cli_real_rehearsal_failure_is_classified_nonzero_no_traceback(tmp_path):
    command = [sys.executable, str(ROOT/'backend/scripts/family_tree_ops.py'), 'rehearse', '--backup', str(tmp_path/PRIVATE), '--destination', str(tmp_path/'target'), '--scratch-root', str(tmp_path)]
    result = subprocess.run(command, capture_output=True, text=True, env={**os.environ,'PYTHONPATH':str(ROOT/'backend'),'APP_ENV':'test'})
    assert result.returncode != 0
    assert 'Traceback' not in result.stderr
    assert PRIVATE not in result.stdout + result.stderr
    output = json.loads(result.stderr.strip().splitlines()[-1])
    assert output['event'] == 'operator_failed' and output['operation'] == 'rehearse'
    assert output['code'] == 'io_error' and output['exception_type'] == 'FileNotFoundError'
    assert result.stdout == ''


def test_api_revision_cycle_graph_truncation_and_safe_correlation(tree, caplog):
    caplog.set_level(logging.INFO)
    client, _, ids = tree
    request_id = str(uuid4())
    client.headers['X-Request-ID'] = request_id
    a = person_id(create(client,name=PRIVATE,notes_md=PRIVATE))
    result = client.post(BASE+'/relatives', json={'expected_graph_revision':1,'idempotency_key':'relative','anchor_person_id':a,'relationship':{'direction':'child','kind':'adoptive'},'person':{'display_name':PRIVATE}})
    assert result.status_code == 200
    b = next(p for p in result.json()['affected']['person_ids'] if p != a)
    assert client.patch(BASE+f'/people/{a}',json={'expected_graph_revision':0,'changes':{'notes_md':PRIVATE}}).status_code == 409
    assert client.post(BASE+'/parent-links',json={'expected_graph_revision':2,'parent_person_id':b,'child_person_id':a,'kind':'step'}).status_code == 409
    third=client.post(BASE+'/relatives', json={'expected_graph_revision':2,'idempotency_key':'third','anchor_person_id':a,'relationship':{'direction':'child','kind':'adoptive'},'person':{'display_name':PRIVATE}})
    assert third.status_code == 200
    response = client.get(BASE+'/graph', params={'focus_person_id':a,'max_nodes':2})
    assert response.status_code == 200 and response.json()['truncated']
    emitted = events(caplog)
    assert {'revision_conflict','relationship_cycle'} <= {e.get('code') for e in emitted}
    assert any(e['event']=='graph_truncated' and e['node_count']==2 and e['household_id']==ids['household'] for e in emitted)
    assert all(e.get('request_id') == request_id for e in emitted)
    assert_private_absent(caplog)


def test_admission_and_byte_limit_emit_safe_codes(caplog):
    caplog.set_level(logging.INFO)
    async def app(scope, receive, send):
        raise AssertionError('Rejected request must not reach app')
    middleware = limits.FamilyTreeBodyLimitMiddleware(app)
    async def run(headers):
        output=[]
        async def send(event): output.append(event)
        async def receive(): return {'type':'http.request','body':PRIVATE.encode()}
        await middleware({'type':'http','path':BASE+'/imports','headers':headers},receive,send)
        return output
    assert limits._TRANSFER_WORKERS.acquire(False)
    assert limits._TRANSFER_WORKERS.acquire(False)
    try:
        response=asyncio.run(run([(b'x-request-id',PRIVATE.encode())]))
        assert response[0]['status']==503
    finally:
        limits._TRANSFER_WORKERS.release(); limits._TRANSFER_WORKERS.release()
    response=asyncio.run(run([(b'content-length',b'999999999'),(b'x-request-id',PRIVATE.encode())]))
    assert response[0]['status']==413
    emitted=events(caplog)
    assert any(e['event']=='admission_rejected' and e['code']=='server_busy' for e in emitted)
    assert any(e['event']=='quota_rejected' and e['code']=='resource_limit' for e in emitted)
    assert all('request_id' not in e for e in emitted)
    assert_private_absent(caplog)


def test_job_warning_and_expiry_signals_are_finite_and_content_free(tree, caplog):
    caplog.set_level(logging.INFO)
    _, factory, ids = tree
    from app.models import User
    with factory() as session:
        actor=session.get(User,ids['owner'])
        job=jobs.create(session,actor,'import',0,{'manifest':PRIVATE}, {'warnings':['chronology_review',PRIVATE], 'duplicate_suggestions':[PRIVATE]},seconds=-1)
        session.commit()
        with pytest.raises(HTTPException): jobs.get(session,actor,'import',job_id=job.id)
    emitted=events(caplog)
    assert any(e['event']=='validation_warning' and e['code']=='chronology_review' for e in emitted)
    assert any(e['event']=='staging_expired' and e['job_id']==job.id for e in emitted)
    assert_private_absent(caplog)


def test_cleanup_and_backup_service_failures_are_observable(tmp_path, monkeypatch, caplog):
    caplog.set_level(logging.INFO)
    from app.services.family_tree import cleanup, recovery, storage
    def fail(*args, **kwargs): raise OSError(PRIVATE)
    monkeypatch.setattr(storage,'lock',fail)
    with pytest.raises(OSError): cleanup.cleanup(lambda: None)
    database=tmp_path/'fixture.sqlite'; database.touch()
    with pytest.raises(OSError): recovery.backup(database,tmp_path/'backup',lambda: None)
    emitted=events(caplog)
    assert any(e['event']=='cleanup_failed' and e['code']=='io_error' for e in emitted)
    assert any(e['event']=='backup_failed' and e['code']=='io_error' for e in emitted)
    assert_private_absent(caplog)


def test_event_schema_drops_untrusted_strings_and_preserves_context(caplog):
    caplog.set_level(logging.INFO)
    from app.services.family_tree.observability import emit, correlation
    request_id=str(uuid4())
    with correlation(request_id):
        emit('graph_truncated', operation='graph', household_id=1, node_count=2, password=PRIVATE, code=PRIVATE, exception_type=PRIVATE, job_id=PRIVATE)
    event=events(caplog)[-1]
    assert event == {'event':'graph_truncated','operation':'graph','household_id':1,'node_count':2,'request_id':request_id}
    emit('graph_truncated', request_id=PRIVATE)
    assert 'request_id' not in events(caplog)[-1]
    assert_private_absent(caplog)


@pytest.mark.parametrize('arguments', [[], ['rehearse','--backup',PRIVATE,'--destination',PRIVATE,'--scratch-root',PRIVATE], ['--database',PRIVATE,'cleanup'], ['cleanup','--batch-size',PRIVATE], [PRIVATE]])
def test_cli_argument_failures_never_echo_private_arguments(arguments):
    result=subprocess.run([sys.executable,str(ROOT/'backend/scripts/family_tree_ops.py'),*arguments],capture_output=True,text=True,env={**os.environ,'PYTHONPATH':str(ROOT/'backend'),'APP_ENV':'test'})
    assert result.returncode != 0
    assert PRIVATE not in result.stdout+result.stderr
    assert 'Traceback' not in result.stderr
    assert json.loads(result.stderr.strip().splitlines()[-1])['event']=='operator_failed'


def test_real_import_http_failure_emits_staging_event(tree,tmp_path,monkeypatch,caplog):
    caplog.set_level(logging.INFO)
    monkeypatch.setenv('FAMILY_TREE_STORAGE_ROOT',str(tmp_path/'store'))
    client,_,_=tree
    response=client.post(BASE+'/imports',data={'expected_graph_revision':'0'},files={'file':('private.json',PRIVATE.encode(),'application/json')})
    assert response.status_code==422
    assert any(e['event']=='staging_failed' and e['operation']=='import' and e['code']=='validation_error' for e in events(caplog))
    assert_private_absent(caplog)


def test_correlation_concurrent_context_and_reset():
    from app.services.family_tree.observability import correlation, emit
    async def run(request_id):
        with correlation(request_id):
            await asyncio.sleep(0)
            return emit('graph_truncated')
    async def gather():
        a,b=str(uuid4()),str(uuid4())
        result=await asyncio.gather(run(a),run(b))
        assert all(e is not None for e in result)
        assert [e['request_id'] for e in result if e is not None]==[a,b]
        outside=emit('graph_truncated')
        assert outside is not None and 'request_id' not in outside
    asyncio.run(gather())


def test_successful_graph_warning_and_compare_truncation(tree,caplog):
    caplog.set_level(logging.INFO)
    client,factory,ids=tree
    a=person_id(create(client,name=PRIVATE))
    b=person_id(create(client,1,PRIVATE,'b'))
    c=person_id(create(client,2,PRIVATE,'c'))
    from app.models.family_tree import FamilyTreeParentLink
    with factory() as session:
        for source,target in [(a,b),(b,c),(c,a)]:
            session.add(FamilyTreeParentLink(household_id=ids['household'],collection_id=1,created_by_user_id=ids['owner'],parent_person_id=source,child_person_id=target,kind='unknown',facts={}))
        session.commit()
    response=client.get(BASE+'/graph',params={'focus_person_id':a})
    assert response.status_code==200 and 'stored_ancestry_cycle' in response.json()['warnings']
    response=client.get(BASE+'/compare',params={'person_a_id':a,'person_b_id':c,'max_edges':1})
    assert response.status_code==200 and response.json()['state']=='truncated'
    assert any(e['event']=='validation_warning' and e['code']=='stored_ancestry_cycle' for e in events(caplog))
    assert any(e['event']=='validation_warning' and e['code']=='bounded_search' for e in events(caplog))
    assert_private_absent(caplog)


def test_cli_success_backup_rehearsal_and_cleanup_readback(tree,tmp_path,monkeypatch):
    client,factory,ids=tree
    person_id(create(client,name=PRIVATE,notes_md=PRIVATE))
    store=tmp_path/'store'
    monkeypatch.setenv('FAMILY_TREE_STORAGE_ROOT',str(store))
    database=Path(factory.kw['bind'].url.database)
    backup=tmp_path/'backup'; restore=tmp_path/'restore'
    def run(arguments):
        result=subprocess.run([sys.executable,str(ROOT/'backend/scripts/family_tree_ops.py'),*arguments],capture_output=True,text=True,env={**os.environ,'PYTHONPATH':str(ROOT/'backend'),'APP_ENV':'test'})
        assert result.returncode==0
        assert PRIVATE not in result.stdout+result.stderr and 'Traceback' not in result.stderr
        assert json.loads(result.stderr.strip().splitlines()[-1])['event']=='operator_completed'
        return json.loads(result.stdout)
    output=run(['--database',str(database),'backup','--destination',str(backup)])
    manifest=json.loads((backup/'manifest.json').read_text())
    assert output['snapshot_id']==manifest['snapshot_id']
    output=run(['rehearse','--backup',str(backup),'--destination',str(restore),'--scratch-root',str(tmp_path)])
    import sqlite3
    with sqlite3.connect(restore/'database.sqlite') as db:
        assert db.execute('PRAGMA integrity_check').fetchone()==('ok',)
        assert db.execute('SELECT COUNT(*) FROM family_tree_people').fetchone()[0]==output['counts']['family_tree_people']==1
        assert db.execute('SELECT COUNT(*) FROM households').fetchone()[0]==output['counts']['households']==2
    output=run(['--database',str(database),'cleanup'])
    assert output=={'expired_jobs':0,'deleted_assets':0,'orphan_files':0,'expired_pins':0}


def test_middleware_raw_staging_failure_never_logs_exception_text(caplog):
    caplog.set_level(logging.INFO)
    async def fail(scope,receive,send): raise OSError(PRIVATE)
    async def run():
        async def receive(): return {'type':'http.request','body':PRIVATE.encode()}
        async def send(event): pass
        with pytest.raises(OSError):
            await limits.FamilyTreeBodyLimitMiddleware(fail)({'type':'http','path':BASE+'/imports','method':'POST','headers':[]},receive,send)
    asyncio.run(run())
    assert any(e['event']=='staging_failed' and e['code']=='io_error' and e['exception_type']=='OSError' for e in events(caplog))
    assert_private_absent(caplog)


def test_pending_job_quota_is_one_counted_safe_event(tree,caplog):
    caplog.set_level(logging.INFO)
    _,factory,ids=tree
    from app.models import User
    with factory() as session:
        actor=session.get(User,ids['owner'])
        for _ in range(20): jobs.create(session,actor,'import',0,{'manifest':PRIVATE},{})
        session.commit()
        with pytest.raises(HTTPException) as failure:
            jobs.create(session,actor,'import',0,{'manifest':PRIVATE},{})
        assert failure.value.status_code==413
    quota=[e for e in events(caplog) if e['event']=='quota_rejected']
    assert len(quota)==1
    assert quota[0]['count']==quota[0]['limit']==20
    assert quota[0]['household_id']==ids['household']
    assert_private_absent(caplog)


def test_scope_correlation_is_read_only_and_not_header_content(caplog):
    caplog.set_level(logging.INFO)
    request_id=str(uuid4())
    scope={'type':'http','path':BASE+'/imports','method':'POST','state':{'request_id':request_id},'headers':[(b'x-request-id',PRIVATE.encode()),(b'content-length',b'999999999')]}
    original=dict(scope['state'])
    async def run():
        async def app(*args): raise AssertionError('Must reject')
        async def receive(): return {'type':'http.request','body':b''}
        async def send(event): pass
        await limits.FamilyTreeBodyLimitMiddleware(app)(scope,receive,send)
    asyncio.run(run())
    assert scope['state']==original
    assert all(e['request_id']==request_id for e in events(caplog))
    assert_private_absent(caplog)
