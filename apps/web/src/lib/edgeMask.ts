/**
 * Bo'lim fonining tepa/past chetini so'ndiradigan niqob.
 *
 * ⚠️ CHIZIQLI GRADIENT YARAMAYDI. `transparent 0%, #000 16%` matematik
 * jihatdan silliq, lekin KO'ZGA ko'rinadi: shaffoflik o'zgarish TEZLIGI
 * 16% nuqtasida birdan noldan doimiyga sakraydi va ko'z aynan shu
 * sinishni ko'ndalang chiziq deb o'qiydi (Mach polosasi).
 *
 * `EASE` — smoothstep (t²(3−2t)) qiymatlari: egri o'z chetlarida
 * tekislanadi, shuning uchun sinish nuqtasi qolmaydi.
 *
 * ⚠️ QIYMAT BITTA JOYDA TURISHI SHART. Ikki qo'shni bo'lim chegarasi
 * faqat ikkala tomon BIR XIL so'nganda ko'rinmaydi; nusxa ko'chirilganda
 * ular bir-biridan uzoqlashib, o'sha chok qaytadi.
 */
const EASE = [0, 0.028, 0.104, 0.216, 0.352, 0.5, 0.648, 0.784, 0.896, 0.972, 1];

/** So'nish zonasi — bo'lim balandligining ulushi (har ikki chetda) */
const FADE = 30;

export const EDGE_MASK = `linear-gradient(to bottom, ${[
  ...EASE.map((a, i) => `rgba(0,0,0,${a}) ${((i / (EASE.length - 1)) * FADE).toFixed(1)}%`),
  ...EASE.map(
    (a, i) => `rgba(0,0,0,${a}) ${(100 - (i / (EASE.length - 1)) * FADE).toFixed(1)}%`,
  ).reverse(),
].join(',')})`;

/** `style` uchun tayyor juftlik — prefiksli va prefiksiz kalit birga */
export const edgeMaskStyle = { maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK } as const;
