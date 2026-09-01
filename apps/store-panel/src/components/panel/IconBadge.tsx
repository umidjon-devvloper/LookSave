import type { LucideIcon } from 'lucide-react';

/**
 * Gradientli ikonka plitkasi.
 *
 * ⚠️ RANG BEZAK EMAS, AJRATGICH. Panelda plitkalar to'rttadan qatorda
 * turadi va hammasi bir xil bo'lsa ko'z ularni o'qimay, birma-bir
 * sanab chiqadi. Har o'lchovga o'z rangi berilsa, sotuvchi ikkinchi
 * marta kirganda «yashil — yakunlangan» deb bir qarashda topadi.
 *
 * ⚠️ RANGLAR PRESETDAN, QO'LDA YOZILGAN HEX EMAS. `tailwind-preset.js`
 * dagi tokenlar uch ilovada umumiy; bu yerda `#8B5CF6` yozilsa panel
 * mavzu o'zgarganda saytdan ajralib qolardi.
 */
export type Tone = 'violet' | 'blue' | 'green' | 'brand' | 'amber';

/*
 * ⚠️ TO'LIQ SINF NOMLARI — `from-${tone}/25` KABI YIG'ISH ISHLAMAYDI.
 * Tailwind manba matnini o'qib sinf yasaydi va shablon satridan
 * yig'ilgan nomni topa olmaydi: uslub jimgina yo'qoladi.
 */
const TONE: Record<Tone, string> = {
  violet: 'from-primary/25 to-primary/[0.04] text-primary ring-primary/20',
  blue: 'from-chart-3/25 to-chart-3/[0.04] text-chart-3 ring-chart-3/20',
  green: 'from-success/25 to-success/[0.04] text-success ring-success/20',
  brand: 'from-brand/25 to-brand/[0.04] text-brand ring-brand/20',
  amber: 'from-warning/25 to-warning/[0.04] text-warning ring-warning/20',
};

export function IconBadge({
  icon: Icon,
  tone = 'violet',
}: {
  icon: LucideIcon;
  tone?: Tone;
}): JSX.Element {
  return (
    <span
      aria-hidden
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${TONE[tone]}`}
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} />
    </span>
  );
}
