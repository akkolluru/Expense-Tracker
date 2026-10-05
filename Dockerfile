# syntax=docker/dockerfile:1

# ---------------------------------------------------------
# Stage 1: Build PaisaIQ PWA static assets (React 19 + Vite)
# ---------------------------------------------------------
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------
# Stage 2: Production Python 3.11 Runtime
# ---------------------------------------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    DATABASE_URL=sqlite+aiosqlite:////data/expense_tracker.db \
    BACKUP_DIR=/backups \
    FRONTEND_DIST_DIR=/app/frontend/dist

WORKDIR /app

# Install minimal OS utilities (curl for healthchecks, sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/pyproject.toml backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Copy backend application source
COPY backend/src /app/src
COPY backend/alembic /app/alembic
COPY backend/alembic.ini /app/alembic.ini

# Copy pre-compiled frontend distribution from Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Ensure mount point directories exist
RUN mkdir -p /data /backups /app/credentials

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/system/health -H "X-API-Key: ${SERVER_API_KEY}" || exit 1

CMD ["uvicorn", "expense_tracker.api.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
