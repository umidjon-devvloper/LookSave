import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { nextSwipeIndex } from './swipe';

/**
 * Kiyintirilgan suratlarni svayp bilan almashtiradigan tasma.
 *
 * ⚠️ BU ILGARI three.js/expo-gl DA EDI — ENDI EMAS. Voz kechishga ikkita
 * O'LCHANGAN sabab bor, ikkalasi ham qurilmada ko'rildi:
 *
 * 1. GL JIM YIQILADI. Kontekst ochiladi, kadrlar sanaladi, jurnal toza —
 *    ekranda esa hech narsa yo'q. Buni kod ichidan aniqlab bo'lmaydi:
 *    «chizilgan piksel ekranga yetdimi» degan savolga GL javob bermaydi.
 *
 * 2. GL KESIMNI OCHA OLMAYDI. Fon olib tashlangan surat — SHAFFOF PNG.
 *    Hermes'da PNG dekoderi yo'q (`Buffer` ham, `atob` ham yo'q), ya'ni
 *    uni qo'lda yozish kerak bo'lardi. React Native `<Image>` esa PNG ni
 *    alfa kanali bilan o'zi ochadi.
 *
 * Almashtirishda hech narsa yo'qolmadi: React Native `transform` da
 * HAQIQIY `perspective` bor, ya'ni maketdagi qiyshayish o'sha-o'sha.
 * Ustiga ustak animatsiya `useNativeDriver` bilan UI oqimida ishlaydi —
 * JS band bo'lganda ham silliq qoladi, GL da bunday emas edi.
 *
 * ⚠️ SVAYP HISOBI KASR SONDA. `pan` — butun indeks emas, oraliq qiymat:
 * 1.4 degani «birinchi va ikkinchi orasida, ikkinchisiga yaqinroq».
 * Kartalarning holati shundan hisoblanadi, ya'ni barmoq harakati bilan
 * tasvir bir vaqtda siljiydi. Butun indeks bilan ishlaganda faqat qo'yib
 * yuborilgandan keyin sakrardi.
 */

export interface SwipePhoto {
  key: string;
  /** Ko'rsatiladigan surat — kesim (shaffof PNG) yoki oddiy surat */
  url: string | null;
}

interface PhotoSwipeProps {
  photos: SwipePhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Qo'shni karta markazdan qancha uzoqda turadi (ekran kengligiga nisbatan).
 *
 * ⚠️ 1 DAN KICHIK BO'LMASIN. Avval 0.82 edi — «qo'shni bir oz ko'rinib
 * tursa svayp mumkinligi bilinadi» degan mulohaza bilan. Qurilmada
 * natija boshqacha chiqdi: `resizeMode="contain"` da surat kartaning
 * MARKAZIDA turadi, ya'ni chetdan qo'shnining o'rtasi — gavdaning bir
 * bo'lagi — kesilgan to'rtburchak bo'lib qarab turadi. Buzilgandek
 * ko'rinadi.
 *
 * Svayp mumkinligi baribir bilinadi: ostidagi kiyim tasmasida joriy
 * karta belgilangan va yonida boshqalari turadi.
 */
const STEP = 1.04;

/**
 * Qiyshayish burchagi.
 *
 * ⚠️ 30° DAN OSHIRMANG. Kattaroq burchakda karta yonboshiga o'girilib,
 * yuz cho'ziladi — foydalanuvchi o'zini tanimay qoladi. Bu ekranning
 * butun maqsadi esa aynan o'zini ko'rish.
 */
const TILT = 22;

/** Perspektiva chuqurligi — kichik qiymat burishni kuchaytiradi. */
const PERSPECTIVE = 900;

/** Bir vaqtda chiziladigan kartalar: joriysi va ikki qo'shnisi. */
const WINDOW = 1;

export function PhotoSwipe({ photos, index, onIndexChange, style }: PhotoSwipeProps): JSX.Element {
  const [width, setWidth] = useState(0);

  /*
   * ⚠️ `useRef` — `useState` EMAS. Bu qiymatlar barmoq harakatida
   * o'zgaradi; holatda bo'lsa har piksel surilganda butun daraxt qayta
   * chizilardi va svayp taxta-taxta bo'lardi.
   */
  const pan = useRef(new Animated.Value(index)).current;
  const target = useRef(index);
  const viewWidth = useRef(0);
  const photosRef = useRef(photos);

  photosRef.current = photos;
  viewWidth.current = width;

  /* Tashqaridan indeks o'zgarsa (masalan tab almashsa) — o'sha yoqqa suramiz */
  useEffect(() => {
    if (target.current === index) return;
    target.current = index;
    Animated.spring(pan, { toValue: index, useNativeDriver: true, friction: 9 }).start();
  }, [index, pan]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        /*
         * ⚠️ VERTIKAL HARAKAT O'TKAZILADI. Bu tasma ostida ro'yxat bor va
         * u ham scroll qilinadi; shart bo'lmasa gorizontal svayp vertikal
         * scrollni ushlab qolardi.
         */
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),

        onPanResponderMove: (_event, gesture) => {
          const step = viewWidth.current || 1;
          pan.setValue(target.current - gesture.dx / step);
        },

        onPanResponderRelease: (_event, gesture) => {
          const step = viewWidth.current || 1;
          const next = nextSwipeIndex(
            target.current,
            gesture.dx / step,
            gesture.vx,
            photosRef.current.length,
          );

          target.current = next;
          Animated.spring(pan, { toValue: next, useNativeDriver: true, friction: 9 }).start();
          if (next !== index) onIndexChange(next);
        },

        onPanResponderTerminate: () => {
          Animated.spring(pan, {
            toValue: target.current,
            useNativeDriver: true,
            friction: 9,
          }).start();
        },
      }),
    [index, onIndexChange, pan],
  );

  return (
    <View
      style={[styles.root, style]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      {...responder.panHandlers}
    >
      {photos.map((photo, position) => {
        // Oynadan tashqaridagi kartalar umuman chizilmaydi
        if (Math.abs(position - index) > WINDOW) return null;

        /*
         * Kartaning markazdan chetlanishi. `pan` kasr bo'lgani uchun bu
         * ham kasr — barmoq harakati bilan uzluksiz o'zgaradi.
         */
        const offset = Animated.subtract(position, pan);

        return (
          <Animated.View
            key={photo.key}
            pointerEvents="none"
            style={[
              styles.card,
              {
                transform: [
                  { perspective: PERSPECTIVE },
                  {
                    translateX: offset.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [-width * STEP, 0, width * STEP],
                    }),
                  },
                  {
                    rotateY: offset.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [`${TILT}deg`, '0deg', `${-TILT}deg`],
                    }),
                  },
                  {
                    scale: offset.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [0.86, 1, 0.86],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
                /*
                 * Qo'shni karta xiralashadi — ko'z markazdagiga qaraydi.
                 * To'liq shaffof qilinmaydi: chetda nimadir turgani
                 * svayp mumkinligini ko'rsatadi.
                 */
                opacity: offset.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [0.45, 1, 0.45],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            {photo.url ? (
              <Image source={{ uri: photo.url }} style={styles.image} resizeMode="contain" />
            ) : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  /*
   * ⚠️ FON YO'Q. Kesim shaffof PNG va ostida sahna bezagi (to'r,
   * platforma, halqalar) turadi — karta o'z foni bilan kelsa ularni
   * bekitib qo'yardi.
   */
  card: { ...StyleSheet.absoluteFillObject },
  image: { flex: 1 },
});
