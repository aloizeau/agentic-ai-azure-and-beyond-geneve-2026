# VÉRIFIER : épingler par digest (FROM python:3.12-slim@sha256:…).
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY issuer.py .
USER 65532:65532
ENTRYPOINT ["python", "issuer.py"]
