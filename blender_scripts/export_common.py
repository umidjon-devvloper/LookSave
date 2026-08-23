"""Eksport skriptlari uchun umumiy yordamchilar.

`looksave_rules.py` dan farqi: bu modul `bpy` ga tayanadi, ya'ni faqat
Blender ichida ishlaydi va Blendersiz sinab bo'lmaydi. Qoidalar (nomlar,
byudjetlar) o'sha faylda qoladi, bu yerda esa geometriya bilan bog'liq
ikkita amal.
"""

import sys

import bpy


def argv_after_dashes() -> list[str]:
    """Blender o'z argumentlarini `--` gacha yeydi — bizniki undan keyin."""
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def measure_rise(prefix: str = "M__") -> float:
    """`mt_height = 1` da gavda qancha yuqoriga ko'tarilishini o'lchaydi.

    Kiyim ham SHU qiymatga ko'tarilishi kerak, aks holda bo'y oshganda
    tana kiyimdan chiqib ketadi.

    ⚠️ O'LCHOV GAVDADAN OLINADI, PANJADAN EMAS. `fix_morphs.py` dan keyin
    panja `mt_height` da umuman qimirlamaydi (u polga bog'langan) — o'sha
    yerdan o'lchasak natija nol chiqadi va tuzatish jimgina ishlamay qoladi.
    Gavda esa aynan kerakli qiymatga suriladi.
    """
    obj = bpy.data.objects.get(prefix + "body_torso")
    if obj is None or obj.data.shape_keys is None:
        return 0.0

    block = obj.data.shape_keys.key_blocks.get("mt_height")
    if block is None:
        return 0.0

    basis = obj.data.shape_keys.key_blocks[0]
    total = sum((a.co.z - b.co.z) for a, b in zip(block.data, basis.data))
    return total / len(block.data)


def recentre_to_half(obj) -> bool:
    """`mt_*` kalitlarning neytral nuqtasini 0 dan 0.5 ga ko'chiradi.

    ⚠️ IKKI XIL KELISHUV TO'QNASHADI. Blender'da odatdagi tartib: asos mesh —
    neytral shakl, shape key — chetki holat, ya'ni neytral = 0. Ilova esa
    neytralni 0.5 deb biladi (04-3d-pipeline §3), chunki o'lchov ikki tomonga
    o'zgarishi kerak: 0 — "kichik" chet, 1 — "katta" chet. Server
    `computeMorphTargets` ham shunga qurilgan (`NEUTRAL` — oltita 0.5).

    Tuzatish qayta modellashsiz: har verteks uchun `S = Σ 0.5 · (kalit − asos)`
    hisoblanadi va asos ham, barcha kalitlar ham `−S` ga suriladi.

        0.5 da → (asos − S) + S = asos      rassom chizgan neytral
        0.0 da → asos − S                   "kichik" chet
        1.0 da → asos + S                   "katta" chet

    Diapazon yo'qolmaydi, faqat markazi ko'chadi. `fm_*` yuz morflari o'z
    farqini saqlaydi — ular ham `−S` ga suriladi, neytrali 0 bo'lib qoladi.

    Kalit topilmasa `False` qaytaradi.
    """
    keys = obj.data.shape_keys
    if keys is None:
        return False

    basis = keys.key_blocks[0]
    count = len(basis.data)

    shift = []
    for index in range(count):
        vector = basis.data[index].co.copy()
        vector.zero()
        shift.append(vector)

    found = False
    for block in keys.key_blocks[1:]:
        if not block.name.startswith("mt_"):
            continue
        found = True
        for index in range(count):
            shift[index] += (block.data[index].co - basis.data[index].co) * 0.5

    if not found:
        return False

    for block in keys.key_blocks:
        for index in range(count):
            block.data[index].co -= shift[index]

    # Mesh vertekslari asos bilan bir xil turishi kerak — aks holda
    # modifikatorlar va eksport eski holatni ko'radi
    for index, vertex in enumerate(obj.data.vertices):
        vertex.co -= shift[index]

    return True


def export_glb(objects, path, active=None) -> int:
    """Berilgan obyektlarni GLB qilib yozadi va bayt sonini qaytaradi."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        # ⚠️ YASHIRILGAN OBYEKT TANLANMAYDI va `use_selection` bilan eksport
        # JIMGINA BO'SH fayl yozadi (132 bayt, xatosiz). Shuning uchun avval
        # ko'rinadigan qilinadi.
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_select = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active or objects[0]

    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        # ⚠️ `export_apply` O'CHIQ: modifikatorlar qo'llansa Armature ham
        # "pishib" qoladi va mesh skeletdan uziladi — avatar qimirlamaydi.
        export_apply=False,
        export_skins=True,
        export_morph=True,
        # Morf normallari fayl hajmini ~2 barobar oshiradi, foydasi esa
        # deyarli ko'rinmaydi — telefon uchun arzimaydi.
        export_morph_normal=False,
        export_morph_tangent=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_yup=True,
    )

    return path.stat().st_size
