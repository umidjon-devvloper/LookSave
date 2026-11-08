import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle } from 'react-native';

import { colors, spacing, text } from '../../theme/tokens';

/*
 * ⚠️ MANIKEN — AVATAR YASALMAGUNCHA ZAXIRA SURAT.
 *
 * Foydalanuvchi yangi ro'yxatdan o'tgan va avatar hali yasalmagan paytda
 * yuz surati ("selfie") kiyintirish sahnasida chiqib qolardi — bu App
 * Store sharhlovchisiga ham g'alati ko'rinardi. Buning o'rniga neytral
 * 3D-maniken ko'rsatiladi: foydalanuvchi kiyimlarni "biror narsa" ustida
 * sinab ko'rishi mumkin, ekran professional qoladi va yuklanish
 * indikatori yo'q bo'ladi.
 */
const MANNEQUIN_FALLBACK = require('../../../assets/3d-person.jpg');

/**
 * Avatar sahnasi — mijoz maketidagi ko'rinish.
 *
 * Qorong'i fon, to'r chiziqlari, gavda atrofidagi neon halqalar va chetdagi
 * o'lchov yozuvlari. Odam bularning orasida turadi.
 *
 * ⚠️ 3D EMAS, KOMPOZITSIYA. Maketdagi rasm ham 3D render emas —
 * fotorealistik surat ustiga qo'yilgan bezak. Shuni takrorlaymiz: AI
 * yasagan (yoki foydalanuvchi yuklagan) suratdan odam kesib olinadi va
 * shu sahnaga qo'yiladi.
 *
 * Bu yondashuvning ustunligi: sahna BEPUL va DARHOL chiziladi, har
 * o'zgarishda AI chaqirilmaydi.
 *
 * ⚠️ KESIM BO'LMASA HAM ISHLAYDI. `cutoutUrl` yo'q bo'lsa oddiy surat
 * ko'rsatiladi — u och kulrang fonli bo'ladi, lekin ekran buzilmaydi.
 * Kesim serverda yasaladi va u yerda nosozlik bo'lishi mumkin.
 */

export interface StageMeasurements {
  height?: number;
  weight?: number;
  waist?: number;
  shoeSize?: number;
}

export function AvatarStage({
  imageUrl,
  cutoutUrl,
  measurements,
  dimmed = false,
  showRings = true,
  zoomed = false,
  children,
}: {
  imageUrl: string | null;
  cutoutUrl?: string | null;
  measurements?: StageMeasurements;
  /** Kutish paytida surat xiralashadi */
  dimmed?: boolean;
  /** Halqalar va o'lchovlar — kiyintirish paytida chalg'itmasin uchun o'chiriladi */
  showRings?: boolean;
  /**
   * Yaqinlashtirish — kiyim tafsilotini ko'rish uchun.
   *
   * ⚠️ FAQAT SURAT KATTALASHADI, sahna emas. To'r, platforma va halqalar
   * joyida qoladi: ular o'lcham mo'ljali bo'lib xizmat qiladi va ular ham
   * kattalashsa, foydalanuvchi nimaga nisbatan yaqinlashganini yo'qotadi.
   */
  zoomed?: boolean;
  /**
   * Suratning O'RNIGA qo'yiladigan tarkib — svayp tasmasi uchun.
   *
   * ⚠️ NEGA ALMASHTIRADI, USTIGA QO'SHMAYDI. Svayp tasmasi o'zi surat
   * chizadi; ostida yana bir `<Image>` qolsa, karta qiyshayganda uning
   * chetidan eski surat ko'rinib turardi.
   *
   * Sahnaning qolgan bezagi (to'r, platforma, halqalar, o'lchovlar)
   * saqlanadi — ular tasma ustidan o'tadi va maketdagi ko'rinish
   * buzilmaydi.
   */
  children?: ReactNode;
}): JSX.Element {
  // Kesim bor bo'lsa u ustun: faqat u qorong'i fonda to'g'ri ko'rinadi
  const source = cutoutUrl ?? imageUrl;

  return (
    <View style={styles.root}>
      {/*
        ⚠️ FLOOR GLOW OLIB TASHLANDI (2026-11-01). Ilgari oyoq ostida sekin
        "nafas oladigan" binafsha nurlanish bor edi — foydalanuvchi uni
        chalg'ituvchi deb topdi. Studio foni va pastki fade yetarli.
      */}

      {children ? (
        <View
          style={[styles.swipeFrame, zoomed && styles.personFrameZoomed, dimmed && styles.dimmed]}
        >
          {children}
        </View>
      ) : source ? (
        <Image
          source={{ uri: source }}
          style={[
            styles.personFrame,
            !cutoutUrl && styles.personWithoutCutout,
            dimmed && styles.dimmed,
            zoomed && styles.personFrameZoomed,
          ]}
          resizeMode="contain"
        />
      ) : (
        <Image
          source={MANNEQUIN_FALLBACK}
          style={[styles.personFrame, dimmed && styles.dimmed, zoomed && styles.personFrameZoomed]}
          resizeMode="contain"
        />
      )}

      {/* Pastdagi yengil fade sahnani ilova foniga yumshoq ulaydi. */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(247,243,255,0.28)', 'rgba(240,234,255,0.74)']}
        locations={[0, 0.62, 1]}
        style={styles.bottomFade}
        pointerEvents="none"
      />

      {/*
        ⚠️ GAVDANI KESIB O'TGAN HALQALAR OLIB TASHLANDI (2026-09-20).
        Ilgari 34% va 56% da ikkita neon ellips gavdadan o'tardi —
        foydalanuvchi ularni «aylanachalar» deb, olib tashlashni so'radi.
        Orqa fon romkalari qoldi (podium 2026-09-25 da olib tashlandi).
      */}

      {/* O'lchovlar — maketdagi joylashuvda */}
      {showRings && measurements ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {measurements.height ? (
            <Label value={String(Math.round(measurements.height))} unit="cm" pos="topLeft" />
          ) : null}
          {measurements.weight ? (
            <Label value={String(Math.round(measurements.weight))} unit="kg" pos="midRight" />
          ) : null}
          {measurements.waist ? (
            <Label value={String(Math.round(measurements.waist))} unit="cm" pos="lowLeft" />
          ) : null}
          {measurements.shoeSize ? (
            <Label value={String(Math.round(measurements.shoeSize))} unit="EU" pos="lowRight" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const POSITIONS = {
  topLeft: { top: '10%', left: spacing.md },
  midRight: { top: '46%', right: spacing.md },
  lowLeft: { top: '68%', left: spacing.md },
  lowRight: { top: '82%', right: spacing.md },
} as const;

function Label({
  value,
  unit,
  pos,
}: {
  value: string;
  unit: string;
  pos: keyof typeof POSITIONS;
}): JSX.Element {
  return (
    <View style={[styles.label, POSITIONS[pos]]}>
      <Text style={styles.labelValue}>{value}</Text>
      <Text style={styles.labelUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * ⚠️ SOF QORA, brend foni (#0A0A0F) emas. Sahna ilova fonidan
   * SEZILARLI qorong'iroq bo'lishi kerak — aks holda ramka bilinmaydi va
   * "sahna" hissi yo'qoladi.
   */
  /*
   * ⚠️ CHETKI CHIZIQ (border) OLIB TASHLANDI (2026-09-20) — foydalanuvchi
   * so'radi. Sahna endi ilova foniga chegarasiz qo'shiladi; orqa fon
   * romkalari o'zi «sahna» hissini beradi.
   */
  root: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 0,
    overflow: 'hidden',
  },

  /*
   * ⚠️ PASTDA JOY QOLDIRILADI. Boshqaruv tugmalari sahna ostida yotiq qator
   * bo'lib turadi va odam to'liq ekranni egallasa, ular oyoq ustiga
   * tushadi. 14% — tugmalar balandligi va biroz nafas.
   */
  /*
   * ⚠️ ORQAROQ OLINDI (2026-09-20). Ilgari `top: 0, bottom: 14%` edi va
   * gavda sahnani to'ldirib, kesilgan pastki qismi podium bilan qo'shilib
   * ketardi. `top: 5%, bottom: 20%` — figura kichrayadi va yuqoriroq
   * turadi, pastda podium uchun joy qoladi.
   *
   * ⚠️ Avatar rasmlari SON sohasida kesilgan (oyoq yo'q) — bu rasm
   * cheklovi, UI emas. Orqaroq olish podium kompozitsiyasini beradi,
   * lekin haqiqiy oyoq faqat to'liq bo'yli avatar qayta yasalganda chiqadi.
   */
  personFrame: {
    position: 'absolute',
    top: '-2%',
    left: '14%',
    right: '14%',
    bottom: '12%',
  },
  personWithoutCutout: { mixBlendMode: 'multiply' } as ImageStyle,
  swipeFrame: {
    position: 'absolute',
    top: '-2%',
    left: '14%',
    right: '14%',
    bottom: '12%',
  },

  /*
   * Pastki singdirish — gavdaning kesilgan pastki qismini qorong'iga
   * eritadi. Podium shu zona ichida, uning ustida turadi.
   */
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '10%', opacity: 0.35 },
  dimmed: { opacity: 0.35 },
  /*
   * 1.45 — tajribada tanlangan. Kamrog'i sezilmaydi, ko'prog'ida bosh
   * ramkadan chiqib ketadi va kiyim o'rniga bo'yin ko'rinadi.
   * Kelib chiqish nuqtasi pastda: yaqinlashganda odam gavdaning USTKI
   * qismini ko'rmoqchi bo'ladi, oyoq emas.
   */
  personFrameZoomed: { transform: [{ scale: 1.38 }, { translateY: 34 }] },

  /*
   * ⚠️ KENGLIK GAVDAGA YAQIN. Avval 12% edi — halqa deyarli butun kadrni
   * egallab, gavdani o'ragandek emas, ustidan o'tgan katta to'rtburchakdek
   * ko'rinardi. Odam kadrning o'rtadagi ~45% ini egallaydi, halqa esa
   * undan bir oz kengroq bo'lishi kerak.
   */
  // Qorong'i sahna ustidagi o'lchov yozuvlari — cream matn, kichik italic
  label: { position: 'absolute' },
  labelValue: {
    ...text.h3,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  labelUnit: {
    ...text.tiny,
    color: colors.textMuted,
    marginTop: -2,
  },
});
