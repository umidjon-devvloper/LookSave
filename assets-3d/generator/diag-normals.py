"""
Kiyim qobig'idagi NORMAL UZILISHINI o'lchaydi — zigzag va chok nuqsonining
sababini raqam bilan ajratish uchun.

⚠️ ICHKI QAVAT AJRATILADI. `thickness` bilan yasalgan ichki qavat normali
teskari qaraydi; uni hisobga olsak har o'rin "180 daraja uzilgan" bo'lib
chiqadi va o'lchov ma'nosini yo'qotadi.

  Blender --background --python diag_normals.py -- <glb> [<glb> ...]
"""

import sys
import math

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]

for path in argv:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=path)

    name = path.split("/")[-1]
    print(f"\n=== {name} ===")

    for obj in sorted(bpy.context.scene.objects, key=lambda o: o.name):
        if obj.type != "MESH":
            continue

        me = obj.data
        me.calc_loop_triangles()
        if not me.vertices:
            continue

        center = sum((v.co for v in me.vertices), Vector()) / len(me.vertices)

        outer = {}
        for tri in me.loop_triangles:
            for li in tri.loops:
                loop = me.loops[li]
                v = me.vertices[loop.vertex_index]
                radial = v.co - center
                radial.z = 0
                n = Vector(loop.normal)
                if radial.length > 1e-6 and n.dot(radial.normalized()) < 0:
                    continue  # ichki qavat
                key = (round(v.co.x, 4), round(v.co.y, 4), round(v.co.z, 4))
                outer.setdefault(key, []).append(n)

        split = 0
        worst = 0.0
        for normals in outer.values():
            if len(normals) < 2:
                continue
            for i in range(1, len(normals)):
                deg = math.degrees(normals[0].angle(normals[i]))
                if deg > 5:
                    split += 1
                    worst = max(worst, deg)
                    break

        share = (split / len(outer) * 100) if outer else 0
        print(
            f"  {obj.name:<22} orin={len(outer):>4}  uzilgan={split:>4} "
            f"({share:>5.1f}%)  eng_katta={worst:>6.1f}deg"
        )
