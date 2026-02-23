# chore_tracking

Chore Tracker v3 monorepo with a FastAPI backend and React frontend.

## Current Scope

- Backend APIs: `GET /health`, `GET /health/live`, `GET /health/ready`, `GET/POST/PATCH /children`
- Frontend app bootstrap (React + Vite)
- SQLite persistence and startup checks
- Backend and frontend automated test coverage for implemented flows

## Prerequisites

- Node.js 20+
- npm 10+
- Python 3.11+

## Repository Layout

- `backend/`: FastAPI service, SQLAlchemy models, tests
- `frontend/`: React + TypeScript SPA
- `specs/`: product and feature specifications
- `IMPLEMENTATION_PLAN.md`: checklist-driven delivery plan

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
pytest backend/tests
```

Run API:

```bash
uvicorn app.main:app --app-dir backend --reload
```

## Quality Gates

Project backpressure commands:

- `npm run lint`
- `npm test`
- `npm run build`

Backend verification:

- `pytest backend/tests`
