"""
render-product.py — demo katalog uchun MAHSULOT SURATI.

⚠️ NEGA BU SKRIPT BOR. Do'kon paneli moderatsiyaga yuborish uchun kamida 3 ta
rasm talab qiladi (`store-products.ts` dagi `refine`), `from-photo.mjs` esa
kiyim RANGINI aynan suratdan oladi. Ya'ni rasmsiz mahsulot na katalogda
ko'rinadi, na 3D oladi. Haqiqiy sotuvchida surat bor — demo katalogda esa
uni yasash kerak.

⚠️ NEGA RENDER, YUKLAB OLINGAN SURAT EMAS. Katalogdagi surat va svaypdagi
3D BIR XIL buyum bo'lishi shart. Tashqi suratni olsak, mijoz kartochkada
bir kiyimni ko'rib, kiyib ko'rganda boshqasini oladi. Bu yerda ikkalasi
ham bitta GLB dan keladi, ya'ni moslik ta'rifan kafolatlangan.

⚠️ FON OCH KULRANG (#F5F5F7), OQ EMAS. `from-photo.mjs` dagi
`dominantColour` yorug'ligi 238 dan katta pikselni FON deb tashlaydi.
245 — o'sha chegaradan yuqori, ya'ni fon ishonchli tashlanadi, lekin oq
kiyimning soyali qismlari (~200-235) saqlanib qoladi va rang to'g'ri
chiqadi. Sof oq fonda kiyimning o'zi ham tashlanib ketishi mumkin edi.

⚠️ MATERIAL `render-fabric.py` DAN KO'CHIRILGAN VA SABABI BOR: ilova mato
teksturasini ish vaqtida qo'yadi, GLB da u YO'Q. Shundoq render qilsak
surat tekis plastmassa bo'lib chiqadi va ilovadagi kiyimga o'xshamaydi.
Albedo esa rangni ALMASHTIRMAYDI, unga ko'paytiriladi — to'g'ridan-to'g'ri
ulansa hamma kiyim kulrang chiqadi.

Ishga tushirish (repo ildizidan):

  /Applications/Blender.app/Contents/MacOS/Blender --background \\
    --python assets-3d/generator/render-product.py -- \\
    --spec /tmp/spec.json --out /tmp/photos

`spec.json` — ro'yxat, har elementi:

  { "key": "futbolka-oq", "file": "tshirt-white-v1.glb",
    "slot": "top", "colorHex": "#F2F2F5" }

Natija: `<out>/<key>-1.png` … `-3.png` (old, chorak burilish, orqa).

⚠️ HAMMA QOLIP HAM MAHSULOT SURATIGA YARAMAYDI. 2026-08-29 da o'lchandi:
`tshirt`, `jacket`, `pants` — yaxshi chiqadi. `cap`, `sneakers`, `watch` —
YO'Q, va sabab ramkalashda emas, geometriyada:

  cap      `cap_dome` butun boshni qoplaydi (4246 uchburchak), kozirogi esa
           12 uchburchak. Yakka render qilinsa KEPKA emas, BOSH ko'rinadi.
  sneakers 632 uchburchakli ezilgan qobiq — yakka holda poyabzalga o'xshamaydi.
  watch    korpus ellipsoid; ikkala bilakda turadi, mesh esa bitta —
           bitta soatni ajratib bo'lmaydi.

Ular avatarda rangli siluet sifatida ishlaydi, lekin katalog surati
bo'la olmaydi. Modellar yaxshilanmaguncha bunday buyumlarni katalogga
qo'ymang (`seed-catalog.ts` dagi izohga qarang).
"""

import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXPORT = os.path.join(ROOT, "assets-3d", "export")
TEXTURES = os.path.join(ROOT, "apps", "mobile", "assets", "textures")

# ── Mato jadvali — `render-fabric.py` va `textures.ts` bilan bir xil ─────
FABRIC = {
    "knit":   {"repeat": 4, "normal_scale": 0.7, "roughness": 0.85},
    "denim":  {"repeat": 2, "normal_scale": 1.1, "roughness": 0.82},
    "twill":  {"repeat": 3, "normal_scale": 0.8, "roughness": 0.70},
    "smooth": {"repeat": 2, "normal_scale": 0.3, "roughness": 0.50},
}

SLOT_KIND = {
    "outer": "denim",
    "bottom": "twill",
    "feet": "smooth",
    "wrist": "smooth",
    "head": "smooth",
}

# Studiya foni — bu yerda ISHLATILMAYDI, `seed-catalog.ts` qo'yadi
# (render `film_transparent` bilan chiqadi). Qiymat shu yerda turibdi,
# chunki uni tanlash sababi render mantiqiga tegishli: 245 —
# `from-photo.mjs` dagi «fon» chegarasidan (238) yuqori, ya'ni fon
# ishonchli tashlanadi, oq kiyimning soyali joylari esa (~200-235)
# saqlanadi va rang to'g'ri o'qiladi.
BACKDROP = "#F5F5F7"

# Rakurslar: old, chorak burilish, orqa. Daraja — Z o'qi atrofida.
ANGLES = (0.0, -35.0, 180.0)

RESOLUTION = (1000, 1250)  # 4:5 — vertikal, e-commerce standarti


def kind_for_slot(slot):
    return SLOT_KIND.get(slot, "knit")


def srgb_to_linear(c):
    """Blender chiziqli fazoda ishlaydi; hex esa sRGB."""
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(value):
    value = value.lstrip("#")
    rgb = [int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return [srgb_to_linear(c) for c in rgb]


def load_image(name, is_data):
    """is_data=True — normal map: sRGB deb o'qilsa relyef buziladi."""
    path = os.path.join(TEXTURES, name)
    if not os.path.exists(path):
        raise SystemExit("tekstura topilmadi: " + path)
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = "Non-Color" if is_data else "sRGB"
    return img


def build_material(kind, color_hex):
    spec = FABRIC[kind]
    mat = bpy.data.materials.new("fabric_" + kind)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    base = hex_to_linear(color_hex)
    bsdf.inputs["Roughness"].default_value = spec["roughness"]

    uv = nodes.new("ShaderNodeUVMap")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (spec["repeat"], spec["repeat"], 1.0)
    links.new(uv.outputs["UV"], mapping.inputs["Vector"])

    albedo = nodes.new("ShaderNodeTexImage")
    albedo.image = load_image("%s-albedo.jpg" % kind, is_data=False)
    albedo.extension = "REPEAT"
    links.new(mapping.outputs["Vector"], albedo.inputs["Vector"])

    # ⚠️ KO'PAYTIRISH — almashtirish emas (albedo kulrang, rang spec'dan).
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs[6].default_value = (*base, 1.0)
    links.new(albedo.outputs["Color"], mix.inputs[7])
    links.new(mix.outputs[2], bsdf.inputs["Base Color"])

    normal_tex = nodes.new("ShaderNodeTexImage")
    normal_tex.image = load_image("%s-normal.jpg" % kind, is_data=True)
    normal_tex.extension = "REPEAT"
    links.new(mapping.outputs["Vector"], normal_tex.inputs["Vector"])

    nmap = nodes.new("ShaderNodeNormalMap")
    nmap.inputs["Strength"].default_value = spec["normal_scale"]
    links.new(normal_tex.outputs["Color"], nmap.inputs["Color"])
    links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

    return mat


def studio(angle_deg):
    """
    Uch nuqtali yorug'lik va och fon.

    ⚠️ YORUG'LIK KAMERA BILAN BIRGA BURILADI. Aks holda orqa rakursda
    buyum faqat kontur bo'lib qolardi — uchta suratdan bittasi yaroqsiz.
    """
    rad = math.radians(angle_deg)
    rot = lambda x, y: (x * math.cos(rad) - y * math.sin(rad),
                        x * math.sin(rad) + y * math.cos(rad))

    # ⚠️ QUVVAT `render-fabric.py` DAGIDAN ~3 BAROBAR PAST. U AgX bilan
    # ishlaydi — AgX yorug' joylarni siqadi va ortiqcha ekspozitsiyani
    # yashiradi. Bu yerda `Standard` turadi, ya'ni siqish yo'q va o'sha
    # quvvat rangni yuvib yuboradi: #3B5A8C jinsi ko'k pastel bo'lib
    # chiqadi. Rang aniqligi bu yerda BEZAK EMAS — `from-photo.mjs`
    # kiyim rangini aynan shu suratdan o'qiydi.
    for name, (lx, ly, lz), energy in (
        ("key",  (2.4, -3.0, 2.6), 340),
        ("fill", (-2.8, -2.2, 1.4), 150),
        ("rim",  (0.0, 3.2, 2.4), 130),
    ):
        rx, ry = rot(lx, ly)
        data = bpy.data.lights.new(name, type="AREA")
        data.energy = energy
        data.size = 3.5
        obj = bpy.data.objects.new(name, data)
        obj.location = (rx, ry, lz)
        obj.rotation_euler = (
            Vector((0, 0, 0.9)) - Vector((rx, ry, lz))
        ).to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(obj)

    # ⚠️ OLAM RANGI FON EMAS, FAQAT YUMSHOQ TO'LDIRUVCHI YORUG'LIK.
    # Kadr `film_transparent` bilan chiqadi va fonni `seed-catalog.ts`
    # qo'yadi. Sabab: olam bir vaqtning o'zida ham fon, ham yorug'lik
    # manbayi — och kulrang fon kerak bo'lsa, u ayni paytda sahnani
    # yoritib yuboradi va buyum yuvilib ketadi. Ajratilgach ikkalasi
    # mustaqil sozlanadi.
    world = bpy.data.worlds.new("studio")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.55, 0.55, 0.60, 1.0)
    bg.inputs[1].default_value = 0.45
    bpy.context.scene.world = world


def bounds(objects):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for obj in objects:
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            lo = Vector((min(lo[i], p[i]) for i in range(3)))
            hi = Vector((max(hi[i], p[i]) for i in range(3)))
    return lo, hi


def place_camera(lo, hi, angle_deg):
    """
    Buyumni kadrga sig'diradi va Z o'qi atrofida `angle_deg` ga buradi.

    ⚠️ MASOFA ENG KATTA O'LCHAMDAN OLINADI, kadr esa 4:5. Shim balandroq,
    krossovka kengroq — bitta qat'iy masofa bilan biri kesilib, ikkinchisi
    kadrning uchdan biriga sig'ib qolardi.
    """
    center = (lo + hi) / 2
    size = max((hi - lo).x, (hi - lo).y, (hi - lo).z)
    dist = size * 2.3

    rad = math.radians(angle_deg)
    offset = Vector((math.sin(rad) * dist, -math.cos(rad) * dist, size * 0.10))

    data = bpy.data.cameras.new("cam")
    data.lens = 65  # uzunroq linza — portret perspektivasi, buzilishsiz
    cam = bpy.data.objects.new("cam", data)
    cam.location = center + offset
    cam.rotation_euler = (-offset).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam


def setup_render(path):
    scene = bpy.context.scene
    # EEVEE — tez. Nomi versiyalar orasida o'zgargan.
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x, scene.render.resolution_y = RESOLUTION
    scene.render.film_transparent = True
    scene.render.filepath = path
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    # ⚠️ `Standard` — MAJBURIY, «shunchaki chiroyliroq» emas. Blender'ning
    # standart AgX transformatsiyasi kadrni kinematik qilib rangni siqadi:
    # #F5F5F7 fon ~#B0B0B0 kulrang bo'lib chiqadi. Ikki oqibat bor va
    # ikkalasi ham jim: (1) fon `dominantColour` dagi 238 chegarasidan
    # pastga tushadi va FON DEB TASHLANMAY, kiyim rangiga qo'shilib
    # ketadi; (2) kiyimning o'z rangi ham o'zgaradi, ya'ni suratdan
    # qurilgan 3D model manifestdagidan boshqa tusda chiqadi.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"


def render_one(entry, out_dir):
    glb = os.path.join(EXPORT, entry["file"])
    if not os.path.exists(glb):
        print("  ✗ fayl yo'q: " + entry["file"])
        return []

    kind = kind_for_slot(entry["slot"])
    written = []

    for index, angle in enumerate(ANGLES, start=1):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=glb)

        meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
        if not meshes:
            print("  ✗ mesh topilmadi: " + entry["file"])
            return []

        mat = build_material(kind, entry["colorHex"])
        for obj in meshes:
            obj.data.materials.clear()
            obj.data.materials.append(mat)
            # Silliq soyalash — qobiq normallari payvandlangan (3D-3)
            for poly in obj.data.polygons:
                poly.use_smooth = True

        studio(angle)
        place_camera(*bounds(meshes), angle)

        path = os.path.join(out_dir, "%s-%d.png" % (entry["key"], index))
        setup_render(path)
        bpy.ops.render.render(write_still=True)
        written.append(path)

    print("  ✓ %-22s %-7s %d ta rakurs" % (entry["key"], kind, len(written)))
    return written


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True, help="JSON ro'yxat")
    ap.add_argument("--out", required=True)
    args = ap.parse_args(argv)

    os.makedirs(args.out, exist_ok=True)
    with open(args.spec, encoding="utf-8") as handle:
        entries = json.load(handle)

    print("Render: %d buyum × %d rakurs -> %s" % (len(entries), len(ANGLES), args.out))
    for entry in entries:
        render_one(entry, args.out)


if __name__ == "__main__":
    main()
