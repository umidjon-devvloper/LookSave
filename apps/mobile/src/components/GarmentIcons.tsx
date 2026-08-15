import Svg, { Path } from 'react-native-svg';

/**
 * Kiyim ikonkalari — qo'lda chizilgan.
 *
 * NEGA QO'LDA: Lucide'da moda glifi deyarli yo'q (shim, kurtka, kepka
 * umuman topilmaydi), `@expo/vector-icons` esa bu muhitda ishlamaydi —
 * yangi arxitekturada `create__default is not a function` xatosini beradi.
 *
 * Lucide bilan bir xil ko'rinishi uchun: 24×24 to'r, `strokeWidth` 1.75,
 * uchlari va burchaklari yumaloq, to'ldirish yo'q (06-dizayn.md §11).
 */
interface GlyphProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function Glyph({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
  d,
}: GlyphProps & { d: string[] }): JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {d.map((path) => (
        <Path
          key={path}
          d={path}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
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

/** Ko'ylak — korsaj va kengayuvchi etak (Marketplace "WOMEN" kartasi). */
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
