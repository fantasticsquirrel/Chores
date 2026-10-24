"""Bound upload bytes before JSON parsing, including chunked requests."""

from starlette.responses import JSONResponse

MAX_UPLOAD_BODY = 3 * 1024 * 1024


class DiscoveryBodyLimitMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] != "http"
            or scope.get("method") != "POST"
            or scope.get("path", "").rstrip("/") != "/chore-api/discovery/packages"
        ):
            return await self.app(scope, receive, send)

        async def reject():
            await JSONResponse(
                {"detail": "Package request exceeds 3 MiB."},
                status_code=413,
                headers={"Cache-Control": "no-store"},
            )(scope, receive, send)

        try:
            lengths = [
                int(value)
                for key, value in scope.get("headers", [])
                if key.lower() == b"content-length"
            ]
            if (
                any(length < 0 or length > MAX_UPLOAD_BODY for length in lengths)
                or len(set(lengths)) > 1
            ):
                return await reject()
        except ValueError:
            return await reject()
        # Bounded buffering deliberately precedes FastAPI JSON parsing. A chunked
        # sender cannot evade the cap by omitting or understating Content-Length.
        chunks = []
        total = 0
        while True:
            event = await receive()
            if event["type"] == "http.disconnect":
                return
            chunk = event.get("body", b"")
            total += len(chunk)
            if total > MAX_UPLOAD_BODY:
                return await reject()
            chunks.append(chunk)
            if not event.get("more_body", False):
                break
        body = b"".join(chunks)
        delivered = False

        async def replay():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": body, "more_body": False}

        await self.app(scope, replay, send)
