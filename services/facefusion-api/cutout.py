"""Cutout (background removal) — birefnet-general-lite + flood-fill + edge blur.

⚠️ RAM: model session'i ~500MB resident, inference +500MB-1GB peak.
   fly.io instance'da 8GB RAM yetarli; eski birefnet-general 2GB RAM yeydi
   va `shared-cpu-4x 8GB` da OOM bo'lardi.
"""
from __future__ import annotations

import io
import logging
import os
from functools import lru_cache
from typing import Any

import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

log = logging.getLogger("cutout")

# PREMIUM default: birefnet-general-lite — 440MB RAM, premium chekka.
MODEL = os.environ.get("CUTOUT_MODEL", "birefnet-general-lite")

# Kiruvchi rasmda maksimum o'lcham. 1024 — mobile ekran uchun yetarli,
# ONNX runtime RAM cho'qqisi mo'tadil (2-3GB).
MAX_SIDE = int(os.environ.get("CUTOUT_MAX_SIDE", "1024"))

# Alfa normallashtirish — chekkadagi yarim-shaffof piksellar aniqlashtirish uchun.
ALPHA_LO = int(os.environ.get("CUTOUT_ALPHA_LO", "10"))
ALPHA_HI = int(os.environ.get("CUTOUT_ALPHA_HI", "245"))

# Qora fon chetdan flood-fill (operator panellari uchun).
BLACK_BG_THRESHOLD = int(os.environ.get("CUTOUT_BLACK_BG_THRESHOLD", "70"))

# Flood tugagach chekka torayitish — halo yo'q qilish.
EDGE_ERODE = int(os.environ.get("CUTOUT_EDGE_ERODE", "3"))

# Chekka silliqlash — Gauss blur.
EDGE_BLUR = float(os.environ.get("CUTOUT_EDGE_BLUR", "2.0"))


@lru_cache(maxsize=1)
def get_session() -> Any:
    """Modelni bir marta yuklab, qayta ishlatish uchun kesh."""
    log.info("rembg modelini yuklamoqda: %s", MODEL)
    s = new_session(MODEL)
    log.info("model tayyor: %s", MODEL)
    return s


def _strip_edge_black(image: Image.Image, threshold: int = 70) -> Image.Image:
    """Chetdan boshlab qora fonni shaffof qiladi.

    Operator panellarida figura atrofida QORA (rgba(0,0,0,255)) bo'ladi.
    Flood-fill 4 burchakdan — chetga bog'langan qora = fon (shaffof).
    Ichkaridagi qora (kiyim, soch) saqlanadi.
    """
    if threshold <= 0:
        return image
    if image.mode != "RGBA":
        image = image.convert("RGBA")

    arr = np.array(image)
    rgb = arr[..., :3]
    is_black = np.all(rgb < threshold, axis=2)

    h, w = is_black.shape
    seed = np.zeros_like(is_black, dtype=bool)
    seed[0, :] = is_black[0, :]
    seed[-1, :] = is_black[-1, :]
    seed[:, 0] = is_black[:, 0]
    seed[:, -1] = is_black[:, -1]

    prev_count = -1
    for _ in range(200):
        count = int(seed.sum())
        if count == prev_count:
            break
        prev_count = count
        expanded = (
            seed
            | np.roll(seed, 1, axis=0)
            | np.roll(seed, -1, axis=0)
            | np.roll(seed, 1, axis=1)
            | np.roll(seed, -1, axis=1)
        )
        seed = expanded & is_black

    arr[..., 3] = np.where(seed, 0, arr[..., 3])

    if EDGE_ERODE > 0:
        halo = seed.copy()
        for _ in range(EDGE_ERODE):
            halo = (
                halo
                | np.roll(halo, 1, axis=0)
                | np.roll(halo, -1, axis=0)
                | np.roll(halo, 1, axis=1)
                | np.roll(halo, -1, axis=1)
            )
        new_halo = halo & ~seed
        arr[..., 3] = np.where(new_halo, arr[..., 3] // 3, arr[..., 3])

    return Image.fromarray(arr, mode="RGBA")


def _soften_alpha(image: Image.Image) -> Image.Image:
    """Chekka silliqlash — chiziqli ramp + Gauss blur."""
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


def make_cutout(data: bytes) -> bytes:
    """Rasmni qabul qilib, shaffof fonli PNG qaytaradi."""
    src = Image.open(io.BytesIO(data))
    if src.mode not in ("RGB", "RGBA"):
        src = src.convert("RGBA")
    src = _downscale(src)

    if BLACK_BG_THRESHOLD > 0:
        src = _strip_edge_black(src, threshold=BLACK_BG_THRESHOLD)

    out = remove(src, session=get_session())
    if isinstance(out, (bytes, bytearray)):
        out = Image.open(io.BytesIO(out))
    out = _soften_alpha(out)

    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True, compress_level=6)
    return buf.getvalue()
