"""LookSave 3D kelishuvlari — sof qoidalar.

Bu modul `bpy` ni IMPORT QILMAYDI. Sabab: Blender ichida xato topilganda
uni tuzatish uchun Blender'ni qayta ochish kerak bo'ladi, bu sekin. Qoidalar
alohida turgani uchun ularni oddiy `python3` bilan sinash mumkin:

    python3 blender_scripts/test_rules.py

`validate.py` sahnadan ma'lumot yig'ib shu funksiyalarga uzatadi.

Manba: docs/04-3d-pipeline.md §2-3
"""

from __future__ import annotations

# ── Skelet (04-3d-pipeline §2) ──────────────────────────────────────────

BONE_PREFIX = "mixamorig:"

REQUIRED_BONES: tuple[str, ...] = (
    "Hips",
    "Spine",
    "Spine1",
    "Spine2",
    "Neck",
    "Head",
    "HeadTop_End",
    "LeftShoulder",
    "LeftArm",
    "LeftForeArm",
    "LeftHand",
    "RightShoulder",
    "RightArm",
    "RightForeArm",
    "RightHand",
    "LeftUpLeg",
    "LeftLeg",
    "LeftFoot",
    "LeftToeBase",
    "RightUpLeg",
    "RightLeg",
    "RightFoot",
    "RightToeBase",
)

#: Socket nomi → ota suyak (prefikssiz).
SOCKET_PARENTS: dict[str, str] = {
    "socket_head": "Head",
    "socket_face": "Head",
    "socket_neck": "Neck",
    "socket_wrist_L": "LeftHand",
    "socket_wrist_R": "RightHand",
    "socket_foot_L": "LeftFoot",
    "socket_foot_R": "RightFoot",
    "socket_bag": "Spine2",
}

# ── Tana mesh'lari ──────────────────────────────────────────────────────

BODY_PARTS: tuple[str, ...] = (
    "body_head",
    "body_neck",
    "body_torso",
    "body_upperArm_L",
    "body_upperArm_R",
    "body_forearm_L",
    "body_forearm_R",
    "body_hand_L",
    "body_hand_R",
    "body_thigh_L",
    "body_thigh_R",
    "body_calf_L",
    "body_calf_R",
    "body_foot_L",
    "body_foot_R",
)

# ── Blendshape (04-3d-pipeline §3) ──────────────────────────────────────

MORPH_KEYS: tuple[str, ...] = (
    "mt_height",
    "mt_weight",
    "mt_shoulderWidth",
    "mt_chest",
    "mt_waist",
    "mt_hips",
)

#: Shape key MAJBURIY bo'lgan slotlar. Qolganlarida fayl hajmini
#: behuda oshiradi (§3, "Xarajat ogohlantirishi").
SLOTS_NEEDING_MORPHS: frozenset[str] = frozenset({"top", "outer", "bottom"})

ALL_SLOTS: frozenset[str] = frozenset(
    {"head", "face", "neck", "top", "outer", "bottom", "feet", "wrist", "bag"}
)

# ── Poligon byudjeti (§5, 3-bosqich) ────────────────────────────────────

#: slot → (minimal kutilgan, maksimal ruxsat etilgan)
POLY_BUDGET: dict[str, tuple[int, int]] = {
    "top": (1_000, 4_000),
    "outer": (2_000, 6_000),
    "bottom": (1_500, 5_000),
    "feet": (1_000, 4_000),
    "head": (300, 2_000),
    "face": (100, 1_000),
    "neck": (200, 1_500),
    "wrist": (200, 1_500),
    "bag": (500, 3_000),
}

#: Draw call'lar soni FPS ga poligondan ko'ra ko'proq ta'sir qiladi (§Muammolar).
MAX_MATERIALS = 3

# ── Fayl nomi (§4) ──────────────────────────────────────────────────────

_NAME_ALLOWED = set("abcdefghijklmnopqrstuvwxyz0123456789-_")


def check_filename(name: str) -> list[str]:
    """`{brend}_{mahsulot-slug}_{rang}_{slot}.glb` qoidasini tekshiradi."""
    problems: list[str] = []

    if not name.endswith(".glb"):
        problems.append(f"fayl `.glb` bilan tugashi kerak: {name}")
        return problems

    stem = name[: -len(".glb")]

    if set(stem) - _NAME_ALLOWED:
        bad = "".join(sorted(set(stem) - _NAME_ALLOWED))
        problems.append(f"nomda ruxsat etilmagan belgi: {bad!r} (faqat a-z 0-9 - _)")

    parts = stem.split("_")
    if len(parts) != 4:
        problems.append(
            f"nom to`rt qismdan iborat bo`lishi kerak "
            f"(brend_mahsulot_rang_slot), topildi: {len(parts)}"
        )
        return problems

    slot = parts[3]
    if slot not in ALL_SLOTS:
        problems.append(f"oxirgi qism slot bo`lishi kerak, topildi: {slot!r}")

    for index, part in enumerate(parts):
        if not part:
            problems.append(f"{index + 1}-qism bo`sh")

    return problems


def slot_from_filename(name: str) -> str | None:
    """Nomdan slotni ajratib oladi. Nom noto'g'ri bo'lsa `None`."""
    if check_filename(name):
        return None
    return name[: -len(".glb")].split("_")[3]


# ── Sahna tekshiruvlari ─────────────────────────────────────────────────


def check_bones(bone_names: list[str]) -> list[str]:
    """Skelet nomlari o'zgartirilmaganini tekshiradi.

    Eng ko'p uchraydigan xato: Blender import qilganda `mixamorig:` ni
    `mixamorig_` ga almashtiradi yoki `.001` qo'shadi. Bunda kiyim tana
    skeletiga bog'lanmaydi va bind pozasida qotib qoladi.
    """
    present = set(bone_names)
    problems: list[str] = []

    for bone in REQUIRED_BONES:
        full = BONE_PREFIX + bone
        if full in present:
            continue

        # Yaqin nomni topib, aniq maslahat beramiz
        similar = [name for name in present if bone in name]
        if similar:
            problems.append(f"suyak nomi noto`g`ri: {similar[0]!r} → {full!r} bo`lishi kerak")
        else:
            problems.append(f"suyak topilmadi: {full}")

    return problems


def check_sockets(empty_names: list[str], parents: dict[str, str]) -> list[str]:
    """Socket'lar mavjudligi va to'g'ri suyakka bog'langanini tekshiradi.

    `parents` — socket nomi → bog'langan suyak nomi (prefiksli yoki
    prefikssiz, ikkalasi ham qabul qilinadi).
    """
    present = set(empty_names)
    problems: list[str] = []

    for socket, expected in SOCKET_PARENTS.items():
        if socket not in present:
            problems.append(f"socket topilmadi: {socket}")
            continue

        actual = parents.get(socket)
        if actual is None:
            problems.append(f"{socket} hech qanday suyakka bog`lanmagan")
            continue

        if actual.removeprefix(BONE_PREFIX) != expected:
            problems.append(
                f"{socket} noto`g`ri suyakda: {actual!r}, kutilgan {BONE_PREFIX + expected!r}"
            )

    return problems


def check_body_meshes(mesh_names: list[str]) -> list[str]:
    """Tana 15 ta alohida mesh ekanini tekshiradi.

    Bir butun mesh bo'lsa `hide_body_parts` ishlamaydi va kiyim ostidan
    tana chiqib turadi (Z-fighting).
    """
    present = set(mesh_names)
    problems = [f"tana qismi topilmadi: {part}" for part in BODY_PARTS if part not in present]

    if len(problems) == len(BODY_PARTS):
        problems = ["tana mesh'lari umuman topilmadi — model bir butunmi?"]

    return problems


def check_morphs(shape_keys: list[str], slot: str) -> list[str]:
    """Shape key'lar slotga mos kelishini tekshiradi.

    Kerak bo'lmagan slotda shape key bo'lsa — xato emas, ogohlantirish:
    fayl hajmi ikki-uch barobar oshadi.
    """
    present = set(shape_keys)
    problems: list[str] = []

    if slot in SLOTS_NEEDING_MORPHS:
        missing = [key for key in MORPH_KEYS if key not in present]
        if len(missing) == len(MORPH_KEYS):
            problems.append(
                f"`{slot}` uchun 6 ta mt_* shape key majburiy, bittasi ham yo`q — "
                "tana o`lchami o`zgarganda kiyim qolib ketadi"
            )
        else:
            problems.extend(f"shape key yetishmayapti: {key}" for key in missing)
    else:
        extra = [key for key in MORPH_KEYS if key in present]
        if extra:
            problems.append(
                f"`{slot}` uchun shape key kerak emas ({len(extra)} ta topildi) — "
                "fayl hajmini behuda oshiradi"
            )

    return problems


def check_polycount(triangles: int, slot: str) -> list[str]:
    """Poligon byudjeti (§5)."""
    budget = POLY_BUDGET.get(slot)
    if budget is None:
        return []

    low, high = budget
    if triangles > high:
        return [f"poligon ko`p: {triangles} > {high} ({slot}) — retopology kerak"]
    if triangles < low:
        return [f"poligon juda kam: {triangles} < {low} ({slot}) — model soddalashib ketganmi?"]
    return []


def check_materials(count: int) -> list[str]:
    if count > MAX_MATERIALS:
        return [
            f"material ko`p: {count} > {MAX_MATERIALS} — har biri alohida draw call, "
            "FPS poligondan ko`ra shundan tushadi"
        ]
    return []


def check_hidden_parts(hide_body_parts: list[str]) -> list[str]:
    """`assets_3d.hide_body_parts` bazaga yoziladigan ro'yxat."""
    known = set(BODY_PARTS)
    return [f"noma`lum tana qismi: {part}" for part in hide_body_parts if part not in known]
