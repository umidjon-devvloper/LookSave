"""Yetishmayotgan `mt_*` shape key'larni qo'shadi va bo'yni polga bog'laydi.

    Blender --background avatar_bodies.blend \
            --python blender_scripts/fix_morphs.py -- --save

`--save` bermasangiz hech narsa yozilmaydi — faqat nima o'zgarishini
ko'rsatadi. Yozishdan oldin `.blend` ning zaxirasini oling.

────────────────────────────────────────────────────────────────────────
IKKI MUAMMO TUZATILADI
────────────────────────────────────────────────────────────────────────

**1. `mt_height` avatarni polga botiradi.**

O'lchov shuni ko'rsatdi: hozir chanoq QOTIRILGAN va oyoq pastga cho'ziladi
(son pastki uchi −104 mm, boldir −185 mm, panja butunligicha −185 mm).
Ya'ni `mt_height = 1` da avatarning oyog'i poldan 185 mm pastga tushadi.

Ilova esa avatarni oyog'i `y = 0` da turadi deb chizadi — `ContactShadows`
ham, kamera ramkasi ham shunga qo'yilgan, va hech qayerda qayta yerga
qo'yish (re-ground) yo'q. Natijada bo'y o'zgarganda avatar polga botadi
yoki havoda osilib qoladi.

Tuzatish arifmetik: BARCHA `mt_height` og'ishlariga `+rise` qo'shiladi,
bu yerda `rise` — panjaning hozirgi pastga siljishi. Shunda:

    panja      −185 → 0        (polda qoladi)
    boldir past −185 → 0        yuqori −104 → +81
    son past   −104 → +81      yuqori 0 → +185
    gavda/bosh/qo'l  (kalit yo'q) → +185 butun siljish

Ya'ni tayanch nuqta chanoqdan POLGA ko'chadi. Bo'y o'sishi o'zgarmaydi —
185 mm bo'lib qoladi, faqat yo'nalishi yuqoriga.

**2. Yuqori tanada `mt_height`, bosh/bo'yinda `mt_weight` yo'q.**

Birinchi tuzatishdan keyin ular MAJBURIY bo'lib qoladi: chanoq ko'tarilsa,
gavda ham ko'tarilishi kerak, aks holda tana bo'g'imdan uziladi.

⚠️ QO'SHILGAN KALIT — MEXANIK, RASSOMNIKI EMAS. Gavda va bosh shunchaki
YUQORIGA SURILADI, cho'zilmaydi; bo'yi baland odamning gavdasi ham
uzunroq bo'ladi, buni faqat qo'lda modellash beradi. `mt_weight` esa
o'z o'qidan tashqariga bir tekis kengaytiradi. Ikkalasi ham "to'g'ri
ishlaydigan" darajada, "chiroyli" darajada emas — keyin qo'lda
tuzatilsin.
"""

import sys

import bpy

PARTS = [
    "body_head", "body_neck", "body_torso",
    "body_upperArm_L", "body_upperArm_R",
    "body_forearm_L", "body_forearm_R",
    "body_hand_L", "body_hand_R",
    "body_thigh_L", "body_thigh_R",
    "body_calf_L", "body_calf_R",
    "body_foot_L", "body_foot_R",
]

PREFIXES = ("M__", "F__")

# Kalit yo'q bo'lsa `mt_weight` qism o'z o'qidan shuncha ulushga kengayadi.
# Gavda va sonda kalit allaqachon bor — bu jadval faqat qolganlari uchun.
WEIGHT_SPREAD = {
    "body_head": 0.04,
    "body_neck": 0.08,
    "body_foot_L": 0.03,
    "body_foot_R": 0.03,
    "body_hand_L": 0.03,
    "body_hand_R": 0.03,
    "body_forearm_L": 0.05,
    "body_forearm_R": 0.05,
    "body_upperArm_L": 0.05,
    "body_upperArm_R": 0.05,
    "body_calf_L": 0.05,
    "body_calf_R": 0.05,
}


def argv_after_dashes() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def ensure_key(obj, name: str):
    """Kalit bo'lmasa yaratadi (asosdan nusxa) va uni qaytaradi."""
    keys = obj.data.shape_keys

    if keys is None:
        obj.shape_key_add(name="Basis", from_mix=False)
        keys = obj.data.shape_keys

    existing = keys.key_blocks.get(name)
    if existing is not None:
        return existing, False

    # `from_mix=False` — asosning aynan nusxasi, ya'ni og'ish nol
    block = obj.shape_key_add(name=name, from_mix=False)
    block.value = 0.0
    return block, True


def measure_rise(prefix: str) -> float:
    """Panja `mt_height` da qancha pastga tushishini o'lchaydi."""
    obj = bpy.data.objects.get(prefix + "body_foot_L")
    if obj is None or obj.data.shape_keys is None:
        return 0.0

    block = obj.data.shape_keys.key_blocks.get("mt_height")
    if block is None:
        return 0.0

    basis = obj.data.shape_keys.key_blocks[0]
    total = sum((a.co.z - b.co.z) for a, b in zip(block.data, basis.data))
    return -total / len(block.data)


def add_weight_key(obj, spread: float) -> None:
    """Qismni o'z tik o'qidan tashqariga bir tekis kengaytiradi."""
    block, _ = ensure_key(obj, "mt_weight")
    basis = obj.data.shape_keys.key_blocks[0]

    # O'q — qismning gorizontal markazi
    count = len(basis.data)
    cx = sum(v.co.x for v in basis.data) / count
    cy = sum(v.co.y for v in basis.data) / count

    for source, target in zip(basis.data, block.data):
        target.co.x = source.co.x + (source.co.x - cx) * spread
        target.co.y = source.co.y + (source.co.y - cy) * spread
        target.co.z = source.co.z


def main() -> None:
    save = "--save" in argv_after_dashes()
    changed = []

    for prefix in PREFIXES:
        rise = measure_rise(prefix)
        if rise <= 0:
            print(f"⚠️  {prefix}: panjada `mt_height` topilmadi — bo'y tuzatilmadi")
            continue

        print(f"\n[{prefix}] polga bog'lash: barcha mt_height og'ishiga +{rise * 1000:.0f} mm")

        for part in PARTS:
            obj = bpy.data.objects.get(prefix + part)
            if obj is None:
                print(f"   ⚠️  {part}: obyekt yo'q")
                continue

            block, created = ensure_key(obj, "mt_height")
            basis = obj.data.shape_keys.key_blocks[0]

            for point in block.data:
                point.co.z += rise

            if created:
                changed.append(f"{prefix}{part}: mt_height qo'shildi (+{rise * 1000:.0f} mm siljish)")
            else:
                changed.append(f"{prefix}{part}: mt_height polga bog'landi")

            # `mt_weight` — faqat yo'q bo'lganda va jadvalda bor bo'lsa
            has_weight = "mt_weight" in obj.data.shape_keys.key_blocks
            spread = WEIGHT_SPREAD.get(part)
            if not has_weight and spread:
                add_weight_key(obj, spread)
                changed.append(f"{prefix}{part}: mt_weight qo'shildi (+{spread * 100:.0f}%)")

            # Asos qiymatlari 0 bo'lib qolsin — neytralga ko'chirishni
            # `export_bodies.py` qiladi, bu yerda tegilmaydi
            for key in obj.data.shape_keys.key_blocks:
                if key is not basis:
                    key.value = 0.0

    print("\n===== O'ZGARISHLAR =====")
    for line in changed:
        print("  " + line)
    print(f"  jami: {len(changed)}")

    if save:
        bpy.ops.wm.save_mainfile()
        print(f"\n✅ saqlandi: {bpy.data.filepath}")
    else:
        print("\n(quruq yurish — yozilmadi. Yozish uchun `-- --save`)")


main()
