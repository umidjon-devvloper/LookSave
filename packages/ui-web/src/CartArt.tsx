/**
 * Bo'sh savat uchun neon aravacha — `apps/mobile/src/components/CartArt.tsx`
 * ning veb ko'chirmasi. Yo'l ma'lumoti AYNAN bir xil.
 *
 * ⚠️ SVG, RASM EMAS. Maketda u 3D render (PNG) edi. Vektor tanlandi,
 * chunki: (1) 1024² PNG ~1 MB qo'shadi va har ekran zichligida qayta
 * chizilishi kerak, (2) rangni tokendan olib bo'lmaydi — mavzu o'zgarsa
 * rasm eskirib qoladi, (3) neon nurlanish gradient bilan beriladi,
 * rasmga qotirilgan holda esa fon o'zgarganda begona ko'rinadi.
 *
 * ⚠️ GRADIENT `id` LARI NOYOB BO'LISHI KERAK. Bitta sahifada ikkita
 * `CartArt` bo'lsa (masalan savat bo'sh va yon panelda ham) brauzer
 * birinchi topilgan `id` ni ishlatadi — ikkinchisi rangsiz chiqadi.
 * Shuning uchun `id` ga prefiks beriladi.
 */
export function CartArt({ size = 190, idPrefix = 'cart' }: { size?: number; idPrefix?: string }) {
  const frame = `${idPrefix}-frame`;
  const handle = `${idPrefix}-handle`;
  const wheel = `${idPrefix}-wheel`;

  return (
    <svg
      width={size}
      height={size * 0.92}
      viewBox="0 0 200 184"
      fill="none"
      role="img"
      aria-label="Bo'sh savat"
    >
      <defs>
        {/* Metall nurlanish — yuqori chetlar yorqinroq */}
        <linearGradient id={frame} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C4B5FD" />
          <stop offset="0.45" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#4C1D95" />
        </linearGradient>
        <linearGradient id={handle} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F472B6" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id={wheel} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#818CF8" />
          <stop offset="1" stopColor="#DB2777" />
        </linearGradient>
      </defs>

      {/* Nurlanish halqasi — savat ostidagi yorug'lik */}
      <g opacity={0.35}>
        <circle cx="105" cy="150" r="52" fill="#8B5CF6" opacity={0.18} />
      </g>

      {/* Dastak */}
      <path
        d="M22 30h14c5 0 9 3 11 8"
        stroke={`url(#${handle})`}
        strokeWidth="9"
        strokeLinecap="round"
      />

      {/* Savat konturi — yuqori chetdan pastki tubigacha */}
      <path
        d="M47 44h132l-16 62H68z"
        stroke={`url(#${frame})`}
        strokeWidth="7"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Panjara — ikki gorizontal, uch vertikal */}
      <g stroke={`url(#${frame})`} strokeWidth="3.2" strokeLinecap="round" opacity={0.85}>
        <path d="M52 64h123M57 85h113" />
        <path d="M76 45l-4 60M110 45l-2 60M144 45l-1 60" />
      </g>

      {/* Aravacha ramkasi — savatdan g'ildiraklarga */}
      <path
        d="M68 106l-8 26h108"
        stroke={`url(#${frame})`}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M36 132h24" stroke={`url(#${frame})`} strokeWidth="7" strokeLinecap="round" />

      {/* G'ildiraklar */}
      <circle cx="76" cy="152" r="14" stroke={`url(#${wheel})`} strokeWidth="6" fill="none" />
      <circle cx="76" cy="152" r="4" fill="#F472B6" />
      <circle cx="156" cy="152" r="14" stroke={`url(#${wheel})`} strokeWidth="6" fill="none" />
      <circle cx="156" cy="152" r="4" fill="#F472B6" />

      {/* Uchqunlar — maketdagi yulduzchalar */}
      <path d="M186 40l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#C084FC" opacity={0.9} />
      <path d="M22 96l2.2 6 6 2.2-6 2.2-2.2 6-2.2-6-6-2.2 6-2.2z" fill="#C084FC" opacity={0.7} />
    </svg>
  );
}
