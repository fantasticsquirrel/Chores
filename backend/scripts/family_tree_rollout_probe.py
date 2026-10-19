"""Linux-only bounded synthetic capacity/protection probe.

Default real-ASGI mode uses an isolated marked SQLite DB/private object store.
Source/reduced modes measure parser/codecs only. Never opens production paths
or inherits private DB/storage/provider configuration. Guards are experiment
ceilings, not production approval. Use the verified backend interpreter.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import gc
import io
import json
import os
from pathlib import Path
import resource
import subprocess
import sys
import threading
import time

MIB = 1024 * 1024
ADDRESS_SPACE_BYTES = 1536 * MIB
TOTAL_RSS_BYTES = 1280 * MIB
WALL_SECONDS = 180
ROOT = Path(__file__).resolve().parents[2]
PROFILES = {'source': (5000,20000,40000,1000,40000,16*MIB,5000),
            'reduced': (500,2000,4000,100,4000,2*MIB,2000)}


def encode(value):
    return json.dumps(value,separators=(',',':')).encode()


def fixture(profile):
    people,facts,records,assets,refs,budget,_ = PROFILES[profile]
    data = {'schema_version':1,'producer':'synthetic-rollout-v1','exported_at':'synthetic',
            'collection_title':'Synthetic','snapshot_revision':0,'media_omitted':False,
            'people':[{'key':f'p:{i}','person':{'display_name':'Synthetic','notes_md':''}} for i in range(people)],
            'care_links':[{'key':f'c:{i}','caregiver_key':f'p:{i%people}','recipient_key':f'p:{(i+1)%people}','kind':'caregiver'} for i in range(facts)],
            'stories':[{'key':f's:{i}','person_key':f'p:{i%people}','story':{'title':'Synthetic','body_md':'x'},'position':i} for i in range(records)],
            'media':[{'key':f'm:{i}','path':f'media/{i:064x}.png','mime_type':'image/png','checksum':f'{i:064x}','byte_size':1} for i in range(assets)],
            'media_references':[{'key':f'r:{i}','asset_key':f'm:{i%assets}','person_key':f'p:{i%people}','story_key':f's:{i}','role':'story'} for i in range(refs)]}
    padding = (budget-len(encode(data)))//people
    if padding < 0:
        raise ValueError('fixture exceeds budget')
    for row in data['people']:
        row['person']['notes_md'] = 'x'*padding
    return data


def child_environment(environment):
    allowed = {k:v for k,v in environment.items() if k in {'PATH','LANG','LC_ALL'}}
    return {**allowed,'APP_ENV':'test','PYTHONPATH':str(ROOT/'backend')}


def rss(pid):
    values = {}
    with open(f'/proc/{pid}/status') as stream:
        for line in stream:
            if line.startswith(('VmRSS:','VmHWM:')):
                key,amount,_ = line.split()
                values[key[:-1]] = int(amount)*1024
    return values


def workload(profile,barrier):
    from PIL import Image
    from fastapi import HTTPException
    from app.services.family_tree import portable, media, storage
    started = time.monotonic()
    data = fixture(profile)
    raw = encode(data)
    del data
    gc.collect()
    barrier.wait(timeout=30)
    manifest = portable.decode(raw)
    assert portable.validate(manifest) == []
    parser_rss = rss(os.getpid())['VmRSS']
    print(json.dumps({'event':'probe_phase','phase':'parser_validated','rss_bytes':parser_rss,'manifest_bytes':len(raw)}),file=sys.stderr,flush=True)
    counts = {key:len(getattr(manifest,key)) for key in ('people','care_links','stories','media','media_references')}
    side = PROFILES[profile][-1]
    images = []
    # Retain the parsed graph during real codec work, as staging does.
    for fmt,mode,mime in [('PNG','RGBA','image/png'),('JPEG','RGB','image/jpeg'),('WEBP','RGBA','image/webp')]:
        image = Image.new(mode,(side,side))
        stream = io.BytesIO()
        image.save(stream,format=fmt)
        image.close()
        incoming = stream.getvalue()
        stream.close()
        clean,out_mime,width,height = media.sanitize(incoming,mime)
        assert out_mime == mime and max(width,height) <= 2048
        images.append({'codec':fmt,'pixels':side*side,'input_bytes':len(incoming),'output_bytes':len(clean)})
        del incoming,clean
        gc.collect()
    # Real encoded-byte and decoded-pixel protection, no oversized allocation.
    rejected = []
    for suffix,value,action in [
        ('IMAGE_MAX_BYTES','1',lambda: media.sanitize(b'xx','image/png')),
        ('IMAGE_MAX_PIXELS','1',lambda: media.sanitize(small_png(),'image/png'))]:
        # Concurrency probes do not mutate process-wide env during workload.
        if barrier.parties == 1:
            os.environ['FAMILY_TREE_'+suffix] = value
            try:
                action()
            except HTTPException as exc:
                assert exc.status_code == 413 and exc.detail['code'] == 'resource_limit'
                rejected.append(suffix)
            finally:
                os.environ.pop('FAMILY_TREE_'+suffix,None)
    return {'counts':counts,'manifest_bytes':len(raw),'images':images,
            'rss_after_parser_bytes':parser_rss,'protection_rejections':rejected,
            'elapsed_seconds':round(time.monotonic()-started,6)}


def small_png():
    from PIL import Image
    image = Image.new('RGB',(2,2))
    stream = io.BytesIO()
    image.save(stream,format='PNG')
    image.close()
    return stream.getvalue()


POLICY = {'MAX_PEOPLE':500,'MAX_FACTS':2000,'MAX_RECORDS':4000,'MAX_MEDIA':100,'MAX_REFERENCES':4000,
          'MANIFEST_MAX_BYTES':2*MIB,'IMAGE_MAX_BYTES':8*MIB,'IMAGE_MAX_PIXELS':16000000,
          'IMPORT_MAX_BYTES':16*MIB,'IMPORT_MAX_EXPANDED_BYTES':32*MIB,
          'HOUSEHOLD_MEDIA_MAX_BYTES':256*MIB,'TRANSFER_WORKERS':1}


def asgi_workload():
    """Real isolated app/auth/SQL/private media; never production fixtures."""
    import tempfile
    import zipfile
    from PIL import Image
    from fastapi.testclient import TestClient
    from sqlalchemy import select, func
    from app.config import get_settings
    from app.db import initialize_database, get_session_factory
    from app.models import Household, User, Module, HouseholdModuleAccess
    from app.models.enums import UserRole
    from app.security import hash_password
    from app.services.modules import ModuleService
    from app.services.family_tree import portable, storage
    from app.models.family_tree import FamilyTreePerson, FamilyTreeStory, FamilyTreeMediaAsset, FamilyTreeMediaReference
    started=time.monotonic()
    os.umask(0o077)
    scratch=Path(os.environ.get('TMPDIR','/root/.hermes/cache/scratch'))
    scratch.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='family-tree-asgi-',dir=scratch) as directory:
        base=Path(directory);(base/'SYNTHETIC_PROBE_ONLY').touch()
        os.environ.update({'FAMILY_TREE_'+key:str(value) for key,value in POLICY.items()})
        os.environ.update(DATABASE_URL='sqlite:///'+str(base/'probe.sqlite'),SECRET_KEY='synthetic-probe-key-not-production',SESSION_COOKIE_SECURE='false',FAMILY_TREE_STORAGE_ROOT=str(base/'private'))
        get_settings.cache_clear();initialize_database(get_settings())
        factory=get_session_factory(get_settings().database_url)
        with factory() as session:
            household=Household(name='Synthetic capacity',owner_user_id=1);session.add(household);session.flush()
            actor=User(household_id=household.id,email='probe@example.test',role=UserRole.PARENT_ADMIN,password_hash=hash_password('synthetic-capacity-password'))
            session.add(actor);session.flush();household.owner_user_id=actor.id
            ModuleService().ensure_catalog(session);session.get(Module,'family-tree').enabled=True
            session.add(HouseholdModuleAccess(household_id=household.id,module_key='family-tree',enabled=True));session.commit()
        from app.main import create_app
        with TestClient(create_app()) as client:
            login=client.post('/chore-api/auth/login',json={'email':'probe@example.test','password':'synthetic-capacity-password'})
            assert login.status_code==200
            client.headers['X-CSRF-Token']=login.json()['csrf_token']
            import logging
            logging.disable(logging.CRITICAL)
            baseline=rss(os.getpid())['VmRSS']
            prefix='/chore-api/family-tree'
            data=fixture('reduced')
            # Normalize before padding: defaults count toward the same byte cap.
            for row in data['people']: row['person']['notes_md']=''
            # All 100 files contain a real 16MP image (same pixel workload,
            # independently sanitized). Mixed trailing bytes exercise ZIP bytes.
            image=Image.new('RGBA',(4000,4000),(45,67,89,180));stream=io.BytesIO();image.save(stream,format='PNG');image.close()
            pixels=stream.getvalue();stream.close()
            blob=pixels+os.urandom(145000)+b'\0'*((30*MIB)//100-len(pixels)-145000)
            for row in data['media']:
                row.update(byte_size=len(blob),checksum=storage.checksum(blob))
            normalized=portable.encode(portable.decode(encode(data)))
            padding=max(0,(int(1.8*MIB)-len(normalized))//500)
            for row in data['people']: row['person']['notes_md']='x'*padding
            raw=portable.encode(portable.decode(encode(data)));portable.validate(portable.decode(raw))
            archive_path=base/'input.zip'
            with zipfile.ZipFile(archive_path,'w',compression=zipfile.ZIP_DEFLATED) as archive:
                archive.writestr('manifest.json',raw)
                for descriptor in data['media']: archive.writestr(descriptor['path'],blob)
            expanded=len(raw)+100*len(blob)
            assert expanded<=POLICY['IMPORT_MAX_EXPANDED_BYTES']
            assert archive_path.stat().st_size<=POLICY['IMPORT_MAX_BYTES']
            print(json.dumps({'event':'probe_phase','phase':'asgi_ready','rss_bytes':baseline,'manifest_bytes':len(raw)}),file=sys.stderr,flush=True)
            with archive_path.open('rb') as source:
                staged=client.post(prefix+'/imports',data={'expected_graph_revision':'0'},files={'file':('synthetic.zip',source,'application/zip')})
            assert staged.status_code==200,('stage',staged.status_code,staged.text[:200])
            staged_at=time.monotonic()
            committed=client.post(prefix+f'/imports/{staged.json()["id"]}/commit',json={'expected_graph_revision':0,'idempotency_key':'bounded-probe','confirmed':True})
            assert committed.status_code==200,('commit',committed.status_code,committed.text[:200])
            assert client.get(prefix+'/people').json()['total']==500
            counts={}
            with factory() as session:
                for model in (FamilyTreePerson,FamilyTreeStory,FamilyTreeMediaAsset,FamilyTreeMediaReference):
                    counts[model.__name__]=session.scalar(select(func.count()).select_from(model))
                assert list(counts.values())==[500,4000,100,4000]
                objects=list(session.scalars(select(FamilyTreeMediaAsset)))
                for obj in objects:
                    actual=storage.read(obj.object_key)
                    assert len(actual)==obj.byte_size and storage.checksum(actual)==obj.checksum
            exported=client.post(prefix+'/exports',json={'format':'zip'})
            assert exported.status_code==200,('export',exported.status_code,exported.text[:200])
            downloaded=client.get(prefix+f'/exports/{exported.json()["id"]}/download')
            assert downloaded.status_code==200
            with zipfile.ZipFile(io.BytesIO(downloaded.content)) as archive:
                result=portable.decode(archive.read('manifest.json'));portable.validate(result)
                assert [len(result.people),len(result.care_links),len(result.stories),len(result.media),len(result.media_references)]==[500,2000,4000,100,4000]
                for descriptor in result.media:
                    content=archive.read(descriptor.path)
                    assert len(content)==descriptor.byte_size and storage.checksum(content)==descriptor.checksum
            # Real API upload of the other supported 16MP codecs, not only a decoder.
            codecs=[]
            for fmt,mode,mime in [('JPEG','RGB','image/jpeg'),('WEBP','RGBA','image/webp')]:
                image=Image.new(mode,(4000,4000));stream=io.BytesIO();image.save(stream,format=fmt);image.close()
                content=stream.getvalue();stream.close()
                response=client.post(prefix+'/media',files={'file':('synthetic',content,mime)})
                assert response.status_code==200,('upload',fmt,response.status_code)
                actual=client.get(prefix+f'/media/{response.json()["id"]}/content')
                assert actual.status_code==200 and storage.checksum(actual.content)==response.json()['checksum']
                codecs.append({'format':fmt,'pixels':16000000,'input_bytes':len(content),'output_bytes':len(actual.content)})
            return {'baseline_app_rss_bytes':baseline,'manifest_bytes':len(raw),'input_zip_bytes':archive_path.stat().st_size,'expanded_bytes':expanded,
                    'input_media_count':100,'input_pixels_each':16000000,'db_counts':counts,'export_zip_bytes':len(downloaded.content),
                    'codec_uploads':codecs,'staging_seconds':round(staged_at-started,3),'elapsed_seconds':round(time.monotonic()-started,3),
                    'policy':POLICY,'evidence':'SYNTHETIC_REAL_ASGI_SQL_OBJECT_READBACK_NOT_PRODUCTION_DISTRIBUTION'}


def worker(profile,concurrency):
    resource.setrlimit(resource.RLIMIT_AS,(ADDRESS_SPACE_BYTES,ADDRESS_SPACE_BYTES))
    resource.setrlimit(resource.RLIMIT_CPU,(170,170))
    if profile=='asgi':
        import contextlib
        assert concurrency==1
        with contextlib.redirect_stdout(sys.stderr):
            result=asgi_workload()
        print(json.dumps({'profile':profile,'concurrency':1,'workloads':[result],
                         'peak_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024,
                         'approval':'CANDIDATE_EVIDENCE_ONLY_REQUIRES_REVIEW_AND_PRODUCTION_PREFLIGHT'}))
        return
    threading.stack_size(1024*1024)
    # Import once before starting threads; no app.main/startup/database import.
    from app.services.family_tree import portable,media
    baseline = rss(os.getpid())['VmRSS']
    barrier = threading.Barrier(concurrency)
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        results = list(pool.map(lambda _:workload(profile,barrier),range(concurrency)))
    print(json.dumps({'profile':profile,'concurrency':concurrency,'baseline_rss_bytes':baseline,
                     'peak_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024,
                     'workloads':results,'approval':'HOLD_NOT_FULL_API_OR_ARCHIVE_STAGING'}))


class SafeParser(argparse.ArgumentParser):
    def error(self,message):
        raise ValueError('invalid_arguments')


def main(argv=None):
    child = None
    try:
        parser = SafeParser(description=__doc__)
        parser.add_argument('--profile',choices=[*PROFILES,'asgi'],default='asgi')
        parser.add_argument('--concurrency',type=int,choices=(1,2),default=1)
        parser.add_argument('--worker',action='store_true',help=argparse.SUPPRESS)
        args = parser.parse_args(argv)
        if args.worker:
            worker(args.profile,args.concurrency)
            return 0
        if sys.platform != 'linux':
            raise RuntimeError('unsupported_platform')
        # Shared-host preflight; abort rather than compete with low free reserve.
        memory = dict((line.split(':')[0],int(line.split()[1])*1024) for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith(('MemAvailable:','MemTotal:')))
        if memory['MemAvailable'] < 2048*MIB:
            raise RuntimeError('insufficient_host_headroom')
        child = subprocess.Popen([sys.executable,str(Path(__file__).resolve()),'--worker','--profile',args.profile,'--concurrency',str(args.concurrency)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=child_environment(os.environ))
        started = time.monotonic()
        sampled_total_peak = 0
        while child.poll() is None:
            try:
                total = rss(os.getpid())['VmRSS'] + rss(child.pid).get('VmRSS',0)
            except FileNotFoundError:
                total = 0
            sampled_total_peak = max(sampled_total_peak,total)
            if total > TOTAL_RSS_BYTES or time.monotonic()-started > WALL_SECONDS:
                raise RuntimeError('guard_exceeded')
            time.sleep(.05)
        output,diagnostics = child.communicate(timeout=2)
        if child.returncode:
            safe = []
            for line in diagnostics.splitlines():
                try:
                    row = json.loads(line)
                    if row.get('event') == 'probe_phase':
                        safe.append({k:row[k] for k in ('phase','rss_bytes','manifest_bytes') if k in row})
                    elif row.get('event') == 'rollout_probe_failed':
                        safe.append({'exception_type':row.get('exception_type','other')})
                except (ValueError,AttributeError):
                    pass
            print(json.dumps({'event':'rollout_probe_failed','code':'bounded_worker_failed','profile':args.profile,'concurrency':args.concurrency,'child_returncode':child.returncode,'safe_diagnostics':safe,'sampled_parent_child_peak_bytes':sampled_total_peak,'approval':'HOLD'}),file=sys.stderr)
            return 1
        result = json.loads(output)
        result.update({'address_space_ceiling_bytes':ADDRESS_SPACE_BYTES,'parent_child_rss_guard_bytes':TOTAL_RSS_BYTES,'sampled_parent_child_peak_bytes':sampled_total_peak,'wall_ceiling_seconds':WALL_SECONDS})
        print(json.dumps(result,sort_keys=True))
        return 0
    except (Exception,KeyboardInterrupt) as exc:
        if child is not None and child.poll() is None:
            child.kill()
            child.communicate(timeout=5)
        code = str(exc) if isinstance(exc,RuntimeError) else 'invalid_arguments' if isinstance(exc,ValueError) else 'probe_failed'
        print(json.dumps({'event':'rollout_probe_failed','code':code,'exception_type':type(exc).__name__ if type(exc).__name__ in {'MemoryError','ValueError','AssertionError','RuntimeError','HTTPException','BrokenBarrierError'} else 'other','approval':'HOLD'}),file=sys.stderr)
        return 2 if code == 'invalid_arguments' else 1


if __name__ == '__main__':
    sys.exit(main())
