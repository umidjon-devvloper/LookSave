"""Yuz almashtirish — FaceFusion'ni yurgizish.

Ikki yo'l bor, natijasi bir xil:

• ISSIQ ISHCHI (`ff_worker.py`, `FACEFUSION_WARM=1`). Modellar xotirada
  turadi; so'rov faqat hisob-kitob vaqtini to'laydi. VPS'da o'lchangan
  (2026-11-15): bitta almashtirish ~45 s o'rniga ~17 s.

• CLI (`facefusion.py headless-run`). Har so'rovda yangi jarayon. Bu ZAXIRA:
  ishchi yo'q, tayyor emas, o'lib qoldi yoki kutilmagan javob berdi — so'rov
  shu yo'l bilan bajariladi. Ya'ni ishchidagi har qanday nosozlik faqat
  sekinlashtiradi, natijani o'zgartirmaydi.

`FACEFUSION_WARM` qo'yilmagan bo'lsa (masalan fly.io'dagi kichik mashina)
faqat CLI ishlaydi — xulq 2026-11-12 dagidek.
"""
from __future__ import annotations

import json
import logging
import os
import queue
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

log = logging.getLogger("swap")

FACEFUSION_DIR = Path(os.environ.get("FACEFUSION_DIR", "/app/facefusion"))
FACEFUSION_PY = os.environ.get("FACEFUSION_PY", str(FACEFUSION_DIR / ".venv" / "bin" / "python"))
TIMEOUT_S = int(os.environ.get("FACEFUSION_TIMEOUT_S", "300"))

WARM = os.environ.get("FACEFUSION_WARM", "").strip().lower() in ("1", "true", "yes", "on")
WORKER_SCRIPT = Path(__file__).with_name("ff_worker.py")

# Ishchi shuncha ishdan keyin yangisiga almashtiriladi — ehtiyot chorasi:
# o'lchovda (15 ta ketma-ket ish) xotirasi ikkinchi ishdan keyin ~5 GB da
# to'xtadi va o'smadi. Almashganda keyingi so'rov yangisi isiguncha (~28 s)
# kutishi mumkin, shuning uchun son katta.
WORKER_TASKS = max(1, int(os.environ.get("FACEFUSION_WORKER_TASKS", "200")))
# ...yoki xotirasi shundan oshsa.
WORKER_MAX_RSS_MB = int(os.environ.get("FACEFUSION_WORKER_MAX_RSS_MB", "7000"))
# So'rov tayyor bo'lmagan ishchini shuncha kutadi; undan keyin — CLI.
# Isinish ~30 s; CLI'ning o'zi ~45 s, shuning uchun kutgan ma'qul.
WORKER_READY_TIMEOUT_S = int(os.environ.get("FACEFUSION_WORKER_READY_TIMEOUT_S", "90"))

# Ishchi ketma-ket shuncha marta ishga tushmasa, bir muddat urinilmaydi —
# aks holda har so'rov befoyda kutib, keyin baribir CLI'ga o'tardi.
_MAX_START_FAILURES = 3
_START_RETRY_AFTER_S = 600


class SwapFailed(Exception):
    """Almashtirish bajarilmadi. `status` — chaqiruvchiga qaytadigan HTTP kodi."""

    def __init__(self, status: int, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.detail = detail


# ── Issiq ishchi ─────────────────────────────────────────────────────────


class _Worker:
    def __init__(self) -> None:
        self.state = "starting"  # starting | ready | dead
        self.jobs = 0
        self.rss_mb = 0
        self.info: Dict[str, Any] = {}
        self._ready = threading.Event()
        self._replies: "queue.Queue[Optional[Dict[str, Any]]]" = queue.Queue()

        env = dict(os.environ)
        env["FACEFUSION_DIR"] = str(FACEFUSION_DIR)
        # stderr meros qoladi — facefusion logi to'g'ridan-to'g'ri konteyner logiga
        self.process = subprocess.Popen(
            [FACEFUSION_PY, str(WORKER_SCRIPT)],
            cwd=str(FACEFUSION_DIR),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            bufsize=1,
            env=env,
        )
        threading.Thread(target=self._read, name="ff-worker-reader", daemon=True).start()

    def _read(self) -> None:
        try:
            for line in self.process.stdout:  # type: ignore[union-attr]
                try:
                    message = json.loads(line)
                except ValueError:
                    log.warning("ishchidan tushunarsiz qator: %s", line[:200])
                    continue

                event = message.get("event")
                if event == "ready":
                    self.info = message
                    self.state = "ready"
                    self._ready.set()
                    log.info(
                        "issiq ishchi tayyor: %ss, iplar=%s, parallel bo'laklar=%s, xotira=%s MB",
                        message.get("seconds"), message.get("threads"), message.get("tiles"), message.get("rss_mb"),
                    )
                elif event == "failed":
                    log.error("issiq ishchi ishga tushmadi: %s", message.get("error"))
                    break
                else:
                    self._replies.put(message)
        except Exception:  # noqa: BLE001
            log.exception("ishchi javobini o'qib bo'lmadi")
        finally:
            self.state = "dead"
            self._ready.set()  # kutayotganlar uyg'onsin
            self._replies.put(None)

    def wait_ready(self, timeout: float) -> bool:
        self._ready.wait(timeout)
        return self.state == "ready"

    def run(self, job: Dict[str, Any], timeout: float) -> Optional[Dict[str, Any]]:
        """Javob; ishchi o'lgan bo'lsa None. Vaqt tugasa `TimeoutError`."""
        try:
            self.process.stdin.write(json.dumps(job) + "\n")  # type: ignore[union-attr]
            self.process.stdin.flush()  # type: ignore[union-attr]
        except (OSError, ValueError):
            return None

        deadline = time.monotonic() + timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError
            try:
                reply = self._replies.get(timeout=remaining)
            except queue.Empty:
                raise TimeoutError from None
            if reply is None:
                return None
            if reply.get("id") == job["id"]:
                return reply
            # boshqa (eski) ishning kechikkan javobi — tashlab yuboriladi

    def kill(self) -> None:
        self.state = "dead"
        try:
            self.process.kill()
        except OSError:
            pass
        for stream in (self.process.stdin, self.process.stdout):
            try:
                if stream is not None:
                    stream.close()
            except OSError:
                pass
        try:
            self.process.wait(timeout=5)
        except Exception:  # noqa: BLE001
            pass


_lock = threading.Lock()  # `_worker` ko'rsatkichi uchun
_use = threading.Lock()  # ishchi bir vaqtda bitta ish bajaradi
_worker: Optional[_Worker] = None
_start_failures = 0
_retry_at = 0.0


def _ensure_worker() -> Optional[_Worker]:
    """Tirik ishchi (kerak bo'lsa yangisini ochib). Ochib bo'lmasa — None."""
    global _worker, _start_failures, _retry_at
    if not WARM:
        return None

    with _lock:
        if _worker is not None and _worker.state == "dead":
            if not _worker.info:  # tayyor bo'lmasdan o'lgan
                _start_failures += 1
                if _start_failures >= _MAX_START_FAILURES:
                    _retry_at = time.monotonic() + _START_RETRY_AFTER_S
                    log.error(
                        "issiq ishchi %d marta ishga tushmadi — %d daqiqa faqat CLI ishlaydi",
                        _start_failures, _START_RETRY_AFTER_S // 60,
                    )
            _worker.kill()
            _worker = None

        if _worker is None:
            if time.monotonic() < _retry_at:
                return None
            if not WORKER_SCRIPT.exists():
                log.error("ishchi skripti topilmadi: %s", WORKER_SCRIPT)
                return None
            try:
                _worker = _Worker()
            except OSError:
                log.exception("issiq ishchini ochib bo'lmadi")
                return None
        return _worker


def _discard(worker: _Worker, wait: bool = False) -> None:
    """Ishchini tashlaydi. Bir necha GB xotirali jarayonni yopish ~1 s oladi —
    so'rov buni kutmasin, shuning uchun sukut bo'yicha fonda."""
    global _worker
    with _lock:
        if _worker is worker:
            _worker = None
    if wait:
        worker.kill()
    else:
        threading.Thread(target=worker.kill, name="ff-worker-kill", daemon=True).start()


def start() -> None:
    """Xizmat ishga tushganda: ishchi FONDA isiy boshlaydi."""
    if _ensure_worker() is not None:
        log.info("issiq ishchi ishga tushirildi (isinmoqda)")


def shutdown() -> None:
    worker = _worker
    if worker is not None:
        _discard(worker, wait=True)


def status() -> Dict[str, Any]:
    worker = _worker
    if not WARM:
        return {"enabled": False}
    if worker is None:
        return {"enabled": True, "state": "none"}
    return {
        "enabled": True,
        "state": worker.state,
        "jobs": worker.jobs,
        "rss_mb": worker.rss_mb or worker.info.get("rss_mb"),
        "threads": worker.info.get("threads"),
        "tiles": worker.info.get("tiles"),
        "warmup_s": worker.info.get("seconds"),
    }


def _run_warm(job: Dict[str, Any], out_path: Path, req_id: str) -> Optional[bytes]:
    """Natija baytlari; None — «CLI bilan bajar» degani."""
    global _start_failures

    with _use:
        worker = _ensure_worker()
        if worker is None:
            return None
        if not worker.wait_ready(WORKER_READY_TIMEOUT_S):
            log.warning("[%s] issiq ishchi tayyor emas (%s) — CLI", req_id, worker.state)
            if worker.state == "dead":
                _ensure_worker()  # o'lganini hisobga oladi va yangisini ochadi
            return None
        _start_failures = 0

        try:
            reply = worker.run(job, TIMEOUT_S)
        except TimeoutError:
            log.error("[%s] issiq ishchi %ss ichida tugatmadi", req_id, TIMEOUT_S)
            _discard(worker)
            _ensure_worker()
            raise SwapFailed(504, "facefusion_timeout") from None

        if reply is None:
            log.error("[%s] issiq ishchi ish paytida o'ldi — CLI bilan qayta", req_id)
            _discard(worker)
            _ensure_worker()
            return None

        worker.jobs += 1
        rss = int(reply.get("rss_mb") or 0)
        worker.rss_mb = rss
        if reply.get("fatal") or worker.jobs >= WORKER_TASKS or rss > WORKER_MAX_RSS_MB:
            log.info("[%s] issiq ishchi almashtiriladi: ishlar=%d xotira=%d MB", req_id, worker.jobs, rss)
            _discard(worker)
            _ensure_worker()  # yangisi fonda isiydi

    lines = [str(item) for item in (reply.get("log") or [])]
    if reply.get("code") == 0 and out_path.exists() and out_path.stat().st_size > 0:
        log.info("[%s] issiq ishchi: %ss, xotira=%s MB", req_id, reply.get("seconds"), reply.get("rss_mb"))
        return out_path.read_bytes()

    # ⚠️ BU XATO QAYTA URINISH BILAN TUZALMAYDI — mijozning yuz suratida yuz
    # topilmadi. CLI'ni ham yurgizish befoyda: u ham shuni aytadi.
    if "no source face detected" in "\n".join(lines).lower():
        raise SwapFailed(422, "no_source_face")

    log.warning("[%s] issiq ishchi code=%s — CLI bilan qayta. %s", req_id, reply.get("code"), " | ".join(lines[-4:]))
    try:
        out_path.unlink()
    except OSError:
        pass
    return None


# ── CLI (zaxira yo'l) ────────────────────────────────────────────────────


def _run_cli(
    src_path: Path, tgt_path: Path, out_path: Path, tmp_path: Path,
    model: str, pixel_boost: str, enhance: bool, req_id: str,
) -> bytes:
    processors = ["face_swapper"]
    if enhance:
        processors.append("face_enhancer")

    # ⚠️ ARGUMENTLAR `ff_worker.py` DAGI BILAN BIR XIL BO'LISHI SHART.
    cmd = [
        FACEFUSION_PY,
        "facefusion.py",
        "headless-run",
        "--source-paths", str(src_path),
        "--target-path", str(tgt_path),
        "--output-path", str(out_path),
        "--processors", *processors,
        "--face-swapper-model", model,
        "--face-swapper-pixel-boost", pixel_boost,
        "--execution-providers", "cpu",
        # Yuz sohasi shu fayldan olinadi (`compose.merge_swap`) — siqish
        # qancha kam bo'lsa, yuz shuncha aniq.
        "--output-image-quality", "95",
        "--log-level", "info",
        # ⚠️ HAR SO'ROVGA O'Z PAPKASI. Sukut bo'yicha vaqtinchalik papka
        # maqsad fayl NOMIDAN yasaladi (`/tmp/facefusion/target`), ish nomi
        # esa soniyagacha aniqlikdagi vaqtdan — ikki jarayon bir vaqtda
        # ishlasa bir-birining faylini bosib yozardi, ya'ni bir mijozga
        # boshqasining rasmi ketishi mumkin edi.
        "--temp-path", str(tmp_path / "tmp"),
        "--jobs-path", str(tmp_path / "jobs"),
    ]
    log.info("[%s] facefusion CLI: %s", req_id, " ".join(cmd))

    try:
        res = subprocess.run(cmd, cwd=str(FACEFUSION_DIR), capture_output=True, text=True, timeout=TIMEOUT_S)
    except subprocess.TimeoutExpired:
        log.error("[%s] facefusion timeout after %ss", req_id, TIMEOUT_S)
        raise SwapFailed(504, "facefusion_timeout") from None

    if res.returncode != 0:
        output = (res.stderr or "") + "\n" + (res.stdout or "")
        tail = output[-800:]
        log.error("[%s] rc=%s tail=%s", req_id, res.returncode, tail)

        # ⚠️ BU XATO QAYTA URINISH BILAN TUZALMAYDI — mijozning yuz
        # suratida yuz topilmadi. Alohida kod bilan qaytadi, chaqiruvchi
        # uni vaqtinchalik nosozlikdan ajratsin.
        if "no source face detected" in output.lower():
            raise SwapFailed(422, "no_source_face")

        raise SwapFailed(500, f"facefusion_failed rc={res.returncode}: {tail}")

    if not out_path.exists() or out_path.stat().st_size == 0:
        raise SwapFailed(500, "facefusion_no_output")

    return out_path.read_bytes()


# ── Kirish nuqtasi ───────────────────────────────────────────────────────


def run(src_bytes: bytes, tgt_bytes: bytes, model: str, pixel_boost: str, enhance: bool, req_id: str) -> bytes:
    """Almashtirilgan rasm (JPEG baytlari). Bajarilmasa — `SwapFailed`."""
    with tempfile.TemporaryDirectory(prefix=f"ff-{req_id}-") as tmp:
        tmp_path = Path(tmp)
        src_path = tmp_path / "source.jpg"
        tgt_path = tmp_path / "target.jpg"
        out_path = tmp_path / "output.jpg"

        src_path.write_bytes(src_bytes)
        tgt_path.write_bytes(tgt_bytes)

        if WARM:
            job = {
                "id": req_id,
                "source": str(src_path),
                "target": str(tgt_path),
                "output": str(out_path),
                "temp": str(tmp_path / "tmp"),
                "model": model,
                "pixel_boost": pixel_boost,
                "enhance": bool(enhance),
            }
            data = _run_warm(job, out_path, req_id)
            if data is not None:
                return data

        return _run_cli(src_path, tgt_path, out_path, tmp_path, model, pixel_boost, enhance, req_id)
