import { useEffect, useRef, useState, type ReactNode } from 'react';

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
}: {
  children: ReactNode;
  /** Ketma-ket elementlarni bosqichma-bosqich chiqarish uchun, millisekund. */
  delay?: number;
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
      className={hidden ? 'opacity-0' : armed ? 'animate-rise' : ''}
    >
      {children}
    </div>
  );
}
