# Decart Anywear widget — patch'lar

Bu papkada 2 ta commit bor, ularni `looksavelooksave/LookSave` (Vercel) ga yetkazish uchun.

## Variant 1 — eng oson: `git am`

Loyihani `looksavelooksave/LookSave` dan toza klon qiling (yoki o'zingizning fork'ingiz orqali yozuv huquqi bor Mac/joydan):

```bash
git clone git@github.com:looksavelooksave/LookSave.git
cd LookSave

# Ikkala patchni ketma-ket qo'llash:
git am /path/to/.patches/0001-feat-web-Decart-Anywear-widget-script-ini-ulash.patch
git am /path/to/.patches/0002-fix-web-Vercel-build-xatosini-tuzatish-set-cookie-pa.patch

git push origin main
```

## Variant 2 — GitHub web PR (klon kerak emas)

1. Shu havolani oching: https://github.com/looksavelooksave/LookSave/compare/main...umidjon-devvloper:LookSave:main
2. "Create pull request" → sarlavha: `Decart Anywear widget + Vercel build fix`
3. PR ochilgach, "Merge pull request" → "Confirm merge"
4. Vercel avtomat deploy qiladi

## Patch nima o'zi qiladi?

**0001** (1.2 KB) — `apps/web/src/root.tsx` ga 4 qator qo'shadi:
```html
<script
  src="https://anywear.decart.ai/widget/latest/anywear.js?domain=looksave.uz"
  async
/>
```

**0002** (97 KB) — Vercel build xatosini tuzatadi:
- `.npmrc` — `legacy-peer-deps=true`
- `apps/web/package.json` — `set-cookie-parser` ni ochiq qo'shadi
- `package-lock.json` — toza qayta yaratilgan

## Tekshirish

Deploy'dan keyin https://looksave.uz oching → DevTools Network tab → `anywear.js` yuklanishi kerak.

**Shart:** [platform.decart.ai](https://platform.decart.ai) → Anywear → **Add domain: looksave.uz**. Aks holda widget hech narsa ko'rsatmaydi.
