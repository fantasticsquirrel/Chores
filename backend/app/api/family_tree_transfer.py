"""FT-3 routes mounted on the existing adult/module guarded router."""
from typing import Annotated
from functools import wraps
import inspect
from sqlalchemy.exc import IntegrityError, OperationalError
from fastapi import File, Form, UploadFile
from fastapi.responses import Response, StreamingResponse
from starlette.concurrency import run_in_threadpool
from app.api.family_tree import router, View, Manage, DB, ReadDB, PositivePath, commit
from app.schemas import family_tree as dto
from app.schemas import family_tree_transfer as transfer_dto
from app.services.family_tree import media, merge, purge, transfer, jobs, storage
from app.services.family_tree.mutations import execute
from app.services.family_tree.access import error


def guard_db(fn):
    def failed(session,exception):
        session.rollback()
        if isinstance(exception,OperationalError): error('server_busy','The server is busy. Retry with the same key.',503)
        error('integrity_conflict','A conflicting record or concurrent command exists.')
    if inspect.iscoroutinefunction(fn):
        @wraps(fn)
        async def guarded_async(*args,**kwargs):
            try: return await fn(*args,**kwargs)
            except (IntegrityError,OperationalError) as exc: failed(kwargs['session'],exc)
        return guarded_async
    @wraps(fn)
    def guarded(*args,**kwargs):
        try: return fn(*args,**kwargs)
        except (IntegrityError,OperationalError) as exc: failed(kwargs['session'],exc)
    return guarded


@router.post('/media', response_model=transfer_dto.MediaDTO)
@guard_db
async def upload_media(user:Manage,session:DB,file:Annotated[UploadFile,File()],caption:Annotated[str|None,Form(max_length=1000)]=None):
    from app.services.family_tree.access import authorize
    authorize(session,user,manage=True)
    key=await storage.stage_upload(file,storage.limit('IMAGE_MAX_BYTES',storage.MAX_IMAGE))
    def process():
        try:
            with storage.lock():
                result=media.upload(session,user,storage.read(key,'staging'),file.content_type,caption)
                return commit(session,result)
        finally: storage.unlink(key,'staging')
    return await run_in_threadpool(process)

@router.get('/media/{asset_id}/content')
@guard_db
def media_content(asset_id:PositivePath,user:View,session:DB):
    with storage.lock(): data,mime=media.content(session,user,asset_id)
    return Response(data,media_type=mime,headers={'Cache-Control':'private, no-store','Content-Disposition':'inline; filename="image"','X-Content-Type-Options':'nosniff'})

@router.get('/people/{person_id}/media',response_model=list[transfer_dto.MediaReferenceDTO])
@guard_db
def media_references(person_id:PositivePath,user:View,session:ReadDB):
    return media.references(session,user,person_id)

@router.post('/media/{asset_id}/attach',response_model=dto.MutationResult)
@guard_db
def attach_media(asset_id:PositivePath,body:transfer_dto.AttachMedia,user:Manage,session:DB):
    return commit(session,execute(session,user,f'media.attach:{asset_id}',body,lambda c:media.attach(session,user,c,asset_id,body)))

@router.delete('/media/{asset_id}/references/{reference_id}',response_model=dto.MutationResult)
@guard_db
def detach_media(asset_id:PositivePath,reference_id:PositivePath,body:dto.Command,user:Manage,session:DB):
    return commit(session,execute(session,user,f'media.detach:{asset_id}:{reference_id}',body,lambda c:media.detach(session,user,c,asset_id,reference_id)))

@router.post('/merge-preview',response_model=transfer_dto.PreviewDTO)
@guard_db
def merge_preview(body:transfer_dto.MergePreview,user:Manage,session:DB):
    return commit(session,merge.preview(session,user,body))

@router.post('/merge',response_model=dto.MutationResult)
@guard_db
def merge_commit(body:transfer_dto.PreviewCommit,user:Manage,session:DB):
    return commit(session,execute(session,user,'merge',body,lambda c:merge.commit(session,user,c,body)))

@router.post('/people/{person_id}/purge-preview',response_model=transfer_dto.PreviewDTO)
@guard_db
def purge_preview(person_id:PositivePath,body:transfer_dto.PurgePreview,user:Manage,session:DB):
    return commit(session,purge.preview(session,user,person_id,body))

@router.post('/people/{person_id}/purge',response_model=dto.MutationResult)
@guard_db
def purge_commit(person_id:PositivePath,body:transfer_dto.PurgeCommit,user:Manage,session:DB):
    purge.owner(session,user,body.password)
    return commit(session,execute(session,user,f'purge:{person_id}',body,lambda c:purge.commit(session,user,c,person_id,body)))

@router.post('/exports',response_model=transfer_dto.JobDTO)
@guard_db
def export_create(body:transfer_dto.ExportRequest,user:Manage,session:DB):
    return transfer.export(session,user,body)

@router.get('/exports/{job_id}',response_model=transfer_dto.JobDTO)
@guard_db
def export_job(job_id:PositivePath,user:Manage,session:DB):
    return jobs.dto(jobs.get(session,user,'export',job_id=job_id))

@router.get('/exports/{job_id}/download')
@guard_db
def export_download(job_id:PositivePath,user:Manage,session:DB):
    stream,format=transfer.download(session,user,job_id)
    def chunks():
        try:
            while data:=stream.read(64*1024): yield data
        finally: stream.close()
    return StreamingResponse(chunks(),media_type='application/zip' if format=='zip' else 'application/json',headers={'Cache-Control':'private, no-store','Content-Disposition':f'attachment; filename="family-tree.{format}"','X-Content-Type-Options':'nosniff'})

@router.post('/imports',response_model=transfer_dto.JobDTO)
@guard_db
async def import_stage(user:Manage,session:DB,file:Annotated[UploadFile,File()],expected_graph_revision:Annotated[int,Form(ge=0)]):
    from app.services.family_tree.access import authorize
    authorize(session,user,manage=True)
    key=await storage.stage_upload(file,storage.limit('IMPORT_MAX_BYTES',storage.MAX_INPUT))
    def process():
        with storage.lock(): return transfer.stage_import(session,user,key,expected_graph_revision)
    return await run_in_threadpool(process)

@router.get('/imports/{job_id}',response_model=transfer_dto.JobDTO)
@guard_db
def import_job(job_id:PositivePath,user:Manage,session:DB):
    return jobs.dto(jobs.get(session,user,'import',job_id=job_id,allow_committed=True))

@router.post('/imports/{job_id}/commit',response_model=dto.MutationResult)
@guard_db
def import_commit(job_id:PositivePath,body:transfer_dto.ImportCommit,user:Manage,session:DB):
    with storage.lock():
        prepared=transfer.prepare_import(session,user,job_id)
        return commit(session,execute(session,user,f'import:{job_id}',body,lambda c:transfer.commit_import(session,user,c,job_id,body,prepared)))

@router.delete('/imports/{job_id}',response_model=transfer_dto.JobDTO)
@guard_db
def import_cancel(job_id:PositivePath,user:Manage,session:DB):
    return transfer.cancel(session,user,job_id)
