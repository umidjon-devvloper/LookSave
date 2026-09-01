import { edgeMaskStyle } from '@/lib/edgeMask';
import { cn } from '@/lib/utils';

/**
 * Bo'lim foni — butun kenglikdagi rasm, cheti fonga singib ketadi.
 *
 * ⚠️ NIMA UCHUN ALOHIDA KOMPONENT: uchta bo'lim (`HowItWorks`, `Stores`,
 * `Waitlist`) bir xil ishni qiladi. Nusxa ko'chirilganda niqob qiymatlari
 * bir-biridan uzoqlashib ketdi va ular tutashgan joyda chok paydo bo'ldi.
 * Chegara ikki tomondan bir xil so'nsagina ko'rinmaydi — demak qiymat
 * bitta joyda turishi shart.
 */

export function SectionBackdrop({
  src,
  /** `object-position` sinfi — rasmning qaysi qismi ko'rinishi kerak */
  position,
  /**
   * Yon tomondagi so'nish (ixtiyoriy). Kontent bir tomonda bo'lsa, fon
   * o'sha tomonda so'nadi — aks holda matn rasm ustida o'qilmaydi.
   */
  sideFade,
  /**
   * Rasm qutisi. Standarti — butun bo'lim (`size-full`).
   *
   * ⚠️ NIQOB SHU QUTIGA O'LCHANADI. Rasmni torroq qilsangiz
   * (masalan `w-[62%]`) chetlarini so'ndiruvchi niqob ham o'sha tor
   * qutida ishlaydi — qo'shni bo'lim bilan tutashish saqlanadi.
   * Shuning uchun bu yerda `className` emas, alohida prop: qutini
   * o'zgartirish niqobni buzmasligi kerak.
   */
  imageClass = 'size-full',
}: {
  src: string;
  position: string;
  sideFade?: string;
  imageClass?: string;
}): JSX.Element {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        style={edgeMaskStyle}
        className={cn('object-cover', imageClass, position)}
      />
      {sideFade ? <div className="absolute inset-0" style={{ background: sideFade }} /> : null}
    </div>
  );
}
