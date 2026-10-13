# VÉRIFIER : épingler par digest (python:3.12-slim@sha256:…) — digest non résolu, registre inaccessible lors de l'audit.
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .
USER 65532:65532
EXPOSE 8080
CMD ["python", "server.py"]
