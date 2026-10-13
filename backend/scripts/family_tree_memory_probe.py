"""Disposable Linux reference probe, not production memory-budget approval.

Run with PYTHONPATH=backend using the backend interpreter. One controlled child;
no DB, storage, network or external records. Fixed synthetic input, <=768 MiB
address-space ceiling, 30 s CPU / 90 s wall ceiling. JSON stdout contains counts,
limits and measured RSS only. Full maximum combined imports remain unmeasured.
"""
import io
import json
import os
from pathlib import Path
import platform
import resource
import subprocess
import sys
import time

MIB = 1024*1024
ADDRESS_SPACE_BYTES = 768*MIB
PEOPLE = 5000
NOTE_BYTES = 1024
SIDE = 4096


def rss_bytes():
    # Linux getrusage ru_maxrss is KiB, /proc VmRSS is KiB.
    values={}
    with open('/proc/self/status') as stream:
        for line in stream:
            if line.startswith(('VmRSS:', 'VmHWM:')):
                key, amount, unit = line.split()
                values[key.rstrip(':')]=int(amount)*1024
    return values


def worker():
    resource.setrlimit(resource.RLIMIT_AS,(ADDRESS_SPACE_BYTES,ADDRESS_SPACE_BYTES))
    resource.setrlimit(resource.RLIMIT_CPU,(30,30))
    from fastapi import HTTPException
    from PIL import Image
    from app.services.family_tree import portable, media, storage
    # Deterministic declared source ceilings, unaffected by deployment overrides.
    for suffix in ['IMAGE_MAX_BYTES','IMAGE_MAX_PIXELS','IMPORT_MAX_BYTES','IMPORT_MAX_EXPANDED_BYTES','TRANSFER_SECONDS']:
        os.environ.pop('FAMILY_TREE_'+suffix,None)
    started=time.perf_counter()
    baseline=rss_bytes()
    data={'schema_version':1,'producer':'synthetic-reference','exported_at':'synthetic',
          'collection_title':'synthetic-reference','snapshot_revision':0,'media_omitted':True,
          'people':[{'key':f'p:{index}','person':{'display_name':'Synthetic','notes_md':'x'*NOTE_BYTES}}
                    for index in range(PEOPLE)]}
    encoded=json.dumps(data,separators=(',',':')).encode()
    if len(encoded)>storage.MAX_MANIFEST:
        raise ValueError('Reference exceeded source manifest ceiling')
    parse_start=time.perf_counter()
    manifest=portable.decode(encoded)
    warnings=portable.validate(manifest)
    parse_seconds=time.perf_counter()-parse_start
    parser_rss=rss_bytes()
    # Exercise production count rejection with one extra synthetic row.
    data['people'].append({'key':'overflow','person':{'display_name':'Synthetic'}})
    try:
        portable.decode(json.dumps(data,separators=(',',':')).encode())
    except HTTPException as exc:
        count_rejection=exc.status_code==413 and isinstance(exc.detail,dict) and exc.detail.get('code')=='resource_limit'
    else:
        count_rejection=False
    del data
    # Highly compressible reference; not a worst-case codec/mode benchmark.
    image=Image.new('RGB',(SIDE,SIDE),(17,31,47))
    buffer=io.BytesIO(); image.save(buffer,format='PNG'); image.close()
    image_input=buffer.getvalue(); buffer.close()
    decode_start=time.perf_counter()
    clean,mime,width,height=media.sanitize(image_input,'image/png')
    decode_seconds=time.perf_counter()-decode_start
    result={'fixture':'5000-people-1024-notes-rgb4096-png-v1',
            'platform':platform.platform(),'interpreter':platform.python_version(),
            'process_count':1,'address_space_ceiling_bytes':ADDRESS_SPACE_BYTES,
            'cpu_ceiling_seconds':30,'wall_ceiling_seconds':90,
            'source_limits':{'manifest_bytes':storage.MAX_MANIFEST,'image_bytes':storage.MAX_IMAGE,
                'image_pixels':storage.MAX_PIXELS,'input_bytes':storage.MAX_INPUT,'expanded_bytes':storage.MAX_EXPANDED,
                'transfer_seconds':storage.limit('TRANSFER_SECONDS',120),'people':5000,'relationships':20000,'records':40000,'media':1000},
            'input_counts':{'people':len(manifest.people),'relationships':0,'records':0,'media':0,'images_decoded':1,'notes_bytes_each':NOTE_BYTES},
            'manifest_bytes':len(encoded),'image_input_bytes':len(image_input),'image_pixels':SIDE*SIDE,
            'image_output_bytes':len(clean),'image_output_width':width,'image_output_height':height,
            'parser_seconds':round(parse_seconds,6),'decode_seconds':round(decode_seconds,6),
            'elapsed_seconds':round(time.perf_counter()-started,6),
            'baseline_rss_bytes':baseline['VmRSS'],'baseline_peak_rss_bytes':baseline['VmHWM'],
            'after_parser_rss_bytes':parser_rss['VmRSS'],
            'peak_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024,
            'count_boundary_rejected':count_rejection,'warning_count':len(warnings),
            'production_functions':['portable.decode','portable.validate','media.sanitize'],
            'approval':'REFERENCE_ONLY_OPERATOR_BUDGET_HOLD'}
    if not count_rejection or mime!='image/png' or width>2048 or height>2048:
        raise ValueError('Production reference checks failed')
    print(json.dumps(result,sort_keys=True))


def main():
    if sys.platform!='linux':
        print(json.dumps({'event':'memory_probe_failed','code':'unsupported_platform'}),file=sys.stderr)
        return 2
    try:
        completed=subprocess.run([sys.executable,str(Path(__file__).resolve()),'--worker'],
            capture_output=True,text=True,timeout=90,env={**os.environ,'APP_ENV':'test'})
        if completed.returncode:
            print(json.dumps({'event':'memory_probe_failed','code':'worker_failed','returncode':completed.returncode}),file=sys.stderr)
            return 1
        result=json.loads(completed.stdout)
        print(json.dumps(result,sort_keys=True))
        return 0
    except (Exception,KeyboardInterrupt):
        print(json.dumps({'event':'memory_probe_failed','code':'probe_interrupted'}),file=sys.stderr)
        return 1


if __name__=='__main__':
    if sys.argv[1:]==['--worker']:
        worker()
    elif sys.argv[1:]:
        print(json.dumps({'event':'memory_probe_failed','code':'invalid_arguments'}),file=sys.stderr)
        sys.exit(2)
    else:
        sys.exit(main())
