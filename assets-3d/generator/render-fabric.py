"""
render-fabric.py — mato teksturasini KO'Z BILAN tekshirish (D-09).

⚠️ NEGA BU SKRIPT BOR. Mato skanlari (PolyHaven, CC0) kodga qo'shildi va
dekod zanjiri 12 test bilan qulflandi, LEKIN natija hech kim ko'rmagan:
simulyator 3D ni chizmaydi (OpenGL-on-Metal), qurilma esa doim qo'l ostida
emas. Ya'ni «mato mato'ga o'xshaydimi?» degan savol javobsiz qolgan edi.

Bu skript javobni Blenderda beradi — ilova qo'yadigan materialni AYNAN
takrorlab.

⚠️ IKKI TUZOQ, ikkalasi ham renderni yolg'onga aylantiradi:

  1. MATO MATERIALI GLB DA YO'Q. Uni ilova ish vaqtida qo'yadi
     (`textures.ts` -> `fabricMaterial`). GLB ni shundoq render qilsak
     «teksturasiz» degan MAVJUD BO'LMAGAN nuqson ko'rinadi.

  2. ALBEDO RANGNI ALMASHTIRMAYDI, UNGA KO'PAYTIRILADI. Albedo kulrang;
     kiyim rangi manifestdan keladi. Albedo'ni to'g'ridan-to'g'ri Base
     Color ga ulasak, hamma kiyim kulrang chiqadi.

⚠️ BU QURILMA SINOVINI ALMASHTIRMAYDI. Blender'ning yorug'lik modeli
three.js'nikidan boshqacha va bu yerda GL konteksti, Hermes dekodi va FPS
umuman sinalmaydi. Skript faqat BITTA savolga javob beradi: to'qima
ko'rinadimi, o'lchami to'g'rimi, naqsh cho'zilib yoki maydalanib
ketmadimi. Qolgani — qurilmada.

Qiymatlar `apps/mobile/src/three/textures.ts` dan ko'chirilgan. U yerda
o'zgarsa, bu yerda ham o'zgarishi kerak — pastdagi FABRIC jadvali shu
sababli bitta joyga yig'ilgan.

Ishga tushirish (repo ildizidan):

  /Applications/Blender.app/Contents/MacOS/Blender --background \\
    --python assets-3d/generator/render-fabric.py -- --out /tmp/fabric

  # bitta kiyim va yaqindan:
  ... -- --out /tmp/fabric --only tshirt-white --closeup
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

# ── Mato jadvali — textures.ts dagi qiymatlarning aynan nusxasi ──────────
#
# `repeat` ILOVADAGI YAKUNIY qiymat. textures.ts da protsedural repeat
# yoziladi va surat bo'lsa u `max(2, round(r / 2.5))` bilan kichraytiriladi
# (256 px suratda to'quv allaqachon o'z o'lchamida). Bu yerda darhol
# yakuniy son turadi, ya'ni hisob takrorlanmaydi.
FABRIC = {
    "knit":   {"repeat": 4, "normal_scale": 0.7, "roughness": 0.85},  # 10 -> 4
    "denim":  {"repeat": 2, "normal_scale": 1.1, "roughness": 0.82},  # 6  -> 2
    "twill":  {"repeat": 3, "normal_scale": 0.8, "roughness": 0.70},  # 7  -> 3
    "smooth": {"repeat": 2, "normal_scale": 0.3, "roughness": 0.50},  # 3  -> 2
}

# `fabricKindForSlot` (textures.ts)
SLOT_KIND = {
    "outer": "denim",
    "bottom": "twill",
    "feet": "smooth",
    "wrist": "smooth",
    "head": "smooth",
}


def kind_for_slot(slot):
    return SLOT_KIND.get(slot, "knit")


def srgb_to_linear(c):
    """Blender chiziqli fazoda ishlaydi; manifestdagi hex esa sRGB."""
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(value):
    value = value.lstrip("#")
    rgb = [int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return [srgb_to_linear(c) for c in rgb]


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load_image(name, is_data):
    """
    is_data=True — normal map. Uni sRGB deb o'qish relyefni buzadi:
    qiymatlar yo'nalish, rang emas.
    """
    path = os.path.join(TEXTURES, name)
    if not os.path.exists(path):
        raise SystemExit("tekstura topilmadi: " + path)
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = "Non-Color" if is_data else "sRGB"
    return img


def build_material(kind, color_hex, textured=True):
    spec = FABRIC[kind]
    mat = bpy.data.materials.new("fabric_%s_%s" % (kind, "tex" if textured else "flat"))
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    base = hex_to_linear(color_hex)
    bsdf.inputs["Roughness"].default_value = spec["roughness"]

    if not textured:
        # Solishtirish uchun: teksturasiz, tekis rang
        bsdf.inputs["Base Color"].default_value = (*base, 1.0)
        return mat

    # UV takrori — ilovadagi `texture.repeat.set(r, r)` ning muqobili
    uv = nodes.new("ShaderNodeUVMap")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (spec["repeat"], spec["repeat"], 1.0)
    links.new(uv.outputs["UV"], mapping.inputs["Vector"])

    albedo = nodes.new("ShaderNodeTexImage")
    albedo.image = load_image("%s-albedo.jpg" % kind, is_data=False)
    albedo.extension = "REPEAT"
    links.new(mapping.outputs["Vector"], albedo.inputs["Vector"])

    # ⚠️ KO'PAYTIRISH — almashtirish emas. Albedo kulrang, rang manifestdan.
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs[6].default_value = (*base, 1.0)          # A — asos rang
    links.new(albedo.outputs["Color"], mix.inputs[7])   # B — to'qima
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


def studio_lights():
    """Uch nuqtali yorug'lik — Scene3D dagi sxemaning muqobili."""
    for name, loc, energy in (
        ("key", (2.4, -3.0, 2.6), 900),
        ("fill", (-2.8, -2.2, 1.4), 350),
        ("rim", (0.0, 3.2, 2.4), 500),
    ):
        data = bpy.data.lights.new(name, type="AREA")
        data.energy = energy
        data.size = 3.0
        obj = bpy.data.objects.new(name, data)
        obj.location = loc
        obj.rotation_euler = (Vector((0, 0, 0.9)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(obj)

    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.04, 0.04, 0.06, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    bpy.context.scene.world = world


def frame_camera(objects, closeup):
    """Obyektlarni kadrga sig'dirish. `closeup` — to'qima ko'rinishi uchun."""
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for obj in objects:
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            lo = Vector((min(lo[i], p[i]) for i in range(3)))
            hi = Vector((max(hi[i], p[i]) for i in range(3)))

    center = (lo + hi) / 2
    size = max((hi - lo).x, (hi - lo).y, (hi - lo).z)
    dist = size * (0.9 if closeup else 2.1)

    data = bpy.data.cameras.new("cam")
    data.lens = 85 if closeup else 50
    cam = bpy.data.objects.new("cam", data)
    cam.location = center + Vector((0.0, -dist, size * 0.12))
    cam.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam


def setup_render(out_path, res):
    scene = bpy.context.scene
    # EEVEE — tez. Nomi Blender versiyalari orasida o'zgargan, shuning
    # uchun mavjudini tanlaymiz.
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x = res
    scene.render.resolution_y = res
    scene.render.film_transparent = False
    scene.render.filepath = out_path
    scene.render.image_settings.file_format = "PNG"


def render_garment(entry, out_dir, closeup, textured):
    kind = kind_for_slot(entry["slot"])
    glb = os.path.join(EXPORT, entry["file"])
    if not os.path.exists(glb):
        print("  o'tkazib yuborildi (fayl yo'q): " + entry["file"])
        return None

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=glb)

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        print("  mesh topilmadi: " + entry["file"])
        return None

    mat = build_material(kind, entry["colorHex"], textured=textured)
    for obj in meshes:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        # Silliq soyalash — qobiq normallari payvandlangan (3D-3)
        for poly in obj.data.polygons:
            poly.use_smooth = True

    studio_lights()
    frame_camera(meshes, closeup)

    suffix = "tex" if textured else "flat"
    name = "%s-%s%s.png" % (entry["key"], suffix, "-closeup" if closeup else "")
    path = os.path.join(out_dir, name)
    setup_render(path, 900 if closeup else 700)
    bpy.ops.render.render(write_still=True)
    print("  %-24s %-7s -> %s" % (entry["key"], kind, name))
    return path


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", default=None, help="faqat shu kalit")
    ap.add_argument("--closeup", action="store_true", help="to'qima ko'rinishi uchun yaqindan")
    ap.add_argument("--compare", action="store_true", help="teksturasiz variantni ham chiqarish")
    args = ap.parse_args(argv)

    os.makedirs(args.out, exist_ok=True)
    manifest = json.load(open(os.path.join(EXPORT, "manifest.json"), encoding="utf-8"))

    entries = manifest["garments"]
    if args.only:
        entries = [e for e in entries if e["key"] == args.only]
        if not entries:
            raise SystemExit("topilmadi: " + args.only)

    print("Render: %d kiyim -> %s" % (len(entries), args.out))
    for entry in entries:
        render_garment(entry, args.out, args.closeup, textured=True)
        if args.compare:
            render_garment(entry, args.out, args.closeup, textured=False)


if __name__ == "__main__":
    main()
