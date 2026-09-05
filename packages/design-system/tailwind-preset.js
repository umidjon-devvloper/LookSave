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
  '--surface-3': '254 26% 17%' /* #252036 — hover / bosilgan holat */,

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

  /*
   * Buyurtma holati. Qiymatlar semantik ranglarni takrorlaydi, lekin nomi
   * boshqa — va bu ataylab: `success` «yaxshi natija», `status-confirmed`
   * esa «do'kon tasdiqladi». Ikkisi bir kunda ajralishi mumkin
   * (`06-dizayn.md` §2, mobil `theme/orderStatus.ts`).
   */
  '--status-waiting': '38 92% 50%' /* #F59E0B — harakat kutilmoqda */,
  '--status-confirmed': '142 71% 45%' /* #22C55E */,
  '--status-rejected': '0 84% 60%' /* #EF4444 */,
  '--status-done': '253 13% 42%' /* #635D78 — e'tibor talab qilmaydi */,

  '--border': '255 24% 16%' /* #241F33 */,
  '--border-strong': '255 27% 23%' /* #332B4A */,
  /*
   * ⚠️ `--ring` (#8B5CF6) EMAS. Mobil `tokens.ts` da faol maydonning
   * chegarasi #7C3AED — bir zina to'qroq binafsha. Fokus halqasi bilan
   * bir xil qilib qo'yilsa, ikki xil holat (fokus va tanlangan) bir xil
   * ko'rinadi va maydon «yonib turgandek» tuyuladi.
   */
  '--border-accent': '262 83% 58%' /* #7C3AED — faol / tanlangan */,
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
        surface3: v('--surface-3'),
        /*
         * `primarySoft` — mobil `tokens.ts` dagi rgba(139,92,246,0.14).
         * `bg-primary/15` YARAMAYDI: 0.15 ≠ 0.14 va ikki platformada
         * yumshoq fon boshqacha chiqadi. Shaffoflik shu yerda qotirilgani
         * uchun `<alpha-value>` ishlatilmaydi.
         */
        primarySoft: 'hsl(var(--primary) / 0.14)',
        borderStrong: v('--border-strong'),
        borderAccent: v('--border-accent'),
        dim: v('--dim'),
        success: v('--success'),
        warning: v('--warning'),
        limited: v('--limited'),
        status: {
          waiting: v('--status-waiting'),
          confirmed: v('--status-confirmed'),
          rejected: v('--status-rejected'),
          done: v('--status-done'),
        },

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

      /*
       * Tipografika shkalasi — `06-dizayn.md` §3 va mobil `theme/tokens.ts`
       * dan. Nomlar ikki platformada bir xil: `text-h2` saytda ham,
       * ilovada ham o'sha sarlavha.
       *
       * ⚠️ NEGA `clamp`: ilovada o'lcham qat'iy (telefon eni ma'lum),
       * saytda esa 320px dan 2560px gacha. Pastki chegara — ilovadagi
       * qiymat, ya'ni telefon brauzerida sayt va ilova bir xil o'lchamda
       * yoziladi. Yuqori chegara — katta ekran uchun.
       *
       * ⚠️ NEGA `em`, `px` EMAS: ilovada `letterSpacing` piksel
       * (`label` 11px shriftda 1.6px). Web'da `px` bersak, `clamp` bilan
       * shrift o'sganda oraliq o'smaydi va sarlavha yoyilib ketadi.
       * 1.6 / 11 = 0.145em — nisbat saqlanadi.
       */
      fontSize: {
        /*
         * `display` — faqat bosh sahifa hero'si uchun, ilovada yo'q.
         *
         * ⚠️ NEGA `hero` YETMADI: uning yuqori chegarasi 4.5rem va u
         * ilovadagi 40px dan kelib chiqqan. 1440px monitorda esa bu
         * sarlavha kichkina bo'lib qoladi — premium moda saytida hero
         * matni ekranni egallashi kerak. `hero` boshqa sahifalarda
         * (katalog, mahsulot) o'z o'rnida qoladi.
         */
        display: ['clamp(3rem, 7.5vw, 7rem)', { lineHeight: '0.98', letterSpacing: '-0.035em' }],
        hero: ['clamp(2.5rem, 6vw, 4.5rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        h1: ['clamp(1.875rem, 3vw, 3rem)', { lineHeight: '1.2', letterSpacing: '-0.0167em' }],
        h2: ['1.375rem', { lineHeight: '1.273', letterSpacing: '-0.0136em' }],
        h3: ['1.0625rem', { lineHeight: '1.412' }],
        /*
         * `lead` — ilovada YO'Q, faqat saytda. Marketing bo'limining
         * kirish xatboshisi: ilovada bunday matn umuman uchramaydi
         * (u yerda hamma narsa qisqa), saytda esa har bo'lim shunday
         * boshlanadi. Shkalaga kiritilgani uchun u ham token, ixtiyoriy
         * `text-lg` emas.
         */
        lead: ['1.125rem', { lineHeight: '1.62' }],
        body: ['0.9375rem', { lineHeight: '1.467' }],
        small: ['0.8125rem', { lineHeight: '1.385' }],
        tiny: ['0.6875rem', { lineHeight: '1.273' }],
        label: ['0.6875rem', { lineHeight: '1.273', letterSpacing: '0.145em' }],
        price: ['1.125rem', { lineHeight: '1.333' }],
        /* Logotip: «L O O K S A V E» — 14px, oraliq 4.5px = 0.32em */
        wordmark: ['0.875rem', { lineHeight: '1.2', letterSpacing: '0.32em' }],
      },

      /*
       * ⚠️ `label` 0.1em EDI — bu 11px shriftda 1.1px beradi, ilovada esa
       * 1.6px. Farq 45%: «TRENDING NOW» ikki platformada boshqacha keng
       * chiqardi va sabab hech kimga ko'rinmasdi (12-tz.md P-05).
       */
      letterSpacing: { label: '0.145em', wordmark: '0.32em' },

      /*
       * `control` — tugma va input balandligi. Ilovada 52px
       * (`components/ui.tsx`), va bu raqam ikkalasida bir xil bo'lishi
       * shart: shadcn'ning 36/40px tugmasi yonma-yon qo'yilganda darrov
       * boshqa mahsulotdek ko'rinadi.
       */
      spacing: { control: '3.25rem' },

      /*
       * Asosiy tugma gradienti. Yassi bir rang «veb-sahifa tugmasi» bo'lib
       * ko'rinadi — ikki tomonlama o'tish hajm beradi. Burchagi 135° :
       * ilovadagi `start {0,0} → end {1,1}` shuning aynan o'zi.
       */
      backgroundImage: {
        'primary-grad': 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-dim)))',
      },

      /* Ilovadagi `Animated.spring` ning web muqobili */
      transitionTimingFunction: { spring: 'cubic-bezier(0.16, 1, 0.3, 1)' },

      /*
       * Ikkalasi ham mobil `components/ui.tsx` dan aniq qiymatlar:
       * bosishda 0.97 ga kichrayish va o'chiq tugmaning 0.45 shaffofligi.
       * Tailwind shkalasida bu raqamlar yo'q — qo'shilmasa har chaqiruvda
       * `scale-[0.97]` yozishga to'g'ri kelardi va bir kun kimdir 0.95 deb
       * yozib qo'yardi.
       */
      scale: { 97: '.97' },
      opacity: { 45: '.45' },

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
        /*
         * Skeleton pulsi — mobil `Skeleton.tsx` bilan bir xil: 0.45 → 0.85,
         * har tomonga 900 ms. Bitta nom ostida turgani uchun sahifadagi
         * barcha skeletonlar bir maromda yonadi; har biri o'z vaqtida
         * yonsa ro'yxat titrayotgandek ko'rinadi.
         */
        'pulse-soft': {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.85' },
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
        'pulse-soft': 'pulse-soft 1.8s ease-in-out infinite',
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
