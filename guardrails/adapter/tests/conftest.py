import os
import socket
import sys
import threading
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]          # adapter/
RAILS = ROOT.parent / "deploy" / "rails"             # guardrails/deploy/rails
sys.path.insert(0, str(ROOT))
os.environ.setdefault("RAILS_ROOT", str(RAILS))


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def mock_llm():
    """Minimal OpenAI-compatible server standing in for the internal gateway.
    Answers 'Yes' (block) when the checked message tries to override instructions."""
    import re
    import uvicorn
    from fastapi import FastAPI, Request

    app = FastAPI()
    calls: list[str] = []

    @app.post("/v1/chat/completions")
    async def cc(req: Request):
        body = await req.json()
        text = " ".join(str(m.get("content", "")) for m in body.get("messages", []))
        m = re.search(r'(?:User|Assistant) message: "(.*?)"', text, re.S)
        checked = (m.group(1) if m else text).lower()
        verdict = "Yes" if ("ignore" in checked and "instruction" in checked) else "No"
        calls.append(verdict)
        return {"id": "x", "object": "chat.completion", "created": 0, "model": body.get("model"),
                "choices": [{"index": 0, "message": {"role": "assistant", "content": verdict},
                             "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 1, "total_tokens": 11}}

    port = _free_port()
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error"))
    th = threading.Thread(target=server.run, daemon=True)
    th.start()
    for _ in range(100):
        if server.started:
            break
        time.sleep(0.05)
    yield {"base_url": f"http://127.0.0.1:{port}/v1", "calls": calls}
    server.should_exit = True


@pytest.fixture(scope="session")
def rails_root(tmp_path_factory, mock_llm):
    """Copy of the real profiles with the strict model pointed at the mock LLM."""
    import shutil
    dst = tmp_path_factory.mktemp("rails")
    for prof in ("default", "strict"):
        shutil.copytree(RAILS / prof, dst / prof)
    cfg = dst / "strict" / "config.yml"
    cfg.write_text(cfg.read_text().replace(
        "http://agentgateway-internal.agentgateway-system.svc.cluster.local:8080/v1", mock_llm["base_url"]))
    # An extra profile exercising the "transform" (Mask) path.
    (dst / "omit").mkdir()
    (dst / "omit" / "config.yml").write_text(
        (RAILS / "default" / "config.yml").read_text().replace("action: reject", "action: omit"))
    return dst
