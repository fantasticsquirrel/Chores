from fastapi import FastAPI

app = FastAPI(title="Chore Tracker API", version="0.1.0")


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
