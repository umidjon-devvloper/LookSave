"""Facefusion natijasini ASL rasmga qaytarib qo'yish.

⚠️ NEGA KERAK (2026-11-12). Facefusion butun kadrni JPEG qilib qaytaradi,
yuz esa kadrning kichik bir qismi. Ilgari o'sha JPEG to'liq olinardi:

  • kiyim piksellari ham qayta siqilardi — rangli yozuv va logotiplar
    atrofida JPEG xiraligi paydo bo'lardi, holbuki kiyimga hech kim
    tegmagan;
  • yuz topilmasa facefusion rasmni O'ZGARTIRMASDAN qaytaradi va xato
    bermaydi — «almashtirildi» bilan «tegilmadi» ni ajratib bo'lmasdi.

Bu yerda ikki nusxa solishtiriladi: FAQAT o'zgargan soha (yuz) yangi
rasmdan olinadi, qolgan hamma piksel asl rasmdan bit-ma-bit qoladi.
O'zgargan soha topilmasa — yuz almashmagan, va bu chaqiruvchiga aytiladi.
"""
from __future__ import annotations

from typing import Optional, Tuple

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

# Solishtirish shu o'lchamgacha kichraytirilgan nusxada bo'ladi: tezroq va
# JPEG shovqini o'rtachalanib kamayadi. Maska esa asl o'lchamda quriladi.
DETECT_SIDE = 768

# Silliqlangan farq (0–255) shundan past bo'lsa — bu JPEG shovqini.
MIN_DIFF = 10

# Farq mahalliy kontrastning shu ulushidan past bo'lsa — bu ham shovqin.
#
# ⚠️ BU SHART BO'LMASA TEKSHIRUV ISHLAMAYDI. JPEG xatosi keskin chegarada
# to'planadi (qora fon ↔ yorug' figura): u yerda farq 10–25 gacha chiqadi va
# butun siluet «o'zgargan» bo'lib ko'rinardi. Haqiqiy almashtirish esa
# SILLIQ teri sohasini o'zgartiradi — kontrast past, farq katta.
#
# O'lchangan (2026-11-12, uch xil rasm, q95/q90/q75 qayta siqish): ikkala
# shart birga — 0 ta soxta piksel; yuz sohasining eng mayin o'zgarishi
# (faqat 6% yorug'lik siljishi) — 3840 ta piksel.
CONTRAST_SHARE = 0.20
CONTRAST_FLOOR = 8.0

# O'zgargan soha shundan kichik bo'lsa (asl piksel, har tomoni) hisobga olinmaydi.
MIN_REGION = 20


def _local_contrast(image: Image.Image) -> np.ndarray:
    """Har piksel atrofidagi (7×7) eng yorug' va eng qorong'i orasidagi farq."""
    ranges = [
        np.asarray(
            ImageChops.subtract(
                channel.filter(ImageFilter.MaxFilter(7)),
                channel.filter(ImageFilter.MinFilter(7)),
            ),
            dtype=np.float32,
        )
        for channel in image.split()
    ]
    return np.max(ranges, axis=0)


def changed_region(
    before: Image.Image,
    after: Image.Image,
    visible: Optional[Image.Image] = None,
) -> Optional[Image.Image]:
    """O'zgargan soha maskasi ('L', chekkasi yumshoq) yoki None.

    `visible` — asl rasmning alfasi (bo'lsa). Ko'rinmaydigan piksellar
    solishtirilmaydi: shaffof joy ostidagi rang ixtiyoriy va u yerdagi farq
    hech narsani bildirmaydi.

    Maska — o'zgargan piksellarning TO'RTBURCHAGI, ularning o'zi emas.
    Facefusion yuzni to'rtburchak bilan joylaydi; uning ichida farq kichik
    bo'lgan joylar ham bor (bir xil teri rangi). Faqat «katta farq»
    piksellari olinsa, yuz ichida asl va yangi piksellar aralashib, dog'
    bo'lib ko'rinardi.
    """
    factor = max(1, -(-max(before.size) // DETECT_SIDE))
    small_before = before.reduce(factor) if factor > 1 else before
    small_after = after.reduce(factor) if factor > 1 else after

    a = np.asarray(small_before, dtype=np.int16)
    b = np.asarray(small_after, dtype=np.int16)
    diff = np.abs(a - b).max(axis=2).astype(np.uint8)

    if visible is not None:
        small_visible = visible.reduce(factor) if factor > 1 else visible
        diff[np.asarray(small_visible) < 16] = 0

    blurred = np.asarray(Image.fromarray(diff).filter(ImageFilter.BoxBlur(1)), dtype=np.float32)

    # Kadrning 90% i yuz emas — u yerdagi farq faqat shovqin. Chegara undan
    # ancha yuqori turadi, lekin MIN_DIFF dan past tushmaydi.
    noise = float(np.percentile(blurred, 90))
    limit = max(float(MIN_DIFF), 3.0 * noise + 4.0)

    contrast = _local_contrast(small_before)
    hot = (blurred >= limit) & (blurred >= CONTRAST_SHARE * (contrast + CONTRAST_FLOOR))

    # Ochish (kichraytirib-kattalashtirish): yakka dog'lar ketadi
    mask = Image.fromarray((hot * 255).astype(np.uint8))
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))

    box = mask.getbbox()
    if box is None:
        return None

    left, top, right, bottom = (value * factor for value in box)
    if right - left < MIN_REGION or bottom - top < MIN_REGION:
        return None

    # Hoshiya keng: facefusion to'rtburchagining chekkasida farq kichik va
    # u «o'zgargan» deb topilmaydi — hoshiya o'sha qismni ham qamraydi.
    # Haqiqiy natijada o'lchangan (2026-11-12): topilgan soha ko'z–burun–og'iz,
    # peshona chizig'idagi o'zgarish esa undan ~20% tashqarida edi. Tor
    # hoshiyada yuzning markazi yangi, cheti eski bo'lib qolardi.
    pad = max(8, int(0.5 * max(right - left, bottom - top)))
    width, height = before.size
    full = Image.new("L", before.size, 0)
    ImageDraw.Draw(full).rectangle(
        (
            max(0, left - pad),
            max(0, top - pad),
            min(width, right + pad),
            min(height, bottom + pad),
        ),
        fill=255,
    )

    # Yumshatish radiusi hoshiyadan kichik — topilgan soha 100% yangi qoladi
    return full.filter(ImageFilter.GaussianBlur(radius=pad / 4))


def merge_swap(original: Image.Image, swapped: Image.Image) -> Tuple[Image.Image, bool]:
    """Asl rasm + facefusion natijasi → (yakuniy RGB, yuz almashdimi).

    O'lchamlar mos kelmasa (kutilmagan hol) solishtirib bo'lmaydi — yangi
    rasm to'liq olinadi va «almashdi» deb hisoblanadi: bilmagan narsani
    «almashmadi» deb e'lon qilish noto'g'ri signal bo'lardi.
    """
    before = original.convert("RGB")
    after = swapped.convert("RGB")

    if before.size != after.size:
        return after, True

    visible = original.getchannel("A") if original.mode == "RGBA" else None
    region = changed_region(before, after, visible)
    if region is None:
        return before, False

    return Image.composite(after, before, region), True
