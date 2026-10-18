"""Family Tree-only ASGI byte caps before multipart disk spooling/JSON parse."""
import json
from threading import BoundedSemaphore
from app.services.family_tree import storage
_TRANSFER_WORKERS=BoundedSemaphore(2)
from starlette.formparsers import MultiPartException
from app.services.family_tree.observability import correlation, emit, operation_context, classify


class FamilyTreeBodyLimitMiddleware:
    def __init__(self,app):
        self.app=app
        self.worker_limit=storage.limit('TRANSFER_WORKERS',2)
        self.workers=_TRANSFER_WORKERS if self.worker_limit==2 else BoundedSemaphore(1)

    async def __call__(self,scope,receive,send):
        path=scope.get('path','')
        if scope['type']!='http' or not path.startswith('/chore-api/family-tree'):
            return await self.app(scope,receive,send)
        request_id=scope.get('state',{}).get('request_id')
        if request_id is None:
            headers=[value.decode('latin1') for key,value in scope.get('headers',[]) if key.lower()==b'x-request-id']
            request_id=headers[0] if len(headers)==1 else None
        operation='import' if path=='/chore-api/family-tree/imports' else 'export' if path=='/chore-api/family-tree/exports' else 'request'
        staging=operation in {'import','export'} and scope.get('method')=='POST'
        async def observed_send(event):
            if staging and event['type']=='http.response.start' and event['status']>=400:
                status=event['status']
                code={413:'resource_limit',422:'validation_error',503:'server_busy'}.get(status,'unexpected_error')
                emit('staging_failed', code=code, status=status)
            await send(event)
        with correlation(request_id), operation_context(operation):
            try:
                return await self._bounded(scope,receive,observed_send,path)
            except Exception as exc:
                if staging: emit('staging_failed', **classify(exc))
                raise

    async def _bounded(self,scope,receive,send,path):
        limit=storage.limit('IMPORT_MAX_BYTES',storage.MAX_INPUT)+64*1024 if path=='/chore-api/family-tree/imports' else storage.limit('IMAGE_MAX_BYTES',storage.MAX_IMAGE)+64*1024 if path=='/chore-api/family-tree/media' else storage.manifest_limit()
        payload=json.dumps({'detail':{'code':'resource_limit','message':'Request exceeds the permitted size.'}}).encode()
        async def reject():
            emit('quota_rejected', operation='request', code='resource_limit', limit=limit, status=413)
            await send({'type':'http.response.start','status':413,'headers':[(b'content-type',b'application/json'),(b'content-length',str(len(payload)).encode()),(b'cache-control',b'private, no-store')]})
            await send({'type':'http.response.body','body':payload})
        try:
            lengths=[int(v) for k,v in scope.get('headers',[]) if k.lower()==b'content-length']
            if any(n<0 or n>limit for n in lengths) or len(set(lengths))>1:
                return await reject()
        except ValueError:
            return await reject()
        total=0; oversized=False; sent_rejection=False
        async def bounded_receive():
            nonlocal total,oversized
            event=await receive()
            if event['type']=='http.request':
                total+=len(event.get('body',b''))
                if total>limit:
                    oversized=True
                    # Starlette closes already-spooled file handles on this
                    # exact parser exception. Outer send substitutes stable 413
                    # even when Request's form parser translates it into 400.
                    raise MultiPartException('Request exceeds the permitted size.')
            return event
        async def bounded_send(event):
            nonlocal sent_rejection
            if oversized:
                if not sent_rejection:
                    sent_rejection=True
                    await reject()
                return
            await send(event)
        heavy=path in {'/chore-api/family-tree/media','/chore-api/family-tree/imports'} or path.startswith('/chore-api/family-tree/exports') or (path.startswith('/chore-api/family-tree/imports/') and path.endswith('/commit'))
        acquired=False
        if heavy:
            acquired=self.workers.acquire(blocking=False)
            if not acquired:
                emit('admission_rejected', operation='request', code='server_busy', limit=self.worker_limit, status=503)
                busy=json.dumps({'detail':{'code':'server_busy','message':'Transfer workers are busy. Retry later.'}}).encode()
                await send({'type':'http.response.start','status':503,'headers':[(b'content-type',b'application/json'),(b'cache-control',b'private, no-store')]})
                return await send({'type':'http.response.body','body':busy})
        try:
            await self.app(scope,bounded_receive,bounded_send)
        except MultiPartException:
            if not sent_rejection: await reject()
        finally:
            if acquired: self.workers.release()
