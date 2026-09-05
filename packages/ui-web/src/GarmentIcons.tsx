/**
 * Kiyim glyflari — `apps/mobile/src/components/GarmentIcons.tsx` ning veb
 * ko'chirmasi. Yo'l ma'lumoti (`d`) AYNAN bir xil: ikki platformada bitta
 * chizma bo'lishi kerak.
 *
 * NEGA QO'LDA CHIZILGAN: Lucide'da moda glifi deyarli yo'q — shim, kurtka
 * va kepka umuman topilmaydi. Faqat futbolka Lucide'niki (`Shirt`).
 *
 * Lucide bilan bir xil ko'rinishi uchun: 24×24 to'r, `strokeWidth` 1.75,
 * uchlari va burchaklari yumaloq, to'ldirish yo'q (06-dizayn.md §11).
 *
 * ⚠️ `stroke="currentColor"` — Lucide ham shunday ishlaydi, ya'ni rang
 * ota-elementdan meros bo'lib keladi va `text-primary` kabi sinf
 * ikkalasiga bir xil ta'sir qiladi.
 */

export interface GlyphProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function Glyph({
  size = 24,
  strokeWidth = 1.75,
  className,
  d,
}: GlyphProps & { d: string[] }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {d.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

/** Shim — bel chizig'i va ikki shtanina. */
export function Pants(props: GlyphProps): JSX.Element {
  return <Glyph {...props} d={['M6 3h12l1 18h-5l-2-10-2 10H5L6 3z', 'M6 7h12']} />;
}

/** Kurtka — yelkalari tushirilgan, yoqasi va markaziy zamogi bilan. */
export function Jacket(props: GlyphProps): JSX.Element {
  return (
    <Glyph {...props} d={['M9 3 4 6l1 4-1 11h16l-1-11 1-4-5-3z', 'M9 3l3 4 3-4', 'M12 7v14']} />
  );
}

/** Ko'ylak — korsaj va kengayuvchi etak (Marketplace «WOMEN» kartasi). */
export function Dress(props: GlyphProps): JSX.Element {
  return <Glyph {...props} d={['M9 3l3 3 3-3 2 3-2 4 3 11H6l3-11-2-4z', 'M9.5 10h5']} />;
}

/** Kepka — gumbaz va kozirek. */
export function Cap(props: GlyphProps): JSX.Element {
  return (
    <Glyph
      {...props}
      d={['M5 14a7 7 0 0 1 14 0', 'M19 14h1.5a1.5 1.5 0 0 1 0 3H5a1 1 0 0 1-1-1v-2h1']}
    />
  );
}

/** Krossovka — yon profil. */
export function Sneaker(props: GlyphProps): JSX.Element {
  return (
    <Glyph
      {...props}
      d={[
        'M3 17v-6h4l3 2 5 1c3 0 6 1 6 3v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
        'M7 11l2 3',
        'M11 13l1.5 2',
      ]}
    />
  );
}

/**
 * Ilgak — shapkadagi «Kiyintirish» uchun.
 *
 * ⚠️ QO'LDA CHIZILGAN: Lucide'da ilgak glifi yo'q (bu fayldagi
 * qolganlari bilan bir sabab). Ilmoq va uchburchak dastadan iborat —
 * kiyimni «osib ko'rish» ma'nosini `Sparkles` dan aniqroq beradi.
 */
export function Hanger(props: GlyphProps): JSX.Element {
  return (
    <Glyph
      {...props}
      d={[
        'M12 9.2V7.9a2.3 2.3 0 1 1 2.3-2.3',
        'm12 9.2-8.2 6a1.5 1.5 0 0 0 .9 2.7h14.6a1.5 1.5 0 0 0 .9-2.7l-8.2-6z',
      ]}
    />
  );
}
