import { LookRoom } from '../../src/components/ai/LookRoom';

/**
 * «Kiyib ko'rish» tabi — markaziy tugma.
 *
 * ⚠️ BU EKRAN UCH MARTA ALMASHDI. Avval `three.js` sahnasi edi (3D avatar
 * va GLB kiyimlar) — natija «o'yinchoq»dek chiqardi va har mahsulotga 3D
 * model kerak bo'lardi. Keyin AI kiyintirish: do'kon katalogi, turkum
 * tablari va filtrlar bilan birga (`FittingExperience`) — ishlardi, lekin
 * ekran murakkablashib ketdi. Endi u sodda primerka: «Look» bilan yig'ilgan
 * kiyimlar va bitta «Kiyintirish» tugmasi (`LookRoom`).
 *
 * Tepadagi AI tugmasi (`/ai/fitting`) aynan shu ekranni ochadi — ikki
 * kirish, bitta ekran.
 */
export default function TryOnTab(): JSX.Element {
  return <LookRoom />;
}
