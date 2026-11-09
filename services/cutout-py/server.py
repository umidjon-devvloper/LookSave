"""
LookSave — Cutout service (premium fon olib tashlash).

⚠️ NEGA BU ALOHIDA XIZMAT:
Avval @imgly/background-removal-node (ONNX, "small"/"medium" modellar) Node
ichida ishlar edi — tez, lekin chekkalardagi halo va jag-stupeni past sifat
beradi. Bu xizmat `rembg` (Python) ichida PREMIUM modellarni ishlatadi:
`birefnet-general` eng toza natija beradi — odam/kiyim figurasi uchun mukammal
chekka, qora fon qoldig'i YO'Q, halo YO'Q. Facefusion chiqargan qora fonli
rasmlar ham mukammal kesiladi.

ALFA MATTING YONGAN: oddiy ikkilik mask emas, balki chekkalarda yarim-shaffof
piksellar bilan professional kompozitsiya — rasm sahnaga tabiiy qo'shiladi.

Node API shu xizmatga POST /cutout orqali rasm jo'natadi, shaffof PNG qaytadi.

ISHGA TUSHIRISH (VPS):
    cd services/cutout-py
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    gunicorn -w 1 -b 127.0.0.1:7801 --timeout 240 --access-logfile - server:app

yoki pm2 bilan (ecosystem.config.cjs ichida):
    name: 'looksave-cutout', script: 'services/cutout-py/.venv/bin/gunicorn',
    args: '-w 1 -b 127.0.0.1:7801 --timeout 240 server:app',
    cwd: 'services/cutout-py'

MODELNI BIRINCHI MAROTABA YUKLASH:
    birefnet-general ~440MB model yuklab oladi (~/.u2net/ ga). Oldindan:
        python -c "from rembg import new_session; new_session('birefnet-general')"

RAM TALABI:
    birefnet-general: ~1.2GB RAM ishga tushgandan keyin, inference paytida
    ~2GB cho'qqi. VPS 8GB RAM / 4 CPU — bemalol sig'adi.

MODELLAR (yangidan eskigacha, sifatdan tezgacha):
    birefnet-general          (440MB, PREMIUM — default)
    birefnet-portrait         (440MB, yuz + gavda uchun maxsus)
    birefnet-general-lite     (170MB, tez va yaxshi)
    isnet-general-use         (170MB, ilgarigi default)
    u2net_human_seg           (170MB, faqat inson)
    silueta                   ( 43MB, o'rtacha)
    u2netp                    (  5MB, past)
"""

from __future__ import annotations

import io
import logging
import os
from functools import lru_cache
from typing import Any

from flask import Flask, Response, jsonify, request
from PIL import Image, ImageFilter
from rembg import new_session, remove

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("cutout")

# PREMIUM default: birefnet-general — eng toza chekka.
# VPS sekinroq bo'lsa `birefnet-general-lite` yoki `isnet-general-use` ga o'zgartirish mumkin.
MODEL = os.environ.get("CUTOUT_MODEL", "birefnet-general")

# Kiruvchi rasmda maksimum o'lcham. 2048 — HD sifati, 1600 — tezroq.
MAX_SIDE = int(os.environ.get("CUTOUT_MAX_SIDE", "2048"))

# Alfa normallashtirish — chekkadagi yarim-shaffof piksellar aniqlashtirish uchun.
# LO past (10) → fon qoldig'i to'liq o'chadi; HI yuqori (245) → figura ichi to'liq opak.
ALPHA_LO = int(os.environ.get("CUTOUT_ALPHA_LO", "10"))
ALPHA_HI = int(os.environ.get("CUTOUT_ALPHA_HI", "245"))

# Alpha matting — rembg ichidagi professional chekka tozalash.
# Bu birefnet bilan birga ishlatilsa rasm studiodan chiqqandek bo'ladi.
ALPHA_MATTING = os.environ.get("CUTOUT_ALPHA_MATTING", "1") == "1"
AM_FG = int(os.environ.get("CUTOUT_AM_FG", "240"))  # 0-255, qancha yuqori — figura ichi shuncha ishonchli
AM_BG = int(os.environ.get("CUTOUT_AM_BG", "10"))   # 0-255, qancha past — fon shuncha ishonchli
AM_ERODE = int(os.environ.get("CUTOUT_AM_ERODE", "10"))  # chekka erozi (px) — halo olib tashlash

# Chekka silliqlash — Gauss blur radiusi (0 = o'chirilgan, 0.5-1.5 — tabiiy)
EDGE_BLUR = float(os.environ.get("CUTOUT_EDGE_BLUR", "0.6"))


@lru_cache(maxsize=1)
def session() -> Any:
    """Modelni bir marta yuklab, keyin qayta ishlatish uchun kesh."""
    log.info("rembg modelini yuklamoqda: %s", MODEL)
    s = new_session(MODEL)
    log.info("model tayyor: %s", MODEL)
    return s


def _soften_alpha(image: Image.Image) -> Image.Image:
    """
    Chekka silliqlash:
      - Alfa kanalni ajratib normallashtiramiz (ALPHA_LO/HI).
      - Juda past alfa (fon qoldig'i) 0 ga tushadi.
      - Yuqori alfa (figura ichi) 255 ga ko'tariladi.
      - Oraliq chiziqli ramp — chekkalar antialias qoladi, pikselli stupeni emas.
      - Yengil Gauss blur chekkalarni tabiiy qiladi.
    """
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    alpha = image.getchannel("A")
    lut = [
        0 if a < ALPHA_LO else 255 if a > ALPHA_HI else int((a - ALPHA_LO) * 255 / (ALPHA_HI - ALPHA_LO))
        for a in range(256)
    ]
    alpha = alpha.point(lut)
    if EDGE_BLUR > 0:
        alpha = alpha.filter(ImageFilter.GaussianBlur(radius=EDGE_BLUR))
    image.putalpha(alpha)
    return image


def _downscale(image: Image.Image) -> Image.Image:
    """MAX_SIDE dan katta bo'lsa nisbatni saqlab kichraytirish."""
    w, h = image.size
    side = max(w, h)
    if side <= MAX_SIDE:
        return image
    scale = MAX_SIDE / side
    nw, nh = int(w * scale), int(h * scale)
    return image.resize((nw, nh), Image.Resampling.LANCZOS)


app = Flask(__name__)


@app.get("/health")
def health() -> Any:
    try:
        session()
        return jsonify({"ok": True, "model": MODEL, "alpha_matting": ALPHA_MATTING, "max_side": MAX_SIDE})
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.post("/cutout")
def cutout() -> Any:
    """
    Kiruvchi: xom rasm bayt (image/jpeg yoki image/png).
    Chiquvchi: shaffof PNG (image/png).
    """
    if not request.data:
        return jsonify({"error": "bo'sh so'rov — image bytes kerak"}), 400
    try:
        src = Image.open(io.BytesIO(request.data))
        if src.mode not in ("RGB", "RGBA"):
            src = src.convert("RGBA")
        src = _downscale(src)

        # Alpha matting — rembg ichidagi premium chekka tozalash.
        # birefnet bilan birga ishlatilsa: chekka silliq, halo yo'q, fon qoldig'i yo'q.
        kwargs: dict[str, Any] = {"session": session()}
        if ALPHA_MATTING:
            kwargs.update({
                "alpha_matting": True,
                "alpha_matting_foreground_threshold": AM_FG,
                "alpha_matting_background_threshold": AM_BG,
                "alpha_matting_erode_size": AM_ERODE,
            })

        out = remove(src, **kwargs)
        if isinstance(out, (bytes, bytearray)):
            out = Image.open(io.BytesIO(out))
        out = _soften_alpha(out)
        buf = io.BytesIO()
        out.save(buf, format="PNG", optimize=True, compress_level=6)
        return Response(buf.getvalue(), mimetype="image/png")
    except Exception as exc:  # noqa: BLE001
        log.exception("cutout muvaffaqiyatsiz")
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "7801"))
    app.run(host="127.0.0.1", port=port)
