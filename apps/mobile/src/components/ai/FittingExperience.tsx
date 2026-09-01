import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ANGLE_LABEL,
  ANGLE_ORDER,
  addToCart,
  getAvatar,
  getFullProfile,
  getGarments,
  getRender,
  getRenders,
  requestAvatarAngle,
  requestRender,
  type AvatarAngle,
  type Garment,
  type TryonRender,
} from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { AvatarStage } from '../../components/ai/AvatarStage';
import { Icon, type IconName } from '../../components/Icon';
import { SignInRequired } from '../../components/SignInRequired';
import { Button, Screen } from '../../components/ui';
import { recommendSize } from '../../sizing';
import { STYLES, useAiFlowStore } from '../../store/aiFlowStore';
import { useAuthStore } from '../../store/authStore';
import { money } from '../../theme/format';
import { colors, radius, spacing, text } from '../../theme/tokens';
import { PhotoSwipe } from './PhotoSwipe';
import { goBack } from '../../navigation/back';

/**
 * AI kiyintirish — ekranning butun tanasi.
 *
 * Tuzilishi mijoz bergan maketdan olingan: yuqorida odam va uning yonida
 * boshqaruv, ostida kategoriya tablari, kiyim tasmasi, rang va o'lcham
 * tanlagichlari.
 *
 * ⚠️ NEGA EKRAN EMAS, KOMPONENT. Bir xil kiyintirish IKKI joydan
 * ochiladi: pastdagi «Kiyib ko'rish» tabidan va AI oqimidan
 * (`/ai/fitting`). Ilgari tab 3D sahnani ko'rsatardi va ikkalasi butunlay
 * boshqa ekran edi — bir xil ish ikki marta yozilgan, tuzatish esa faqat
 * bittasiga tushardi. Endi tana shu yerda, marshrutlar faqat qobiq.
 *
 * ⚠️ SO'ROV FAQAT TUGMA BOSILGANDA YUBORILADI. Kiyimni tanlash bepul —
 * tasmani surish, svayp qilish, rang va o'lcham tanlash hech narsa
 * turmaydi. AI faqat "Shuni kiyintir" bosilganda chaqiriladi va har
 * chaqiruv PUL turadi.
 *
 * Avtomatik yasash qulayroq ko'rinardi, lekin foydalanuvchi tasmani bir
 * marta surganda o'nlab kredit yo'qolardi.
 */

export interface FittingExperienceProps {
  /**
   * Orqaga tugmasi ko'rsatiladimi.
   *
   * Tabda ko'rsatilmaydi — u yerda orqaga qaytadigan joy yo'q, tab
   * qatorining o'zi navigatsiya. Oqimda esa kerak.
   */
  showBack?: boolean;
}

/** Kategoriya tablari — faqat AI qo'llab-quvvatlaydigan slotlar. */
/** Tasmadagi bitta karta + oraliq — `getItemLayout` uchun. */
const STRIP_ITEM = 72 + spacing.sm;

/**
 * Kategoriya tablari — maketdagi beshtasi.
 *
 * ⚠️ SLOT EMAS, KATEGORIYA. Ilgari uchta tab bor edi va ular `slot`
 * bo'yicha guruhlanardi (ustki / kurtka / pastki). Maketda esa beshta:
 * T-Shirts, Hoodies, Jackets, Shirts, Pants — bular kategoriya, slot
 * emas. Futbolka, xudi va ko'ylak uchalasi ham `top` slotida, lekin
 * foydalanuvchi uchun uch xil narsa.
 *
 * Bazada bu kategoriyalar allaqachon bor, faqat filtr slot bo'yicha
 * ketardi. Endi kategoriya bo'yicha.
 */
const TABS: Array<{ category: string; label: string; icon: IconName }> = [
  { category: 'tshirt', label: 'Futbolka', icon: 'slotTop' },
  { category: 'hoodie', label: 'Xudi', icon: 'slotTop' },
  { category: 'jacket', label: 'Kurtka', icon: 'slotOuter' },
  { category: 'shirt', label: "Ko'ylak", icon: 'slotTop' },
  { category: 'trousers', label: 'Shim', icon: 'slotBottom' },
];

export function FittingExperience({ showBack = false }: FittingExperienceProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';

  const [tab, setTab] = useState('tshirt');
  const [chosen, setChosen] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [angle, setAngle] = useState<AvatarAngle>('front');
  const [notice, setNotice] = useState<string | null>(null);

  /*
   * Kiyim tasmasining ref'i — svayp bilan bog'lash uchun.
   *
   * ⚠️ NEGA KERAK. Sahnada svayp qilinganda tanlangan kiyim o'zgaradi,
   * lekin pastdagi tasma joyida qolardi: foydalanuvchi uchinchi kiyimga
   * o'tgan bo'lsa ham tasmada birinchisi belgilangan turardi va qaysi
   * kiyim ko'rsatilayotgani bilinmasdi. Endi tasma svayp ortidan
   * suriladi.
   */
  const stripRef = useRef<FlatList<Garment>>(null);

  /* Uslub oqim bo'ylab saqlanadi — AI komplekt yasashda ishlatiladi */
  const style = useAiFlowStore((state) => state.style);
  const setStyle = useAiFlowStore((state) => state.setStyle);

  const profile = useQuery({ queryKey: ['profile'], queryFn: getFullProfile, enabled: signedIn });
  const avatar = useQuery({
    queryKey: ['avatar'],
    queryFn: getAvatar,
    enabled: signedIn,
    // Burchak yasalayotgan bo'lsa kuzatamiz, aks holda so'rov yubormaymiz
    refetchInterval: (query) =>
      (query.state.data as { anglePending?: string | null } | undefined)?.anglePending
        ? 3000
        : false,
  });

  /*
   * Aylantirish.
   *
   * ⚠️ HAR BURCHAK ALOHIDA KREDIT. Shuning uchun tugma bosilganda avval
   * KESHGA qaraladi: burchak allaqachon yasalgan bo'lsa shunchaki
   * ko'rsatiladi va hech narsa to'lanmaydi. Faqat yo'q bo'lsa so'raladi.
   */
  const rotate = useMutation({
    mutationFn: requestAvatarAngle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['avatar'] }),
    onError: (err) => setNotice(err instanceof ApiError ? err.message : 'Aylantirib bo`lmadi'),
  });

  const garments = useQuery({
    queryKey: ['garments', tab],
    queryFn: () => getGarments(undefined, undefined, tab),
  });

  const items = useMemo(() => garments.data ?? [], [garments.data]);
  const current: Garment | undefined = items.find((item) => item.variantId === chosen) ?? items[0];

  // Tab almashganda tanlov tozalanadi — eski kiyim yangi ro'yxatda yo'q
  useEffect(() => {
    setChosen(null);
    setSize(null);
    setNotice(null);
  }, [tab]);

  /*
   * Tayyor natijalar bir so'rovda olinadi. Har kiyim uchun alohida so'rov
   * yuborilsa tarmoq bo'g'ilardi va keshdagi natija kech ko'rinardi.
   */
  const renders = useQuery({
    // ⚠️ Burchak kalitda: aks holda yon ko'rinish keshi old ko'rinishniki bilan aralashardi
    queryKey: ['renders', angle, items.map((item) => item.variantId).join(',')],
    queryFn: () =>
      getRenders(
        items.map((item) => item.variantId),
        angle,
      ),
    enabled: signedIn && items.length > 0,
  });

  const byVariant = useMemo(() => {
    const map = new Map<string, TryonRender>();
    for (const render of renders.data ?? []) map.set(render.variantId, render);
    return map;
  }, [renders.data]);

  const active = current ? byVariant.get(current.variantId) : undefined;

  const tracked = useQuery({
    queryKey: ['render', active?.id],
    queryFn: () => getRender(active?.id ?? ''),
    enabled: Boolean(active?.id) && active?.status !== 'ready' && active?.status !== 'failed',
    refetchInterval: (query) => {
      const data = query.state.data as TryonRender | undefined;
      return data?.status === 'ready' || data?.status === 'failed' ? false : 2500;
    },
  });

  const shown = tracked.data?.variantId === current?.variantId ? tracked.data : active;

  const start = useMutation({
    mutationFn: (input: { variantId: string; angle: AvatarAngle }) =>
      requestRender(input.variantId, input.angle),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['renders'] }),
    onError: (err) => setNotice(err instanceof ApiError ? err.message : 'Kiyintirib bo`lmadi'),
  });

  const cart = useMutation({
    mutationFn: (input: { variantId: string; chosenSize: string }) =>
      addToCart(input.variantId, input.chosenSize),
    onSuccess: () => setNotice('Savatga qo`shildi'),
    onError: (err) => setNotice(err instanceof ApiError ? err.message : 'Qo`shilmadi'),
  });

  if (!signedIn) {
    return (
      <Screen>
        <SignInRequired hint="Kiyintirish avataringizga bog`langan." />
      </Screen>
    );
  }

  /*
   * ⚠️ TAYYORLIK IKKI QISMDAN: SURAT VA O'LCHAMLAR.
   *
   * Ilgari faqat surat tekshirilardi. Natijada o'lchamsiz foydalanuvchi
   * kiyintirishga o'tib ketardi va u yerda o'lcham tavsiyasi bo'sh
   * chiqardi — «sizga M» o'rniga hech narsa. Kiyintirishning ma'nosi esa
   * aynan O'ZIGA mos o'lchamni ko'rish.
   */
  const hasPhoto = avatar.data?.status === 'ready' || Boolean(profile.data?.bodyPhotoUrl);
  const measurements = profile.data?.measurements;
  const hasSizes =
    typeof measurements?.height === 'number' && typeof measurements?.weight === 'number';
  const ready = hasPhoto && hasSizes;

  /*
   * ⚠️ TANLOV EMAS, TO'G'RIDAN-TO'G'RI SEHRGAR. Ilgari bu yerda ikki
   * tugmali bo'sh ekran turardi («Yuzni skaner qilish» / «O'z suratimni
   * yuklash») va foydalanuvchi kiyintirishni ochib, o'rniga savol
   * oladi. Endi u to'g'ridan-to'g'ri sehrgarga tushadi: yuz skaneri,
   * so'ng o'lchamlar. Surat yuklash yo'li sehrgarning ichida qoldi.
   *
   * `Redirect` ishlatiladi, `useEffect` + `router.replace` emas: bu
   * shartli `return` lardan keyin va effektni shu yerga qo'yib
   * bo'lmasdi — hook tartibi buzilardi.
   */
  if (profile.isSuccess && avatar.isSuccess && !ready) {
    return <Redirect href="/ai/avatar" />;
  }

  /*
   * Kiyintirilgan natija HAR BURCHAKDA ko'rinadi.
   *
   * Sinovda tasdiqlandi: kiyintirish modeli yon ko'rinishda ham pozani
   * tanidi va kiyimni to'g'ri joyladi. Shuning uchun aylantirilganda
   * o'sha burchakdagi kiyingan natija ko'rsatiladi.
   *
   * ⚠️ HAR BURCHAK ALOHIDA TO'LANADI: bitta kiyimni uch burchakda ko'rish
   * uch kredit turadi. Shuning uchun ular oldindan yasalmaydi.
   */
  const angles = avatar.data?.angles ?? {};
  const baseImage = angles[angle] ?? avatar.data?.imageUrl ?? profile.data?.bodyPhotoUrl ?? null;
  const resultImage = shown?.status === 'ready' ? shown.imageUrl : null;

  /*
   * Kesimlar — sahna uchun. Ular bo'lmasligi mumkin (serverda yasashda
   * nosozlik), shunda oddiy surat ishlatiladi va ekran buzilmaydi.
   *
   * ⚠️ Burchak old ko'rinishdan boshqa bo'lsa avatar kesimi ishlatilmaydi:
   * u faqat old ko'rinish uchun yasalgan.
   */
  const baseCutout = angle === 'front' ? (avatar.data?.cutoutUrl ?? null) : null;

  /*
   * Svayp tasmasi — tabdagi HAR kiyim uchun bitta karta.
   *
   * ⚠️ TAYYOR NATIJA BO'LMASA ODAMNING ASOSIY SURATI QO'YILADI, kiyim
   * surati emas. Tasmada kiyim rasmi turgan bo'lsa svayp «kiyim
   * katalogi»ga o'xshab qolardi; bu ekranning ma'nosi esa O'ZINGNI
   * ko'rish — kiyilgani ham, kiyilmagani ham.
   */
  const deck = items.map((item) => {
    /*
     * ⚠️ IKKI MANBA, JORIYSI USTUN. `byVariant` — ro'yxat so'rovi, u
     * keshdan keladi va kechikishi mumkin. `shown` esa aynan joriy
     * kiyimni KUZATIB turgan so'rov natijasi.
     *
     * Faqat ro'yxatga tayanilsa quyidagi hol chiqadi: kiyintirish tayyor
     * bo'ladi, tugma «Savatga» ga o'zgaradi — tasmada esa hali kiyimsiz
     * surat turadi. Foydalanuvchi natijani ko'rmay turib sotib olishga
     * chaqiriladi.
     */
    const render = item.variantId === shown?.variantId ? shown : byVariant.get(item.variantId);

    /*
     * ⚠️ KESIM USTUN, ODDIY SURAT ZAXIRA.
     *
     * AI natijani DOIM och kulrang studiya foni bilan qaytaradi. Uni
     * to'g'ridan-to'g'ri qo'ysak, qorong'i sahnada och kulrang
     * to'rtburchak paydo bo'ladi va maketdagi butun taassurot buziladi —
     * neon halqalar ham, platforma ham surat ortida qolib ketadi.
     *
     * Kesim (`cutout_url`) — fondan ajratilgan shaffof PNG, server
     * `makeCutout` bilan yasaydi. Uning ostidan sahna bezagi ko'rinib
     * turadi va odam haqiqatan o'sha sahnada turgandek bo'ladi.
     *
     * ⚠️ KESIM BO'LMASLIGI MUMKIN — u BEZAK va yasashda nosozlik bo'lsa
     * `null` qoladi. Bunda oddiy surat ishlatiladi: ko'rinishi yomonroq,
     * lekin ekran ishlaydi.
     */
    if (render?.status === 'ready') {
      return { key: item.variantId, url: render.cutoutUrl ?? render.imageUrl };
    }

    return { key: item.variantId, url: baseCutout ?? baseImage };
  });

  const deckIndex = Math.max(
    0,
    items.findIndex((item) => item.variantId === current?.variantId),
  );

  /* Joriy mahsulotning boshqa ranglari — ular ro'yxatda alohida yozuv */
  const colorOptions = current ? items.filter((item) => item.productId === current.productId) : [];
  const resultCutout = shown?.status === 'ready' ? shown.cutoutUrl : null;
  const working = shown?.status === 'pending' || shown?.status === 'processing' || start.isPending;

  /*
   * ⚠️ O'LCHAM TAVSIYASI SURATDAN EMAS, HAQIQIY O'LCHOVLARDAN.
   * Yasalgan avatar taxminiy, o'lchovlar esa foydalanuvchi kiritgan aniq
   * raqamlar — shuning uchun tavsiya aniqligi avatar sifatiga bog'liq emas.
   */
  const recommended =
    current && profile.data ? recommendSize(current.slot, profile.data.measurements) : null;
  const sizes = current?.sizes ?? [];
  const picked =
    size ?? (recommended && sizes.includes(recommended) ? recommended : sizes[0]) ?? null;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Orqaga"
            hitSlop={10}
            onPress={() => goBack('/(tabs)')}
            style={styles.headerButton}
          >
            <Icon name="back" size={20} color={colors.text} />
          </Pressable>
        ) : (
          // Bo'sh joy — sarlavha o'ngdagi tugma bilan muvozanatda tursin
          <View style={styles.headerButton} />
        )}
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Kiyintirish</Text>
          <Text style={styles.headerHint}>Kiyimni tanlang</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Avatarni almashtirish"
          hitSlop={10}
          onPress={() => router.push('/ai/avatar')}
          style={styles.headerButton}
        >
          <Icon name="camera" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* ── Avatar maydoni ── */}
      <View style={styles.stage}>
        {/*
          Maketdagi sahna: qorong'i fon, to'r, neon halqalar va o'lchovlar.
          Odam kesim sifatida qo'yiladi — oddiy surat och kulrang foni bilan
          kelsa, qora ekranda to'rtburchak bo'lib ko'rinardi.
        */}
        <AvatarStage
          imageUrl={resultImage ?? baseImage}
          cutoutUrl={resultCutout ?? baseCutout}
          /*
           * ⚠️ O'LCHOV YOZUVLARI OLIB TASHLANDI. Ular sahna chekkalarida
           * turardi va CHAPDAGI boshqaruv qatoriga hamda o'ngdagi
           * «Yechish» tugmasiga tushib qoldi — raqamlar tugma yozuvlari
           * ustiga chiqib, ikkalasi ham o'qilmaydigan bo'ldi.
           *
           * Maketda ham ular yo'q. O'lchovlar profil va «O'lchamlarim»
           * ekranida bor, ya'ni hech qayerdan yo'qolmaydi.
           */
          dimmed={!resultImage && working}
          /*
           * ⚠️ HALQALAR NATIJADA HAM QOLADI. Ilgari ular kiyintirilgach
           * o'chirilardi («kiyim ko'rinsin» degan mulohaza bilan). Lekin
           * maketda odam AYNAN kiyingan holda halqalar orasida turadi —
           * ular sahnaning o'zi, chalg'ituvchi bezak emas.
           *
           * Kesim shaffof bo'lgani uchun halqalar endi odamning orqasidan
           * ham o'tadi va u haqiqatan sahnada turgandek ko'rinadi.
           */
          showRings
        >
          {/*
            Svayp tasmasi — har kiyim uchun bitta karta.

            ⚠️ TAYYOR BO'LMAGAN KARTADA ODAMNING O'ZI TURADI. Bo'sh karta
            qo'yilsa svayp «teshik»ka tushardi va foydalanuvchi nimadir
            buzilgan deb o'ylardi. Shu holda esa u o'zini ko'radi va
            «Shuni kiyintir» tugmasi kiyimni qo'shadi.
          */}
          <PhotoSwipe
            photos={deck}
            index={deckIndex}
            onIndexChange={(next) => {
              const item = items[next];
              if (!item) return;
              setChosen(item.variantId);
              setSize(null);
              setNotice(null);

              /*
               * Tasmani ergashtiramiz. `viewPosition: 0.5` — tanlangan
               * karta markazga keladi, chetga emas: chetda turgani
               * keyingisi bormi-yo'qmi bilinmaydi.
               */
              stripRef.current?.scrollToIndex({
                index: next,
                animated: true,
                viewPosition: 0.5,
              });
            }}
          />
        </AvatarStage>

        {/*
          Boshqaruv — CHAPDA TIK QATOR (maketdagidek).

          ⚠️ ILGARI PASTDA YOTIQ EDI va sahnaning eng qimmatli qismini —
          odamning oyoq-oyoq qismini — bekitib turardi. Chapda esa ular
          bo'sh joyda: odam kadrning markazida, chekkalar esa fon.
        */}
        <View style={styles.sideControls} pointerEvents="box-none">
          <Control
            icon="rotate"
            label={ANGLE_LABEL[angle]}
            busy={Boolean(avatar.data?.anglePending) || rotate.isPending}
            onPress={() => {
              const next =
                ANGLE_ORDER[(ANGLE_ORDER.indexOf(angle) + 1) % ANGLE_ORDER.length] ?? 'front';
              setAngle(next);
              setNotice(null);

              // Keshda bo'lmasa yasaymiz — bo'lsa bepul ko'rsatiladi
              if (!angles[next]) rotate.mutate(next);
            }}
          />
          <Control
            icon="zoom"
            label={zoomed ? 'Kichraytir' : 'Yaqinlashtir'}
            onPress={() => setZoomed((value) => !value)}
          />
          <Control
            icon="reset"
            label="Qayta"
            onPress={() => {
              setZoomed(false);
              setChosen(null);
              setSize(null);
              setNotice(null);
              setAngle('front');
            }}
          />
        </View>

        {/* Kiyimni yechish — o'ngda, faqat natija bo'lsa (maketdagidek) */}
        {resultImage ? (
          <View style={styles.removeSlot} pointerEvents="box-none">
            <Control icon="close" label="Yechish" onPress={() => setChosen(null)} danger boxed />
          </View>
        ) : null}

        {working ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.overlayText}>AI kiyintirmoqda…</Text>
            <Text style={styles.overlayHint}>10–20 soniya</Text>
          </View>
        ) : null}

        {shown?.status === 'failed' ? (
          <View style={styles.overlay}>
            <Icon name="close" size={26} color={colors.danger} />
            <Text style={styles.overlayText}>Kiyintirib bo`lmadi</Text>
            <Text style={styles.overlayHint} numberOfLines={2}>
              {shown.error ?? 'Boshqa kiyim bilan urinib ko`ring'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Kategoriya tablari ── */}
      {/* Beshta tab sig'maydi — surilib turadi, maketdagidek */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        style={styles.tabsWrap}
      >
        {TABS.map((item) => (
          <Pressable
            key={item.category}
            accessibilityRole="button"
            onPress={() => setTab(item.category)}
            style={[styles.tab, tab === item.category && styles.tabActive]}
          >
            <Icon
              name={item.icon}
              size={18}
              color={tab === item.category ? colors.accent : colors.textDim}
            />
            <Text style={[styles.tabText, tab === item.category && { color: colors.text }]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.bottom} showsVerticalScrollIndicator={false}>
        {/* ── Kiyim tasmasi ── */}
        {garments.isLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.stripLoader} />
        ) : items.length === 0 ? (
          <Text style={styles.emptyStrip}>Bu turkumda hozircha kiyim yo`q</Text>
        ) : (
          <FlatList
            ref={stripRef}
            data={items}
            keyExtractor={(item) => item.variantId}
            /*
             * ⚠️ `getItemLayout` SHART. Usiz `scrollToIndex` hali
             * chizilmagan elementga surilganda xato beradi — tasma uzun
             * bo'lsa `FlatList` faqat ko'rinadiganlarini chizadi.
             * Kartalar bir xil kenglikda, shuning uchun hisob oddiy.
             */
            getItemLayout={(_data, index) => ({
              length: STRIP_ITEM,
              offset: STRIP_ITEM * index,
              index,
            })}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
            removeClippedSubviews
            renderItem={({ item }) => {
              const selected = item.variantId === current?.variantId;
              const render = byVariant.get(item.variantId);
              const ready = render?.status === 'ready';

              /*
               * ⚠️ KARTOCHKADA ODAMNING O'ZI — MAKETDAGI ASOSIY FIKR.
               *
               * Maketda har kartochka kiyimning yassi suratini emas,
               * MODELNI O'SHA KIYIMDA ko'rsatadi. Ekranni «kiyim
               * katalogi»dan «o'zingni ko'rish»ga aylantiradigan narsa
               * aynan shu.
               *
               * Bizda bu ma'lumot bepul: tayyor render — aynan odamning
               * shu kiyimdagi surati. Kesimi bo'lsa u ishlatiladi
               * (qorong'i kartochkada chiroyliroq turadi).
               *
               * ⚠️ HAMMA KARTOCHKADA BO'LMAYDI. Render PUL turadi va u
               * faqat foydalanuvchi «Shuni kiyintir» bosgandan keyin
               * yasaladi. Yasalmaganlarida mahsulot surati qoladi —
               * maketdagidek to'liq emas, lekin har kartochka uchun
               * oldindan to'lash bundan yomonroq bo'lardi.
               */
              const preview = ready ? (render.cutoutUrl ?? render.imageUrl) : item.image;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  onPress={() => {
                    setChosen(item.variantId);
                    setSize(null);
                    setNotice(null);
                  }}
                  style={[styles.thumbWrap, selected && styles.thumbSelected]}
                >
                  <Image
                    source={{ uri: preview ?? undefined }}
                    style={[styles.thumb, ready && styles.thumbWorn]}
                    resizeMode={ready ? 'contain' : 'cover'}
                  />

                  {/*
                    Tayyor natija belgilanadi — foydalanuvchi bu kiyim uchun
                    qayta to'lov ketmasligini ko'rib tursin.
                  */}
                  {ready ? (
                    <View style={styles.readyBadge}>
                      <Icon name="authentic" size={10} color={colors.bg} />
                    </View>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}

        {current ? (
          <View style={styles.details}>
            <Text style={styles.title} numberOfLines={1}>
              {current.title}
            </Text>
            <Text style={styles.store} numberOfLines={1}>
              {current.store.name}
            </Text>

            {/*
              ⚠️ RANGLAR — SHU MAHSULOTNING BOSHQA VARIANTLARI.
              Ilgari bu yerda BITTA nuqta turardi: joriy variantning rangi.
              U tanlov emas edi — bosib bo'lmasdi va hech narsa
              o'zgartirmasdi.

              Aslida ranglar API'da bor, faqat alohida `Garment` yozuvlari
              bo'lib keladi (har rang — o'z variantiy). Ularni mahsulot
              bo'yicha guruhlash yetarli edi.
            */}
            {colorOptions.length > 1 ? (
              <>
                <Text style={styles.label}>Rang</Text>
                <View style={styles.colors}>
                  {colorOptions.map((option) => (
                    <Pressable
                      key={option.variantId}
                      accessibilityRole="button"
                      accessibilityLabel={`Rang: ${option.colorHex ?? option.title}`}
                      onPress={() => {
                        setChosen(option.variantId);
                        setSize(null);
                        setNotice(null);
                      }}
                      style={[
                        styles.color,
                        { backgroundColor: option.colorHex ?? colors.surface2 },
                        option.variantId === current.variantId && styles.colorActive,
                      ]}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {sizes.length > 0 ? (
              <>
                <Text style={styles.label}>
                  O`lcham
                  {recommended ? (
                    <Text style={styles.recommend}> · sizga {recommended}</Text>
                  ) : null}
                </Text>
                <View style={styles.sizes}>
                  {sizes.map((item) => (
                    <Pressable
                      key={item}
                      accessibilityRole="button"
                      onPress={() => setSize(item)}
                      style={[styles.size, picked === item && styles.sizeActive]}
                    >
                      <Text style={[styles.sizeText, picked === item && { color: colors.text }]}>
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.soldOut}>Bu mahsulot omborda tugagan</Text>
            )}

            {/*
              Uslub — maketdagi Style qatori.

              ⚠️ U TANLOVNI FILTRLAMAYDI, BALKI SAQLAYDI. Ro'yxat
              `aiFlowStore` da va AI komplekt yasashda ishlatiladi
              (`ai/index.tsx` oqimi). Bu yerda ko'rsatilishining sababi:
              foydalanuvchi kiyim tanlayotgan payt uslub haqida
              o'ylaydi — uni alohida ekranga yashirish oqimni uzardi.
            */}
            <Text style={styles.label}>Uslub</Text>
            <View style={styles.styles}>
              {STYLES.map((name) => (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  onPress={() => setStyle(name)}
                  style={[styles.stylePill, style === name && styles.stylePillActive]}
                >
                  <Text style={[styles.styleText, style === name && { color: colors.text }]}>
                    {name}
                  </Text>
                </Pressable>
              ))}
            </View>

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <View style={styles.actions}>
              {resultImage ? (
                <Button
                  title={
                    picked
                      ? `Davom etish · ${money(current.price, current.currency)}`
                      : 'O`lcham tanlang'
                  }
                  disabled={!picked || cart.isPending}
                  loading={cart.isPending}
                  onPress={() =>
                    picked && cart.mutate({ variantId: current.variantId, chosenSize: picked })
                  }
                />
              ) : (
                <Button
                  title="Kiyintirish →"
                  loading={working}
                  onPress={() => {
                    setNotice(null);
                    start.mutate({ variantId: current.variantId, angle });
                  }}
                />
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/** Avatar yonidagi dumaloq tugma — maketdagi uslubda. */
function Control({
  icon,
  label,
  onPress,
  danger = false,
  busy = false,
  boxed = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  /** Ish ketayotganda tugma bloklanadi — takroriy bosish kredit yeydi */
  busy?: boolean;
  /** To'rtburchak ramka — maketdagi «Remove Clothing» uslubi */
  boxed?: boolean;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={busy}
      style={styles.control}
    >
      <View
        style={[
          styles.controlIcon,
          boxed && styles.controlBoxed,
          danger && styles.controlDanger,
          busy && styles.controlBusy,
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Icon name={icon} size={16} color={danger ? colors.danger : colors.text} />
        )}
      </View>
      <Text style={[styles.controlLabel, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: { ...text.h3, color: colors.text },
  headerHint: { ...text.tiny, color: colors.textDim },

  /*
   * ⚠️ BALANDLIK NISBAT BILAN, `flex: 1` BILAN EMAS.
   *
   * `flex: 1` da sahna pastdagi ro'yxat bilan bo'sh joyni bo'lishardi va
   * kontent ko'paygan sari kichrayib borardi — skrinshotda odam kichkina
   * bo'lib, atrofida katta qora chekka qolgan edi.
   *
   * 3:4 — avatar suratining o'z nisbati, ya'ni rasm ramkani to'liq
   * to'ldiradi va chekka qolmaydi.
   */
  stage: {
    /*
     * ⚠️ BALANDLIK NISBAT BILAN EMAS, ULUSH BILAN.
     *
     * Ilgari `aspectRatio: 3/4` edi — surat ramkani to'liq to'ldirsin
     * degan mulohaza bilan. Qurilmada natija boshqacha chiqdi: 402pt
     * kenglikda sahna 493pt balandlik olib, ekranning 56% ini egalladi.
     * Sarlavha, tablar va pastki panel qolganini yeb, kiyim tasmasi,
     * rang, o'lcham va uslub qatorlari uchun ~140pt qoldi — ular
     * ko'rinmay qoldi va foydalanuvchi ularni topish uchun scroll
     * qilishi kerak edi.
     *
     * Maketda sahna ekranning uchdan biri, qolgani tanlov uchun.
     * 44% shu nisbatni beradi va kesim baribir to'liq sig'adi
     * (`resizeMode="contain"`).
     */
    height: '44%',
    margin: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { flex: 1 },
  // Kutish paytida asl surat xiralashadi — natija bilan chalkashmasin
  dimmed: { opacity: 0.35 },

  /*
   * ⚠️ TIK EMAS, YOTIQ QATOR. Ilgari tugmalar ustma-ust turardi va
   * uchinchisi ramkadan chiqib ketib kesilardi. Pastda yotiq qator esa
   * sahna balandligiga bog'liq emas.
   */
  /* Chapdagi tik qator — maketdagi Rotate / Zoom / Reset */
  sideControls: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.lg,
    gap: spacing.lg,
  },
  /* O'ngdagi «Yechish» — maketdagi Remove Clothing */
  removeSlot: { position: 'absolute', right: spacing.sm, top: '38%' },
  control: { alignItems: 'center', gap: 2 },
  controlIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10, 10, 15, 0.72)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* To'rtburchak ramka — dumaloq emas (maketdagi Remove Clothing) */
  controlBoxed: { borderRadius: radius.md, width: 46, height: 46 },
  controlDanger: { borderColor: colors.danger, backgroundColor: 'rgba(239, 68, 68, 0.12)' },
  controlBusy: { borderColor: colors.borderAccent },
  controlLabel: { ...text.tiny, color: colors.textMuted },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  overlayText: { ...text.bodyMed, color: colors.text, textAlign: 'center' },
  overlayHint: { ...text.tiny, color: colors.textDim, textAlign: 'center' },

  /*
   * ⚠️ BESHTA TAB SIG'MAYDI — SCROLL KERAK. Uchtasida `flex: 1` bilan
   * bo'linardi; beshtada yozuvlar qisqarib o'qilmay qolardi. Maketda ham
   * tablar surilib turadi (oxirgisi yarim ko'rinadi).
   */
  tabsWrap: { flexGrow: 0 },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm },
  tab: {
    minWidth: 76,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySoft },
  tabText: { ...text.tiny, color: colors.textDim },

  bottom: { paddingBottom: spacing.xl },
  stripLoader: { marginVertical: spacing.lg },
  emptyStrip: { ...text.small, color: colors.textDim, textAlign: 'center', padding: spacing.lg },

  strip: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  thumbWrap: {
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbSelected: { borderColor: colors.accent },
  thumb: { width: 72, height: 92, backgroundColor: colors.surface2 },
  /*
   * Kiyilgan natija — qorong'i fon. Kesim shaffof bo'lgani uchun ostidan
   * shu rang ko'rinadi va kartochka sahnaning davomidek turadi.
   */
  thumbWorn: { backgroundColor: colors.bg },
  readyBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },

  details: { paddingHorizontal: spacing.md, gap: spacing.xs },
  title: { ...text.h3, color: colors.text },
  store: { ...text.tiny, color: colors.textDim },

  label: { ...text.label, color: colors.textDim, marginTop: spacing.md },
  recommend: { ...text.tiny, color: colors.accent },

  colors: { flexDirection: 'row', gap: spacing.sm },
  color: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  colorActive: { borderColor: colors.accent, borderWidth: 3 },

  styles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stylePill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stylePillActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySoft },
  styleText: { ...text.tiny, color: colors.textDim },

  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  size: {
    minWidth: 52,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  sizeActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySoft },
  sizeText: { ...text.bodyMed, color: colors.textMuted },

  soldOut: { ...text.small, color: colors.warning, marginTop: spacing.sm },
  notice: { ...text.small, color: colors.accent, marginTop: spacing.sm },
  actions: { marginTop: spacing.md },
});
