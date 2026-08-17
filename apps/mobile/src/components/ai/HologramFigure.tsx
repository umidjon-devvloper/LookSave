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
 * ⚠️ RASM FONI QORA VA SHAFFOF EMAS (`hasAlpha: no`). Shuning uchun ekran
 * foni ham sof qora qilingan — aks holda rasm atrofida to'rtburchak chekka
 * ko'rinib qoladi (brend foni `#0A0A0F`, rasmniki `#000000`). Rasmni
 * boshqa fon ustiga qo'yish kerak bo'lsa, PNG ni shaffof qilib qayta
 * eksport qilish kerak bo'ladi.
 */
export function HologramFigure(): JSX.Element {
  return <Image source={images.aiHologram} style={styles.image} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  // Qolgan bo'sh joyni egallaydi — ekran hajmiga qarab kichrayadi
  image: { flex: 1, width: '100%' },
});
