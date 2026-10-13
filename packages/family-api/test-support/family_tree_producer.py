"""Disposable real HTTP producer examples; no persistent/backend source changes.

Exercise the actual backend application, with isolated SQLite and private
storage under TMPDIR. Record actual HTTP responses, never invented DTO values.
"""
import base64
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'backend'))
from contextlib import contextmanager
import asyncio
from http.cookies import SimpleCookie
from contextlib import nullcontext
from types import SimpleNamespace
from PIL import Image
from app.config import get_settings
from app.db import initialize_database, get_session_factory
from app.main import create_app
from app.models import Household, User, Module, HouseholdModuleAccess
from app.models.enums import UserRole
from app.security import hash_password
from app.services.modules import ModuleService
from app.schemas.family_tree_transfer import Manifest

class AsgiClient:
    """Real in-process ASGI HTTP, with only declared runtime dependencies."""
    def __init__(self, app):
        self.app = app
        self.headers = {}
        self.cookies = {}

    def request(self, method, path, json=None, files=None, data=None):
        headers = {k.lower(): v for k, v in self.headers.items()}
        headers['host'] = 'testserver'
        if self.cookies: headers['cookie'] = '; '.join(f'{k}={v}' for k, v in self.cookies.items())
        body = b''
        if json is not None:
            body = globals()['json'].dumps(json).encode()
            headers['content-type'] = 'application/json'
        elif files is not None:
            boundary = 'ft3-contract-boundary'
            parts = []
            for key, value in (data or {}).items():
                parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
            for key, (filename, value, mime) in files.items():
                parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"; filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'.encode() + value + b'\r\n')
            body = b''.join(parts) + f'--{boundary}--\r\n'.encode()
            headers['content-type'] = f'multipart/form-data; boundary={boundary}'
        headers['content-length'] = str(len(body))

        async def dispatch():
            events = []; delivered = False
            async def receive():
                nonlocal delivered
                if not delivered:
                    delivered = True
                    return {'type': 'http.request', 'body': body, 'more_body': False}
                await asyncio.Event().wait()
            async def send(event): events.append(event)
            scope = {'type': 'http', 'asgi': {'version': '3.0', 'spec_version': '2.4'}, 'http_version': '1.1',
                     'method': method, 'scheme': 'http', 'path': path, 'raw_path': path.encode(), 'query_string': b'',
                     'root_path': '', 'headers': [(k.encode(), v.encode()) for k, v in headers.items()],
                     'client': ('127.0.0.1', 1234), 'server': ('testserver', 80)}
            await self.app(scope, receive, send)
            return events
        events = asyncio.run(dispatch())
        start = next(event for event in events if event['type'] == 'http.response.start')
        response_headers = {}
        for key, value in start['headers']:
            key = key.decode(); value = value.decode(); response_headers[key] = value
            if key.lower() == 'set-cookie':
                cookie = SimpleCookie(); cookie.load(value)
                for name, morsel in cookie.items(): self.cookies[name] = morsel.value
        content = b''.join(event.get('body', b'') for event in events if event['type'] == 'http.response.body')
        return SimpleNamespace(status_code=start['status'], headers=response_headers, content=content,
                               text=content.decode(errors='replace'), json=lambda: globals()['json'].loads(content))

    def get(self, path): return self.request('GET', path)
    def post(self, path, **kwargs): return self.request('POST', path, **kwargs)


BASE = '/chore-api/family-tree'

@contextmanager
def isolated_tree(directory):
    # Environment belongs to this disposable probe subprocess only.
    os.environ.update(APP_ENV='test', DATABASE_URL=f'sqlite:///{directory / "tree.sqlite"}',
                      SECRET_KEY='a' * 32, SESSION_COOKIE_SECURE='false',
                      FAMILY_TREE_STORAGE_ROOT=str(directory / 'private'))
    get_settings.cache_clear()
    initialize_database(get_settings())
    factory = get_session_factory(get_settings().database_url)
    with factory() as session:
        household = Household(name='Contract fixture', owner_user_id=1)
        session.add(household); session.flush()
        users = [User(household_id=household.id, email=f'{role.value.lower()}@example.test', role=role,
                      password_hash=hash_password('password123')) for role in [UserRole.PARENT_ADMIN, UserRole.PARENT]]
        session.add_all(users); session.flush(); household.owner_user_id = users[0].id
        ModuleService().ensure_catalog(session)
        session.get(Module, 'family-tree').enabled = True
        session.add(HouseholdModuleAccess(household_id=household.id, module_key='family-tree', enabled=True))
        session.commit()
    with nullcontext(AsgiClient(create_app())) as client:
        response = client.post('/chore-api/auth/login', json={'email': 'PARENT_ADMIN@example.test', 'password': 'password123'})
        assert response.status_code == 200, response.text
        client.headers['X-CSRF-Token'] = response.json()['csrf_token']
        yield client


def create(client, rev=0, name='Original', key='first', **fields):
    return client.post(BASE + '/people', json={'expected_graph_revision': rev, 'idempotency_key': key, 'person': {'display_name': name, **fields}})


def person_id(response):
    assert response.status_code == 200, response.text
    return response.json()['affected']['person_ids'][0]


def produce():
    records = []
    with tempfile.TemporaryDirectory(prefix='ft3-producer-', dir=os.environ.get('TMPDIR', '/root/.hermes/cache/scratch')) as directory:
        with isolated_tree(Path(directory)) as client:
            def revision():
                response = client.get(BASE + '/')
                assert response.status_code == 200, response.text
                return response.json()['graph_revision']

            def call(name, method, path, args=(), body=None, schema=None, response_model=None, binary=False, files=None, fields=None, expected=200):
                kwargs = {'json': body} if body is not None else {}
                if files is not None: kwargs['files'] = files
                if fields is not None: kwargs['data'] = fields
                response = client.request(method.upper(), BASE + path, **kwargs)
                assert response.status_code == expected, (name, response.status_code, response.text)
                record = {'name': name, 'method': method.upper(), 'path': '/family-tree' + path, 'args': list(args), 'body': body,
                          'schema': schema, 'response_model': response_model, 'status': response.status_code,
                          'headers': {k: v for k, v in response.headers.items() if k in ['content-type', 'content-disposition', 'cache-control']}}
                if files is not None:
                    record['multipart'] = {'fields': fields or {}, 'files': {key: {'filename': value[0], 'base64': base64.b64encode(value[1]).decode(), 'type': value[2]} for key, value in files.items()}}
                if binary:
                    record['binary'] = base64.b64encode(response.content).decode()
                else:
                    record['response'] = response.json()
                records.append(record)
                return response

            p = person_id(create(client, name='Original', birth_date={'value': '1984', 'uncertain': True}, aliases=[{'name': 'Entered alias'}]))
            login = client.post('/chore-api/auth/login', json={'email': 'PARENT@example.test', 'password': 'password123'})
            assert login.status_code == 200; client.headers['X-CSRF-Token'] = login.json()['csrf_token']
            changed = client.request('PATCH', BASE + f'/people/{p}', json={
                'expected_graph_revision': revision(), 'changes': {'aliases': [
                    {'name': 'Entered alias'}, {'name': 'Second contributor alias', 'label': 'Original citation'}]}})
            assert changed.status_code == 200, changed.text
            login = client.post('/chore-api/auth/login', json={'email': 'PARENT_ADMIN@example.test', 'password': 'password123'})
            assert login.status_code == 200; client.headers['X-CSRF-Token'] = login.json()['csrf_token']
            child = person_id(create(client, rev=revision(), name='Child', key='child'))
            source = person_id(create(client, rev=revision(), name='Duplicate', key='source'))
            for path, fields in [('/parent-links', {'parent_person_id': p, 'child_person_id': child, 'kind': 'adoptive'}),
                                 ('/care-links', {'caregiver_person_id': p, 'recipient_person_id': child, 'kind': 'guardian', 'start_date': {'value': '2000'}}),
                                 ('/partner-episodes', {'person_a_id': p, 'person_b_id': child, 'kind': 'partners', 'status': 'ended'})]:
                response = client.post(BASE + path, json={'expected_graph_revision': revision(), **fields})
                assert response.status_code == 200, response.text
            response = client.post(BASE + f'/people/{p}/stories', json={'expected_graph_revision': revision(), 'idempotency_key': 'story', 'story': {'title': 'Retained story', 'body_md': '**History**', 'date': {'value': '2000'}}})
            assert response.status_code == 200, response.text
            story = response.json()['affected']['story_ids'][0]
            response = client.post(BASE + f'/people/{p}/residences', json={'expected_graph_revision': revision(), 'residence': {'place': 'Entered place', 'is_primary': True}})
            assert response.status_code == 200, response.text
            image = io.BytesIO(); Image.new('RGB', (16, 16), 'red').save(image, format='PNG')
            asset = call('uploadFamilyTreeMedia', 'post', '/media', response_model='MediaDTO', files={'file': ('photo.png', image.getvalue(), 'image/png')}, fields={'caption': 'Original caption'}).json()['id']
            attach_body = {'expected_graph_revision': revision(), 'person_id': p, 'story_id': story, 'role': 'story', 'idempotency_key': 'attach'}
            call('attachFamilyTreeMedia', 'post', f'/media/{asset}/attach', (asset,), attach_body, 'AttachMedia', 'MutationResult')
            references = call('listFamilyTreeMediaReferences', 'get', f'/people/{p}/media', (p,), response_model='MediaReferenceDTO[]').json()
            call('getFamilyTreeMediaContent', 'get', f'/media/{asset}/content', (asset,), binary=True)
            call('removeFamilyTreeMediaReference', 'delete', f'/media/{asset}/references/{references[0]["id"]}', (asset, references[0]['id']), {'expected_graph_revision': revision()}, 'Command', 'MutationResult')
            # Restore attachment so both JSON and ZIP snapshots exercise portable media.
            call('attachFamilyTreeMedia', 'post', f'/media/{asset}/attach', (asset,), {'expected_graph_revision': revision(), 'person_id': p, 'role': 'primary'}, 'AttachMedia', 'MutationResult')
            exports = []
            for format in ['json', 'zip']:
                job = call('createFamilyTreeExport', 'post', '/exports', body={'format': format}, schema='ExportRequest', response_model='JobDTO').json()
                call('getFamilyTreeExportJob', 'get', f'/exports/{job["id"]}', (job['id'],), response_model='JobDTO')
                data = call('downloadFamilyTreeExport', 'get', f'/exports/{job["id"]}/download', (job['id'],), binary=True).content
                exports.append(data)
            manifest = Manifest.model_validate_json(exports[0]).model_dump(mode='json')
            with zipfile.ZipFile(io.BytesIO(exports[1])) as archive:
                original_aliases = json.loads(archive.read('manifest.json'))['people'][0]['person']['aliases']
            assert len({a['provenance']['attribution'] for a in original_aliases}) == 2
            def exported_aliases(pid):
                job = client.post(BASE + '/exports', json={'format': 'json'})
                assert job.status_code == 200, job.text
                data = client.get(BASE + f'/exports/{job.json()["id"]}/download')
                assert data.status_code == 200, data.text
                return next(p['person']['aliases'] for p in data.json()['people'] if p['key'] == f'p:{pid}')
            imp = call('stageFamilyTreeImport', 'post', '/imports', response_model='JobDTO', files={'file': ('tree.zip', exports[1], 'application/zip')}, fields={'expected_graph_revision': str(revision())}).json()
            call('getFamilyTreeImportJob', 'get', f'/imports/{imp["id"]}', (imp['id'],), response_model='JobDTO')
            # Same-household alternate actor cannot use the creator's job.
            login = client.post('/chore-api/auth/login', json={'email': 'PARENT@example.test', 'password': 'password123'})
            assert login.status_code == 200; client.headers['X-CSRF-Token'] = login.json()['csrf_token']
            call('getFamilyTreeImportJob', 'get', f'/imports/{imp["id"]}', (imp['id'],), expected=404)
            login = client.post('/chore-api/auth/login', json={'email': 'PARENT_ADMIN@example.test', 'password': 'password123'})
            assert login.status_code == 200; client.headers['X-CSRF-Token'] = login.json()['csrf_token']
            commit = {'expected_graph_revision': revision(), 'idempotency_key': 'append', 'confirmed': True}
            call('commitFamilyTreeImport', 'post', f'/imports/{imp["id"]}/commit', (imp['id'],), {**commit, 'confirmed': False}, 'ImportCommit', expected=422)
            result = call('commitFamilyTreeImport', 'post', f'/imports/{imp["id"]}/commit', (imp['id'],), commit, 'ImportCommit', 'MutationResult').json()
            retry = call('commitFamilyTreeImport', 'post', f'/imports/{imp["id"]}/commit', (imp['id'],), commit, 'ImportCommit', 'MutationResult').json()
            assert retry['replayed'] is True and retry['committed_revision'] == result['committed_revision']
            imported = result['affected']['person_ids'][0]
            imported_detail = client.get(BASE + f'/people/{imported}').json()
            assert imported_detail['identity_link'] is None
            assert {a['created_by_user_id'] for a in imported_detail['person']['aliases']} == {imported_detail['person']['created_by_user_id']}
            imported_aliases = exported_aliases(imported)
            assert imported_aliases == original_aliases
            source = imported  # Exercise imported alias history in the actual merge.
            call('getFamilyTreeImportJob', 'get', f'/imports/{imp["id"]}', (imp['id'],), response_model='JobDTO')
            duplicate = call('stageFamilyTreeImport', 'post', '/imports', response_model='JobDTO', files={'file': ('tree.zip', exports[1], 'application/zip')}, fields={'expected_graph_revision': str(revision())}).json()
            assert duplicate['summary']['duplicate_provenance'] is True
            dup_body = {'expected_graph_revision': revision(), 'idempotency_key': 'duplicate-append', 'confirmed': True}
            call('commitFamilyTreeImport', 'post', f'/imports/{duplicate["id"]}/commit', (duplicate['id'],), dup_body, 'ImportCommit', expected=409)
            call('commitFamilyTreeImport', 'post', f'/imports/{duplicate["id"]}/commit', (duplicate['id'],), {**dup_body, 'acknowledge_duplicate_provenance': True}, 'ImportCommit', 'MutationResult')
            canceled = call('stageFamilyTreeImport', 'post', '/imports', response_model='JobDTO', files={'file': ('tree.json', exports[0], 'application/json')}, fields={'expected_graph_revision': str(revision())}).json()
            call('cancelFamilyTreeImport', 'delete', f'/imports/{canceled["id"]}', (canceled['id'],), response_model='JobDTO')
            call('getFamilyTreeImportJob', 'get', f'/imports/{canceled["id"]}', (canceled['id'],), expected=409)
            merge_body = {'expected_graph_revision': revision(), 'source_person_id': source, 'target_person_id': p, 'scalar_choices': {'display_name': 'target'}}
            preview = call('previewFamilyTreeMerge', 'post', '/merge-preview', body=merge_body, schema='MergePreview', response_model='PreviewDTO').json()
            merge_commit = {'expected_graph_revision': revision(), 'idempotency_key': 'merge', 'preview_token': preview['preview_token']}
            call('commitFamilyTreeMerge', 'post', '/merge', body=merge_commit, schema='PreviewCommit', response_model='MutationResult')
            assert client.get(BASE + f'/people/{source}').json()['person']['merged_into_person_id'] == p
            call('previewFamilyTreePurge', 'post', f'/people/{p}/purge-preview', (p,), {'expected_graph_revision': revision(), 'password': 'password123'}, 'PurgePreview', expected=409)
            purge_body = {'expected_graph_revision': revision(), 'password': 'password123'}
            preview = call('previewFamilyTreePurge', 'post', f'/people/{source}/purge-preview', (source,), purge_body, 'PurgePreview', 'PreviewDTO').json()
            purge_commit = {**purge_body, 'preview_token': preview['preview_token'], 'idempotency_key': 'purge'}
            call('commitFamilyTreePurge', 'post', f'/people/{source}/purge', (source,), {**purge_commit, 'password': 'wrong-password'}, 'PurgeCommit', expected=403)
            call('commitFamilyTreePurge', 'post', f'/people/{source}/purge', (source,), purge_commit, 'PurgeCommit', 'MutationResult')
            assert client.get(BASE + f'/people/{source}').status_code == 404
            # No response/summary contains internal token, artifact or storage authority.
            for record in records:
                if record.get('response_model') == 'JobDTO':
                    assert set(record['response']) == {'id', 'kind', 'state', 'expected_graph_revision', 'expires_at', 'summary'}
            merged_aliases = [a for a in exported_aliases(p) if a in original_aliases]
            assert merged_aliases == original_aliases
            return {'records': records, 'manifest': manifest, 'alias_history': {
                'original': original_aliases, 'imported': imported_aliases, 'merged': merged_aliases}}

if __name__ == '__main__':
    print(json.dumps(produce()))
