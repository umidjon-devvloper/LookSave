import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Element ekranga kirganda bir marta paydo bo'ladi.
 *
 * ⚠️ BOSHLANG'ICH HOLAT KO'RINMAS EMAS. `opacity: 0` bilan boshlansa va
 * JavaScript yuklanmasa (yoki xato bersa), sahifa butunlay bo'sh qoladi —
 * marketing sayti uchun bu eng yomon nosozlik. Shuning uchun kuzatuvchi
 * ishga tushgandagina yashiriladi: JS bo'lmasa hamma narsa shunchaki
 * animatsiyasiz ko'rinadi.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Ketma-ket elementlarni bosqichma-bosqich chiqarish uchun, millisekund. */
  delay?: number;
  /**
   * O'rab turgan `div` ga qo'shimcha sinflar.
   *
   * ⚠️ BALANDLIK UCHUN KERAK. Bu komponent QO'SHIMCHA `div` yasaydi:
   * to'r katagi bilan karta orasiga tushib, `h-full` zanjirini uzadi.
   * Karta `h-full` desa, u shu `div` ning balandligini o'lchaydi —
   * `div` esa `height: auto`, ya'ni kontent bo'yicha. Natijada bir
   * qatordagi kartalar turli balandlikda qoladi.
   *
   * Yechim: chaqiruvchi bu yerga `flex flex-1` (yoki `h-full`) beradi
   * va zanjir tiklanadi.
   */
  className?: string;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver !== 'function') return;

    setArmed(true);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          observer.disconnect();
        }
      },
      // Element to'liq ko'rinishini kutmaymiz — chetidan 12% chiqishi yetarli
      { rootMargin: '0px 0px -12% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const hidden = armed && !shown;

  return (
    <div
      ref={ref}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(hidden ? 'opacity-0' : armed ? 'animate-rise' : '', className)}
    >
      {children}
    </div>
  );
}
