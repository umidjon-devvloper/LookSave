import { FittingExperience } from '../../src/components/ai/FittingExperience';

/**
 * AI oqimidagi kiyintirish qadami.
 *
 * Tana `FittingExperience` da — u pastdagi «Kiyib ko'rish» tabi bilan
 * bir xil. Bu yerdagi yagona farq: oqimga orqaga qaytish tugmasi kerak.
 */
export default function FittingScreen(): JSX.Element {
  return <FittingExperience showBack />;
}
