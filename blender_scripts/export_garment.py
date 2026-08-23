"""Blender'da modellashtirilgan kiyimni ilova kutgan GLB ga eksport qiladi.

    Blender --background avatar_bodies.blend \
            --python blender_scripts/export_garment.py -- demo_tshirt chiqish.glb

Tanadan farqi: kiyimda skelet ham, socket ham yo'q — u tinch holatda
(rest pose) tananing o'lchamiga qarab yasalgan va avatar ildiziga
qo'yiladi (`src/three/garment.ts` dagi `STATIC` yo'li).

Uchta narsa to'g'rilanadi:

  1. **X siljishi.** Blend'da tanalar yonma-yon turadi va kiyim erkak
     tanasining ustida (x = −0.7). Ilova esa avatarni koordinata boshida
     kutadi.

  2. **Neytral nuqta.** `mt_*` kalitlarning markazi 0 dan 0.5 ga ko'chadi —
     `export_common.recentre_to_half` ga qarang.

  3. **Bo'y bilan ko'tarilish.** ⚠️ ENG OSON O'TKAZIB YUBORILADIGANI:
     `demo_tshirt` ning `mt_height` kaliti atigi 2 mm harakat qiladi, ya'ni
     amalda yo'q. Tana esa `fix_morphs.py` dan keyin bo'y oshganda gavdasini
     to'liq ko'taradi. Tuzatilmasa `mt_height = 1` da tana ko'tariladi,
     futbolka esa joyida qoladi — u belgacha tushib, gavda undan chiqib
     turadi. Shuning uchun kiyimning `mt_height` og'ishiga ham xuddi shu
     `rise` qo'shiladi.
"""

import sys
from pathlib import Path

import bpy

sys.path.append(str(Path(__file__).resolve().parent))

from export_common import argv_after_dashes, export_glb, measure_rise, recentre_to_half


def fail(message: str) -> None:
    print(f"❌ {message}")
    sys.exit(1)


def main() -> None:
    args = argv_after_dashes()
    if not args:
        fail("kiyim obyektining nomi berilmadi")

    name = args[0]
    obj = bpy.data.objects.get(name)
    if obj is None:
        fail(f"{name} topilmadi")
    if obj.type != "MESH":
        fail(f"{name} mesh emas ({obj.type})")

    out = Path(args[1]) if len(args) > 1 else Path(bpy.data.filepath).parent / f"{name}.glb"
    out.parent.mkdir(parents=True, exist_ok=True)

    # ⚠️ Mesh nomi `body_` bilan boshlanmasligi kerak: ilovadagi
    # `applyHiddenParts` shu qolipga tushgan hamma narsani tana qismi deb
    # biladi va kiyimni yashirib qo'yadi.
    if obj.name.startswith("body_"):
        fail(f"{obj.name}: kiyim mesh'i `body_` bilan boshlanmasin")

    rise = measure_rise()

    # ── Bo'y bilan ko'tarilish ──
    keys = obj.data.shape_keys
    if keys is None:
        print(f"⚠️  {name}: shape key yo'q — o'lcham o'zgarganda kiyim moslashmaydi")
    else:
        height = keys.key_blocks.get("mt_height")
        if height is None:
            height = obj.shape_key_add(name="mt_height", from_mix=False)
            print(f"   mt_height qo'shildi (+{rise * 1000:.0f} mm)")
        else:
            print(f"   mt_height polga bog'landi (+{rise * 1000:.0f} mm)")

        for point in height.data:
            point.co.z += rise

        recentre_to_half(obj)

        for block in keys.key_blocks[1:]:
            block.value = 0.5 if block.name.startswith("mt_") else 0.0

    # ── X siljishini bekor qilish ──
    # Kiyim erkak tanasining ustida turadi, tana esa `M__rig` bilan surilgan
    rig = bpy.data.objects.get("M__rig")
    offset = rig.location.x if rig else obj.location.x
    obj.location.x -= offset

    size = export_glb([obj], out)
    print(f"[export] {name} → {out}  ({size / 1024:.0f} KB, {len(obj.data.polygons)} yuz)")


main()
