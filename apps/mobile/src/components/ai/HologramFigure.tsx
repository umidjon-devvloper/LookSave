import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Rect,
  Stop,
  G,
  RadialGradient,
} from 'react-native-svg';

import { colors } from '../../theme/tokens';

/**
 * AI Designer ekranidagi "gologramma" figurasi.
 *
 * NEGA SVG, 3D EMAS: bu bezak. Shu joyga `AvatarScene` qo'yilsa GL konteksti
 * ochiladi (~200-400 ms) va GPU xotirasi band bo'ladi — kirish ekrani uchun
 * juda qimmat. SVG bir kadrda chiziladi va hech narsa ushlab turmaydi.
 *
 * Shakl `three/placeholder.ts` dagi maneken bilan bir xil proporsiyada
 * yasalgan — foydalanuvchi keyingi ekranda o'sha shaklni ko'radi, ikkalasi
 * bir dunyoning bo'lagi bo'lib tursin.
 */
export function HologramFigure({ size = 240 }: { size?: number }): JSX.Element {
  // viewBox 200×260 — figura 0…220, halqalar pastda
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 200 260">
      <Defs>
        <LinearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.22} />
          <Stop offset="70%" stopColor={colors.primary} stopOpacity={0.06} />
          <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="figure" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.95} />
          <Stop offset="100%" stopColor={colors.primary} stopOpacity={0.7} />
        </LinearGradient>
        <RadialGradient id="floor" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Yuqoridan tushayotgan nur */}
      <Rect x="38" y="28" width="124" height="205" fill="url(#beam)" />

      {/* Proyektor halqasi — tepada */}
      <Ellipse
        cx="100"
        cy="28"
        rx="60"
        ry="11"
        stroke={colors.accent}
        strokeWidth={1.6}
        fill="none"
        opacity={0.75}
      />
      <Ellipse cx="100" cy="28" rx="40" ry="7" stroke={colors.accent} strokeWidth={1} fill="none" />

      {/* Poldagi yorug'lik */}
      <Ellipse cx="100" cy="236" rx="80" ry="20" fill="url(#floor)" />

      {/* Figura — `three/placeholder.ts` bilan bir xil tuzilma */}
      <G fill="url(#figure)">
        <Circle cx="100" cy="62" r="13" />
        <Rect x="96" y="72" width="8" height="9" rx="3" />
        <Rect x="85" y="79" width="30" height="63" rx="13" />
        <Rect x="72" y="84" width="9" height="55" rx="4.5" />
        <Rect x="119" y="84" width="9" height="55" rx="4.5" />
        <Circle cx="76.5" cy="145" r="5.5" />
        <Circle cx="123.5" cy="145" r="5.5" />
        <Rect x="89" y="139" width="10" height="74" rx="5" />
        <Rect x="101" y="139" width="10" height="74" rx="5" />
      </G>

      {/* Oyoq kiyimi — to'qroq, xuddi manekendagidek */}
      <G fill={colors.primaryDark}>
        <Rect x="86" y="211" width="15" height="9" rx="3.5" />
        <Rect x="99" y="211" width="15" height="9" rx="3.5" />
      </G>

      {/* Skanerlash chiziqlari — o'lchov taassuroti */}
      <Rect x="60" y="104" width="80" height="1" fill={colors.accent} opacity={0.5} />
      <Rect x="66" y="150" width="68" height="1" fill={colors.accent} opacity={0.35} />

      {/* Poldagi halqalar */}
      <Ellipse
        cx="100"
        cy="230"
        rx="68"
        ry="15"
        stroke={colors.primary}
        strokeWidth={1.4}
        fill="none"
        opacity={0.8}
      />
      <Ellipse
        cx="100"
        cy="238"
        rx="48"
        ry="10"
        stroke={colors.accent}
        strokeWidth={1.1}
        fill="none"
        opacity={0.6}
      />
      <Ellipse
        cx="100"
        cy="244"
        rx="28"
        ry="6"
        stroke={colors.accent}
        strokeWidth={0.9}
        fill="none"
        opacity={0.4}
      />
    </Svg>
  );
}
