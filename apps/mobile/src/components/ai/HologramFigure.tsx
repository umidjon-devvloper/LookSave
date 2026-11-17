import { Image, StyleSheet } from 'react-native';

import { images } from '../../theme/images';

/**
 * AI Designer ekranidagi gologramma.
 *
 * NEGA RASM, SVG EMAS: ilgari figura kod bilan chizilgan edi — halqalar va
 * oddiy shakl. U sxematik ko'rinardi. Tayyor rasm nur, tuman va material
 * detallarini beradi, ularni SVG bilan takrorlab bo'lmaydi.
 *
 * ⚠️ RASM TO'LIQ KO'RSATILADI — ichida kartalar va kiyim plitkalari ham bor,
 * shuning uchun ekranda ular alohida chizilmaydi.
 *
 * ⚠️ RASM FONI QORA VA SHAFFOF EMAS (`hasAlpha: no`). Ekran esa yorug',
 * shuning uchun rasm sof qora (`#000000`) yumaloq ramka ichida turadi
 * (`app/ai/index.tsx` → `stage`) — ramka boshqa rangda bo'lsa rasm atrofida
 * to'rtburchak chekka ko'rinib qoladi. Ramkasiz, to'g'ridan-to'g'ri yorug'
 * fonga qo'yish kerak bo'lsa, PNG ni shaffof qilib qayta eksport qilish kerak.
 */
export function HologramFigure(): JSX.Element {
  return <Image source={images.aiHologram} style={styles.image} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  // Qolgan bo'sh joyni egallaydi — ekran hajmiga qarab kichrayadi
  image: { flex: 1, width: '100%' },
});
