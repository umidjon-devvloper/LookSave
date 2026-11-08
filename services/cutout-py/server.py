"""
LookSave — Cutout service (fon olib tashlash).

⚠️ NEGA BU ALOHIDA XIZMAT:
Avval @imgly/background-removal-node (ONNX, "small"/"medium" modellar) Node
ichida ishlar edi — tez, lekin chekkalardagi halo va jag-stupeni past sifat
beradi. Bu xizmat `rembg` (Python) ichida `isnet-general-use` modelini
ishlatadi: bu model aynan odam/kiyim figurasi uchun tayyorlangan va chekkalari
ancha silliqroq chiqadi. Facefusion chiqargan qora fonli rasmlar ham toza
kesiladi.

Node API shu xizmatga POST /cutout orqali rasm jo'natadi, shaffof PNG qaytadi.

ISHGA TUSHIRISH (VPS):
    cd services/cutout-py
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    gunicorn -w 1 -b 127.0.0.1:7801 --timeout 90 server:app

yoki pm2 bilan (ecosystem.config.cjs ichida):
    name: 'looksave-cutout', script: 'services/cutout-py/.venv/bin/gunicorn',
    args: '-w 1 -b 127.0.0.1:7801 --timeout 90 server:app',
    cwd: 'services/cutout-py'

MODELNI BIRINCHI MAROTABA YUKLASH:
    rembg ni birinchi so'rovda ~170MB model yuklab oladi (~/.u2net/ ga).
    Lokal tez-tez buni oldindan qilish uchun:
        python -c "from rembg import new_session; new_session('isnet-general-use')"

RAM TALABI:
    isnet-general-use: ~400MB RAM ishga tushgandan keyin, inference paytida
    ~700MB cho'qqi. 1GB VPS'da ishlaydi lekin boshqa og'ir jarayonlar bilan
    birga ishlashga ehtiyot bo'lish kerak.
"""

from __future__ import annotations

import io
import logging
import os
from functools import lru_cache
from typing import Any

from flask import Flask, Response, jsonify, request
from PIL import Image
from rembg import new_session, remove

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("cutout")

# Oddiyroq va tezroq modellar mavjud:
#   u2netp (4.7MB, past) · silueta (43MB, o'rta) · isnet-general-use (170MB, yaxshi)
# Odam + kiyim uchun isnet-general-use eng toza — default shu.
MODEL = os.environ.get("CUTOUT_MODEL", "isnet-general-use")

# Kiruvchi rasmda maksimum o'lcham (balandligi/kengligi): kattarog'i shunga
# kichraytiriladi — latency va RAM cho'qqisi nazoratda qoladi.
MAX_SIDE = int(os.environ.get("CUTOUT_MAX_SIDE", "1600"))

# Alfa normallashtirish — chekkadagi yarim-shaffof piksellar aniqlashtirish uchun.
ALPHA_LO = int(os.environ.get("CUTOUT_ALPHA_LO", "30"))
ALPHA_HI = int(os.environ.get("CUTOUT_ALPHA_HI", "220"))


@lru_cache(maxsize=1)
def session() -> Any:
    """Modelni bir marta yuklab, keyin qayta ishlatish uchun kesh."""
    log.info("rembg modelini yuklamoqda: %s", MODEL)
    s = new_session(MODEL)
    log.info("model tayyor")
    return s


def _soften_alpha(image: Image.Image) -> Image.Image:
    """
    Chekka silliqlash:
      - Alfa kanalni ajratib normallashtiramiz (ALPHA_LO/HI).
      - Juda past alfa (fon qoldig'i) 0 ga tushadi.
      - Yuqori alfa (figura ichi) 255 ga ko'tariladi.
      - Oraliq chiziqli ramp — chekkalar antialias qoladi, pikselli stupeni emas.
    """
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    alpha = image.getchannel("A")
    lut = [
        0 if a < ALPHA_LO else 255 if a > ALPHA_HI else int((a - ALPHA_LO) * 255 / (ALPHA_HI - ALPHA_LO))
        for a in range(256)
    ]
    alpha = alpha.point(lut)
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
    # Modelni oldindan yuklab (lazily) ishga tushiramiz — birinchi so'rov tez bo'ladi
    try:
        session()
        return jsonify({"ok": True, "model": MODEL})
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
        src = _downscale(src)
        # rembg qaytargan ob'ekt PIL.Image yoki bytes — biz PIL ni so'raymiz
        out = remove(src, session=session())
        if isinstance(out, (bytes, bytearray)):
            out = Image.open(io.BytesIO(out))
        out = _soften_alpha(out)
        buf = io.BytesIO()
        out.save(buf, format="PNG", optimize=True)
        return Response(buf.getvalue(), mimetype="image/png")
    except Exception as exc:  # noqa: BLE001
        log.exception("cutout muvaffaqiyatsiz")
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    # Development uchun. Prod'da gunicorn ishlatiladi.
    port = int(os.environ.get("PORT", "7801"))
    app.run(host="127.0.0.1", port=port)
