import { type RouteConfig, index, route } from '@react-router/dev/routes';

/**
 * Marshrutlar — docs/13-sayt.md §5.
 *
 * Har bir yo'lda til bo'lagi bor (`/:locale/...`). Ildiz (`/`) hech narsa
 * chizmaydi: `Accept-Language` ga qarab mos tilga yo'naltiradi.
 *
 * ⚠️ `layout('layouts/shell.tsx')` — shapka va futer. U ichida `Outlet`
 * bor va marshrut xatolarini ham ushlaydi, ya'ni 404 sahifasida ham
 * navigatsiya joyida qoladi (13-sayt.md §4.14).
 */
export default [
  index('routes/entry.tsx'),

  route(':locale', 'layouts/shell.tsx', [
    index('routes/home.tsx'),

    // ── Katalog ──
    route('catalog', 'routes/catalog.tsx'),
    route('c/:slug', 'routes/category.tsx'),
    route('p/:id', 'routes/product.tsx'),
    route('search', 'routes/search.tsx'),

    // ── Do'konlar ──
    route('stores', 'routes/stores.tsx'),
    route('store/:id', 'routes/store.tsx'),

    // ── Xarid ──
    route('cart', 'routes/cart.tsx'),
    route('checkout', 'routes/checkout.tsx'),
    route('orders', 'routes/orders.tsx'),
    route('order/:id', 'routes/order.tsx'),

    // ── Hisob ──
    route('sign-in', 'routes/sign-in.tsx'),
    route('sign-up', 'routes/sign-up.tsx'),
    route('sign-out', 'routes/sign-out.tsx'),
    route('profile', 'layouts/profile.tsx', [
      index('routes/profile/index.tsx'),
      route('measurements', 'routes/profile/measurements.tsx'),
    ]),

    // ── Kiyintirish ──
    route('try-on', 'routes/try-on.tsx'),

    // ── Huquqiy (10-roadmap §4: 18-haftaga majburiy) ──
    route('privacy', 'routes/privacy.tsx'),
    route('terms', 'routes/terms.tsx'),

    // Til ichidagi topilmagan yo'llar
    route('*', 'routes/not-found.tsx'),
  ]),
] satisfies RouteConfig;
