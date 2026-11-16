"""Uzoq yashaydigan FaceFusion ishchisi — modellar xotirada turadi.

⚠️ NEGA KERAK (2026-11-15, VPS'da o'lchangan). `facefusion.py headless-run`
har so'rovda yangi jarayon ochadi va ~45 soniyaning ~30 tasi ishga emas,
tayyorgarlikka ketardi:

  • model fayllarini qayta tekshirish (2 GB ni CRC qilish)   ~10 s
  • modellarni xotiraga yuklash                              ~12–14 s
  • python va facefusion'ning o'zi ishga tushishi            ~2–4 s

Bu jarayon ularni BIR MARTA qiladi va navbatdagi ishni kutib turadi.
Natija piksel-ma-piksel CLI bilan bir xil: xuddi o'sha funksiyalar, xuddi
o'sha sozlamalar chaqiriladi (`core.conditional_process`).

Bu fayl FACEFUSION'NING O'Z python'ida ishlaydi (`/app/facefusion/.venv`),
API jarayonida emas. Ota jarayon (`swap.py`) bilan gaplashish — har qatorda
bitta JSON: ish stdin'dan keladi, javob stdout'ga yoziladi. Facefusion,
ffmpeg yoki onnxruntime nima chop etsa — stderr'ga (konteyner logiga) ketadi.

⚠️ FACEFUSION'NING ICHKI FUNKSIYALARI CHAQIRILADI — ular ommaviy API emas.
Versiya Dockerfile'da qotirilgan (`FACEFUSION_REF`); yangilaganda
`vps/smoke.sh` bilan sinang. Bu ishchi yiqilsa xizmat to'xtamaydi: `swap.py`
o'sha so'rovni eski yo'l (CLI) bilan bajaradi.
"""
from __future__ import annotations

import hashlib
import inspect
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Set, Tuple

# `facefusion.py` aynan shuni qiladi — xulq bir xil bo'lsin.
os.environ["OMP_NUM_THREADS"] = "1"

FACEFUSION_DIR = os.environ.get("FACEFUSION_DIR", "/app/facefusion")

# Javob kanali — asl stdout. Shundan keyin 1-deskriptor stderr'ga buriladi:
# kutubxonalar stdout'ga nima yozsa ham protokol qatorlariga aralashmaydi.
_PROTO = os.fdopen(os.dup(1), "w", buffering=1, encoding="utf-8")
os.dup2(2, 1)
sys.stdout = sys.stderr


def _send(message: Dict[str, Any]) -> None:
    _PROTO.write(json.dumps(message, ensure_ascii=False) + "\n")
    _PROTO.flush()


def _thread_count() -> int:
    """Shu jarayonga berilgan yadrolar soni (konteynerning `cpuset`i bilan)."""
    raw = os.environ.get("FACE_THREADS", "").strip()
    if raw.isdigit() and int(raw) > 0:
        return int(raw)
    try:
        return max(1, len(os.sched_getaffinity(0)))
    except AttributeError:  # Linux emas
        return max(1, os.cpu_count() or 1)


def _rss_mb() -> int:
    try:
        with open("/proc/self/status", encoding="ascii") as handle:
            for line in handle:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) // 1024
    except OSError:
        pass
    return 0


THREADS = _thread_count()

# Almashtirgich yuzni bo'laklarga bo'lib hisoblaydi (512x512 da 16 ta) —
# nechtasi bir vaqtda ketadi. 1 — facefusion'ning o'zidagidek ketma-ket.
_RAW_TILES = os.environ.get("FACEFUSION_TILE_WORKERS", "").strip()
TILE_WORKERS = int(_RAW_TILES) if _RAW_TILES.isdigit() else THREADS

# Ishga tushganda shu model oldindan yuklanadi (API sukut bo'yicha shuni
# so'raydi). Boshqa model so'ralsa — o'sha so'rovda yuklanadi va u ham qoladi.
WARM_MODEL = os.environ.get("FACEFUSION_WARM_MODEL", "inswapper_128")
WARM_PIXEL_BOOST = os.environ.get("FACEFUSION_WARM_PIXEL_BOOST", "512x512")

os.chdir(FACEFUSION_DIR)
# Skript papkasi (/app) o'rniga facefusion ildizi: aks holda `import
# facefusion` /app/facefusion PAPKASINI (paket emas) topib olardi.
sys.path[0] = FACEFUSION_DIR

# ⚠️ CLI ARGUMENTLARI `swap.py` DAGI BILAN BIR XIL BO'LISHI SHART — natija
# aynan shularga bog'liq. Farqi faqat ikkita:
#   • yo'llar har ishda almashtiriladi;
#   • `tolerant` — ish tugagach modellar xotiradan chiqarilmaydi (sukutdagi
#     `strict` har ishdan keyin hammasini tozalaydi).
sys.argv = [
    "facefusion.py", "headless-run",
    "--source-paths", "/nonexistent/source.jpg",
    "--target-path", "/nonexistent/target.jpg",
    "--output-path", "/nonexistent/output.jpg",
    "--processors", "face_swapper", "face_enhancer",
    "--face-swapper-model", WARM_MODEL,
    "--face-swapper-pixel-boost", WARM_PIXEL_BOOST,
    "--execution-providers", "cpu",
    "--output-image-quality", "95",
    "--log-level", "info",
    "--video-memory-strategy", "tolerant",
]

import onnxruntime  # noqa: E402

from facefusion import (  # noqa: E402
    content_analyser,
    core,
    face_classifier,
    face_detector,
    face_landmarker,
    face_recognizer,
    face_store,
    inference_manager,
    process_manager,
    state_manager,
)
from facefusion import logger as ff_logger  # noqa: E402
from facefusion.args import apply_args  # noqa: E402
from facefusion.model_helper import get_static_model_initializer  # noqa: E402
from facefusion.processors.modules.face_enhancer import core as enhancer  # noqa: E402
from facefusion.processors.modules.face_swapper import choices as swapper_choices  # noqa: E402
from facefusion.processors.modules.face_swapper import core as swapper  # noqa: E402
from facefusion.program import create_program  # noqa: E402
from facefusion.program_helper import validate_args  # noqa: E402
from facefusion.vision import read_static_image  # noqa: E402

log = logging.getLogger("ff-worker")


# ── Ip soni ──────────────────────────────────────────────────────────────
#
# Facefusion sessiyani sozlamasiz ochadi: onnxruntime mashinadagi HAMMA
# yadroga ip ochadi va ularni yadrolarga mixlashga urinadi. Konteynerga
# yadrolarning bir qismi berilgan bo'lsa (`cpuset`), bu ortiqcha iplar va
# logda «pthread_setaffinity_np failed» xatolari degani. Shuning uchun ip
# soni aniq beriladi.
#
# Almashtirgich modeli — alohida: uning bo'laklari parallel chaqiriladi
# (`_install_parallel_tiles`), har chaqiruv bitta ipda. O'lchangan (16 bo'lak,
# 8 yadro): 8 ipli ketma-ket 15.0 s, bir ipli 8 ta parallel 11.8 s. Sababi:
# bitta sessiyaning ichki iplari parallel chaqiruvlar orasida BO'LISHILADI,
# shuning uchun «2 ip x 4 parallel» kabi aralash sozlama eng yomoni (19 s).

_REAL_SESSION = inference_manager.InferenceSession
_SWAPPER_PATHS: Set[str] = set()
_PARALLEL_TILES = False


def _swapper_model_paths() -> Set[str]:
    paths: Set[str] = set()
    for options in swapper.create_static_model_set("full").values():
        for source in (options.get("sources") or {}).values():
            path = source.get("path")
            if path:
                paths.add(os.path.abspath(path))
    return paths


def _session(model_path: str, providers: Any = None, **kwargs: Any) -> Any:
    options = onnxruntime.SessionOptions()
    single = _PARALLEL_TILES and os.path.abspath(model_path) in _SWAPPER_PATHS
    options.intra_op_num_threads = 1 if single else THREADS
    return _REAL_SESSION(model_path, sess_options=options, providers=providers, **kwargs)


# ── Bo'laklarni parallel hisoblash ───────────────────────────────────────

# `swap_face` ning qotirilgan versiyadagi matni. Facefusion yangilanib,
# funksiya o'zgarsa — nusxamiz eskirgan bo'ladi va parallel yo'l O'ZI
# o'chadi (asl funksiya qoladi, faqat sekinroq).
_SWAP_FACE_SHA256 = "2585dd4d13114388046f08705d461af6b2060c4db463d42e9a774a0f2704bb7f"


def _install_parallel_tiles() -> bool:
    if TILE_WORKERS <= 1:
        return False
    try:
        actual = hashlib.sha256(inspect.getsource(swapper.swap_face).encode()).hexdigest()
    except Exception:  # noqa: BLE001
        return False
    if actual != _SWAP_FACE_SHA256:
        log.warning("swap_face o'zgargan (%s) — bo'laklar ketma-ket hisoblanadi", actual[:12])
        return False

    pool = ThreadPoolExecutor(max_workers=TILE_WORKERS, thread_name_prefix="tile")
    cv2 = swapper.cv2
    numpy = swapper.numpy

    # Asl `swap_face` ning aynan o'zi; farqi — bo'laklar tsikli `pool.map`.
    def swap_face(source_face: Any, target_face: Any, source_vision_frame: Any, temp_vision_frame: Any) -> Any:
        model_template = swapper.get_model_options().get("template")
        model_size = swapper.get_model_options().get("size")
        pixel_boost_size = swapper.unpack_resolution(state_manager.get_item("face_swapper_pixel_boost"))
        pixel_boost_total = pixel_boost_size[0] // model_size[0]
        crop_vision_frame, affine_matrix = swapper.warp_face_by_face_landmark_5(
            temp_vision_frame, target_face.landmark_set.get("5/68"), model_template, pixel_boost_size
        )
        crop_masks = []

        if "box" in state_manager.get_item("face_mask_types"):
            box_mask = swapper.create_box_mask(
                crop_vision_frame, state_manager.get_item("face_mask_blur"), state_manager.get_item("face_mask_padding")
            )
            crop_masks.append(box_mask)

        if "occlusion" in state_manager.get_item("face_mask_types"):
            occlusion_mask = swapper.create_occlusion_mask(crop_vision_frame)
            crop_masks.append(occlusion_mask)

        pixel_boost_vision_frames = swapper.implode_pixel_boost(crop_vision_frame, pixel_boost_total, model_size)

        def one(pixel_boost_vision_frame: Any) -> Any:
            pixel_boost_vision_frame = swapper.prepare_crop_frame(pixel_boost_vision_frame)
            pixel_boost_vision_frame = swapper.forward_swap_face(
                source_face, target_face, source_vision_frame, pixel_boost_vision_frame
            )
            return swapper.normalize_crop_frame(pixel_boost_vision_frame)

        if len(pixel_boost_vision_frames) > 1:
            # Umumiy narsalar oldindan tayyor bo'lsin — aks holda iplar
            # ularni bir vaqtda, har biri o'zi yuklashga urinadi.
            swapper.get_inference_pool()
            if swapper.get_model_options().get("type") not in ("blendswap", "uniface"):
                swapper.prepare_source_embedding(source_face)
            temp_vision_frames = list(pool.map(one, pixel_boost_vision_frames))
        else:
            temp_vision_frames = [one(frame) for frame in pixel_boost_vision_frames]

        crop_vision_frame = swapper.explode_pixel_boost(temp_vision_frames, pixel_boost_total, model_size, pixel_boost_size)

        if "area" in state_manager.get_item("face_mask_types"):
            face_landmark_68 = cv2.transform(
                target_face.landmark_set.get("68").reshape(1, -1, 2), affine_matrix
            ).reshape(-1, 2)
            area_mask = swapper.create_area_mask(crop_vision_frame, face_landmark_68, state_manager.get_item("face_mask_areas"))
            crop_masks.append(area_mask)

        if "region" in state_manager.get_item("face_mask_types"):
            region_mask = swapper.create_region_mask(crop_vision_frame, state_manager.get_item("face_mask_regions"))
            crop_masks.append(region_mask)

        crop_mask = numpy.minimum.reduce(crop_masks).clip(0, 1)
        paste_vision_frame = swapper.paste_back(temp_vision_frame, crop_vision_frame, crop_mask, affine_matrix)
        return paste_vision_frame

    swapper.swap_face = swap_face
    return True


# ── Ish ──────────────────────────────────────────────────────────────────


class _Capture(logging.Handler):
    """Facefusion log qatorlarini yig'adi — «yuz topilmadi» kabi sabab shu yerda."""

    def __init__(self) -> None:
        super().__init__(level=logging.INFO)
        self.lines: List[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        try:
            self.lines.append(record.getMessage())
        except Exception:  # noqa: BLE001
            pass


_CAPTURE = _Capture()
_ARGS: Dict[str, Any] = {}
# Fayllari tekshirilgan (protsessorlar, almashtirgich modeli) juftliklari.
_CHECKED: Set[Tuple[Tuple[str, ...], str]] = set()


def _pre_check(processors: List[str], model: str) -> bool:
    """Model fayllarini tekshiradi (yo'q bo'lsa yuklab oladi) — har juftlik uchun BIR marta."""
    key = (tuple(processors), model)
    if key in _CHECKED:
        return True
    if not (core.common_pre_check() and core.processors_pre_check()):
        return False
    _CHECKED.add(key)
    # Kuchaytirgichsiz to'plam — tekshirilganning bir qismi
    _CHECKED.add((tuple(name for name in processors if name == "face_swapper"), model))
    return True


def _apply(job: Dict[str, Any], processors: List[str]) -> None:
    step = dict(_ARGS)
    step.update(
        source_paths=[job["source"]],
        target_path=job["target"],
        output_path=job["output"],
        temp_path=job["temp"],
        processors=processors,
        face_swapper_model=job["model"],
        face_swapper_pixel_boost=job["pixel_boost"],
    )
    apply_args(step, state_manager.set_item)


def _forget() -> None:
    """Ish tugagach undan hech narsa qolmasin.

    Yuz keshi kalit sifatida kadrning 32 bitli CRC'sini ishlatadi: CLI'da u
    jarayon bilan birga yo'qoladi, bu yerda esa tozalanmasa boshqa mijozning
    yuzi (kamdan-kam, lekin mumkin bo'lgan to'qnashuvda) qaytib chiqardi.
    """
    for clear in (face_store.clear_faces, content_analyser.analyse_image.cache_clear, read_static_image.cache_clear):
        try:
            clear()
        except Exception:  # noqa: BLE001
            pass
    process_manager.end()


def _run(job: Dict[str, Any]) -> Dict[str, Any]:
    model = str(job.get("model") or "")
    pixel_boost = str(job.get("pixel_boost") or "")
    processors = ["face_swapper"] + (["face_enhancer"] if job.get("enhance") else [])

    # CLI'da buni argparse tekshiradi (noto'g'ri qiymat — chiqish kodi 2)
    allowed = swapper_choices.face_swapper_set.get(model)
    if allowed is None:
        return {"code": 2, "log": [f"invalid face swapper model: {model}"]}
    if pixel_boost not in allowed:
        return {"code": 2, "log": [f"invalid pixel boost {pixel_boost} for {model}"]}

    # Xotirada BITTA almashtirgich modeli turadi. Boshqa model so'ralsa
    # avvalgisi chiqariladi: ikkalasi birga ~7.4 GB oladi (o'lchangan) va
    # ishchi xotira chegarasidan oshib, har safar qayta ochilardi.
    previous = state_manager.get_item("face_swapper_model")
    if previous and previous != model:
        try:
            swapper.clear_inference_pool()  # holat hali avvalgi modelni ko'rsatadi
            get_static_model_initializer.cache_clear()
        except Exception:  # noqa: BLE001
            log.exception("avvalgi modelni xotiradan chiqarib bo'lmadi: %s", previous)

    _apply(job, processors)
    if not _pre_check(processors, model):
        return {"code": 1, "log": _CAPTURE.lines[-30:] + ["pre_check failed"]}

    code = core.conditional_process()
    return {"code": int(code), "log": _CAPTURE.lines[-30:]}


def _handle(job: Dict[str, Any]) -> Dict[str, Any]:
    started = time.time()
    _CAPTURE.lines = []
    try:
        reply = _run(job)
    except BaseException as exc:  # noqa: BLE001 — SystemExit ham (facefusion `hard_exit`)
        log.exception("ish yiqildi")
        # Holat yarim o'zgargan bo'lishi mumkin — bu jarayon endi ishonchsiz
        reply = {"code": -1, "log": _CAPTURE.lines[-30:] + [f"{exc.__class__.__name__}: {exc}"], "fatal": True}
    finally:
        _forget()

    reply["id"] = job.get("id")
    reply["seconds"] = round(time.time() - started, 2)
    reply["rss_mb"] = _rss_mb()
    return reply


# ── Ishga tushish ────────────────────────────────────────────────────────


def _setup() -> None:
    global _ARGS, _PARALLEL_TILES, _SWAPPER_PATHS

    program = create_program()
    if not validate_args(program):
        raise RuntimeError("facefusion argumentlari yaroqsiz")
    _ARGS = vars(program.parse_args())
    apply_args(_ARGS, state_manager.init_item)
    ff_logger.init(state_manager.get_item("log_level"))
    ff_logger.get_package_logger().addHandler(_CAPTURE)

    _SWAPPER_PATHS = _swapper_model_paths()
    _PARALLEL_TILES = _install_parallel_tiles()
    inference_manager.InferenceSession = _session

    if not _pre_check(list(state_manager.get_item("processors")), WARM_MODEL):
        raise RuntimeError("model fayllari tekshiruvdan o'tmadi")


def _warm_up() -> None:
    """Hamma model sessiyasini oldindan ochadi — birinchi so'rov kutmasin."""
    modules = (content_analyser, face_detector, face_landmarker, face_recognizer, face_classifier, swapper, enhancer)
    for module in modules:
        try:
            module.get_inference_pool()
        except Exception:  # noqa: BLE001 — isitish ixtiyoriy, model birinchi ishda yuklanadi
            log.exception("%s isitilmadi", module.__name__)

    try:
        options = swapper.get_model_options()
        if options.get("type") == "inswapper":
            get_static_model_initializer(options.get("sources").get("face_swapper").get("path"))
    except Exception:  # noqa: BLE001
        log.exception("model matritsasi isitilmadi")


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    started = time.time()
    try:
        _setup()
        _warm_up()
    except BaseException as exc:  # noqa: BLE001
        log.exception("ishga tushmadi")
        _send({"event": "failed", "error": f"{exc.__class__.__name__}: {exc}"})
        return 1

    _send(
        {
            "event": "ready",
            "seconds": round(time.time() - started, 1),
            "threads": THREADS,
            "tiles": TILE_WORKERS if _PARALLEL_TILES else 1,
            "model": WARM_MODEL,
            "rss_mb": _rss_mb(),
        }
    )

    # Ota jarayon yopilsa stdin tugaydi — tsikl ham tugaydi, jarayon yetim qolmaydi
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            job = json.loads(line)
        except ValueError:
            log.error("tushunarsiz qator: %s", line[:200])
            continue

        reply = _handle(job)
        _send(reply)
        if reply.get("fatal"):
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
