"""Tanadagi `mt_*` shape key'larni kiyimga ko'chiradi (04-3d-pipeline §3).

Blender ichida (GUI'da) ishlatiladi:
  1. Sahnada tana (`body_torso`) va kiyim bo'lsin
  2. Kiyimni tanlang (u faol obyekt bo'lsin)
  3. Scripting → Run Script

Yoki buyruq satridan:
  blender --background model.blend --python blender_scripts/transfer_morphs.py -- hoodie

Nima qiladi: kiyimga Surface Deform modifikatori qo'shadi, tanadagi har
bir shape key'ni navbat bilan `1.0` ga qo'yib, hosil bo'lgan shaklni
kiyimda shape key sifatida saqlaydi.

⚠️ Bu hujjatdagi skriptning kengaytirilgan varianti. Farqlari: xatolar
tekshiriladi, mavjud shape key'lar qayta yaratilmaydi, bind
muvaffaqiyatsiz bo'lsa aniq sabab aytiladi.

⚠️ Blender'da sinalmagan.
"""

from __future__ import annotations

import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from looksave_rules import MORPH_KEYS  # noqa: E402

BODY_MESH = "body_torso"
MODIFIER = "LS_SurfaceDeform"


def resolve_target() -> bpy.types.Object | None:
    """Kiyim obyekti: faol obyekt yoki `--` dan keyingi nom."""
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []

    if args:
        return bpy.data.objects.get(args[0])

    active = bpy.context.active_object
    if active is not None and active.type == "MESH" and active.name != BODY_MESH:
        return active

    return None


def main() -> None:
    body = bpy.data.objects.get(BODY_MESH)
    if body is None:
        print(f"\n❌ `{BODY_MESH}` topilmadi. Tana faylini sahnaga qo'shing:")
        print("   File → Append → body_male_v3.blend → Object → body_torso\n")
        sys.exit(1)

    if body.data.shape_keys is None:
        print(f"\n❌ `{BODY_MESH}` da shape key yo'q. Avval rig_template.py ni ishlating.\n")
        sys.exit(1)

    cloth = resolve_target()
    if cloth is None:
        print("\n❌ Kiyim tanlanmagan. Kiyimni tanlang yoki nomini argument qilib bering.\n")
        sys.exit(1)

    print(f"\n── {cloth.name} ← {BODY_MESH} ──\n")

    body_keys = body.data.shape_keys.key_blocks
    missing = [name for name in MORPH_KEYS if name not in body_keys]
    if missing:
        print(f"❌ Tanada shape key yetishmayapti: {', '.join(missing)}\n")
        sys.exit(1)

    # Ko'chirish paytida hamma shape key nolda turishi shart, aks holda
    # deformatsiyalar bir-biriga qo'shilib ketadi
    saved = {name: body_keys[name].value for name in MORPH_KEYS}
    for name in MORPH_KEYS:
        body_keys[name].value = 0.0

    if cloth.data.shape_keys is None:
        cloth.shape_key_add(name="Basis", from_mix=False)

    existing = {key.name for key in cloth.data.shape_keys.key_blocks}

    bpy.context.view_layer.objects.active = cloth
    cloth.select_set(True)

    modifier = cloth.modifiers.get(MODIFIER)
    if modifier is None:
        modifier = cloth.modifiers.new(name=MODIFIER, type="SURFACE_DEFORM")
    modifier.target = body

    bpy.ops.object.surfacedeform_bind(modifier=MODIFIER)

    # Bind muvaffaqiyatsiz bo'lsa `is_bound` False qoladi va keyingi
    # qadamlar jim ishlaydi, lekin natija noto'g'ri bo'ladi
    if not modifier.is_bound:
        cloth.modifiers.remove(modifier)
        print("❌ Surface Deform bind bo'lmadi.\n")
        print("   Sabablari, ehtimollik tartibida:")
        print("   - Kiyim tanadan uzoq (bind faqat yaqin yuzalarni topadi)")
        print("   - Tanada n-gon bor (Surface Deform faqat tri/quad bilan ishlaydi)")
        print("   - Kiyimda modifikator stack tartibi noto'g'ri\n")
        for name, value in saved.items():
            body_keys[name].value = value
        sys.exit(1)

    copied: list[str] = []
    skipped: list[str] = []

    for name in MORPH_KEYS:
        if name in existing:
            skipped.append(name)
            continue

        body_keys[name].value = 1.0
        bpy.ops.object.modifier_apply_as_shapekey(keep_modifier=True, modifier=MODIFIER)
        cloth.data.shape_keys.key_blocks[-1].name = name
        body_keys[name].value = 0.0
        copied.append(name)

    cloth.modifiers.remove(modifier)

    for name, value in saved.items():
        body_keys[name].value = value

    print(f"  ko'chirildi: {len(copied)}")
    if skipped:
        print(f"  mavjud edi:  {', '.join(skipped)}")

    print("\n  Tekshiring: tanadagi mt_weight ni 1.0 ga qo'ying —")
    print("  kiyim ham u bilan birga kengayishi kerak.\n")


if __name__ == "__main__":
    main()
