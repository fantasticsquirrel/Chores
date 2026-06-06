# Family Manager

Family Manager is the evolution of Chore Tracker v3: a FastAPI backend and React frontend for household workflows. The current production route names intentionally remain `/chore/` and `/chore-api/` for deployment stability while the visible app shell and code direction move toward Family Manager.

## Current Scope

- Shared household, parent, and child accounts with role-aware route protection
- Chores module for chore management, child eligible chores, submissions, and parent review/approval
- Homeschool module for semesters, subjects, attendance calendar entries, day comments, and grades
- Admin module for per-user module access management, with last-admin protection
- SQLite persistence with Alembic migrations, startup checks, and WAL mode
- Frontend and backend automated test coverage for implemented flows

## Prerequisites

- Node.js 20+
- npm 10+
- Python 3.11+

## Repository Layout

- `backend/`: FastAPI service, SQLAlchemy models, tests
- `frontend/`: React + TypeScript SPA
- `mobile/`: Expo + React Native TypeScript app for Android and iPhone
- `specs/`: product and feature specifications
- `IMPLEMENTATION_PLAN.md`: checklist-driven delivery plan

## Exact Production URLs

Current production host: `https://family.multihost.ing`.

SPA routes are served under `/chore/` for this release. This is deliberate: Family Manager naming is visible in the UI, but deployment routes stay stable until a later route migration decision.

- `https://family.multihost.ing/chore/`
- `https://family.multihost.ing/chore/login`
- `https://family.multihost.ing/chore/parent/dashboard`
- `https://family.multihost.ing/chore/parent/children`
- `https://family.multihost.ing/chore/board`
- `https://family.multihost.ing/chore/homeschool`
- `https://family.multihost.ing/chore/admin/dashboard`
- `https://family.multihost.ing/chore/child/today`

API routes are served under `/chore-api/`:

- `GET https://family.multihost.ing/chore-api/health`
- `GET https://family.multihost.ing/chore-api/health/live`
- `GET https://family.multihost.ing/chore-api/health/ready`
- `GET https://family.multihost.ing/chore-api/children?household_id={id}&active_only={true|false}`
- `POST https://family.multihost.ing/chore-api/children`
- `PATCH https://family.multihost.ing/chore-api/children/{child_id}`
- `GET https://family.multihost.ing/chore-api/children/me/eligible-chores?date=YYYY-MM-DD&child_id={optional}`
- `POST https://family.multihost.ing/chore-api/submissions?child_id={optional}`
- `GET https://family.multihost.ing/chore-api/submissions?status={optional}`
- `POST https://family.multihost.ing/chore-api/submissions/{submission_id}/approve-all`
- `POST https://family.multihost.ing/chore-api/submissions/{submission_id}/items/{item_id}/decision`
- `GET https://family.multihost.ing/chore-api/modules/me`
- `GET https://family.multihost.ing/chore-api/modules/users`
- `PUT https://family.multihost.ing/chore-api/modules/users/{user_id}`
- `GET|POST https://family.multihost.ing/chore-api/homeschool/semesters`
- `PUT|DELETE https://family.multihost.ing/chore-api/homeschool/semesters/{semester_id}`
- `GET|POST https://family.multihost.ing/chore-api/homeschool/subjects`
- `PUT|DELETE https://family.multihost.ing/chore-api/homeschool/subjects/{subject_id}`
- `GET|PUT https://family.multihost.ing/chore-api/homeschool/attendance`
- `DELETE https://family.multihost.ing/chore-api/homeschool/attendance/{attendance_id}`
- `GET|PUT https://family.multihost.ing/chore-api/homeschool/day-comments`
- `DELETE https://family.multihost.ing/chore-api/homeschool/day-comments/{comment_id}`
- `GET|PUT https://family.multihost.ing/chore-api/homeschool/grades`
- `DELETE https://family.multihost.ing/chore-api/homeschool/grades/{grade_id}`

Compatibility health routes also exist without `/chore-api`:

- `GET https://family.multihost.ing/health`
- `GET https://family.multihost.ing/health/live`
- `GET https://family.multihost.ing/health/ready`

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

### Mobile

The Expo app uses `EXPO_PUBLIC_API_BASE_URL` and expects the backend API prefix to stay `/chore-api`.

```bash
npm install
npm run mobile:typecheck
npm run mobile:start
```

Useful run targets:

```bash
npm run mobile:android
npm run mobile:ios
npm run mobile:apk
```

API base URL examples:

- Android emulator: `http://10.0.2.2:8000/chore-api`
- iOS simulator: `http://127.0.0.1:8000/chore-api`
- Physical device: `http://YOUR_LAN_IP:8000/chore-api`
- Production: `https://family.multihost.ing/chore-api`

Android APK builds use the EAS `apk` profile in `mobile/eas.json`.
One-time setup:

```bash
npm run mobile:eas:init
npm run mobile:eas:set-api -- https://family.multihost.ing/chore-api
```

Then build:

```bash
npm run mobile:apk
```

See `docs/mobile-apk-build.md` for the full repeatable workflow, including
local APK builds on machines with Java and an Android SDK.

iOS simulator runs and local iOS builds require macOS/Xcode or EAS.

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

2. Apply database migrations:

```bash
source .venv/bin/activate
cd backend
alembic upgrade head
cd ..
```

3. Build frontend assets:

```bash
npm ci
npm run build
```

4. Start API process (serves both API and built SPA):

```bash
source .venv/bin/activate
pip install -e "backend[dev]"
uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```

5. Verify runtime health:

```bash
curl -fsS http://127.0.0.1:8000/chore-api/health/live
curl -fsS http://127.0.0.1:8000/chore-api/health/ready
curl -I http://127.0.0.1:8000/chore/
```

6. Daily SQLite backup:

```bash
mkdir -p backups
sqlite3 data/chore_tracking.db ".backup backups/chore_tracking-$(date +%F).db"
```

7. Restore from backup (service stopped):

```bash
cp backups/chore_tracking-YYYY-MM-DD.db data/chore_tracking.db
```

## Auth Setup

Auth endpoints:

- `POST /chore-api/auth/login`
- `POST /chore-api/auth/child-login`
- `POST /chore-api/auth/logout`
- `GET /chore-api/auth/me`

Login sets two cookies:

- `chore_tracker_session` (HttpOnly session cookie)
- `chore_tracker_csrf` (CSRF cookie)

Child login accepts `parent_email`, `child_name`, and `password`, then signs in
the linked active child account. Existing email/password login remains
available for parent accounts and legacy child login emails.

All authenticated write requests to `/chore-api/*` (except login endpoints) must include:

- Header `X-CSRF-Token: <chore_tracker_csrf cookie value>`

Example login and authenticated session check:

```bash
curl -i -c /tmp/chore.cookies \
  -H "Content-Type: application/json" \
  -X POST http://127.0.0.1:8000/chore-api/auth/login \
  -d '{"email":"parent.admin@example.com","password":"change-me-strong-password"}'

CSRF_TOKEN="$(awk '/chore_tracker_csrf/ {print $7}' /tmp/chore.cookies | tail -n 1)"

curl -i -b /tmp/chore.cookies \
  http://127.0.0.1:8000/chore-api/auth/me
```

## First Parent Bootstrap Flow

Use this once per new database to create the first household and parent admin user.

1. Configure backend env and install deps:

```bash
cp backend/.env.example backend/.env
source .venv/bin/activate
pip install -e "backend[dev]"
```

2. Create the initial household + `PARENT_ADMIN` account:

```bash
source .venv/bin/activate
PYTHONPATH=backend python - <<'PY'
from app.config import get_settings
from app.db import get_session_factory, initialize_database
from app.models.core import Household, User
from app.models.enums import UserRole
from app.security import hash_password

settings = get_settings()
initialize_database(settings)
session_factory = get_session_factory(settings.database_url)

admin_email = "parent.admin@example.com"
admin_password = "change-me-strong-password"

with session_factory() as session:
    household = Household(name="My Household", timezone="UTC")
    session.add(household)
    session.flush()
    session.add(
        User(
            household_id=household.id,
            email=admin_email,
            password_hash=hash_password(admin_password),
            role=UserRole.PARENT_ADMIN,
            child_id=None,
        )
    )
    session.commit()
    print(f"Created household_id={household.id}, admin_email={admin_email}")
PY
```

3. Sign in through `POST /chore-api/auth/login` or `https://family.multihost.ing/chore/login`, then create children from `/chore/parent/children`. Parent admins receive default access to Chores, Homeschool, and Admin modules. Parent users receive Chores and Homeschool by default; child users receive Chores by default.

## Production Test Checklist

Run this checklist after each deploy:

1. Build and start:
   - `npm run build`
   - `uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8501`
2. Runtime health:
   - `curl -fsS http://127.0.0.1:8501/chore-api/health`
   - `curl -fsS http://127.0.0.1:8501/chore-api/health/live`
   - `curl -fsS http://127.0.0.1:8501/chore-api/health/ready`
   - `curl -I http://127.0.0.1:8501/chore/`
3. Auth and module protections:
   - Anonymous `GET /chore-api/children?household_id=1` returns `401` with `Not authenticated.`
   - Child account `GET /chore-api/submissions` returns `403` with `Forbidden.`
   - Parent/admin users with a disabled module receive `403` with `Module access denied.` on that module's backend APIs.
   - The Admin module prevents removing the last household admin's Admin access.
4. Deployed UI smoke flow:
   - `DATABASE_URL=sqlite:///$PWD/data/chore_tracking.db npm run test:smoke --workspace frontend`
   - Confirms login redirect, parent child-create flow, child submission flow, and parent board approval flow.

## Quality Gates

Project backpressure commands:

- `npm run lint`
- `npm test`
- `npm run build`

Backend verification:

- `.venv/bin/pytest backend/tests`
- Fresh migration sanity is covered by `backend/tests/test_alembic_migrations.py`; operators can also run `cd backend && alembic upgrade head` against a temporary DB.
