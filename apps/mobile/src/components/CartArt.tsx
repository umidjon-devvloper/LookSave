import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '../theme/tokens';

/**
 * Bo'sh savat uchun neon aravacha.
 *
 * ⚠️ SVG, RASM EMAS. Maketda u 3D render (PNG) edi. Vektor tanlandi,
 * chunki: (1) 1024² PNG bundle'ga ~1 MB qo'shadi va har ekran zichligida
 * qayta chizilishi kerak, (2) rangni tokendan olib bo'lmaydi — mavzu
 * o'zgarsa rasm eskirib qoladi, (3) neon nurlanish gradient bilan
 * beriladi, rasmga qotirilgan holda esa fon o'zgarganda begona ko'rinadi.
 *
 * Aravacha profil ko'rinishida: savat, ikki g'ildirak, dastak. Panjara
 * chiziqlari — kesishgan ingichka chiziqlar; ular soni ataylab kam, aks
 * holda mayda o'lchamda qora dog'ga aylanadi.
 */
export function CartArt({ size = 190 }: { size?: number }): JSX.Element {
  return (
    <Svg width={size} height={size * 0.92} viewBox="0 0 200 184" fill="none">
      <Defs>
        {/* Metall nurlanish — yuqori chetlar yorqinroq */}
        <LinearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#C4B5FD" />
          <Stop offset="0.45" stopColor={colors.primary} />
          <Stop offset="1" stopColor="#4C1D95" />
        </LinearGradient>
        <LinearGradient id="handle" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F472B6" />
          <Stop offset="1" stopColor="#A855F7" />
        </LinearGradient>
        <LinearGradient id="wheel" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#818CF8" />
          <Stop offset="1" stopColor="#DB2777" />
        </LinearGradient>
      </Defs>

      {/* Nurlanish halqasi — savat ostidagi yorug'lik */}
      <G opacity={0.35}>
        <Circle cx="105" cy="150" r="52" fill={colors.primary} opacity={0.18} />
      </G>

      {/* Dastak */}
      <Path
        d="M22 30h14c5 0 9 3 11 8"
        stroke="url(#handle)"
        strokeWidth="9"
        strokeLinecap="round"
      />

      {/* Savat konturi — yuqori chetdan pastki tubigacha */}
      <Path
        d="M47 44h132l-16 62H68z"
        stroke="url(#frame)"
        strokeWidth="7"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Panjara — ikki gorizontal, uch vertikal */}
      <G stroke="url(#frame)" strokeWidth="3.2" strokeLinecap="round" opacity={0.85}>
        <Path d="M52 64h123M57 85h113" />
        <Path d="M76 45l-4 60M110 45l-2 60M144 45l-1 60" />
      </G>

      {/* Aravacha ramkasi — savatdan g'ildiraklarga */}
      <Path
        d="M68 106l-8 26h108"
        stroke="url(#frame)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M36 132h24" stroke="url(#frame)" strokeWidth="7" strokeLinecap="round" />

      {/* G'ildiraklar */}
      <Circle cx="76" cy="152" r="14" stroke="url(#wheel)" strokeWidth="6" fill="none" />
      <Circle cx="76" cy="152" r="4" fill="#F472B6" />
      <Circle cx="156" cy="152" r="14" stroke="url(#wheel)" strokeWidth="6" fill="none" />
      <Circle cx="156" cy="152" r="4" fill="#F472B6" />

      {/* Uchqunlar — maketdagi yulduzchalar */}
      <Path d="M186 40l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill={colors.accent} opacity={0.9} />
      <Path
        d="M22 96l2.2 6 6 2.2-6 2.2-2.2 6-2.2-6-6-2.2 6-2.2z"
        fill={colors.accent}
        opacity={0.7}
      />
    </Svg>
  );
}
