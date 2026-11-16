"""Cutout (fon olib tashlash) — birefnet-general-lite.

⚠️ UCH QOIDA (2026-11-12) — uchalasi ham o'lchangan nosozlikdan chiqqan:

1. MODEL ALOHIDA JARAYONDA ISHLAYDI, API jarayonida emas.
   Ilgari rembg sessiyasi uvicorn ichida turardi va har kesimdan keyin
   xotirasi o'sib borardi: 2026-11-11 da ~20 ta kesimdan so'ng uvicorn
   12.7 GB RSS ga yetdi, navbatdagi facefusion ishga tushganda mashina
   OOM bilan o'ldirildi (`exit_code=137, oom_killed=true`) va o'sha
   paytdagi so'rov 502 oldi — ya'ni mijozga yuzi almashtirilmagan rasm
   ketdi. Bola jarayon bir necha ishdan keyin almashtiriladi va xotira
   to'liq OS ga qaytadi.

2. RASM KICHRAYTIRILMAYDI — FAQAT MASKA.
   Ilgari kirish rasmi `MAX_SIDE` gacha kichraytirilib, natija ham o'sha
   o'lchamda qaytardi: 1024×1536 → 512×768. Yuz ikki barobar maydalashib
   xiralashardi. Endi model kichik nusxada faqat MASKANI hisoblaydi, maska
   asl o'lchamga cho'ziladi va asl piksellarga qo'yiladi.

3. ASL SHAFFOFLIK BOR BO'LSA MODEL UMUMAN CHAQIRILMAYDI.
   AI allaqachon shaffof PNG qaytargan bo'lsa, uning alfasi model
   taxminidan aniqroq (soch tolalari, qora kiyim) — o'shani saqlaymiz.
"""
from __future__ import annotations

import io
import logging
import multiprocessing
import os
import subprocess
import sys
import threading
import time
from functools import lru_cache
from typing import Any, Dict, Optional, Tuple

import numpy as np
from PIL import Image, ImageChops, ImageFilter, ImageOps

log = logging.getLogger("cutout")

# PREMIUM default: birefnet-general-lite — 440MB RAM, premium chekka.
# `birefnet-general` 2026-11-10'da sinab ko'rildi — fly.io 8GB'da OOM qildi
# (inference peak 7.9GB). Lite yetarli: alfa threshold bilan sifat yaxshi,
# fon o'tib ko'rinmaydi.
MODEL = os.environ.get("CUTOUT_MODEL", "birefnet-general-lite")

# MODEL ko'radigan nusxaning maksimum o'lchami (natijaning emas!).
# Maska shu o'lchamda hisoblanadi, keyin asl o'lchamga cho'ziladi.
MAX_SIDE = int(os.environ.get("CUTOUT_MAX_SIDE", "768"))

# Alfa normallashtirish — chekkadagi yarim-shaffof piksellar aniqlashtirish uchun.
# Lite model body'ga 230+ alpha, chetlarga 30-60 beradi. 80 dan past = 0,
# 200 dan yuqori = 255. Fon o'tib ko'rinmaydi, body opaque.
ALPHA_LO = int(os.environ.get("CUTOUT_ALPHA_LO", "80"))
ALPHA_HI = int(os.environ.get("CUTOUT_ALPHA_HI", "200"))

# Qora fon chetdan flood-fill.
# ⚠️ 0 ga tushirildi (2026-11-10): render rasmlarida foydalanuvchining
# kiyimi qora bo'lsa (qora shim, qora kurtka), flood-fill fon qora pikseldan
# kiyimga tarqalib, kiyimni ham transparent qilib yuborar edi. rembg
# birefnet o'zi yetarli — chetdagi fonni to'g'ri aniqlaydi. 0 flood-fill'ni
# butunlay o'chiradi. (CUTOUT_BLACK_BG_THRESHOLD env bilan tiklash mumkin.)
BLACK_BG_THRESHOLD = int(os.environ.get("CUTOUT_BLACK_BG_THRESHOLD", "0"))

# Flood tugagach chekka torayitish — halo yo'q qilish.
EDGE_ERODE = int(os.environ.get("CUTOUT_EDGE_ERODE", "3"))

# Chekka silliqlash — Gauss blur (model ko'rgan o'lchamda).
EDGE_BLUR = float(os.environ.get("CUTOUT_EDGE_BLUR", "2.0"))

# Bitta bola jarayon nechta kesimdan keyin almashtiriladi. Kichik son —
# xotira kam yig'iladi, lekin har almashganda model qayta yuklanadi.
#
# ⚠️ SUKUT BO'YICHA 1 — har kesimdan keyin jarayon yopiladi. Ishchi tirik
# qolsa, xotirasi keyingi facefusion bilan bir vaqtda band turadi; 1 da esa
# hech narsa qolmaydi (kichik mashina — fly.io — aynan shunga muhtoj edi).
#
# VPS'da o'lchangan (2026-11-15, 8 yadro): model yuklash 9–13 s; yangi
# jarayondagi BIRINCHI kesim ~14 s, keyingilari ~9 s. Xotira esa birinchi
# kesimdan keyin 7.4 GB, ikkinchisidan keyin 11.9 GB va shu yerda TO'XTAYDI
# (2026-11-11 dagi «12.7 GB» ham cheksiz o'sish emas, shu chegara ekan).
# Xotirasi keng serverda kattaroq son tezroq — `CUTOUT_IDLE_RECYCLE_S`
# bilan birga, bo'sh paytda o'sha 12 GB qaytib tursin.
TASKS_PER_WORKER = max(1, int(os.environ.get("CUTOUT_TASKS_PER_WORKER", "1")))

# Ishchi OLDINDAN ochib qo'yiladimi. Yoqilsa model so'rov ichida emas, ikki
# so'rov orasida (fonda) yuklanadi — har kesimdan 9–13 soniya tushadi.
# Kutib turgan ishchi ~0.6 GB oladi.
PREWARM = os.environ.get("CUTOUT_PREWARM", "").strip().lower() in ("1", "true", "yes", "on")

# Kamida bitta ish bajargan ishchi shuncha soniya bo'sh tursa, yangisiga
# almashtiriladi (xotirasi qaytadi). 0 — almashtirilmaydi.
#
# ⚠️ QISQA QILMA. Yangi ishchining birinchi kesimi 14–18 s, isiganiniki 9 s:
# qiymat so'rovlar orasidagi odatiy tanaffusdan qisqa bo'lsa, HAR so'rov
# «birinchi kesim» narxini to'laydi.
IDLE_RECYCLE_S = max(0, int(os.environ.get("CUTOUT_IDLE_RECYCLE_S", "0")))

# Ishchi xotirasi shundan oshsa — navbatdagi ishdan oldin almashtiriladi.
# O'lchovda ~12 GB da to'xtaydi; bu chegara asta sizib chiqishdan himoya.
WORKER_MAX_RSS_MB = int(os.environ.get("CUTOUT_WORKER_MAX_RSS_MB", "16000"))

# Bitta maskaga beriladigan vaqt (model xotiraga yuklanishi bilan birga).
MASK_TIMEOUT_S = int(os.environ.get("CUTOUT_TIMEOUT_S", "150"))

# Model FAYLINI yuklab olishga beriladigan vaqt — `ensure_model` ga qarang.
MODEL_FETCH_TIMEOUT_S = int(os.environ.get("CUTOUT_MODEL_FETCH_TIMEOUT_S", "1800"))

# Asl alfaga ishonish shartlari — `trusted_alpha` ga qarang.
TRUST_MIN_CLEAR = 0.08
TRUST_MIN_SOLID = 0.03
TRUST_MAX_FILL = 0.86


# ── Rasmni o'qish ──


def decode(data: bytes) -> Image.Image:
    """Baytlarni RGB yoki RGBA rasmga aylantiradi.

    ⚠️ WebP SUPPORT (2026-11-10): backend result_url'lari `.webp` bo'lishi
    mumkin. PIL ocha olmasa imageio bilan urinib ko'ramiz.

    ⚠️ EXIF BURILISHI QO'LLANADI. Facefusion rasmni OpenCV bilan o'qiydi va
    u burilishni o'zi qo'llaydi; PIL esa qo'llamaydi. Usiz ikkala nusxa
    bir-biriga mos kelmay qolardi (`compose.merge_swap` piksel-ma-piksel
    solishtiradi).
    """
    try:
        image = Image.open(io.BytesIO(data))
        image.load()  # formatni darhol decode qilish — xatoni erta aniqlash
    except Exception as first:  # noqa: BLE001
        log.warning("Image.open xato: %s — imageio bilan urinib ko'ramiz", first)
        try:
            import imageio.v3 as iio

            image = Image.fromarray(iio.imread(io.BytesIO(data)))
        except Exception as second:  # noqa: BLE001
            raise RuntimeError(f"cannot decode image: {first}; imageio fallback: {second}")

    image = ImageOps.exif_transpose(image) or image

    if image.mode == "P" and "transparency" in image.info:
        image = image.convert("RGBA")
    elif image.mode in ("LA", "PA"):
        image = image.convert("RGBA")
    elif image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")

    return image


def trusted_alpha(image: Image.Image) -> Optional[Image.Image]:
    """Rasmning O'Z alfasi — agar u haqiqiy kesim bo'lsa. Aks holda None.

    ⚠️ FAQAT «ALFA KANAL BOR» YETMAYDI — ikki tuzoq bor:

    • Alfa kanal bor, lekin hamma piksel to'liq ko'rinadi (oq/kulrang fonli
      PNG). Shaffof qism 8% dan kam bo'lsa ishonmaymiz.

    • Burchaklar shaffof, lekin figura ortida FON QOLGAN: uch panelli
      varaqdan qirqilgan bo'lak shaffof hoshiya bilan to'ldirilganda shunday
      bo'ladi (2026-11-09 da aynan shu sabab mijoz ekranida qora
      to'rtburchak ko'ringan). Bunday rasmda ko'rinadigan qism o'z
      ramkasini deyarli TO'LIQ to'ldiradi; odam silueti esa ramkasining
      yarmidan kamini egallaydi. Shuning uchun to'ldirish ulushi 86% dan
      oshsa — bu to'rtburchak, kesim emas.
    """
    if image.mode != "RGBA":
        return None

    alpha = image.getchannel("A")
    small = np.asarray(alpha.resize((96, 144), Image.Resampling.BOX))

    clear = small < 16
    solid = small > 239
    if clear.mean() < TRUST_MIN_CLEAR or solid.mean() < TRUST_MIN_SOLID:
        return None

    rows = np.flatnonzero((~clear).any(axis=1))
    cols = np.flatnonzero((~clear).any(axis=0))
    if rows.size == 0 or cols.size == 0:
        return None

    box_area = (rows[-1] - rows[0] + 1) * (cols[-1] - cols[0] + 1)
    fill = float((~clear).sum()) / float(box_area)
    if fill > TRUST_MAX_FILL:
        return None

    return alpha


# ── Model (bola jarayonda) ──


@lru_cache(maxsize=1)
def get_session() -> Any:
    """Modelni bir marta yuklaydi. ⚠️ FAQAT BOLA JARAYONDA chaqiriladi."""
    from rembg import new_session

    log.info("rembg modelini yuklamoqda: %s", MODEL)
    # ⚠️ FAQAT CPU. rembg sukut bo'yicha mavjud HAMMA provayderni oladi;
    # serverda bu baribir CPU, lekin boshqa mashinada (masalan Mac'da
    # CoreML) model bir necha daqiqa kompilyatsiya qilinadi va ish vaqti
    # yetmay yiqiladi. Aniq aytilgani — hamma joyda bir xil xulq.
    session = new_session(MODEL, providers=["CPUExecutionProvider"])
    log.info("model tayyor: %s", MODEL)
    return session


def _predict_mask(raw: bytes, size: Tuple[int, int]) -> bytes:
    """Odam maskasini hisoblaydi — BOLA JARAYONDA ishlaydi.

    Kirish va chiqish xom baytlar: jarayonlar orasida PIL obyektini
    uzatishdan ko'ra arzon va rembg versiyasiga bog'liq emas.
    """
    from rembg import remove

    image = Image.frombytes("RGB", size, raw)
    out = remove(image, session=get_session(), only_mask=True)
    if isinstance(out, (bytes, bytearray)):
        out = Image.open(io.BytesIO(out))

    mask = out.getchannel("A") if out.mode == "RGBA" else out.convert("L")
    if mask.size != size:
        mask = mask.resize(size, Image.Resampling.BILINEAR)
    return mask.tobytes()


_model_lock = threading.Lock()
_model_started = False
_model_ready = threading.Event()

_FETCH_MODEL = """
import sys
from rembg.sessions import sessions_class
wanted = sys.argv[1]
next(item for item in sessions_class if item.name() == wanted).download_models()
"""


def ensure_model() -> None:
    """Model FAYLI joyidaligini tekshiradi; yo'q bo'lsa yuklab oladi.

    ⚠️ NEGA ALOHIDA QADAM. Fayl image yig'ilayotganda yuklanadi, lekin
    Dockerfile'dagi o'sha qadam `|| true` bilan — yiqilsa ham yig'ish
    davom etadi. Unda 224 MB fayl BIRINCHI SO'ROV ichida yuklanardi va
    so'rov vaqti (150 s) yetmay ishchi o'ldirilardi — keyingi so'rov yana
    boshidan yuklardi, va kesim hech qachon ishlamasdi (2026-11-12 da
    lokal sinovda aynan shunday bo'ldi).

    Qisqa yordamchi jarayonda bajariladi: rembg'ni API jarayoniga import
    qilish uni bir necha yuz MB ga og'irlashtirardi.
    """
    global _model_started
    with _model_lock:
        if _model_started:
            return
        _model_started = True

    try:
        subprocess.run(
            [sys.executable, "-c", _FETCH_MODEL, MODEL],
            check=True,
            capture_output=True,
            text=True,
            timeout=MODEL_FETCH_TIMEOUT_S,
        )
        log.info("cutout modeli joyida: %s", MODEL)
    except Exception as exc:  # noqa: BLE001
        detail = getattr(exc, "stderr", None) or str(exc)
        log.error("cutout modelini tayyorlab bo'lmadi: %s", str(detail)[-400:])
    finally:
        # Yiqilsa ham ochiladi: so'rovlar abadiy kutmasin, o'zi urinib ko'rsin
        _model_ready.set()
        # Fayl joyida — birinchi ishchi shu yerda ochiladi (`CUTOUT_PREWARM`)
        prewarm()


def _thread_count() -> int:
    """Shu jarayonga berilgan yadrolar soni (konteynerning `cpuset`i bilan).

    ⚠️ ANIQ BERILMASA onnxruntime mashinadagi HAMMA yadroga ip ochadi va
    ularni yadrolarga mixlashga urinadi: konteynerga yadrolarning bir qismi
    berilgan bo'lsa bu ortiqcha iplar va «pthread_setaffinity_np failed»
    xatolari degani (2026-11-15 da ko'rildi).
    """
    raw = os.environ.get("FACE_THREADS", "").strip()
    if raw.isdigit() and int(raw) > 0:
        return int(raw)
    try:
        return max(1, len(os.sched_getaffinity(0)))
    except AttributeError:  # Linux emas (lokal sinov) — rembg o'zi hal qiladi
        return 0


def _worker_main(conn: Any, tasks: int, threads: int) -> None:
    """BOLA JARAYON: modelni yuklaydi, `tasks` ta maska hisoblaydi va yopiladi.

    Model ish kelishidan OLDIN yuklanadi — ota jarayon ishchini oldindan
    ochib qo'ysa (`prewarm`), so'rov yuklashni kutmaydi.
    """
    if threads > 0:
        # rembg ip sonini shundan oladi — sessiya ochilishidan oldin turishi shart
        os.environ["OMP_NUM_THREADS"] = str(threads)

    try:
        get_session()
        conn.send(("ready", None))
    except Exception as exc:  # noqa: BLE001
        try:
            conn.send(("failed", repr(exc)))
        except Exception:  # noqa: BLE001
            pass
        return

    for _ in range(tasks):
        try:
            message = conn.recv()
        except (EOFError, OSError):
            return  # ota jarayon yopildi
        if message is None:
            return

        raw, size = message
        try:
            conn.send(("ok", _predict_mask(raw, size)))
        except Exception as exc:  # noqa: BLE001
            conn.send(("error", repr(exc)))


class _MaskTimeout(Exception):
    pass


def _rss_mb(pid: Optional[int]) -> int:
    """Jarayonning band xotirasi (MB); bilib bo'lmasa 0 (masalan Linux emas)."""
    try:
        with open(f"/proc/{pid}/statm", encoding="ascii") as handle:
            pages = int(handle.read().split()[1])
        return pages * os.sysconf("SC_PAGE_SIZE") // (1024 * 1024)
    except (OSError, ValueError, IndexError):
        return 0


class _MaskWorker:
    """Bitta bola jarayon va u bilan aloqa."""

    def __init__(self) -> None:
        # ⚠️ `spawn`, `fork` EMAS: fork uvicorn'ning iplarini yarim holatda
        # ko'chirib olardi.
        context = multiprocessing.get_context("spawn")
        self._conn, child = context.Pipe()
        self.process = context.Process(
            target=_worker_main,
            args=(child, TASKS_PER_WORKER, _thread_count()),
            name="cutout-worker",
            daemon=True,
        )
        self.process.start()
        child.close()

        self.left = TASKS_PER_WORKER
        self.done = 0
        self.ready = False
        self.last_used = time.monotonic()

    def is_ready(self) -> bool:
        """Model yuklanib bo'ldimi. Faqat BO'SH turgan ishchi uchun chaqiriladi."""
        try:
            return self.ready or self._conn.poll(0)
        except (OSError, ValueError):
            return False

    def _receive(self, deadline: float) -> Tuple[str, Any]:
        remaining = deadline - time.monotonic()
        if remaining <= 0 or not self._conn.poll(remaining):
            raise _MaskTimeout
        return self._conn.recv()  # jarayon o'lgan bo'lsa EOFError

    def ask(self, payload: Tuple[bytes, Tuple[int, int]], deadline: float) -> bytes:
        if not self.ready:
            kind, value = self._receive(deadline)
            if kind != "ready":
                raise RuntimeError(f"cutout modeli yuklanmadi: {value}")
            self.ready = True

        self._conn.send(payload)
        self.left -= 1
        kind, value = self._receive(deadline)
        self.done += 1
        self.last_used = time.monotonic()
        if kind != "ok":
            raise RuntimeError(f"cutout xatosi: {value}")
        return value

    def close(self) -> None:
        """Jarayonni yopadi. Qotgan ishchi o'zi o'lmaydi — o'ldiriladi, aks
        holda u modelni xotirada ushlab turaveradi."""
        try:
            self._conn.close()
        except OSError:
            pass
        try:
            if self.process.is_alive():
                self.process.kill()
            self.process.join(timeout=5)
        except Exception:  # noqa: BLE001
            pass


_worker_lock = threading.Lock()
_idle: Optional[_MaskWorker] = None
_idle_timer: Optional[threading.Timer] = None


def _take() -> _MaskWorker:
    """Kutib turgan ishchi; yo'q bo'lsa yangisi (unda model so'rov ichida yuklanadi)."""
    global _idle
    with _worker_lock:
        worker, _idle = _idle, None
    if worker is not None:
        if worker.process.is_alive():
            return worker
        worker.close()
    return _MaskWorker()


def prewarm() -> None:
    """Keyingi so'rov uchun ishchini HOZIR ochadi — model fonda yuklanadi."""
    global _idle
    if not PREWARM:
        return

    stale: Optional[_MaskWorker] = None
    with _worker_lock:
        if _idle is not None and _idle.process.is_alive():
            return
        stale, _idle = _idle, None
        try:
            _idle = _MaskWorker()
        except Exception:  # noqa: BLE001
            log.exception("cutout ishchisini oldindan ochib bo'lmadi")
    if stale is not None:
        stale.close()


def _release(worker: _MaskWorker) -> None:
    """Ishdan keyin: yana ishlata olinsa saqlanadi, bo'lmasa o'rniga yangisi ochiladi."""
    global _idle
    rss = _rss_mb(worker.process.pid)
    if rss > WORKER_MAX_RSS_MB:
        log.warning("cutout ishchisi xotirasi %d MB — yangisiga almashtiriladi", rss)
    elif worker.left > 0 and worker.process.is_alive():
        with _worker_lock:
            kept = _idle is None
            if kept:
                _idle = worker
        if kept:
            _schedule_idle_recycle()
            return

    worker.close()
    prewarm()


def _schedule_idle_recycle() -> None:
    global _idle_timer
    if IDLE_RECYCLE_S <= 0:
        return
    with _worker_lock:
        if _idle_timer is not None:
            _idle_timer.cancel()
        _idle_timer = threading.Timer(IDLE_RECYCLE_S, _recycle_if_idle)
        _idle_timer.daemon = True
        _idle_timer.start()


def _recycle_if_idle() -> None:
    """Ishlatilgan ishchi bo'sh turib qolsa — yopiladi, xotirasi (≈12 GB) qaytadi."""
    global _idle
    with _worker_lock:
        worker = _idle
        if worker is None or worker.done == 0:
            return
        if time.monotonic() - worker.last_used < IDLE_RECYCLE_S - 1:
            return  # orada yana ishlatilgan — navbatdagi taymer hal qiladi
        _idle = None

    log.info("cutout ishchisi %ss bo'sh turdi — yangisiga almashtirildi", IDLE_RECYCLE_S)
    worker.close()
    prewarm()


def shutdown() -> None:
    """Xizmat to'xtayotganda chaqiriladi."""
    global _idle, _idle_timer
    with _worker_lock:
        worker, _idle = _idle, None
        timer, _idle_timer = _idle_timer, None
    if timer is not None:
        timer.cancel()
    if worker is not None:
        worker.close()


def status() -> Dict[str, Any]:
    """`/health` uchun: kutib turgan ishchi bormi va modeli yuklanganmi."""
    with _worker_lock:
        worker = _idle
        if worker is None or not worker.process.is_alive():
            state = "none"
        else:
            state = "ready" if worker.is_ready() else "loading"
    return {"prewarm": PREWARM, "worker": state, "tasks_per_worker": TASKS_PER_WORKER}


def predict_mask(rgb: Image.Image) -> Image.Image:
    """Asl o'lchamdagi maska ('L'). Model esa kichik nusxani ko'radi."""
    ensure_model()
    if not _model_ready.wait(timeout=MASK_TIMEOUT_S):
        raise RuntimeError("cutout modeli hali yuklanmoqda")

    work = _downscale(rgb)
    payload = (work.tobytes(), work.size)

    raw: Optional[bytes] = None
    for attempt in (1, 2):
        worker = _take()
        try:
            raw = worker.ask(payload, time.monotonic() + MASK_TIMEOUT_S)
        except _MaskTimeout:
            worker.close()
            prewarm()
            raise RuntimeError(f"cutout {MASK_TIMEOUT_S}s ichida tugamadi") from None
        except (EOFError, OSError):
            # Bola jarayon o'lgan (masalan xotira yetmagan) — bir marta qayta
            worker.close()
            log.warning("cutout ishchisi o'ldi (urinish %d) — yangisi ochiladi", attempt)
            if attempt == 2:
                prewarm()
                raise RuntimeError("cutout ishchisi ikki marta o'ldi") from None
            continue
        except Exception:
            worker.close()
            prewarm()
            raise

        _release(worker)
        break

    mask = Image.frombytes("L", work.size, raw)
    mask = _soften(mask)

    if mask.size != rgb.size:
        # ⚠️ BICUBIC, LANCZOS EMAS: lanczos maskada «ringing» qoldiradi —
        # chekka yonida och/to'q hoshiya paydo bo'ladi.
        mask = mask.resize(rgb.size, Image.Resampling.BICUBIC)
    return mask


def model_alpha(image: Image.Image) -> Image.Image:
    """Model hisoblagan alfa. Rasmning o'z alfasi bo'lsa — ikkalasining kichigi.

    «Kichigi» shart: shaffof hoshiya bilan to'ldirilgan bo'lakda hoshiya
    model nima desa ham shaffof qolishi kerak.
    """
    rgb = image.convert("RGB")
    if BLACK_BG_THRESHOLD > 0:
        stripped = _strip_edge_black(rgb.convert("RGBA"), threshold=BLACK_BG_THRESHOLD)
        own = stripped.getchannel("A")
    else:
        own = None

    mask = predict_mask(rgb)

    if image.mode == "RGBA":
        mask = ImageChops.darker(mask, image.getchannel("A"))
    if own is not None:
        mask = ImageChops.darker(mask, own)
    return mask


def encode_png(image: Image.Image, alpha: Image.Image, darken_edges: bool = False) -> bytes:
    """Asl piksellar + berilgan alfa → PNG, ASL O'LCHAMDA.

    `darken_edges` — alfa MODELDAN kelganda yoqiladi: rang maskaga
    ko'paytiriladi, ya'ni chekkadagi yarim-shaffof piksellar qoraga tortiladi.

    ⚠️ BU ATAYLAB, VA ILGARIGI KO'RINISHNING O'ZI. Model maskasi figuradan bir
    necha piksel tashqariga chiqadi; o'sha joyda rang asl FON bilan aralashgan.
    Rang o'zgarmay qolsa, och fonli suratdan olingan figura qorong'i sahnada
    och halqa bilan ko'rinadi (2026-11-12 da lokal sinovda tekshirildi).
    rembg'ning o'z kesimi (`naive_cutout`) aynan shu ko'paytirishni qiladi va
    ilova sahnasi qorong'i — shuning uchun ko'rinish avvalgidek qoladi, faqat
    o'lcham to'liq bo'ladi.

    Chekkani «figura rangi bilan to'ldirish» ham sinab ko'rildi: halqa
    yo'qoldi, lekin soch va bo'yin atrofida surkalgan hoshiya paydo bo'ldi —
    undan voz kechildi.

    Rasmning O'Z alfasida (`trusted_alpha`) hech narsa ko'paytirilmaydi:
    u yerda chekka ranglari allaqachon to'g'ri.
    """
    rgb = image.convert("RGB")
    if darken_edges:
        opaque = rgb.copy()
        opaque.putalpha(255)
        out = Image.composite(opaque, Image.new("RGBA", rgb.size, 0), alpha)
    else:
        out = rgb
        out.putalpha(alpha)

    # Rang profili (bo'lsa) natijaga o'tadi. `Image.composite` yangi rasm
    # yasaydi va profilni tashlab yuboradi; usiz keng gamutli (Display P3)
    # rasm oddiy sRGB deb o'qilib, ranglari so'nikroq ko'rinardi.
    profile = image.info.get("icc_profile")
    extra = {"icc_profile": profile} if profile else {}

    buffer = io.BytesIO()
    out.save(buffer, format="PNG", compress_level=6, **extra)
    return buffer.getvalue()


def make_cutout(data: bytes) -> Tuple[bytes, str]:
    """Rasmni qabul qilib, shaffof fonli PNG qaytaradi — ASL O'LCHAMDA.

    Ikkinchi qiymat alfa qayerdan olinganini aytadi: `alpha` (rasmning
    o'zidan) yoki `model`.
    """
    image = decode(data)

    alpha = trusted_alpha(image)
    if alpha is not None:
        return encode_png(image, alpha), "alpha"

    return encode_png(image, model_alpha(image), darken_edges=True), "model"


# ── Yordamchilar ──


def _strip_edge_black(image: Image.Image, threshold: int = 70) -> Image.Image:
    """Chetdan boshlab qora fonni shaffof qiladi.

    Operator panellarida figura atrofida QORA (rgba(0,0,0,255)) bo'ladi.
    Flood-fill 4 burchakdan — chetga bog'langan qora = fon (shaffof).
    Ichkaridagi qora (kiyim, soch) saqlanadi.
    """
    if threshold <= 0:
        return image
    if image.mode != "RGBA":
        image = image.convert("RGBA")

    arr = np.array(image)
    rgb = arr[..., :3]
    is_black = np.all(rgb < threshold, axis=2)

    seed = np.zeros_like(is_black, dtype=bool)
    seed[0, :] = is_black[0, :]
    seed[-1, :] = is_black[-1, :]
    seed[:, 0] = is_black[:, 0]
    seed[:, -1] = is_black[:, -1]

    prev_count = -1
    for _ in range(200):
        count = int(seed.sum())
        if count == prev_count:
            break
        prev_count = count
        expanded = (
            seed
            | np.roll(seed, 1, axis=0)
            | np.roll(seed, -1, axis=0)
            | np.roll(seed, 1, axis=1)
            | np.roll(seed, -1, axis=1)
        )
        seed = expanded & is_black

    arr[..., 3] = np.where(seed, 0, arr[..., 3])

    if EDGE_ERODE > 0:
        halo = seed.copy()
        for _ in range(EDGE_ERODE):
            halo = (
                halo
                | np.roll(halo, 1, axis=0)
                | np.roll(halo, -1, axis=0)
                | np.roll(halo, 1, axis=1)
                | np.roll(halo, -1, axis=1)
            )
        new_halo = halo & ~seed
        arr[..., 3] = np.where(new_halo, arr[..., 3] // 3, arr[..., 3])

    return Image.fromarray(arr, mode="RGBA")


def _soften(mask: Image.Image) -> Image.Image:
    """Chekka silliqlash — chiziqli ramp + Gauss blur."""
    lut = [
        0 if a < ALPHA_LO else 255 if a > ALPHA_HI else int((a - ALPHA_LO) * 255 / (ALPHA_HI - ALPHA_LO))
        for a in range(256)
    ]
    mask = mask.point(lut)
    if EDGE_BLUR > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(radius=EDGE_BLUR))
    return mask


def _downscale(image: Image.Image) -> Image.Image:
    """MAX_SIDE dan katta bo'lsa nisbatni saqlab kichraytirish (faqat model uchun)."""
    w, h = image.size
    side = max(w, h)
    if side <= MAX_SIDE:
        return image
    scale = MAX_SIDE / side
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    return image.resize((nw, nh), Image.Resampling.LANCZOS)
