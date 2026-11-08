# cutout-py — fon olib tashlash xizmati

Node API `apps/api/src/store/cutout.ts` dan POST /cutout ga rasm jo'natadi,
shaffof PNG qaytadi. Model: **isnet-general-use** (rembg).

## VPS'da o'rnatish

```bash
cd /var/www/LookSave/services/cutout-py
sudo apt install -y python3-venv python3-pip
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

# Modelni oldindan yuklab olish (~170MB — birinchi so'rov tez bo'ladi)
.venv/bin/python -c "from rembg import new_session; new_session('isnet-general-use')"
```

## Ishga tushirish (pm2)

`ecosystem.config.cjs` (loyiha ildizida) ichiga qo'shing:

```js
{
  name: 'looksave-cutout',
  script: 'services/cutout-py/.venv/bin/gunicorn',
  args: '-w 1 -b 127.0.0.1:7801 --timeout 90 server:app',
  cwd: 'services/cutout-py',
  env: {
    CUTOUT_MODEL: 'isnet-general-use',
    CUTOUT_MAX_SIDE: '1600'
  }
}
```

Keyin:

```bash
pm2 start ecosystem.config.cjs --only looksave-cutout
pm2 save
```

## Node API bilan bog'lash

`/var/www/LookSave/.env` ga qo'shing:

```
CUTOUT_URL=http://127.0.0.1:7801
```

Bo'lmasa — Node eski `@imgly` fallback'ga qaytadi.

## Sinash

```bash
curl -s http://127.0.0.1:7801/health
curl --data-binary @test.jpg -H "Content-Type: image/jpeg" http://127.0.0.1:7801/cutout -o out.png
```

## Resurs

- RAM: ~400MB ishlashda, ~700MB inference cho'qqisida
- Latency: ~2-4s bitta rasm (CPU, 1600px)
- Model fayli: `~/.u2net/isnet-general-use.onnx` (~170MB)
