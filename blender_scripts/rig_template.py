"""Mixamo nomli skelet, socket'lar va shape key nomlarini tayyorlaydi.

    blender --background --python blender_scripts/rig_template.py -- /path/to/out.blend

BU MODEL YARATMAYDI. Geometriya sizniki — bu skript faqat **nomlashni**
to'g'ri qilib beradi: suyaklar, 8 ta socket, 6 ta bo'sh shape key.

Nega kerak: nomlarni qo'lda yozganda bitta harf xatosi (`socket_foot_l`
o'rniga `socket_foot_L`) modelni telefonda ochgunga qadar bilinmaydi, va
o'shanda ham sabab ko'rinmaydi — poyabzal shunchaki sahna markazida
turadi.

Ish tartibi:
  1. Mixamo'dan skelet import qiling YOKI shu skript bilan bo'sh
     skelet yarating
  2. Tanangizni 15 ta mesh'ga bo'ling (nomlari `looksave_rules.BODY_PARTS`)
  3. `add_sockets()` — socket'lar suyaklarga bog'lanadi
  4. `add_shape_keys()` — bo'sh shape key'lar qo'shiladi, keyin ularni
     Blender'da qo'lda tahrirlaysiz
  5. `validate.py` bilan tekshiring

⚠️ Blender'da sinalmagan — konteynerda Blender yo'q. Blender 4.2 LTS
API'siga qarab yozilgan.
"""

from __future__ import annotations

import os
import sys

import bpy
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from looksave_rules import BONE_PREFIX, MORPH_KEYS, SOCKET_PARENTS  # noqa: E402

#: Socket'ning suyakka nisbatan siljishi (metrda, mahalliy koordinatada).
#: Bular TAXMIN — telefonda ko'rib tuzatiladi. Kepka boshga botib qolsa
#: yoki ko'zoynak yuzdan uzoqlashsa, shu raqamlar o'zgaradi.
SOCKET_OFFSETS: dict[str, tuple[float, float, float]] = {
    "socket_head": (0.0, 0.09, 0.0),
    "socket_face": (0.0, 0.01, 0.10),
    "socket_neck": (0.0, 0.0, 0.02),
    "socket_wrist_L": (0.0, 0.0, 0.0),
    "socket_wrist_R": (0.0, 0.0, 0.0),
    "socket_foot_L": (0.0, 0.0, 0.0),
    "socket_foot_R": (0.0, 0.0, 0.0),
    "socket_bag": (0.0, 0.0, -0.12),
}


def find_armature() -> bpy.types.Object | None:
    for obj in bpy.data.objects:
        if obj.type == "ARMATURE":
            return obj
    return None


def add_sockets(rig: bpy.types.Object) -> list[str]:
    """Har socket uchun bo'sh obyekt yaratib, suyakka parent qiladi.

    Mavjud socket qayta yaratilmaydi — skriptni bir necha marta ishga
    tushirish xavfsiz.
    """
    created: list[str] = []

    for socket, bone_short in SOCKET_PARENTS.items():
        if socket in bpy.data.objects:
            continue

        bone_name = BONE_PREFIX + bone_short
        if bone_name not in rig.data.bones:
            print(f"  o'tkazib yuborildi: {socket} — {bone_name} topilmadi")
            continue

        empty = bpy.data.objects.new(socket, None)
        empty.empty_display_type = "PLAIN_AXES"
        empty.empty_display_size = 0.05
        bpy.context.scene.collection.objects.link(empty)

        empty.parent = rig
        empty.parent_type = "BONE"
        empty.parent_bone = bone_name

        # Suyakka parent qilinganda Blender obyektni suyak UCHIGA qo'yadi,
        # ildiziga emas. Farqni ayirmasak socket suyak uzunligicha siljib
        # ketadi — kepka boshdan ancha yuqorida turadi.
        bone = rig.data.bones[bone_name]
        offset = Vector(SOCKET_OFFSETS.get(socket, (0.0, 0.0, 0.0)))
        empty.location = offset - Vector((0.0, bone.length, 0.0))

        created.append(socket)

    return created


def add_shape_keys(mesh_names: list[str] | None = None) -> list[str]:
    """Mesh'larga bo'sh `mt_*` shape key qo'shadi.

    Qiymatlar o'zgartirilmaydi — ular Blender'da qo'lda modellanadi.
    Skript faqat nomlarni to'g'ri qo'yadi va `Basis` borligini
    ta'minlaydi.
    """
    touched: list[str] = []

    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        if mesh_names is not None and obj.name not in mesh_names:
            continue

        if obj.data.shape_keys is None:
            obj.shape_key_add(name="Basis", from_mix=False)

        existing = {key.name for key in obj.data.shape_keys.key_blocks}

        for key_name in MORPH_KEYS:
            if key_name in existing:
                continue
            key = obj.shape_key_add(name=key_name, from_mix=False)
            # Neytral 0.5 (04-3d-pipeline §3) — ilova shu qiymatni
            # yuboradi, shuning uchun Blender'da ham shunday ko'rinsin
            key.value = 0.5
            key.slider_min = 0.0
            key.slider_max = 1.0

        touched.append(obj.name)

    return touched


def main() -> None:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []

    rig = find_armature()
    if rig is None:
        print("\n❌ Skelet topilmadi.")
        print("   Avval Mixamo'dan FBX import qiling:")
        print("   File → Import → FBX → mixamo.com dan yuklangan fayl\n")
        sys.exit(1)

    print(f"\n── Shablon tayyorlanmoqda: {rig.name} ──\n")

    sockets = add_sockets(rig)
    print(f"  socket: {len(sockets)} ta qo'shildi" if sockets else "  socket: hammasi mavjud")

    meshes = add_shape_keys()
    print(f"  shape key: {len(meshes)} ta mesh'ga qo'shildi")

    if args:
        target = args[0]
        bpy.ops.wm.save_as_mainfile(filepath=target)
        print(f"\n  saqlandi: {target}")

    print("\n  Keyingi qadam:")
    print("    1. Tanani 15 ta mesh'ga bo'ling (body_head … body_foot_R)")
    print("    2. Har shape key'ni Blender'da modellang")
    print("    3. blender --background <fayl> --python blender_scripts/validate.py -- base\n")


if __name__ == "__main__":
    main()
