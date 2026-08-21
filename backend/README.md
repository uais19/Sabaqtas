# Sabaqtas Backend

FastAPI modular-monolith core for diagnostics, prerequisite topics, learning plans, progress, teacher analytics and textbook-grounded Gemini integration.

## Structure

`app/api` is the HTTP boundary, `app/services` coordinates use cases, `app/domain` holds framework-free concepts, `app/repositories` owns SQLAlchemy persistence, and `app/integrations` isolates Gemini.

## Install

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
Copy-Item .env.example .env
```

Set `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` in `.env`; do not commit it.

## Run

```powershell
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs`. Health is available at `/health`; canonical endpoints live under `/api/v1`, with `/api` aliases for the existing frontend.

## Quality

```powershell
python -m pytest
ruff check .
mypy app
```

Tests use only in-memory fakes and do not call Gemini or require PostgreSQL. Production schemas are changed only by Alembic migrations; application startup never creates tables.
