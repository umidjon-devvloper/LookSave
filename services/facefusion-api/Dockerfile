# Facefusion + Cutout API uchun Dockerfile.
#
# ⚠️ ESLATMA: Facefusion o'z venv'ini ichida o'rnatadi (install.py).
# Bu Dockerfile tizim python'da fastapi + rembg o'rnatadi,
# facefusion esa alohida .venv'da.

FROM python:3.12-slim

# System dependencies (facefusion uchun)
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        git \
        libgl1 \
        libglib2.0-0 \
        wget \
        curl \
        ca-certificates \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Facefusion repo clone + venv setup
RUN git clone https://github.com/facefusion/facefusion.git /app/facefusion && \
    cd /app/facefusion && \
    python -m venv .venv && \
    .venv/bin/pip install --upgrade pip && \
    .venv/bin/python install.py default --skip-conda

# 2) API wrapper paketlari (tizim python'da)
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# 3) Cutout modelini oldindan yuklab olish (image build paytida)
# ⚠️ ONLINE kerak — rembg modelni GitHub'dan yuklaydi (~224MB).
#    Ishga tushganda qayta yuklamaslik uchun shu yerda cache qilamiz.
RUN mkdir -p /root/.u2net && \
    python -c "from rembg import new_session; new_session('birefnet-general-lite')" || true

# 4) API code
COPY main.py cutout.py /app/

# 5) Mount point for facefusion assets (model weights)
VOLUME /app/facefusion/.assets

ENV PYTHONUNBUFFERED=1 \
    PORT=8080

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--log-level", "info"]
