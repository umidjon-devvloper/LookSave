import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Element ekranga yaqinlashganini bildiradi.
 *
 * three.js bilan bog'liq emas — ataylab: aynan shu ilgak `three` bo'lagini
 * yuklashni boshlaydi, shuning uchun uning o'zi hech narsa olib kelmasligi
 * kerak.
 */
export function useInView<T extends HTMLElement>(margin = '250px'): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Eski brauzerda kuzatuvchi yo'q — u holda darrov ko'rsatamiz
    if (typeof IntersectionObserver !== 'function') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: margin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [margin]);

  return [ref, inView];
}
