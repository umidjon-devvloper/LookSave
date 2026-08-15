"""`looksave_rules` testlari.

    python3 blender_scripts/test_rules.py

Blender kerak emas — shuning uchun CI'da ham ishlaydi.
"""

from __future__ import annotations

import unittest

from looksave_rules import (
    BODY_PARTS,
    BONE_PREFIX,
    MORPH_KEYS,
    REQUIRED_BONES,
    check_body_meshes,
    check_bones,
    check_filename,
    check_hidden_parts,
    check_materials,
    check_morphs,
    check_polycount,
    check_sockets,
    slot_from_filename,
)


def all_bones() -> list[str]:
    return [BONE_PREFIX + bone for bone in REQUIRED_BONES]


class TestFilename(unittest.TestCase):
    def test_valid(self) -> None:
        self.assertEqual(check_filename("nike_air-max-90_black_feet.glb"), [])
        self.assertEqual(check_filename("zara_oversize-hoodie_beige_top.glb"), [])

    def test_extension(self) -> None:
        problems = check_filename("nike_air-max-90_black_feet.gltf")
        self.assertTrue(any(".glb" in problem for problem in problems))

    def test_uppercase_and_cyrillic_rejected(self) -> None:
        # Blender fayl nomini o'zgartirmaydi — xato shu yerda ushlanadi
        self.assertTrue(check_filename("Nike_air-max_black_feet.glb"))
        self.assertTrue(check_filename("найк_air-max_black_feet.glb"))
        self.assertTrue(check_filename("nike_air max_black_feet.glb"))

    def test_wrong_part_count(self) -> None:
        problems = check_filename("nike_air-max_feet.glb")
        self.assertTrue(any("to`rt qism" in problem for problem in problems))

    def test_unknown_slot(self) -> None:
        problems = check_filename("nike_air-max_black_shoes.glb")
        self.assertTrue(any("slot" in problem for problem in problems))

    def test_slot_extraction(self) -> None:
        self.assertEqual(slot_from_filename("nike_air-max-90_black_feet.glb"), "feet")
        self.assertIsNone(slot_from_filename("buzuq nom.glb"))


class TestBones(unittest.TestCase):
    def test_complete_skeleton(self) -> None:
        self.assertEqual(check_bones(all_bones()), [])

    def test_missing_bone(self) -> None:
        bones = [bone for bone in all_bones() if not bone.endswith("LeftToeBase")]
        problems = check_bones(bones)
        self.assertEqual(len(problems), 1)
        self.assertIn("LeftToeBase", problems[0])

    def test_renamed_prefix_gives_useful_hint(self) -> None:
        # Blender import qilganda `:` ni `_` ga almashtirishi mumkin —
        # eng ko'p uchraydigan va eng chalkashtiradigan xato
        bones = [bone.replace("mixamorig:", "mixamorig_") for bone in all_bones()]
        problems = check_bones(bones)
        self.assertTrue(problems)
        self.assertIn("→", problems[0])
        self.assertIn("mixamorig:", problems[0])

    def test_duplicate_suffix(self) -> None:
        bones = [bone + ".001" for bone in all_bones()]
        problems = check_bones(bones)
        self.assertTrue(problems)


class TestSockets(unittest.TestCase):
    def setUp(self) -> None:
        self.names = [
            "socket_head",
            "socket_face",
            "socket_neck",
            "socket_wrist_L",
            "socket_wrist_R",
            "socket_foot_L",
            "socket_foot_R",
            "socket_bag",
        ]
        self.parents = {
            "socket_head": "mixamorig:Head",
            "socket_face": "mixamorig:Head",
            "socket_neck": "mixamorig:Neck",
            "socket_wrist_L": "mixamorig:LeftHand",
            "socket_wrist_R": "mixamorig:RightHand",
            "socket_foot_L": "mixamorig:LeftFoot",
            "socket_foot_R": "mixamorig:RightFoot",
            "socket_bag": "mixamorig:Spine2",
        }

    def test_all_correct(self) -> None:
        self.assertEqual(check_sockets(self.names, self.parents), [])

    def test_prefixless_parent_accepted(self) -> None:
        parents = {key: value.removeprefix(BONE_PREFIX) for key, value in self.parents.items()}
        self.assertEqual(check_sockets(self.names, parents), [])

    def test_missing_socket(self) -> None:
        names = [name for name in self.names if name != "socket_bag"]
        problems = check_sockets(names, self.parents)
        self.assertEqual(len(problems), 1)
        self.assertIn("socket_bag", problems[0])

    def test_wrong_parent(self) -> None:
        # Chap-o'ng chalkashtirish — poyabzal noto'g'ri oyoqda turadi
        parents = dict(self.parents)
        parents["socket_foot_L"] = "mixamorig:RightFoot"
        problems = check_sockets(self.names, parents)
        self.assertEqual(len(problems), 1)
        self.assertIn("LeftFoot", problems[0])

    def test_unparented_socket(self) -> None:
        parents = dict(self.parents)
        del parents["socket_head"]
        problems = check_sockets(self.names, parents)
        self.assertTrue(any("bog`lanmagan" in problem for problem in problems))


class TestBodyMeshes(unittest.TestCase):
    def test_complete(self) -> None:
        self.assertEqual(check_body_meshes(list(BODY_PARTS)), [])

    def test_single_mesh_body(self) -> None:
        # Eng jiddiy xato: tana bir butun, hide_body_parts ishlamaydi
        problems = check_body_meshes(["Body"])
        self.assertEqual(len(problems), 1)
        self.assertIn("bir butun", problems[0])

    def test_partial(self) -> None:
        parts = [part for part in BODY_PARTS if part != "body_foot_R"]
        problems = check_body_meshes(parts)
        self.assertEqual(len(problems), 1)
        self.assertIn("body_foot_R", problems[0])


class TestMorphs(unittest.TestCase):
    def test_top_requires_all(self) -> None:
        self.assertEqual(check_morphs(list(MORPH_KEYS), "top"), [])

    def test_top_without_morphs(self) -> None:
        problems = check_morphs([], "top")
        self.assertEqual(len(problems), 1)
        self.assertIn("majburiy", problems[0])

    def test_top_partial(self) -> None:
        problems = check_morphs(["mt_height", "mt_weight"], "top")
        self.assertEqual(len(problems), 4)

    def test_accessory_without_morphs_is_fine(self) -> None:
        self.assertEqual(check_morphs([], "wrist"), [])
        self.assertEqual(check_morphs([], "feet"), [])

    def test_accessory_with_morphs_warns(self) -> None:
        problems = check_morphs(list(MORPH_KEYS), "feet")
        self.assertEqual(len(problems), 1)
        self.assertIn("kerak emas", problems[0])

    def test_unrelated_shape_keys_ignored(self) -> None:
        keys = [*MORPH_KEYS, "Basis", "viseme_O"]
        self.assertEqual(check_morphs(keys, "top"), [])


class TestBudgets(unittest.TestCase):
    def test_within_budget(self) -> None:
        self.assertEqual(check_polycount(3_000, "top"), [])

    def test_too_many(self) -> None:
        problems = check_polycount(9_000, "top")
        self.assertTrue(any("retopology" in problem for problem in problems))

    def test_too_few(self) -> None:
        problems = check_polycount(50, "top")
        self.assertTrue(problems)

    def test_unknown_slot_skipped(self) -> None:
        self.assertEqual(check_polycount(999_999, "noma'lum"), [])

    def test_materials(self) -> None:
        self.assertEqual(check_materials(3), [])
        self.assertTrue(check_materials(7))


class TestHiddenParts(unittest.TestCase):
    def test_known_parts(self) -> None:
        self.assertEqual(check_hidden_parts(["body_torso", "body_upperArm_L"]), [])

    def test_typo_caught(self) -> None:
        # Bazaga noto'g'ri nom yozilsa tana yashirilmaydi va kiyim ichidan chiqadi
        problems = check_hidden_parts(["body_Torso"])
        self.assertEqual(len(problems), 1)

    def test_empty_is_valid(self) -> None:
        # Kepka uchun bo'sh ro'yxat normal
        self.assertEqual(check_hidden_parts([]), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
