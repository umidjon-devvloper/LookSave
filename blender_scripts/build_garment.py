"""Kiyim modelini tana meshidan yasaydi — Blender ichida, mato simulyatsiyasi bilan.

    blender --background --python blender_scripts/build_garment.py -- \
        <avatar.glb> <spec.json> <chiqish.glb>

NEGA BLENDER: kiyim JavaScript'da ham yasalgan edi (`assets-3d/generator`), lekin
u faqat tananing nusxasini tashqariga suradi. Natijada kiyim tanaga BO'YALGANDEK
yopishib turadi: har bir mushak, kindik va kurak ko'rinib qoladi. Haqiqiy kiyim
esa osiladi — yelkada ushlanib turadi, qolgan joyda tanadan uzoqlashadi va burma
beradi.

Buni faqat mato simulyatsiyasi beradi. Blender'da u bor, brauzerda yo'q.

⚠️ SIMULYATSIYA IXTIYORIY. `spec.cloth` berilmasa, kiyim shunchaki silliqlanadi.
Ba'zi kiyimlar (kepka, krossovka) uchun simulyatsiya ma'nosiz — ular qattiq.
"""

import json
import os
import runpy
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree


def args():
    """`--` dan keyingi argumentlar. Blender o'zinikilarini oldin oladi."""
    raw = sys.argv[sys.argv.index("--") + 1 :]
    if len(raw) != 3:
        raise SystemExit("kerak: <avatar.glb> <spec.json> <chiqish.glb>")
    return raw


# ── Koordinata almashinuvi ────────────────────────────────────────────────
#
# ⚠️ BLENDER Z-UP, glTF ESA Y-UP. Import paytida Blender modelni buradi:
# balandlik Y dan Z ga o'tadi, glTF ning Z o'qi esa Blender'ning -Y siga.
#
# Bu xato JIM: kod ishlaydi, xato bermaydi, shunchaki butunlay boshqa sohani
# kesadi. Birinchi urinishda aynan shu bo'ldi — pin guruhi noto'g'ri joydan
# olinib, simulyatsiya portladi va kiyim 6 metrga cho'zilib ketdi.
#
# Spetsifikatsiya fayllari glTF o'lchovida yoziladi (ilova ham shunda
# ishlaydi), shuning uchun ular shu yerda Blender o'lchoviga o'giriladi.


def to_blender(point):
    """glTF [x, y, z] → Blender [x, -z, y]."""
    x, y, z = point
    return Vector((x, -z, y))


def height(vector):
    """Balandlik — Blender'da bu Z."""
    return vector.z


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_avatar(path):
    bpy.ops.import_scene.gltf(filepath=path)
    return {o.name: o for o in bpy.data.objects if o.type == "MESH"}


def baked_mesh(source, name):
    """Meshning KO'RINADIGAN holatidagi nusxasi.

    ⚠️ `obj.data.vertices` NI TO'G'RIDAN-TO'G'RI OLIB BO'LMAYDI. Tana skeletga
    bog'langan (skinned), va xom verteks ma'lumoti skin fazosida saqlanadi —
    u ko'rinadigan shakl emas. Blender uni o'z konvensiyasi bilan tiklaydi va
    natija three.js nikidan farq qiladi: o'lchov 4 metr enli, 7 metr bo'yli
    chiqadi.

    Bu xato jim: import xatosiz o'tadi, obyekt sahnada bor, faqat raqamlar
    ma'nosiz. Birinchi urinishda kesish sohasi shu sababli butunlay noto'g'ri
    joydan olindi.

    `evaluated_get` esa barcha modifikatorlar (skelet ham) qo'llangan yakuniy
    meshni beradi — ya'ni ko'z ko'rgan narsani.

    Shape key'lar oldindan 0.5 ga qo'yiladi: bu NEYTRAL holat, 0 emas
    (`shape.mjs` — asos og'ishlar yig'indisining yarmicha orqaga surilgan).
    """
    keys = source.data.shape_keys
    if keys:
        for block in keys.key_blocks:
            block.value = 0.5

    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = source.evaluated_get(depsgraph)

    mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    mesh.transform(source.matrix_world)

    copy = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(copy)
    return copy


def merged_copy(objects, name):
    """Berilgan meshlarning bitta obyektga birlashtirilgan nusxasi."""
    copies = [baked_mesh(source, f"{name}_part") for source in objects]

    bpy.ops.object.select_all(action="DESELECT")
    for copy in copies:
        copy.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]

    if len(copies) > 1:
        bpy.ops.object.join()

    merged = bpy.context.view_layer.objects.active
    merged.name = name
    return merged


def keep_region(obj, region):
    """Kerakli sohadan tashqaridagi uchburchaklarni o'chiradi.

    `y`     — [past, baland]
    `axis`  — {start, end, from, to}: suyak bo'ylab ulush (yeng uchun; qo'l qiya
              turgani sababli balandlik bo'yicha kesish uni noto'g'ri qirqadi)
    `around`— {x, z, radius}: tik o'q atrofidagi doira (yoqa uchun)
    """
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)

    y_low, y_high = region.get("y", [-1e9, 1e9])

    axis = region.get("axis")
    if axis:
        start = to_blender(axis["start"])
        direction = to_blender(axis["end"]) - start
        length_sq = direction.length_squared

    around = region.get("around")

    doomed = []
    for face in mesh.faces:
        center = face.calc_center_median()
        keep = y_low <= height(center) <= y_high

        if keep and axis and length_sq > 0:
            share = (center - start).dot(direction) / length_sq
            keep = axis["from"] <= share <= axis["to"]

        if keep and around:
            # Doira gorizontal tekislikda — Blender'da bu X va Y
            middle = to_blender([around["x"], 0.0, around["z"]])
            offset = Vector((center.x - middle.x, center.y - middle.y, 0.0))
            keep = offset.length <= around["radius"]

        if not keep:
            doomed.append(face)

    bmesh.ops.delete(mesh, geom=doomed, context="FACES")

    # Yakka qolgan uchlar eksportda ogohlantirish beradi va foyda keltirmaydi
    stray = [v for v in mesh.verts if not v.link_faces]
    if stray:
        bmesh.ops.delete(mesh, geom=stray, context="VERTS")

    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()


def offset_along_normals(obj, distance):
    """Kiyim tanadan shu qadar uzoqda boshlanadi."""
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    mesh.normal_update()

    for vert in mesh.verts:
        vert.co += vert.normal * distance

    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()


def pin_group(obj, spec):
    """Simulyatsiyada qimirlamaydigan vertekslar — kiyim shu yerda ushlanadi.

    Busiz mato shunchaki tananing ustidan sirg'alib tushib ketadi.
    """
    group = obj.vertex_groups.new(name="pin")
    y_min = spec["pin_above"]

    indices = [v.index for v in obj.data.vertices if height(v.co) >= y_min]
    group.add(indices, 1.0, "REPLACE")

    return group.name, len(indices)


def simulate(garment, body, spec, region):
    """Matoni tanaga osilib tushishga majbur qiladi.

    ⚠️ ENG MUHIM QADAM. Bugacha kiyim tananing aniq nusxasi — u mushaklarni,
    kindikni va kurakni takrorlaydi. Simulyatsiyadan keyin mato yelkada
    ushlanib, qolgan joyda tanadan uzoqlashadi va burma beradi.
    """
    body.modifiers.new(name="collision", type="COLLISION")
    body.collision.thickness_outer = spec.get("collision", 0.004)

    name, pinned = pin_group(garment, spec)
    if pinned == 0:
        raise SystemExit("pin guruhi bo'sh — kiyim tushib ketadi, `pin_above` ni tekshiring")

    modifier = garment.modifiers.new(name="cloth", type="CLOTH")
    settings = modifier.settings

    # Qadam soni — portlashning eng ko'p uchraydigan sababi kamligi
    settings.quality = spec.get("quality", 14)
    settings.mass = spec.get("mass", 0.25)
    settings.tension_stiffness = spec.get("tension", 18)
    settings.compression_stiffness = spec.get("compression", 18)
    settings.shear_stiffness = spec.get("shear", 8)
    settings.bending_stiffness = spec.get("bending", 1.2)
    settings.vertex_group_mass = name

    # Havo qarshiligi mato "tirik" ko'rinishi uchun — busiz u toshdek tushadi
    settings.air_damping = spec.get("air", 1.4)

    """Vaqt qadami.

    ⚠️ 1.0 DA MATO CHO'ZILIB TUSHADI. Bir kadr ichida gravitatsiya juda ko'p
    ish bajaradi va cho'zilishga qarshilik yetishmaydi: ko'ylak yelkadan
    sirg'alib, ikki metrga uzayadi. Kichikroq qadam sekinroq, lekin barqaror.
    """
    settings.time_scale = spec.get("time_scale", 0.5)

    collision = modifier.collision_settings
    collision.distance_min = spec.get("gap", 0.003)

    """O'z-o'ziga urilish — burma ustma-ust tushmasligi uchun.

    ⚠️ STANDART HOLATDA O'CHIQ. U hisobni ancha og'irlashtiradi va zich
    to'rda simulyatsiyani beqaror qiladi: qo'shni uchburchaklar bir-birini
    itarib, mato portlaydi. Faqat ochiq-oydin kerak bo'lganda yoqiladi.
    """
    if spec.get("self_collision"):
        collision.use_self_collision = True
        collision.self_distance_min = 0.004

    frames = spec.get("frames", 40)
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = frames

    bpy.context.view_layer.objects.active = garment
    bpy.ops.object.select_all(action="DESELECT")
    garment.select_set(True)

    # Kadrma-kadr o'tamiz — `bake` operatori fon rejimida ishonchsiz
    for frame in range(1, frames + 1):
        scene.frame_set(frame)

    bpy.ops.object.modifier_apply(modifier=modifier.name)
    check_sane(garment, body, region)


def check_sane(garment, body, region):
    """Simulyatsiya portlamaganini tekshiradi.

    ⚠️ BUSIZ XATO JIM O'TADI. Beqaror mato vertekslarni metrlarga uchirib
    yuboradi, lekin Blender xato bermaydi — GLB muvaffaqiyatli yoziladi va
    nosozlik faqat telefonda ko'rinadi. Birinchi urinishda aynan shunday
    bo'ldi: kiyim 6 metrga cho'zilgan, lekin quvur "TAYYOR" deb yozgan.
    """
    def extent(obj):
        points = [obj.matrix_world @ v.co for v in obj.data.vertices]
        lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
        hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
        return hi - lo

    cloth = extent(garment)
    torso = extent(body)

    # Kiyim tanadan biroz kattaroq bo'ladi, lekin ikki baravar emas
    for axis, name in ((0, "X"), (1, "Y"), (2, "Z")):
        if cloth[axis] > torso[axis] * 1.8 + 0.05:
            raise SystemExit(
                f"simulyatsiya portladi: {name} bo'yicha kiyim {cloth[axis]:.2f} m, "
                f"tana {torso[axis]:.2f} m — `quality`, `gap` yoki `offset` ni oshiring"
            )

    """⚠️ CHO'ZILISH ALOHIDA TEKSHIRILADI. Portlash — vertekslar har tomonga
    uchishi; cho'zilish esa boshqa nosozlik: mato butun holicha pastga
    sirg'aladi. O'lcham me'yorida qoladi, shuning uchun yuqoridagi tekshiruv
    uni sezmaydi.

    Birinchi to'liq yig'ishda aynan shu bo'ldi: kurtka 0.53 gacha tushib
    paltoga aylandi, shim esa −0.15 ga, ya'ni pol ostiga."""
    floor = min(height(garment.matrix_world @ v.co) for v in garment.data.vertices)
    allowed = region.get("y", [-1e9, 1e9])[0] - 0.09

    if floor < allowed:
        raise SystemExit(
            f"mato cho'zilib tushdi: eng past nuqta {floor:.2f} m, ruxsat {allowed:.2f} m — "
            f"`tension`/`compression` ni oshiring yoki `frames` ni kamaytiring"
        )


def finish(garment, spec):
    """Qalinlik, silliqlik va material."""
    solidify = garment.modifiers.new(name="thickness", type="SOLIDIFY")
    solidify.thickness = spec.get("thickness", 0.005)
    solidify.offset = -1.0  # ichkariga — tashqi yuza joyida qolsin
    solidify.use_rim = True

    smooth = garment.modifiers.new(name="smooth", type="SMOOTH")
    smooth.factor = 0.5
    smooth.iterations = spec.get("smooth", 2)

    bpy.context.view_layer.objects.active = garment
    for modifier in list(garment.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)

    # Uchburchak byudjeti (04-3d-pipeline §3): keragidan ko'pi telefonni yeydi
    budget = spec.get("max_tris", 9000)
    faces = len(garment.data.polygons)
    if faces > budget:
        decimate = garment.modifiers.new(name="decimate", type="DECIMATE")
        decimate.ratio = budget / faces
        bpy.ops.object.modifier_apply(modifier=decimate.name)

    material = bpy.data.materials.new(name=f"{spec['key']}_fabric")
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]

    colour = spec["color"]
    bsdf.inputs["Base Color"].default_value = (*colour, 1.0)
    bsdf.inputs["Roughness"].default_value = spec.get("roughness", 0.86)
    bsdf.inputs["Metallic"].default_value = 0.0

    garment.data.materials.clear()
    garment.data.materials.append(material)

    bpy.ops.object.shade_smooth()


MORPH_KEYS = ("mt_height", "mt_weight", "mt_shoulderWidth", "mt_chest", "mt_waist", "mt_hips")


def evaluated_points(objects):
    """Tana nuqtalari — modifikatorlar va shape key'lar qo'llangan holda.

    Tartib barqaror: topologiya o'zgarmaydi, shuning uchun bir chaqiruvdagi
    N-nuqta boshqasidagi N-nuqta bilan bir xil verteksga tegishli.
    """
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []

    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        points.extend(obj.matrix_world @ v.co for v in mesh.vertices)
        evaluated.to_mesh_clear()

    return points


def add_size_keys(garment, bodies):
    """Tanadagi `mt_*` kalitlarni kiyimga ko'chiradi.

    ⚠️ NEGA `transfer_morphs.py` EMAS. U Surface Deform ishlatadi va u faqat
    YAQIN yuzalarni bog'laydi. Ustki kiyimda bu ishlaydi, lekin shim oyoqlari,
    krossovka va kepka gavdadan uzoqda — ular bog'lanmay qoladi va kalitlar
    jimgina bo'sh chiqadi. Birinchi to'liq yig'ishda 12 kiyimning 8 tasi
    o'lchamsiz qolgan edi.

    Bu yerda boshqa usul: har bir kiyim verteksi uchun ENG YAQIN tana
    nuqtasi topiladi va o'sha nuqtaning siljishi ko'chiriladi. Tana zich
    (53 000 uchburchak), shuning uchun eng yaqin nuqta yetarli aniq va
    masofa cheklovi yo'q — istalgan tana qismi bilan ishlaydi.

    ⚠️ ASOS 0.5 GA SURILADI. Ilova kalitlarni fayldagi standart og'irlikda
    qo'llaydi, JavaScript quvuri esa 0.5 yozadi. Ikki quvur bir xil
    kelishuvda bo'lishi uchun bu yerda ham shunday: asos yarim yig'indiga
    orqaga suriladi va har kalit 0.5 da chiqadi.
    """
    """⚠️ KESISHMA EMAS, BIRLASHMA. Generator nol siljishli kalitlarni
    saqlamaydi: boshda `mt_waist`, kaftda `mt_chest` yo'q. Har qismda
    bo'lishini talab qilsak, ro'yxat 6 tadan 2 taga tushadi va kiyim
    o'lchamning ko'p qismiga javob bermay qoladi."""
    keys = [name for name in MORPH_KEYS
            if any(b.data.shape_keys and name in b.data.shape_keys.key_blocks for b in bodies)]
    if not keys:
        print("  ⚠︎ tanada mt_* kalitlar yo'q — o'lcham kalitlari qo'shilmadi")
        return

    def reset():
        for body in bodies:
            for block in body.data.shape_keys.key_blocks:
                block.value = 0.0

    reset()
    base = evaluated_points(bodies)

    tree = KDTree(len(base))
    for index, point in enumerate(base):
        tree.insert(point, index)
    tree.balance()

    # Har bir kiyim verteksi uchun eng yaqin tana nuqtasi
    nearest = [tree.find(garment.matrix_world @ v.co)[1] for v in garment.data.vertices]

    shifts = {}
    for name in keys:
        reset()
        for body in bodies:
            # Qismda bu kalit bo'lmasa, uning siljishi nol — o'tkazib yuboramiz
            block = body.data.shape_keys.key_blocks.get(name)
            if block:
                block.value = 1.0

        moved = evaluated_points(bodies)
        shifts[name] = [moved[i] - base[i] for i in range(len(base))]

    reset()

    if garment.data.shape_keys is None:
        garment.shape_key_add(name="Basis", from_mix=False)

    basis = garment.data.shape_keys.key_blocks[0]

    # Asosni yarim yig'indiga orqaga suramiz
    for index, vertex in enumerate(garment.data.vertices):
        total = Vector((0.0, 0.0, 0.0))
        for name in keys:
            total += shifts[name][nearest[index]]
        basis.data[index].co = vertex.co - total * 0.5

    for name in keys:
        block = garment.shape_key_add(name=name, from_mix=False)
        for index in range(len(garment.data.vertices)):
            block.data[index].co = basis.data[index].co + shifts[name][nearest[index]]
        # Eksportda `weights` shu qiymatdan olinadi
        block.value = 0.5

    print(f"  o'lcham kalitlari: {len(keys)} ta")


def export(garment, path):
    bpy.ops.object.select_all(action="DESELECT")
    garment.select_set(True)
    bpy.context.view_layer.objects.active = garment

    """⚠️ `export_apply` O'CHIQ. Modifikatorlar `finish()` da allaqachon
    qo'llangan, shape key'lar esa endi bor — Blender ikkalasini birga
    bajara olmaydi va shape key'larni jimgina tashlab ketadi."""
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
    )


def main():
    avatar_path, spec_path, out_path = args()
    spec = json.loads(open(spec_path, encoding="utf-8").read())

    clean_scene()
    meshes = import_avatar(avatar_path)

    missing = [name for name in spec["source"] + spec["collide"] if name not in meshes]
    if missing:
        raise SystemExit(f"tana qismlari topilmadi: {', '.join(missing)}")

    garment = merged_copy([meshes[n] for n in spec["source"]], spec["key"])
    keep_region(garment, spec["region"])
    offset_along_normals(garment, spec.get("offset", 0.02))

    if spec.get("cloth"):
        body = merged_copy([meshes[n] for n in spec["collide"]], "collider")
        simulate(garment, body, spec["cloth"], spec["region"])
        bpy.data.objects.remove(body, do_unlink=True)

    finish(garment, spec)

    if spec.get("size_keys", True):
        add_size_keys(garment, [meshes[name] for name in spec["collide"]])

    export(garment, out_path)

    print(f"TAYYOR {spec['key']}: {len(garment.data.polygons)} uchburchak → {out_path}")


main()
