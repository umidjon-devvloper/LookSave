"""Blender sahnasini QA qoidalariga solishtiradi.

    blender --background model.blend --python blender_scripts/validate.py -- top
    blender --background body_male_v3.blend --python blender_scripts/validate.py -- base

Oxirgi argument — slot (`top`, `feet`, …) yoki `base` (tana fayli uchun).
Slot berilmasa fayl nomidan aniqlanishga urinadi.

Chiqish kodi: xato bo'lsa 1 — shunda skriptni CI yoki eksport
zanjirida to'siq sifatida ishlatish mumkin.

⚠️ MEN BU SKRIPTNI ISHGA TUSHIRA OLMADIM — konteynerda Blender yo'q.
Qoidalar (`looksave_rules.py`) testlangan, lekin `bpy` chaqiruvlari
faqat sizning Blender versiyangizda tekshiriladi. Blender 4.2 LTS
uchun yozilgan.
"""

from __future__ import annotations

import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from looksave_rules import (  # noqa: E402
    check_body_meshes,
    check_bones,
    check_materials,
    check_morphs,
    check_polycount,
    check_sockets,
    slot_from_filename,
)


def script_args() -> list[str]:
    """`--` dan keyingi argumentlar. Blender o'zinikini oldin oladi."""
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def armature() -> bpy.types.Object | None:
    for obj in bpy.data.objects:
        if obj.type == "ARMATURE":
            return obj
    return None


def socket_parents() -> dict[str, str]:
    """Socket nomi → bog'langan suyak.

    Blender'da suyakka parent qilingan obyektda `parent_bone` to'ldiriladi
    va `parent_type == 'BONE'` bo'ladi. Oddiy obyekt parent bo'lsa suyak
    nomi bo'sh qoladi — bu ham xato, `check_sockets` ushlaydi.
    """
    parents: dict[str, str] = {}

    for obj in bpy.data.objects:
        if not obj.name.startswith("socket_"):
            continue
        if obj.parent_type == "BONE" and obj.parent_bone:
            parents[obj.name] = obj.parent_bone

    return parents


def shape_keys(obj: bpy.types.Object) -> list[str]:
    if obj.type != "MESH" or obj.data.shape_keys is None:
        return []
    return [key.name for key in obj.data.shape_keys.key_blocks]


def triangle_count() -> int:
    """Uchburchaklar soni — modifikatorlar qo'llangandan keyin.

    `len(mesh.polygons)` yaramaydi: quad va n-gon'lar bitta polygon
    bo'lib sanaladi, GPU esa ularni uchburchakka bo'ladi. Byudjet
    uchburchakda o'lchanadi.
    """
    total = 0
    depsgraph = bpy.context.evaluated_depsgraph_get()

    for obj in bpy.data.objects:
        if obj.type != "MESH" or not obj.visible_get():
            continue

        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()

    return total


def material_count() -> int:
    used: set[str] = set()
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            if slot.material is not None:
                used.add(slot.material.name)
    return len(used)


def report(title: str, problems: list[str]) -> int:
    if not problems:
        print(f"  OK   {title}")
        return 0

    print(f"  XATO {title}")
    for problem in problems:
        print(f"       - {problem}")
    return len(problems)


def main() -> None:
    args = script_args()
    filename = os.path.basename(bpy.data.filepath) or "(saqlanmagan)"

    slot = args[0] if args else slot_from_filename(filename.replace(".blend", ".glb"))

    print(f"\n── LookSave QA: {filename} ──")
    print(f"   slot: {slot or '(aniqlanmadi)'}\n")

    errors = 0
    rig = armature()

    if rig is None:
        print("  XATO skelet (armature) topilmadi")
        errors += 1
    else:
        bones = [bone.name for bone in rig.data.bones]
        errors += report("skelet", check_bones(bones))

    empties = [obj.name for obj in bpy.data.objects if obj.name.startswith("socket_")]
    meshes = [obj.name for obj in bpy.data.objects if obj.type == "MESH"]

    if slot == "base":
        # Tana fayli: socket va 15 mesh shu yerda bo'lishi shart
        errors += report("socket'lar", check_sockets(empties, socket_parents()))
        errors += report("tana mesh'lari", check_body_meshes(meshes))

        body = bpy.data.objects.get("body_torso")
        if body is not None:
            errors += report("shape key'lar", check_morphs(shape_keys(body), "top"))
        else:
            print("  XATO body_torso topilmadi — shape key'lar tekshirilmadi")
            errors += 1
    elif slot is not None:
        # Kiyim fayli: bitta model, shape key slotga qarab
        keys: list[str] = []
        for obj in bpy.data.objects:
            if obj.type == "MESH":
                keys.extend(shape_keys(obj))

        errors += report("shape key'lar", check_morphs(keys, slot))
        errors += report("poligon", check_polycount(triangle_count(), slot))
        errors += report("material", check_materials(material_count()))
    else:
        print("  XATO slot aniqlanmadi — argument sifatida bering")
        errors += 1

    print(f"\n   uchburchak: {triangle_count():,}   material: {material_count()}")

    if errors:
        print(f"\n❌ {errors} ta muammo. Eksport qilmang.\n")
        sys.exit(1)

    print("\n✅ Tekshiruvdan o'tdi.\n")


if __name__ == "__main__":
    main()
