import animate from 'tailwindcss-animate';
import plugin from 'tailwindcss/plugin';

/*
 * LookSave dizayn tizimi — YAGONA manba.
 *
 * Ranglar `docs/06-dizayn.md` §2 dan (deckdan olingan) va shadcn/ui ning
 * semantik tokenlariga o'girilgan. Uchala web ilova (web, store-panel,
 * admin-panel) shu presetni ulaydi — endi rang bir joyda o'zgaradi.
 *
 * Nega HSL uchligi (`258 90% 66%`) saqlanadi, `#8B5CF6` emas:
 * shadcn `hsl(var(--primary) / 0.15)` shaklida shaffoflik beradi, bu esa
 * faqat alohida kanallar bo'lganda ishlaydi.
 *
 * Tokenlar ikki qavat:
 *   1) shadcn semantikasi — background/foreground/card/primary/... Komponentlar
 *      shulardan foydalanadi, boshqa hech narsadan.
 *   2) LookSave brendi — brand, surface2, dim, limited... Deckdagi hissiyot
 *      (nurlanuvchi binafsha) shu qavatdan keladi.
 */

/** Hex qiymatlar izoh uchun — Tailwind faqat HSL kanallarini ko'radi. */
const TOKENS = {
  '--background': '240 20% 5%' /* #0A0A0F */,
  '--foreground': '0 0% 100%',

  '--panel': '253 26% 7%' /* #0F0D16 — panel foni, saytnikidan bir zina ochiq */,
  '--surface': '252 22% 9%' /* #14121C */,
  '--surface-2': '252 23% 13%' /* #1C1928 */,

  '--card': '252 22% 9%' /* #14121C */,
  '--card-foreground': '0 0% 100%',
  '--popover': '252 23% 13%' /* #1C1928 */,
  '--popover-foreground': '0 0% 100%',

  '--primary': '258 90% 66%' /* #8B5CF6 */,
  '--primary-foreground': '0 0% 100%',
  '--primary-dim': '258 67% 55%' /* #6D3FD9 — bosilgan/hover holati */,

  '--secondary': '252 23% 13%' /* #1C1928 */,
  '--secondary-foreground': '0 0% 100%',

  '--muted': '252 22% 9%' /* #14121C */,
  '--muted-foreground': '252 13% 64%' /* #9B96AE */,

  '--accent': '255 27% 23%' /* #332B4A — ustiga borilgan yuza */,
  '--accent-foreground': '0 0% 100%',

  '--brand': '270 95% 75%' /* #C084FC — yorqin binafsha, urg'u matni */,
  '--dim': '253 13% 42%' /* #635D78 — ikkilamchi izoh */,

  '--destructive': '0 84% 60%' /* #EF4444 */,
  '--destructive-foreground': '0 0% 100%',
  '--success': '142 71% 45%' /* #22C55E */,
  '--warning': '38 92% 50%' /* #F59E0B */,
  '--limited': '46 92% 53%' /* #F5C518 — cheklangan seriya */,

  '--border': '255 24% 16%' /* #241F33 */,
  '--border-strong': '255 27% 23%' /* #332B4A */,
  '--input': '255 24% 16%',
  '--ring': '258 90% 66%',

  '--radius': '0.875rem',

  /* Diagrammalar — binafshadan sovuq tomonga qarab tarqaladi */
  '--chart-1': '258 90% 66%',
  '--chart-2': '270 95% 75%',
  '--chart-3': '199 89% 60%',
  '--chart-4': '46 92% 53%',
  '--chart-5': '142 71% 45%',

  /* Panellardagi yon menyu (shadcn `sidebar`) */
  '--sidebar-background': '252 22% 9%',
  '--sidebar-foreground': '252 13% 64%',
  '--sidebar-primary': '258 90% 66%',
  '--sidebar-primary-foreground': '0 0% 100%',
  '--sidebar-accent': '252 23% 13%',
  '--sidebar-accent-foreground': '0 0% 100%',
  '--sidebar-border': '255 24% 16%',
  '--sidebar-ring': '258 90% 66%',
};

/** `hsl(var(--x) / <alpha>)` — Tailwind shaffoflik qo'sha olishi uchun. */
const v = (name) => `hsl(var(${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        /* — shadcn semantikasi — */
        background: v('--background'),
        foreground: v('--foreground'),
        card: { DEFAULT: v('--card'), foreground: v('--card-foreground') },
        popover: { DEFAULT: v('--popover'), foreground: v('--popover-foreground') },
        primary: {
          DEFAULT: v('--primary'),
          foreground: v('--primary-foreground'),
          dim: v('--primary-dim'),
        },
        secondary: { DEFAULT: v('--secondary'), foreground: v('--secondary-foreground') },
        muted: { DEFAULT: v('--muted'), foreground: v('--muted-foreground') },
        accent: { DEFAULT: v('--accent'), foreground: v('--accent-foreground') },
        destructive: { DEFAULT: v('--destructive'), foreground: v('--destructive-foreground') },
        /* `danger` — loyihaning eski nomi, mobil ilova ham shundan foydalanadi */
        danger: v('--destructive'),
        border: v('--border'),
        input: v('--input'),
        ring: v('--ring'),

        /* — LookSave brendi — */
        brand: v('--brand'),
        panel: v('--panel'),
        surface: v('--surface'),
        surface2: v('--surface-2'),
        borderStrong: v('--border-strong'),
        dim: v('--dim'),
        success: v('--success'),
        warning: v('--warning'),
        limited: v('--limited'),

        chart: {
          1: v('--chart-1'),
          2: v('--chart-2'),
          3: v('--chart-3'),
          4: v('--chart-4'),
          5: v('--chart-5'),
        },
        sidebar: {
          DEFAULT: v('--sidebar-background'),
          foreground: v('--sidebar-foreground'),
          primary: v('--sidebar-primary'),
          'primary-foreground': v('--sidebar-primary-foreground'),
          accent: v('--sidebar-accent'),
          'accent-foreground': v('--sidebar-accent-foreground'),
          border: v('--sidebar-border'),
          ring: v('--sidebar-ring'),
        },
      },

      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        card: '16px',
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },

      letterSpacing: { label: '0.1em', wordmark: '0.32em' },

      boxShadow: {
        glow: '0 0 60px -12px hsl(var(--primary) / 0.55)',
        card: '0 24px 60px -32px rgb(0 0 0 / 0.9)',
      },

      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.35', transform: 'scale(0.97)' },
          '50%': { opacity: '0.75', transform: 'scale(1.03)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        rise: 'rise 700ms cubic-bezier(0.16, 1, 0.3, 1) both',
        breathe: 'breathe 5.2s ease-in-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },

  plugins: [
    animate,
    /*
     * Tokenlarni CSS ga o'zimiz quyamiz — shunda `index.css` da uchta ilovada
     * takrorlanadigan 60 qatorlik `:root { --... }` bloki qolmaydi.
     */
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...TOKENS, 'color-scheme': 'dark' },
        '*': { borderColor: 'hsl(var(--border))' },
        body: {
          backgroundColor: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          '-webkit-font-smoothing': 'antialiased',
        },
      });
    }),
  ],
};
