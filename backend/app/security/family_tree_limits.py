"""Family Tree-only ASGI byte caps before multipart disk spooling/JSON parse."""
import json
from threading import BoundedSemaphore
_TRANSFER_WORKERS=BoundedSemaphore(2)
from starlette.formparsers import MultiPartException


class FamilyTreeBodyLimitMiddleware:
    def __init__(self,app): self.app=app

    async def __call__(self,scope,receive,send):
        path=scope.get('path','')
        if scope['type']!='http' or not path.startswith('/chore-api/family-tree'):
            return await self.app(scope,receive,send)
        limit=100*1024*1024+64*1024 if path=='/chore-api/family-tree/imports' else 10*1024*1024+64*1024 if path=='/chore-api/family-tree/media' else 16*1024*1024
        payload=json.dumps({'detail':{'code':'resource_limit','message':'Request exceeds the permitted size.'}}).encode()
        async def reject():
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
            acquired=_TRANSFER_WORKERS.acquire(blocking=False)
            if not acquired:
                busy=json.dumps({'detail':{'code':'server_busy','message':'Transfer workers are busy. Retry later.'}}).encode()
                await send({'type':'http.response.start','status':503,'headers':[(b'content-type',b'application/json'),(b'cache-control',b'private, no-store')]})
                return await send({'type':'http.response.body','body':busy})
        try:
            await self.app(scope,bounded_receive,bounded_send)
        except MultiPartException:
            if not sent_rejection: await reject()
        finally:
            if acquired: _TRANSFER_WORKERS.release()
