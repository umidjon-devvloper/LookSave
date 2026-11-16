"""FastAPI wrapper around facefusion + birefnet cutout.

Endpoints:
- POST /swap:              face swap only (JPEG → JPEG)
- POST /cutout:            background removal only (any → transparent PNG)
- POST /swap-and-cutout:   face swap THEN cutout (any → transparent PNG)

Protected by Bearer token (FACEFUSION_API_TOKEN env var).

⚠️ JAVOB SARLAVHALARI (2026-11-12) — chaqiruvchi natijaga ishonmasdan oldin
ularni o'qiydi:
- `X-Face-Swap: done | none | off` — yuz HAQIQATAN almashdimi. `none` —
  maqsad rasmda yuz topilmadi va rasm o'zgarmadi (facefusion bunda xato
  bermaydi). `off` — almashtirish shu xizmatda o'chirilgan (`FACE_SWAP=off`),
  rasmga faqat kesim qilindi.
- `X-Cutout: alpha | model | failed` — shaffoflik qayerdan olindi.
"""
import logging
import os
import secrets
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response

import compose
import cutout
import swap

BUILD = "2026-11-15-swap-switch"

FACEFUSION_DIR = swap.FACEFUSION_DIR
FACEFUSION_PY = swap.FACEFUSION_PY

# ⚠️ YUZ ALMASHTIRISHNI O'CHIRISH KALITI (2026-11-15, loyiha egasining qarori:
# «rasmning orqa foni bo'lmasa bo'ldi, GPT'ning o'z sifati qolsin»).
#
# `FACE_SWAP=off` bo'lsa facefusion umuman ishlamaydi va ishchisi ham
# ochilmaydi. Yo'llar o'z joyida qoladi — chaqiruvchini (API) o'zgartirish
# shart emas:
#   • `/swap-and-cutout` — maqsad rasmga FAQAT kesim qiladi (`/cutout` ning o'zi);
#   • `/swap`            — maqsad rasmni baytma-bayt o'zgarishsiz qaytaradi.
# Ikkalasi `X-Face-Swap: off` bilan javob beradi: bu «almashmadi» (`none`)
# emas — xato yo'q, shunday sozlangan.
#
# Sukut bo'yicha YOQIQ: kalit qo'yilmagan joyda xulq o'zgarmaydi.
FACE_SWAP = os.environ.get("FACE_SWAP", "on").strip().lower() not in ("0", "off", "false", "no")
_RAW_TOKENS = os.environ.get("FACEFUSION_API_TOKEN", "").strip()
# Vergul bilan ko'p token qo'llanadi: `tok1,tok2` → har bir loyiha o'ziniki.
# Bo'sh bo'lsa auth butunlay o'chadi (public).
API_TOKENS = tuple(t.strip() for t in _RAW_TOKENS.split(",") if t.strip())

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
logger = logging.getLogger("facefusion-api")

app = FastAPI(title="FaceFusion + Cutout API", version="2.1")

# ⚠️ OG'IR ISH BITTALAB. Facefusion va kesim modeli har biri bir necha GB
# xotira va berilgan HAMMA yadroni oladi. Ikkitasi bir vaqtda ketsa ikkalasi
# ham ikki barobar sekinlashadi (yadrolar bo'linadi) — o'rtacha kutish
# bittalab ishlagandagidan uzun chiqadi. Ikkinchi so'rov rad etilmaydi —
# navbatda kutadi.
_HEAVY = threading.Lock()


def _facefusion_revision() -> str:
    try:
        done = subprocess.run(
            ["git", "-C", str(FACEFUSION_DIR), "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return done.stdout.strip() or "unknown"
    except Exception:  # noqa: BLE001
        return "unknown"


FACEFUSION_REVISION = _facefusion_revision()


@app.on_event("startup")
def _prepare_cutout_model() -> None:
    """Kesim modeli faylini FONDA tekshiradi — ishga tushishni kutdirmaydi.

    ⚠️ MODEL BU YERDA XOTIRAGA YUKLANMAYDI (ilgari yuklanardi). Sessiya
    API jarayonida tursa uning xotirasi har kesimda o'sib boradi —
    `cutout.py` boshidagi izohga qarang.
    """
    threading.Thread(target=cutout.ensure_model, name="cutout-model", daemon=True).start()
    # Facefusion ishchisi ham fonda isiydi (`FACEFUSION_WARM=1` bo'lsa);
    # u tayyor bo'lguncha kelgan so'rov kutadi yoki eski yo'l bilan bajariladi.
    # Almashtirish o'chirilgan bo'lsa ishchi kerak emas (~5 GB tejaladi).
    if FACE_SWAP:
        swap.start()
    else:
        logger.info("yuz almashtirish O'CHIQ (FACE_SWAP=off) — xizmat faqat fonni kesadi")


@app.on_event("shutdown")
def _stop_workers() -> None:
    """Kutib turgan ishchi jarayonlarni yopadi — aks holda ular egasiz qolib ketadi."""
    swap.shutdown()
    cutout.shutdown()


def _check_auth(authorization: Optional[str]) -> None:
    # Hech qanday token sozlanmagan — auth o'chirilgan (public).
    if not API_TOKENS:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    provided = authorization[len("Bearer "):].strip()
    # Har bir ruxsat etilgan tokenga teng vaqtli solishtirish.
    for tok in API_TOKENS:
        if secrets.compare_digest(provided, tok):
            return
    raise HTTPException(status_code=401, detail="invalid token")


@app.get("/health")
def health():
    return {
        "ok": FACEFUSION_DIR.is_dir() and Path(FACEFUSION_PY).exists(),
        "build": BUILD,
        "facefusion_dir": str(FACEFUSION_DIR),
        "facefusion_revision": FACEFUSION_REVISION,
        "has_token": bool(API_TOKENS),
        "token_count": len(API_TOKENS),
        "cutout_ready": True,
        # false — xizmat faqat fonni kesadi, yuzga tegmaydi (`FACE_SWAP=off`)
        "face_swap": FACE_SWAP,
        # Tezlashtirish holati: facefusion ishchisi va kesim ishchisi tayyormi
        "warm": swap.status() if FACE_SWAP else {"enabled": False},
        "cutout": cutout.status(),
    }


def _run_facefusion(src_bytes: bytes, tgt_bytes: bytes, model: str, pixel_boost: str, enhance: bool, req_id: str) -> bytes:
    """Yuz almashtirish (`swap.py`). Almashtirilgan JPEG baytlarini qaytaradi."""
    try:
        return swap.run(src_bytes, tgt_bytes, model, pixel_boost, enhance, req_id)
    except swap.SwapFailed as exc:
        raise HTTPException(status_code=exc.status, detail=exc.detail) from exc


def _timing(**stages: float) -> str:
    """`Server-Timing` sarlavhasi — har bosqich necha millisekund olgani."""
    return ", ".join(f"{name};dur={seconds * 1000:.0f}" for name, seconds in stages.items())


def _read_pair(source: UploadFile, target: UploadFile) -> tuple[bytes, bytes]:
    src_bytes = source.file.read()
    tgt_bytes = target.file.read()
    if not src_bytes or not tgt_bytes:
        raise HTTPException(status_code=400, detail="empty source or target")
    return src_bytes, tgt_bytes


def _read_target(target: UploadFile) -> bytes:
    """Almashtirish o'chiq bo'lganda yuz surati (`source`) o'qilmaydi ham."""
    tgt_bytes = target.file.read()
    if not tgt_bytes:
        raise HTTPException(status_code=400, detail="empty target")
    return tgt_bytes


def _media_type(data: bytes) -> str:
    """Rasm turi — baytlarning boshidan (fayl nomiga ishonilmaydi: API har
    qanday rasmni `target.jpg` deb yuboradi)."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return "application/octet-stream"


def _cutout_png(data: bytes, req_id: str) -> tuple[bytes, str, dict[str, float]]:
    """Fonni olib tashlaydi: (shaffof PNG, alfa qayerdan olingani, bosqich vaqtlari).

    Rasmning o'z shaffofligi bo'lsa model chaqirilmaydi va piksellarga
    tegilmaydi — `cutout.trusted_alpha` ga qarang.
    """
    arrived = time.monotonic()
    started = arrived
    try:
        decoded = cutout.decode(data)
        alpha = cutout.trusted_alpha(decoded)
        how = "alpha"
        if alpha is None:
            with _HEAVY:
                started = time.monotonic()
                alpha = cutout.model_alpha(decoded)
            how = "model"
        masked_at = time.monotonic()
        png = cutout.encode_png(decoded, alpha, darken_edges=how == "model")
    except Exception as exc:  # noqa: BLE001
        logger.exception("[%s] cutout failed", req_id)
        raise HTTPException(status_code=500, detail=f"cutout_failed: {exc}") from exc

    done = time.monotonic()
    stages = {
        "queue": started - arrived,
        "cutout": masked_at - started,
        "encode": done - masked_at,
        "total": done - arrived,
    }
    return png, how, stages


# ⚠️ ENDPOINTLAR `def`, `async def` EMAS — VA BU MUHIM (2026-11-12).
#
# `async def` ichida bloklovchi chaqiruv (facefusion subprocess, kesim)
# butun event loop'ni to'xtatadi: bir daqiqalik almashtirish davomida
# `/health` ham javob bermasdi, fly.io xizmatni «nosog'lom» deb belgilab,
# o'sha paytda kelgan boshqa so'rovlarni rad etardi (logda har almashtirishda
# «Health check ... has failed» turardi). Oddiy `def` ni FastAPI alohida
# ipda bajaradi — event loop bo'sh qoladi.


@app.post("/swap")
def swap_endpoint(
    source: UploadFile = File(...),
    target: UploadFile = File(...),
    model: str = Form("inswapper_128"),
    pixel_boost: str = Form("256x256"),
    enhance: bool = Form(True),
    authorization: Optional[str] = Header(default=None),
):
    _check_auth(authorization)
    req_id = uuid.uuid4().hex[:8]

    if not FACE_SWAP:
        # Rasm baytma-bayt o'zgarishsiz qaytadi — qayta siqilmaydi ham
        tgt_bytes = _read_target(target)
        logger.info("[%s] swap: o'chiq — rasm o'zgarishsiz qaytdi (%d bytes)", req_id, len(tgt_bytes))
        return Response(content=tgt_bytes, media_type=_media_type(tgt_bytes), headers={"X-Face-Swap": "off"})

    src_bytes, tgt_bytes = _read_pair(source, target)

    arrived = time.monotonic()
    with _HEAVY:
        started = time.monotonic()
        data = _run_facefusion(src_bytes, tgt_bytes, model, pixel_boost, enhance, req_id)
    swapped_at = time.monotonic()

    # Yuz almashdimi — faqat sarlavha uchun; aniqlab bo'lmasa javob baribir ketadi
    face = "done"
    try:
        _, changed = compose.merge_swap(cutout.decode(tgt_bytes), cutout.decode(data))
        face = "done" if changed else "none"
    except Exception:  # noqa: BLE001
        logger.exception("[%s] swap: natijani solishtirib bo'lmadi", req_id)

    timing = _timing(queue=started - arrived, swap=swapped_at - started, total=time.monotonic() - arrived)
    logger.info("[%s] swap ok %d bytes face=%s | %s", req_id, len(data), face, timing)
    return Response(
        content=data,
        media_type="image/jpeg",
        headers={"X-Face-Swap": face, "Server-Timing": timing},
    )


@app.post("/cutout")
def cutout_endpoint(
    image: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    """Faqat fon olib tashlash — natija ASL O'LCHAMDA."""
    _check_auth(authorization)
    req_id = uuid.uuid4().hex[:8]

    data = image.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty image")

    png, how, stages = _cutout_png(data, req_id)
    timing = _timing(**stages)
    logger.info("[%s] cutout ok %d bytes via=%s | %s", req_id, len(png), how, timing)
    return Response(content=png, media_type="image/png", headers={"X-Cutout": how, "Server-Timing": timing})


@app.post("/swap-and-cutout")
def swap_and_cutout(
    source: UploadFile = File(...),
    target: UploadFile = File(...),
    model: str = Form("inswapper_128"),
    pixel_boost: str = Form("256x256"),
    enhance: bool = Form(True),
    authorization: Optional[str] = Header(default=None),
):
    """Birdaniga face swap VA cutout — 1 ta HTTP call.

    Natija: shaffof fonli PNG, foydalanuvchining asl yuzi bilan, ASL
    O'LCHAMDA. Yuzdan boshqa piksellar asl rasmdan o'zgarmay olinadi.

    `FACE_SWAP=off` bo'lsa yuzga tegilmaydi — natija `/cutout` niki bilan
    bir xil (`X-Face-Swap: off`).
    """
    _check_auth(authorization)
    req_id = uuid.uuid4().hex[:8]

    if not FACE_SWAP:
        png, how, stages = _cutout_png(_read_target(target), req_id)
        timing = _timing(**stages)
        logger.info("[%s] swap-and-cutout: almashtirish o'chiq, faqat kesim — %d bytes via=%s | %s", req_id, len(png), how, timing)
        return Response(
            content=png,
            media_type="image/png",
            headers={"X-Face-Swap": "off", "X-Cutout": how, "Server-Timing": timing},
        )

    src_bytes, tgt_bytes = _read_pair(source, target)

    arrived = time.monotonic()
    with _HEAVY:
        started = time.monotonic()
        # 1) Face swap
        swapped = _run_facefusion(src_bytes, tgt_bytes, model, pixel_boost, enhance, req_id)
        swapped_at = time.monotonic()
        logger.info("[%s] swap done %d bytes in %.1fs, composing...", req_id, len(swapped), swapped_at - started)

        try:
            original = cutout.decode(tgt_bytes)

            # 2) Faqat o'zgargan soha (yuz) yangi rasmdan olinadi
            merged, changed = compose.merge_swap(original, cutout.decode(swapped))

            # 3) Shaffoflik: asl alfa bo'lsa o'sha, aks holda model
            alpha = cutout.trusted_alpha(original)
            how = "alpha"
            if alpha is None:
                if original.mode == "RGBA" and merged.size == original.size:
                    merged.putalpha(original.getchannel("A"))
                alpha = cutout.model_alpha(merged)
                how = "model"

            masked_at = time.monotonic()
            png = cutout.encode_png(merged, alpha, darken_edges=how == "model")
        except Exception:  # noqa: BLE001
            logger.exception("[%s] compose/cutout failed; returning swapped JPEG", req_id)
            # Fallback: return swapped JPEG without cutout rather than fail completely
            return Response(
                content=swapped,
                media_type="image/jpeg",
                headers={"X-Face-Swap": "done", "X-Cutout": "failed"},
            )

    face = "done" if changed else "none"
    if not changed:
        logger.warning("[%s] facefusion rasmni o'zgartirmadi — maqsadda yuz topilmadi", req_id)

    done = time.monotonic()
    timing = _timing(
        queue=started - arrived,
        swap=swapped_at - started,
        cutout=masked_at - swapped_at,
        encode=done - masked_at,
        total=done - arrived,
    )
    logger.info("[%s] swap-and-cutout ok %d bytes face=%s cutout=%s | %s", req_id, len(png), face, how, timing)
    return Response(
        content=png,
        media_type="image/png",
        headers={"X-Face-Swap": face, "X-Cutout": how, "Server-Timing": timing},
    )
