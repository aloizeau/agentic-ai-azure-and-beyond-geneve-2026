# NeMo Guardrails adapter for the agentgateway webhook guardrail API.
# VÉRIFIER : épingler par digest (python:3.12-slim@sha256:…) — digest non résolu, registre inaccessible lors de l'audit.
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install -r requirements.txt && apt-get purge -y build-essential && apt-get autoremove -y

COPY app ./app

# Non-root, read-only root filesystem friendly.
RUN useradd --uid 10001 --create-home adapter
USER 10001

EXPOSE 8080
ENV RAILS_ROOT=/rails
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--no-access-log"]
