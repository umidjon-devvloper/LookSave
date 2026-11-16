import { LookRoom } from '../../src/components/ai/LookRoom';

/**
 * Kiyib ko'rish — bosh sahifadagi AI tugmasidan ochiladigan ekran.
 *
 * Tana `LookRoom` da — u pastdagi markaziy tab bilan bir xil. Bu yerdagi
 * yagona farq: tab qatori yo'q, shuning uchun orqaga tugmasi kerak.
 */
export default function FittingScreen(): JSX.Element {
  return <LookRoom showBack />;
}
