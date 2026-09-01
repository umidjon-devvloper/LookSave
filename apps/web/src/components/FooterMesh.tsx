/**
 * Futer ostidagi perspektivadagi to'r.
 *
 * ⚠️ RASM EMAS, SVG: (1) hajmi bir necha yuz bayt — bir necha yuz
 * kilobaytlik PNG o'rniga, (2) rangi `--primary` dan keladi, ya'ni
 * token o'zgarsa u ham o'zgaradi, (3) chetlari niqob bilan so'nadi va
 * qorong'i panelda to'rtburchagi ko'rinmaydi.
 *
 * ⚠️ BUTUN TO'R BITTA `<path>` DA. Har chiziqni alohida element qilish
 * 22 ta tugun yasardi; bitta `d` ularni `M … L …` bo'laklari bilan
 * ko'taradi va DOM'da bitta element qoladi.
 */

const ROWS = 9;
const COLS = 13;

/*
 * Modul yuklanganda bir marta hisoblanadi — qiymatlar o'zgarmas,
 * shuning uchun har chizishda qayta hisoblash keraksiz.
 */
const MESH = ((): string => {
  const parts: string[] = [];

  /* Qatorlar: pastda siyrak va keng, tepada zich — perspektiva shundan */
  for (let row = 0; row < ROWS; row += 1) {
    const t = row / (ROWS - 1);
    const y = 260 - t ** 2.1 * 250;
    let d = `M0 ${y.toFixed(1)}`;
    for (let x = 40; x <= 560; x += 40) {
      /* Yengil to'lqin — tekis chiziqlar «jadval» bo'lib ko'rinardi */
      const wave = Math.sin(x / 90 + row * 0.7) * (1 - t) * 9;
      d += ` L${x} ${(y + wave).toFixed(1)}`;
    }
    parts.push(d);
  }

  /* Ustunlar: pastda kengroq, tepada bir nuqtaga yaqinlashadi */
  for (let col = 0; col < COLS; col += 1) {
    const ratio = col / (COLS - 1);
    parts.push(`M${(ratio * 560).toFixed(1)} 260 L${(60 + ratio * 440).toFixed(1)} 10`);
  }

  return parts.join(' ');
})();

const FADE = 'radial-gradient(120% 100% at 12% 100%, #000 12%, transparent 72%)';

export function FooterMesh({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 560 260"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
      style={{ maskImage: FADE, WebkitMaskImage: FADE }}
    >
      <path d={MESH} fill="none" stroke="hsl(var(--primary))" strokeWidth={1} />
    </svg>
  );
}
