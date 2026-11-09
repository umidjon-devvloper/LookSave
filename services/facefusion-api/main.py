"""FastAPI wrapper around facefusion + birefnet cutout.

Endpoints:
- POST /swap:              face swap only (JPEG → JPEG)
- POST /cutout:            background removal only (any → transparent PNG)
- POST /swap-and-cutout:   face swap THEN cutout (JPEG → transparent PNG)

Protected by Bearer token (FACEFUSION_API_TOKEN env var).
"""
import gc
import io
import logging
import os
import secrets
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response

from cutout import make_cutout, get_session

FACEFUSION_DIR = Path(os.environ.get("FACEFUSION_DIR", "/app/facefusion"))
FACEFUSION_PY = os.environ.get(
    "FACEFUSION_PY", str(FACEFUSION_DIR / ".venv" / "bin" / "python")
)
API_TOKEN = os.environ.get("FACEFUSION_API_TOKEN", "").strip()
TIMEOUT_S = int(os.environ.get("FACEFUSION_TIMEOUT_S", "300"))

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
logger = logging.getLogger("facefusion-api")

app = FastAPI(title="FaceFusion + Cutout API", version="2.0")


def _check_auth(authorization: Optional[str]) -> None:
    if not API_TOKEN:
        raise HTTPException(status_code=503, detail="FACEFUSION_API_TOKEN not set")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    provided = authorization[len("Bearer "):].strip()
    if not secrets.compare_digest(provided, API_TOKEN):
        raise HTTPException(status_code=401, detail="invalid token")


@app.get("/health")
def health():
    return {
        "ok": FACEFUSION_DIR.is_dir() and Path(FACEFUSION_PY).exists(),
        "facefusion_dir": str(FACEFUSION_DIR),
        "has_token": bool(API_TOKEN),
        "cutout_ready": True,
    }


def _run_facefusion(src_bytes: bytes, tgt_bytes: bytes, model: str, pixel_boost: str, enhance: bool, req_id: str) -> bytes:
    """Face swap subprocess. Returns swapped JPEG bytes."""
    with tempfile.TemporaryDirectory(prefix=f"ff-{req_id}-") as tmp:
        tmp_path = Path(tmp)
        src_path = tmp_path / "source.jpg"
        tgt_path = tmp_path / "target.jpg"
        out_path = tmp_path / "output.jpg"

        src_path.write_bytes(src_bytes)
        tgt_path.write_bytes(tgt_bytes)

        processors = ["face_swapper"]
        if enhance:
            processors.append("face_enhancer")

        cmd = [
            FACEFUSION_PY,
            "facefusion.py",
            "headless-run",
            "--source-paths", str(src_path),
            "--target-path", str(tgt_path),
            "--output-path", str(out_path),
            "--processors", *processors,
            "--face-swapper-model", model,
            "--face-swapper-pixel-boost", pixel_boost,
            "--execution-providers", "cpu",
            "--output-image-quality", "90",
            "--log-level", "info",
        ]
        logger.info("[%s] facefusion: %s", req_id, " ".join(cmd))

        try:
            res = subprocess.run(
                cmd,
                cwd=str(FACEFUSION_DIR),
                capture_output=True,
                text=True,
                timeout=TIMEOUT_S,
            )
        except subprocess.TimeoutExpired:
            logger.error("[%s] facefusion timeout after %ss", req_id, TIMEOUT_S)
            raise HTTPException(status_code=504, detail="facefusion_timeout")

        if res.returncode != 0:
            tail = ((res.stderr or "") + "\n" + (res.stdout or ""))[-800:]
            logger.error("[%s] rc=%s tail=%s", req_id, res.returncode, tail)
            raise HTTPException(
                status_code=500,
                detail=f"facefusion_failed rc={res.returncode}: {tail}",
            )

        if not out_path.exists() or out_path.stat().st_size == 0:
            raise HTTPException(status_code=500, detail="facefusion_no_output")

        return out_path.read_bytes()


@app.post("/swap")
async def swap(
    source: UploadFile = File(...),
    target: UploadFile = File(...),
    model: str = Form("inswapper_128"),
    pixel_boost: str = Form("256x256"),
    enhance: bool = Form(True),
    authorization: Optional[str] = Header(default=None),
):
    _check_auth(authorization)
    req_id = uuid.uuid4().hex[:8]

    src_bytes = await source.read()
    tgt_bytes = await target.read()
    if not src_bytes or not tgt_bytes:
        raise HTTPException(status_code=400, detail="empty source or target")

    data = _run_facefusion(src_bytes, tgt_bytes, model, pixel_boost, enhance, req_id)
    logger.info("[%s] swap ok %d bytes", req_id, len(data))
    return Response(content=data, media_type="image/jpeg")


@app.post("/cutout")
async def cutout(
    image: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    """Faqat fon olib tashlash — birefnet-general-lite + flood-fill + edge blur."""
    _check_auth(authorization)
    req_id = uuid.uuid4().hex[:8]

    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty image")

    try:
        png = make_cutout(data)
        logger.info("[%s] cutout ok %d bytes", req_id, len(png))
        return Response(content=png, media_type="image/png")
    except Exception as exc:  # noqa: BLE001
        logger.exception("[%s] cutout failed", req_id)
        raise HTTPException(status_code=500, detail=f"cutout_failed: {exc}") from exc
    finally:
        gc.collect()


@app.post("/swap-and-cutout")
async def swap_and_cutout(
    source: UploadFile = File(...),
    target: UploadFile = File(...),
    model: str = Form("inswapper_128"),
    pixel_boost: str = Form("256x256"),
    enhance: bool = Form(True),
    authorization: Optional[str] = Header(default=None),
):
    """Birdaniga face swap VA cutout — 1 ta HTTP call.

    Natija: shaffof fonli PNG, foydalanuvchining asl yuzi bilan.
    """
    _check_auth(authorization)
    req_id = uuid.uuid4().hex[:8]

    src_bytes = await source.read()
    tgt_bytes = await target.read()
    if not src_bytes or not tgt_bytes:
        raise HTTPException(status_code=400, detail="empty source or target")

    # 1) Face swap
    swapped = _run_facefusion(src_bytes, tgt_bytes, model, pixel_boost, enhance, req_id)
    logger.info("[%s] swap done %d bytes, running cutout...", req_id, len(swapped))

    # 2) Cutout (birefnet) on swapped result
    try:
        png = make_cutout(swapped)
    except Exception as exc:  # noqa: BLE001
        logger.exception("[%s] cutout failed; returning swapped JPEG", req_id)
        # Fallback: return swapped JPEG without cutout rather than fail completely
        return Response(content=swapped, media_type="image/jpeg")
    finally:
        gc.collect()

    logger.info("[%s] swap-and-cutout ok %d bytes", req_id, len(png))
    return Response(content=png, media_type="image/png")


@app.on_event("startup")
def _preload():
    """Model'ni ishga tushishda darhol yuklab olish — birinchi so'rov tez bo'ladi."""
    try:
        get_session()
        logger.info("cutout model preloaded")
    except Exception as exc:  # noqa: BLE001
        logger.warning("cutout model preload failed: %s", exc)
