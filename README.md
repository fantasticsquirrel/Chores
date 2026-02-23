# chore_tracking

Chore Tracker v3 monorepo with a FastAPI backend and React frontend.

## Current Scope

- Backend API for health, child management, chore eligibility, and submission review/approval flows
- Frontend SPA shell and major parent/child views
- SQLite persistence with startup checks and WAL mode
- Frontend and backend automated test coverage for implemented flows

## Prerequisites

- Node.js 20+
- npm 10+
- Python 3.11+

## Repository Layout

- `backend/`: FastAPI service, SQLAlchemy models, tests
- `frontend/`: React + TypeScript SPA
- `specs/`: product and feature specifications
- `IMPLEMENTATION_PLAN.md`: checklist-driven delivery plan

## Exact Production URLs

Assume your deployment host is `https://YOUR_DOMAIN`.

SPA routes are served under `/chore/`:

- `https://YOUR_DOMAIN/chore/`
- `https://YOUR_DOMAIN/chore/login`
- `https://YOUR_DOMAIN/chore/parent/dashboard`
- `https://YOUR_DOMAIN/chore/parent/children`
- `https://YOUR_DOMAIN/chore/board`
- `https://YOUR_DOMAIN/chore/child/today`

API routes are served under `/chore-api/`:

- `GET https://YOUR_DOMAIN/chore-api/health`
- `GET https://YOUR_DOMAIN/chore-api/health/live`
- `GET https://YOUR_DOMAIN/chore-api/health/ready`
- `GET https://YOUR_DOMAIN/chore-api/children?household_id={id}&active_only={true|false}`
- `POST https://YOUR_DOMAIN/chore-api/children`
- `PATCH https://YOUR_DOMAIN/chore-api/children/{child_id}`
- `GET https://YOUR_DOMAIN/chore-api/children/me/eligible-chores?date=YYYY-MM-DD&child_id={optional}`
- `POST https://YOUR_DOMAIN/chore-api/submissions?child_id={optional}`
- `GET https://YOUR_DOMAIN/chore-api/submissions?status={optional}`
- `POST https://YOUR_DOMAIN/chore-api/submissions/{submission_id}/approve-all`
- `POST https://YOUR_DOMAIN/chore-api/submissions/{submission_id}/items/{item_id}/decision`

Compatibility health routes also exist without `/chore-api`:

- `GET https://YOUR_DOMAIN/health`
- `GET https://YOUR_DOMAIN/health/live`
- `GET https://YOUR_DOMAIN/health/ready`

## Local Setup

### Frontend

```bash
npm install
npm run lint
npm run test
npm run build
```

Run dev server:

```bash
npm run dev --workspace frontend
```

### Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e "backend[dev]"
cp backend/.env.example backend/.env
.venv/bin/pytest backend/tests
```

Run API:

```bash
uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```

## Operator Runbook

1. Prepare environment variables:

```bash
cp backend/.env.example backend/.env
```

Set at least:

- `APP_ENV=production`
- `DATABASE_URL=sqlite:///./data/chore_tracking.db` (or your persistent path)
- `SECRET_KEY=<minimum 32 characters>`
- `LOG_LEVEL=INFO`
- `SESSION_COOKIE_SECURE=true`

2. Build frontend assets:

```bash
npm ci
npm run build
```

3. Start API process (serves both API and built SPA):

```bash
source .venv/bin/activate
pip install -e "backend[dev]"
uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```

4. Verify runtime health:

```bash
curl -fsS http://127.0.0.1:8000/chore-api/health/live
curl -fsS http://127.0.0.1:8000/chore-api/health/ready
curl -I http://127.0.0.1:8000/chore/
```

5. Daily SQLite backup:

```bash
mkdir -p backups
sqlite3 data/chore_tracking.db ".backup backups/chore_tracking-$(date +%F).db"
```

6. Restore from backup (service stopped):

```bash
cp backups/chore_tracking-YYYY-MM-DD.db data/chore_tracking.db
```

## Quality Gates

Project backpressure commands:

- `npm run lint`
- `npm test`
- `npm run build`

Backend verification:

- `.venv/bin/pytest backend/tests`
