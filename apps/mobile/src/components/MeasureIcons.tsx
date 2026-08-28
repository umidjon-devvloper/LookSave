import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

/**
 * O'lchov ikonkalari — qo'lda chizilgan.
 *
 * NEGA QO'LDA: Lucide'da tana o'lchovi glifi yo'q (ko'krak, bel, son
 * atrofidagi o'lchov chizig'i umuman topilmaydi), rasm sifatida saqlash
 * esa bundle'ni shishiradi va har ekran zichligida qayta chizilishi
 * kerak. SVG vektor — har o'lchamda toza va rangi tokendan keladi.
 *
 * `GarmentIcons.tsx` bilan bir xil qoida: 24×24 to'r, `strokeWidth` 1.75,
 * uchlari yumaloq, to'ldirish yo'q (06-dizayn.md §11). Shunda ular
 * Lucide ikonkalari yonida begona ko'rinmaydi.
 */

interface GlyphProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const stroke = (color: string, width: number) => ({
  stroke: color,
  strokeWidth: width,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none' as const,
});

/** Bo'y — o'lchov chizg'ichi va odam */
export function HeightIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: GlyphProps): JSX.Element {
  const s = stroke(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Chizg'ich va uning bo'linmalari */}
      <Rect x="2.5" y="3" width="5.5" height="18" rx="1.2" {...s} />
      <Line x1="2.5" y1="7" x2="5" y2="7" {...s} />
      <Line x1="2.5" y1="10.5" x2="5" y2="10.5" {...s} />
      <Line x1="2.5" y1="14" x2="5" y2="14" {...s} />
      <Line x1="2.5" y1="17.5" x2="5" y2="17.5" {...s} />
      {/* Odam */}
      <Circle cx="16.5" cy="6" r="2.2" {...s} />
      <Path d="M16.5 8.6v6.4M13.4 11.4h6.2M14.6 21l1.9-6M18.4 21l-1.9-6" {...s} />
    </Svg>
  );
}

/** Vazn — tarozi */
export function WeightIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: GlyphProps): JSX.Element {
  const s = stroke(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="16" rx="3" {...s} />
      <Circle cx="12" cy="12" r="4.2" {...s} />
      {/* Strelka — o'ngga yuqoriga qaragan */}
      <Path d="M12 12l2.4-2.4" {...s} />
    </Svg>
  );
}

/** Ko'krak — gavda va eng keng joyi bo'ylab o'lchov chizig'i */
export function ChestIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: GlyphProps): JSX.Element {
  const s = stroke(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Yelka va gavda konturi */}
      <Path
        d="M7 4.5C7 3 9.2 2.5 12 2.5s5 .5 5 2c0 1.6-1.2 2.4-1.2 4.2v11.8H8.2V8.7C8.2 6.9 7 6.1 7 4.5Z"
        {...s}
      />
      {/* O'lchov chizig'i — eng keng joyi */}
      <Path d="M4.5 9.5h3M16.5 9.5h3" {...s} />
    </Svg>
  );
}

/** Bel — ikki tomondan siqilgan gavda */
export function WaistIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: GlyphProps): JSX.Element {
  const s = stroke(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Gavdaning ingichka joyi — ichkariga egilgan ikki chiziq */}
      <Path d="M8 3c0 3.5-2.2 5.4-2.2 9S8 17.5 8 21" {...s} />
      <Path d="M16 3c0 3.5 2.2 5.4 2.2 9S16 17.5 16 21" {...s} />
      {/* Kindik — markazni belgilaydi */}
      <Circle cx="12" cy="12.5" r="0.9" fill={color} stroke="none" />
      {/* Ichkariga qaragan strelkalar */}
      <Path d="M2.5 12h2.2M4 10.8 5.2 12 4 13.2" {...s} />
      <Path d="M21.5 12h-2.2M20 10.8 18.8 12 20 13.2" {...s} />
    </Svg>
  );
}

/** Son — chanoq va eng keng joyi */
export function HipsIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: GlyphProps): JSX.Element {
  const s = stroke(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Bel — chanoq — son */}
      <Path d="M8.5 3.5c0 2.5-3 4-3 7.5 0 2.6 1.3 4 1.6 6.5.2 1.6.2 2.7.2 3.5" {...s} />
      <Path d="M15.5 3.5c0 2.5 3 4 3 7.5 0 2.6-1.3 4-1.6 6.5-.2 1.6-.2 2.7-.2 3.5" {...s} />
      {/* Oyoqlar orasi */}
      <Path d="M12 14.5V21" {...s} />
      {/* Eng keng joyi bo'ylab uzuq chiziq */}
      <Path d="M6 14.2h2M10.5 14.2h3M16 14.2h2" strokeDasharray="2 1.6" {...s} />
    </Svg>
  );
}

/** Oyoq o'lchami — yon ko'rinishdagi oyoq va uzunlik o'qi */
export function ShoeIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: GlyphProps): JSX.Element {
  const s = stroke(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Boldir va panja */}
      <Path
        d="M9 2.5c0 3 .6 4.6.6 7 0 1.9-1.1 3-1.1 4.8 0 1.4.6 2.3.6 3.4 0 1.4-1.2 2.3-3.1 2.3H4c-.8 0-1.2-.5-1.2-1.1 0-.8.6-1.2 1.6-1.6 1.6-.7 2.3-1.6 2.6-3"
        {...s}
      />
      <Path
        d="M9 2.5c1.4 0 2.4.7 2.4 2 0 1.5-.7 2.6-.7 4.4 0 2 1.2 3 1.2 5 0 2-1 3.3-1 4.9"
        {...s}
      />
      {/* Uzunlik o'qi */}
      <Path d="M17.5 4v16M16.3 5.2 17.5 4l1.2 1.2M16.3 18.8l1.2 1.2 1.2-1.2" {...s} />
    </Svg>
  );
}

/** Avatar shakli — futbolka */
export function FitIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: GlyphProps): JSX.Element {
  const s = stroke(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.8 3.5 5 5.6l1.6 3.4 1.6-.7V20.5h7.6V8.3l1.6.7L19 5.6l-3.8-2.1a3.4 3.4 0 0 1-6.4 0Z"
        {...s}
      />
    </Svg>
  );
}

/** Umumiy o'lchov — santimetr lentasi (sarlavha bloki uchun) */
export function TapeIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: GlyphProps): JSX.Element {
  const s = stroke(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Gavda konturi */}
      <Path d="M8 2.5c0 3-2 4.6-2 7.8s2 4.4 2 7.6" {...s} />
      <Path d="M16 2.5c0 3 2 4.6 2 7.8s-2 4.4-2 7.6" {...s} />
      {/* Lenta */}
      <Rect x="3.5" y="12.5" width="17" height="4" rx="1.4" {...s} />
      <Line x1="7.5" y1="13.6" x2="7.5" y2="15.4" {...s} />
      <Line x1="10.5" y1="13.6" x2="10.5" y2="15.4" {...s} />
      <Line x1="13.5" y1="13.6" x2="13.5" y2="15.4" {...s} />
      <Line x1="16.5" y1="13.6" x2="16.5" y2="15.4" {...s} />
    </Svg>
  );
}
