"""Blender'dagi tanalarni ilova kutgan GLB ga eksport qiladi.

    Blender --background avatar_bodies.blend \
            --python blender_scripts/export_bodies.py -- male  [chiqish.glb]

NEGA KERAK: `avatar_bodies.blend` da ikkala tana bitta sahnada, yonma-yon
turadi va nomlari `M__` / `F__` prefiksi bilan ajratilgan. Ilova esa har
jinsni ALOHIDA faylda va prefikssiz nom bilan kutadi (`body_torso`,
`socket_head`), chunki `hide_body_parts` va socket qidiruvi aynan shu
nomlarga tayanadi (04-3d-pipeline §2).

Skript sahnani o'zgartiradi, lekin `.blend` ni SAQLAMAYDI — har ishga
tushirish toza fayldan boshlanadi.

Nima qiladi:
  1. Bitta jinsning 15 tana mesh'i, rigi va 8 socketini ajratadi
  2. Prefiksni olib tashlaydi
  3. Tanani X bo'yicha 0 ga qaytaradi (blend'da ular yonma-yon turadi)
  4. `mt_*` shape key'larni 0.5 ga qo'yadi — NEYTRAL holat shu
  5. GLB yozadi

⚠️ `mt_*` = 0.5 TASODIF EMAS. Hujjat (04-3d-pipeline §3) neytral holatni
0.5 deb belgilaydi: asos geometriya "kichik" chetda, shape key "katta"
chetda, o'rtasi esa haqiqiy proporsiya. GLB ga aynan shu qiymatlar
standart og'irlik bo'lib yoziladi va ilova ularni o'zgartirmaguncha
avatar to'g'ri ko'rinadi.
"""

import sys
from pathlib import Path

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

SOCKETS = [
    "socket_head", "socket_face", "socket_neck",
    "socket_wrist_L", "socket_wrist_R",
    "socket_foot_L", "socket_foot_R", "socket_bag",
]

PREFIX = {"male": "M__", "female": "F__"}


def argv_after_dashes() -> list[str]:
    """Blender o'z argumentlarini `--` gacha yeydi — bizniki undan keyin."""
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def fail(message: str) -> None:
    print(f"❌ {message}")
    sys.exit(1)


def recentre_to_half(obj) -> None:
    """`mt_*` kalitlarning neytral nuqtasini 0 dan 0.5 ga ko'chiradi.

    ⚠️ NEGA KERAK — IKKI XIL KELISHUV TO'QNASHADI.

    Blender'da odatdagi ish tartibi: asos mesh — neytral shakl, shape key
    esa chetki holat, ya'ni neytral = 0. `avatar_bodies.blend` aynan shunday
    yasalgan (fayldagi barcha `mt_*` qiymati 0).

    Ilova esa boshqa kelishuvni kutadi (04-3d-pipeline §3): neytral = 0.5,
    chunki o'lchov ikki tomonga o'zgarishi kerak — 0 past chegara ("kichik"),
    1 yuqori chegara ("katta"). Server `computeMorphTargets` ham shunga
    qurilgan: `NEUTRAL` — oltita 0.5.

    Shu farq tuzatilmasa avatar ilovada buziladi: `mt_height = 0.5` da oyoq
    yarim uzunlikka cho'ziladi va tanadan uzilib qoladi.

    QANDAY TUZATILADI — qayta modellashsiz. Har verteks uchun
    `S = Σ 0.5 · (kalit − asos)` hisoblanadi va asos ham, BARCHA kalitlar ham
    `−S` ga suriladi. Shunda:

        0.5 da  →  (asos − S) + S = asos   ya'ni rassom chizgan neytral
        0.0 da  →  asos − S               "kichik" chet
        1.0 da  →  asos + S               "katta" chet

    Ya'ni diapazon yo'qolmaydi, faqat markazi 0.5 ga ko'chadi. `fm_*` yuz
    morflari o'z farqini saqlab qoladi — ular ham `−S` ga suriladi, lekin
    ularning neytrali 0 bo'lib qolaveradi.
    """
    keys = obj.data.shape_keys
    basis = keys.key_blocks[0]
    count = len(basis.data)

    shift = [None] * count
    for index in range(count):
        shift[index] = basis.data[index].co.copy()
        shift[index].zero()

    found = False
    for block in keys.key_blocks[1:]:
        if not block.name.startswith("mt_"):
            continue
        found = True
        for index in range(count):
            shift[index] += (block.data[index].co - basis.data[index].co) * 0.5

    if not found:
        return

    for block in keys.key_blocks:
        for index in range(count):
            block.data[index].co -= shift[index]

    # Mesh vertekslari asos bilan bir xil turishi kerak — aks holda
    # modifikatorlar va eksport asosni emas, eski holatni ko'radi
    for index, vertex in enumerate(obj.data.vertices):
        vertex.co -= shift[index]


def main() -> None:
    args = argv_after_dashes()
    gender = args[0] if args else "male"

    if gender not in PREFIX:
        fail(f"jins 'male' yoki 'female' bo'lishi kerak, berilgani: {gender}")

    prefix = PREFIX[gender]
    default_out = Path(bpy.data.filepath).parent / f"{gender}-base-v1.glb"
    out = Path(args[1]) if len(args) > 1 else default_out
    out.parent.mkdir(parents=True, exist_ok=True)

    rig = bpy.data.objects.get(f"{prefix}rig")
    if rig is None:
        fail(f"{prefix}rig topilmadi")

    meshes = []
    for part in PARTS:
        obj = bpy.data.objects.get(prefix + part)
        if obj is None:
            fail(f"{prefix}{part} topilmadi — tana 15 qismga bo'linmagan")
        meshes.append(obj)

    sockets = []
    for socket in SOCKETS:
        obj = bpy.data.objects.get(prefix + socket)
        if obj is None:
            print(f"⚠️  {prefix}{socket} yo'q — u holda ilova unga biriktirilgan buyumni ildizga qo'yadi")
            continue
        sockets.append(obj)

    exported = [rig, *meshes, *sockets]

    # ── X siljishini bekor qilish ──
    # Blend'da tanalar yonma-yon (erkak x=-0.7, ayol x=+0.7). Ilova esa
    # avatarni koordinata boshida kutadi: kamera va oyoq ostidagi soya
    # x=0 ga qarab qo'yilgan.
    offset = rig.location.x
    for obj in exported:
        # Rigga bog'langanlar u bilan birga siljiydi — ikki marta surilmasin
        if obj.parent is rig:
            continue
        obj.location.x -= offset

    # ── Shape key'lar: neytral holat ──
    for obj in meshes:
        keys = obj.data.shape_keys
        if keys is None:
            print(f"⚠️  {obj.name}: shape key yo'q — o'lcham o'zgarganda bu qism qimirlamaydi")
            continue

        recentre_to_half(obj)

        for block in keys.key_blocks:
            if block.name.startswith("mt_"):
                block.value = 0.5
            elif block.name.startswith("fm_"):
                # Yuz morflari foydalanuvchi skanidan keladi — asosi neytral 0
                block.value = 0.0

    # ── Nomlarni tozalash ──
    # ⚠️ FAYL SAQLANMAYDI, shuning uchun bu o'zgarish faqat shu seansda.
    for obj in exported:
        if obj.name.startswith(prefix):
            obj.name = obj.name[len(prefix) :]
    rig.name = "rig"

    # ── Tanlash ──
    bpy.ops.object.select_all(action="DESELECT")
    for obj in exported:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig

    print(f"\n[export] {gender}: {len(meshes)} mesh, {len(sockets)} socket, "
          f"{len(rig.data.bones)} suyak → {out}")

    bpy.ops.export_scene.gltf(
        filepath=str(out),
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

    size_kb = out.stat().st_size / 1024
    print(f"[export] tayyor: {size_kb:.0f} KB")


main()
