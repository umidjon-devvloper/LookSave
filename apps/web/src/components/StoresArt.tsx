/**
 * Do'konlar sahifasining hero kompozitsiyasi — neon xarita va marker
 * ustunlari (15-sayt-dizayn.md §4.5).
 *
 * ⚠️ SVG, RASM EMAS — `CartArt.tsx` bilan bir xil sabab: (1) 1500²
 * PNG ~700 KB qo'shadi va har zichlikda qayta chiziladi, (2) rangni
 * tokendan olib bo'lmaydi, ya'ni `--primary` o'zgarsa rasm eskiradi,
 * (3) chetlari fonga singishi kerak — qotirilgan qora to'rtburchak
 * `#0A0A0F` sahifada ko'rinib qoladi (Hero'dagi o'sha muammo).
 *
 * ⚠️ TO'R HAQIQIY PERSPEKTIVADA, `skewX` bilan emas. Qiyshaytirish
 * izometrik beradi — chiziqlar parallel qoladi va «Illustratordagi
 * shablon» bo'lib ko'rinadi. Bu yerda kamera modeli bor
 * (`project`), shuning uchun ko'chalar yo'qolish nuqtasiga qarab
 * yaqinlashadi va uzoqdagi katak kichrayadi.
 *
 * ⚠️ HISOB MODUL DARAJASIDA, render ichida emas. Geometriya statik —
 * har chizishda 40 ta chiziqni qayta hisoblash bekorga ish bo'lardi,
 * ustiga SSR da ham, gidratatsiyada ham bir xil natija kerak.
 *
 * Markup SSR HTML'ida ~20 KB (sahifa gzip bilan 35 KB) — kadrdan
 * tashqaridagi chiziqlar tashlanadi va koordinatalar butun songa
 * yaxlitlanadi, pastdagi `offFrame` va `r` ga qarang.
 */

/* ── Kamera ───────────────────────────────────────────────────────
 * Yer tekisligidagi (a, b) nuqta ekranga shunday tushadi:
 *   z  = markazgacha masofa + burilgan chuqurlik
 *   x  = CX + FOCAL · yon-siljish / z
 *   y  = HORIZON + LIFT / z          (LIFT = FOCAL · kamera balandligi)
 *
 * `HORIZON` manfiy — yo'qolish nuqtasi kadrdan YUQORIDA turadi.
 * Aks holda gorizont chizig'i kadr ichida qolib, xarita «stol usti»
 * bo'lib ko'rinadi.
 */
const VIEW = { w: 760, h: 520 };
const CX = 380;
const HORIZON = -60;
const FOCAL = 520;
const LIFT = 159_120;
/** Yaqin tekislik: bundan berigi hamma narsa kadrdan chiqadi (va z ≤ 0 da matematika buziladi). */
const Z_MIN = 92;
const Z_CENTER = 442;
/** Ko'chalar diagonal ketsin — to'g'ri qaragan to'r «Excel jadvali» bo'lib qoladi. */
const TILT = 0.55;

const COS = Math.cos(TILT);
const SIN = Math.sin(TILT);

/** Chuqurlik — chiziqni kesishdan oldin faqat shu kerak bo'ladi. */
function depth(a: number, b: number): number {
  return Z_CENTER + a * SIN + b * COS;
}

function project(a: number, b: number): { x: number; y: number } {
  const z = depth(a, b);
  return { x: CX + (FOCAL * (a * COS - b * SIN)) / z, y: HORIZON + LIFT / z };
}

/**
 * Koordinatalar butun songacha yaxlitlanadi.
 *
 * ⚠️ NEGA O'NDAN BIR EMAS: kompozitsiya 760 birlik kenglikda ~800px ga
 * chiziladi, ya'ni bitta birlik ≈ bitta piksel. Yarim piksel siljish
 * ko'rinmaydi, lekin har raqamdagi ikkita ortiqcha belgi ~700 ta
 * koordinatada 1.5 KB ni yeydi.
 */
const r = (n: number): number => Math.round(n);

const lerp = (u: number, v: number, t: number): number => u + (v - u) * t;

/**
 * Kesma — kameraning ORQASIGA tushgan uchi qirqiladi.
 *
 * ⚠️ QIRQISHSIZ BO'LMAYDI: z manfiy bo'lganda `FOCAL·lateral/z` ishorani
 * almashtiradi va chiziq kadr bo'ylab teskari tomonga otiladi. Ekranda bu
 * to'r orasidan chiqib ketgan tasodifiy uzun chiziq bo'lib ko'rinadi.
 */
function segment(a0: number, b0: number, a1: number, b1: number): string | null {
  const z0 = depth(a0, b0);
  const z1 = depth(a1, b1);
  if (z0 < Z_MIN && z1 < Z_MIN) return null;

  const cut = (Z_MIN - z0) / (z1 - z0);
  const t0 = z0 < Z_MIN ? cut : 0;
  const t1 = z1 < Z_MIN ? cut : 1;

  const p0 = project(lerp(a0, a1, t0), lerp(b0, b1, t0));
  const p1 = project(lerp(a0, a1, t1), lerp(b0, b1, t1));
  if (offFrame(p0, p1)) return null;

  return `M${r(p0.x)} ${r(p0.y)}L${r(p1.x)} ${r(p1.y)}`;
}

/**
 * Kesma kadrdan butunlay tashqaridami?
 *
 * ⚠️ BUSIZ MARKUP OG'IRROQ. Tekislik ±2400 ga cho'zilgani uchun chekka
 * chiziqlar ekrandan uzoqda — masalan x = −3100 da — turadi va ular
 * BARIBIR SSR HTML'iga yoziladi. Ko'z ularni ko'rmaydi, bayt esa
 * haqiqiy: shu tekshiruv 242 `path` ni 177 ga, markup'ni 29 KB dan
 * 24 KB ga tushirdi (butun songa yaxlitlash bilan birga — 19.6 KB).
 *
 * Tekshiruv EHTIYOTKOR: faqat ikkala uchi bir tomonda tashqarida
 * bo'lgan kesma tashlanadi. Diagonal o'tib ketayotgani qoladi —
 * aniqroq kesish uchun to'liq clipping kerak, u esa bu yerda ortiqcha.
 */
function offFrame(p0: { x: number; y: number }, p1: { x: number; y: number }): boolean {
  const m = 24;
  return (
    (p0.x < -m && p1.x < -m) ||
    (p0.x > VIEW.w + m && p1.x > VIEW.w + m) ||
    (p0.y < -m && p1.y < -m) ||
    (p0.y > VIEW.h + m && p1.y > VIEW.h + m)
  );
}

/*
 * ⚠️ QADAM MAKET ZICHLIGIDAN OLINGAN, «chiroyli raqam» dan emas.
 * Markazda (z = Z_CENTER) qo'shni chiziqlar orasi ekranda
 * `FOCAL · STEP / Z_CENTER` piksel bo'ladi: 22 da ≈ 26px, ya'ni kadr
 * bo'ylab ~29 katak. Maketdagi ham shuncha. Ilgari 44 edi — 15 katak,
 * va to'r SHAHAR XARITASI emas, oddiy 3D simto'r bo'lib ko'rinardi.
 */
const STEP = 22;
/** Zich markaz shu yergacha; undan nari qadam yiriklashadi (pastdagi izoh). */
const DENSE = 700;
const HALF = 2400;

/**
 * Chiziq o'rinlari.
 *
 * ⚠️ TEKISLIK KADRDAN CHIQIB KETISHI SHART. `HALF` kichik bo'lsa to'rning
 * CHETI ko'rinadi — kompozitsiya «stol ustidagi gilam» bo'lib qoladi
 * (900 da aynan shunday chiqdi: tepada ikkita qattiq diagonal qirra).
 *
 * ⚠️ LEKIN HAMMA YOQDA 22 QADAM QO'YIB BO'LMAYDI: ±2400 da bu har
 * yo'nalishda 219 ta chiziq — SSR HTML'i ikki barobar og'irlashadi.
 * Kerak ham emas: perspektivada uzoqdagi chiziqlar bir-biriga qo'shilib
 * ketadi va o'sha masofada 66 qadam ham 22 qadamdek ko'rinadi. Shuning
 * uchun markaz zich, chekka yirik — ko'z farqni sezmaydi.
 */
const LINE_POSITIONS: number[] = [0];
for (let i = STEP; i <= DENSE; i += STEP) LINE_POSITIONS.push(i, -i);
for (let i = DENSE + STEP * 3; i <= HALF; i += STEP * 3) LINE_POSITIONS.push(i, -i);

const STREETS: string[] = [];

for (const i of LINE_POSITIONS) {
  const along = segment(i, -HALF, i, HALF);
  if (along) STREETS.push(along);

  const across = segment(-HALF, i, HALF, i);
  if (across) STREETS.push(across);
}

/**
 * Yer tekisligidagi nuqtalar zanjirini ekranga tushiradi.
 *
 * ⚠️ UZILISHNI HISOBGA OLADI: zanjirning bir qismi yaqin tekislikdan
 * o'tib ketsa, u yerda chiziq UZILISHI kerak. Aks holda kamera ortidagi
 * nuqta kadr bo'ylab otilib, xaritani kesib o'tuvchi tasodifiy chiziq
 * qoldiradi.
 */
function polyline(points: Array<[number, number]>): string {
  /*
   * Kadrdan uzoqdagi nuqtalar ham tashlanadi (yuqoridagi `offFrame`
   * bilan bir sabab). Zaxira KENG: qo'shni nuqtalar orasi ~28px, ya'ni
   * 200px zaxira bilan ko'rinadigan bo'lakning uchi hech qachon
   * qirqilmaydi.
   */
  const margin = 200;
  let path = '';
  let open = false;

  for (const [a, b] of points) {
    if (depth(a, b) < Z_MIN) {
      open = false;
      continue;
    }

    const p = project(a, b);
    if (p.x < -margin || p.x > VIEW.w + margin || p.y < -margin || p.y > VIEW.h + margin) {
      open = false;
      continue;
    }

    path += `${open ? 'L' : 'M'}${r(p.x)} ${r(p.y)}`;
    open = true;
  }

  return path;
}

/**
 * Asosiy ko'chalar — EGRI, to'g'ri emas.
 *
 * ⚠️ TO'R CHIZIG'INI QALINLASHTIRISH YETMAYDI. Maketdagi ikkita yorqin
 * yo'l to'r bo'ylab egilib o'tadi va aynan shu narsa kompozitsiyani
 * «xarita» qiladi: haqiqiy shaharda magistral kvartal chizig'ini
 * takrorlamaydi. Qalinlashtirilgan to'g'ri chiziq esa to'rning bir
 * qatoriday ko'rinadi, xolos.
 */
function highway(
  base: number,
  amplitude: number,
  wavelength: number,
  phase: number,
  swap: boolean,
): string {
  const points: Array<[number, number]> = [];
  for (let t = -HALF; t <= HALF; t += 24) {
    const offset = base + amplitude * Math.sin(t / wavelength + phase);
    points.push(swap ? [offset, t] : [t, offset]);
  }
  return polyline(points);
}

const ROADS = [
  highway(-150, 96, 260, 0, false),
  highway(190, 84, 300, 1.3, true),
  highway(320, 70, 240, 2.1, false),
];

/**
 * Radar halqalari — yerda yotgan aylanalar, ya'ni ekranda ELLIPS emas,
 * perspektivada egilgan shakl. `<ellipse>` bilan chizilsa u to'r bilan
 * bir tekislikda turmaydi va marker havoda osilgandek ko'rinadi.
 *
 * ⚠️ RADIUSLAR MARKERGA BOG'LIQ, KADRGA EMAS. Halqa markerning
 * «qamrovi» — u markerdan sezilarli katta bo'lsa, kompozitsiyaning
 * markazi marker emas, halqa bo'lib qoladi. Tashqi halqa kadr enining
 * ≈45% i: maketdagi nisbat shu (ilgari 69% edi va halqalar to'rni
 * bosib ketardi).
 */
function ring(radius: number): string {
  const steps = 48;
  const points: string[] = [];
  for (let k = 0; k < steps; k += 1) {
    const t = (k / steps) * Math.PI * 2;
    const p = project(Math.cos(t) * radius, Math.sin(t) * radius);
    points.push(`${r(p.x)} ${r(p.y)}`);
  }
  return `M${points.join('L')}Z`;
}

const RINGS = [32, 58, 88, 118, 150].map(ring);

/**
 * Markerlar — kompozitsiya nuqtalari, shuning uchun ular EKRAN
 * koordinatasi bilan beriladi, yer koordinatasi bilan emas: maketda
 * marker qayerda turishi kerakligi ma'lum, u qaysi «ko'chada»
 * turishi esa ahamiyatsiz.
 *
 * Chuqurlik baribir haqiqiy bo'lib qoladi: `y` dan `z` bir qiymatli
 * kelib chiqadi (`y = HORIZON + LIFT / z`), ya'ni pastdagi marker
 * yaqin, tepadagisi uzoq — va `lift` (yerdan balandlik, dunyo
 * birligida) o'zi to'g'ri kichrayadi.
 */
const PINS = [
  { x: 380, y: 300, lift: 128, key: 'hub' },
  { x: 208, y: 198, lift: 56, key: 'nw' },
  { x: 604, y: 182, lift: 58, key: 'ne' },
  { x: 158, y: 392, lift: 39, key: 'sw' },
  { x: 620, y: 404, lift: 38, key: 'se' },
].map((pin) => {
  const z = LIFT / (pin.y - HORIZON);
  /* Lucide `MapPin` glifi 24 birlik qutida, ko'rinadigan balandligi ≈ 20 */
  return { ...pin, scale: r((FOCAL * pin.lift) / z / 20) };
});

/** Lucide `MapPin` — uchi (12, 21.8) da, shuning uchun shu nuqta yerga qo'yiladi. */
const PIN_PATH =
  'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0';

export function StoresArt({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      className={className}
      fill="none"
      role="img"
      aria-label="Yaqin atrofdagi do'konlar xaritasi"
    >
      <defs>
        {/*
          Chetlarni so'ndirish — Hero'dagi bilan bir xil qoida, faqat u
          yerda gradient rasm USTIDA, bu yerda esa niqob: vektorda
          niqob toza, «yopishtirilgan» chekka umuman qolmaydi.
        */}
        <radialGradient id="stores-art-fade" cx="0.5" cy="0.5" r="0.66">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.92" />
          <stop offset="0.75" stopColor="#fff" stopOpacity="0.42" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="stores-art-mask">
          <rect width={VIEW.w} height={VIEW.h} fill="url(#stores-art-fade)" />
        </mask>

        {/* Markaz ostidagi nur — to'r shu yerda yorqin, chetga borib so'nadi */}
        <radialGradient id="stores-art-core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity="0.38" />
          <stop offset="0.45" stopColor="hsl(var(--primary))" stopOpacity="0.14" />
          <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>

        {/* Marker uchi yerga tekkan nuqta — kompozitsiyaning eng yorug' joyi */}
        <radialGradient id="stores-art-spark" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F3EAFF" stopOpacity="0.95" />
          <stop offset="0.3" stopColor="hsl(var(--brand))" stopOpacity="0.6" />
          <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="stores-art-pin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#DDD0FF" />
          <stop offset="0.55" stopColor="hsl(var(--brand))" />
          <stop offset="1" stopColor="hsl(var(--primary))" />
        </linearGradient>

        {/* Neon — chiziqning o'zi tiniq qoladi, nurlanish ORQASIDA turadi */}
        <filter id="stores-art-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="stores-art-haze" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>

      <g mask="url(#stores-art-mask)">
        <ellipse cx={CX} cy="300" rx="250" ry="112" fill="url(#stores-art-core)" />

        {/*
          Ko'chalar to'ri.

          ⚠️ ZICHLIK OSHGANDA TINIQLIK PASAYADI. 26px lik katakda 0.4
          shaffoflik chiziqlarni bir-biriga qo'shib yuboradi va to'r
          yaxlit binafsha dog' bo'lib qoladi — maketda esa har chiziq
          alohida o'qiladi.
        */}
        <g stroke="hsl(var(--primary))" strokeOpacity="0.34" strokeWidth="0.9">
          {STREETS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        {/* Kesishmalardagi uchqunlar — to'rni «tirik» qiladi */}
        <g fill="hsl(var(--brand))" fillOpacity="0.5">
          {[
            [-242, 198],
            [198, -88],
            [-88, -286],
            [286, 286],
            [-330, -44],
            [110, 330],
            [-176, 66],
            [242, 132],
            [44, -198],
            [-286, 308],
            [352, -242],
            [-110, 396],
            [418, 88],
            [-396, -176],
          ].map(([a, b]) => {
            const p = project(a as number, b as number);
            return <circle key={`${a}:${b}`} cx={r(p.x)} cy={r(p.y)} r="1.6" />;
          })}
        </g>

        {/* Magistrallar — avval nurlanish, keyin o'zagi */}
        <g
          filter="url(#stores-art-glow)"
          stroke="hsl(var(--primary))"
          strokeOpacity="0.5"
          fill="none"
          strokeLinecap="round"
        >
          {ROADS.map((d) => (
            <path key={d} d={d} strokeWidth="5" />
          ))}
        </g>
        <g
          stroke="hsl(var(--brand))"
          strokeOpacity="0.85"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        >
          {ROADS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        {/* Radar halqalari — ichkarisi yorqin, ikki ichkarisi nurlanadi ham */}
        <g filter="url(#stores-art-glow)" stroke="hsl(var(--primary))" fill="none">
          {RINGS.slice(0, 3).map((d) => (
            <path key={d} d={d} strokeWidth="3.5" strokeOpacity="0.65" />
          ))}
        </g>
        <g stroke="hsl(var(--brand))" fill="none">
          {RINGS.map((d, index) => (
            <path
              key={d}
              d={d}
              strokeWidth={index === 0 ? 1.8 : 1.3}
              strokeOpacity={0.95 - index * 0.13}
            />
          ))}
        </g>

        {/* Uchqun — halqalardan keyin, ya'ni ularning markazida yonadi */}
        <ellipse cx={CX} cy="300" rx="62" ry="19" fill="url(#stores-art-spark)" />

        {/* Markerlar — orqadagilari avval chiziladi */}
        {PINS.map((pin) => {
          const place = `translate(${pin.x} ${pin.y}) scale(${pin.scale}) translate(-12 -21.8)`;
          const big = pin.key === 'hub';
          return (
            <g key={pin.key}>
              {/* Yerdagi dog' — marker havoda osilib qolmasin */}
              <ellipse
                cx={pin.x}
                cy={pin.y}
                rx={pin.scale * 7}
                ry={pin.scale * 2.4}
                fill="hsl(var(--brand))"
                fillOpacity="0.4"
                filter="url(#stores-art-glow)"
              />
              <g transform={place} filter="url(#stores-art-haze)" opacity={big ? 0.9 : 0.6}>
                <path d={PIN_PATH} stroke="hsl(var(--primary))" strokeWidth="3" />
              </g>
              <g transform={place} fill="none" strokeLinecap="round">
                <path d={PIN_PATH} stroke="url(#stores-art-pin)" strokeWidth={big ? 1.5 : 2} />
                <circle
                  cx="12"
                  cy="10"
                  r={big ? 3.4 : 3}
                  stroke="url(#stores-art-pin)"
                  strokeWidth={big ? 1.5 : 2}
                />
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
