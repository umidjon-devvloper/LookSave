import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  baseForCategory,
  GARMENT_STYLES,
  type GarmentStyle,
  indexRenders,
  layerRank,
  nextPending,
  matchSize,
  recommendSize,
  renderKey,
  resolveAtFrontChain,
  resolveOutfit,
  topReady,
} from '@looksave/validation';

import {
  addFavorite,
  addToCart,
  getAvatar,
  getFavorites,
  getFullProfile,
  getGarments,
  getRenders,
  requestAvatarCutout,
  removeFavorite,
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

import { useAiFlowStore } from '../../store/aiFlowStore';
import { useAuthStore } from '../../store/authStore';
import { money } from '../../theme/format';
import { colors, fonts, radius, spacing, text } from '../../theme/tokens';
import { PhotoSwipe } from './PhotoSwipe';
import { StorePicker } from './StorePicker';
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
 * (`/ai/fitting`). Tana shu yerda, marshrutlar faqat qobiq.
 *
 * ── UCHTA QOIDA, UCHALASI HAM O'ZGARTIRILGAN ──
 *
 * 1. ⚠️ KIYIM USTIGA KIYIM. Ilgari har kiyintirish ASL suratdan
 *    boshlanardi va ekranda doim BITTA kiyim ko'rinardi: kurtka
 *    tanlansa futbolka yo'qolardi. Endi komplekt qatlam-qatlam
 *    yig'iladi (`src/ai/outfit.ts`), zanjir esa serverga `baseRenderId`
 *    bo'lib boradi.
 *
 * 2. ⚠️ TASMA OLDINDAN TAYYORLANADI. Ilgari so'rov faqat «Kiyintirish»
 *    tugmasi bosilganda ketardi — pul tejash uchun. Endi turkumdagi
 *    hamma kiyim fonda kiyintiriladi va foydalanuvchi tasmani surganda
 *    tayyor suratlarni ko'radi.
 *
 *    BU SARF QARORI: bitta turkumni ochish 30 tagacha kredit turadi.
 *    Chegara `TRYON_DAILY_LIMIT` da va unga yetilganda ekran silliq
 *    to'xtaydi (banner), xato oynasi chiqmaydi.
 *
 * 3. ⚠️ RO'YXAT DO'KON VA O'LCHAM BO'YICHA FILTRLANADI. Ilgari sehrgarda
 *    tanlangan do'kon `aiFlowStore` da yotardi va HECH QAYERDA
 *    ishlatilmasdi; o'lcham esa faqat «sizga M» yozuvi edi. Natijada
 *    foydalanuvchi boshqa do'konning, o'ziga to'g'ri kelmaydigan
 *    kiyimini kiyintirib, keyin uni sotib ololmasdi.
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

/** Tasmadagi bitta karta + oraliq — `getItemLayout` uchun. */
const STRIP_ITEM = 72 + spacing.sm;

/**
 * Kategoriya tablari — maketdagi beshtasi.
 *
 * ⚠️ SLOT EMAS, KATEGORIYA. Futbolka, xudi va ko'ylak uchalasi ham `top`
 * slotida, lekin foydalanuvchi uchun uch xil narsa.
 *
 * ⚠️ TARTIB — KO'RISH TARTIBI, KIYINISH TARTIBI EMAS. Maketda tablar shu
 * ketma-ketlikda turadi. Kiyinish tartibi esa boshqa (shim eng pastda) va
 * u `src/ai/outfit.ts` dagi `LAYER_ORDER` da — shimni kurtkadan keyin
 * kiyib bo'lmaydi.
 *
 * `slot` o'lcham tavsiyasi uchun kerak: ustki kiyim ko'krakdan, pastki
 * kiyim beldan hisoblanadi.
 */
/*
 * Uslub nomlari. Slug bazada (`products.tags`), tarjima shu yerda —
 * sotuvchi formasidagi ro'yxat bilan bir xil bo'lishi shart.
 */
const STYLE_LABEL: Record<GarmentStyle, string> = {
  casual: 'Kundalik',
  sport: 'Sport',
  streetwear: 'Streetwear',
  classic: 'Klassik',
  minimal: 'Minimal',
};

const TABS: Array<{ category: string; label: string; icon: IconName; slot: string }> = [
  { category: 'tshirt', label: 'Futbolka', icon: 'slotTop', slot: 'top' },
  { category: 'hoodie', label: 'Xudi', icon: 'slotTop', slot: 'top' },
  { category: 'jacket', label: 'Kurtka', icon: 'slotOuter', slot: 'outer' },
  { category: 'shirt', label: "Ko'ylak", icon: 'slotTop', slot: 'top' },
  { category: 'trousers', label: 'Shim', icon: 'slotBottom', slot: 'bottom' },
  /*
   * ⚠️ OYOQ KIYIMIDA TURKUM YO'Q — ATAYIN.
   *
   * Bazada beshta oyoq kiyim turkumi bor: sneakers, boots, dress-shoes,
   * sandals, shoes. Tabga bittasini qotirib qo'ysak, qolgan to'rttasi
   * ko'rinmasdi. Bo'sh `category` esa serverga faqat SLOT bo'yicha
   * filtrlashni aytadi va beshalasi ham chiqadi.
   */
  { category: '', label: 'Oyoq kiyim', icon: 'slotFeet', slot: 'feet' },
];

/** Biror natija hali kelmayotgan bo'lsa ro'yxat qayta so'raladi. */
function isWorking(renders: readonly TryonRender[] | undefined): boolean {
  return (renders ?? []).some(
    (render) => render.status === 'pending' || render.status === 'processing',
  );
}

export function FittingExperience({ showBack = false }: FittingExperienceProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';

  const [tab, setTab] = useState('tshirt');
  const [size, setSize] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  /*
   * Uslub filtri. `null` — hammasi.
   *
   * ⚠️ ILGARI SHU YERDA BESHTA CHIP BOR EDI VA ULAR HECH NARSA
   * QILMASDI: tanlovni faqat xotiraga yozardi, ro'yxat esa o'zgarmasdi.
   * Shuning uchun ular olib tashlangan edi. Endi mahsulotda uslub belgisi
   * bor (`products.tags`) va filtr serverda bajariladi.
   */
  const [styleFilter, setStyleFilter] = useState<GarmentStyle | null>(null);
  // Burchak «front» da qoladi — aylantirish tugmasi olib tashlangan
  /*
   * Ko'rish burchagi — «Yaqinlashtir» ostidagi Old/Yon/Orqa tugmalari.
   * Kiyim natijalari uch panelli varaqdan bo'linib har burchakda
   * saqlanadi (`submitDress`), ya'ni almashtirish darhol — qayta so'rovsiz.
   */
  const [angle, setAngle] = useState<AvatarAngle>('front');
  const [notice, setNotice] = useState<string | null>(null);
  const [storeOpen, setStoreOpen] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  /**
   * O'lcham filtri.
   *
   * ⚠️ O'CHIRISH IMKONI QOLDIRILGAN. Filtr sukut bo'yicha YOQIQ — oqimning
   * ma'nosi «menga mos narsalar» — lekin kichik do'konda u ro'yxatni
   * butunlay bo'shatib qo'yishi mumkin. Bunday holda foydalanuvchi boshi
   * berk ko'chaga tushmasligi kerak: yo filtrni o'chiradi, yo do'konni
   * almashtiradi. Ikkala yo'l ham bo'sh ro'yxat yonida ko'rsatiladi.
   */
  const [onlyMySize, setOnlyMySize] = useState(true);

  /**
   * Ko'rilgan kiyimlar keshi.
   *
   * ⚠️ NEGA KERAK. Komplektda beshta turkumdan kiyim bo'lishi mumkin,
   * ro'yxat esa faqat JORIY turkumni yuklaydi. Komplektning umumiy
   * narxini ko'rsatish va uni savatga qo'shish uchun boshqa
   * turkumlardagi kiyimlarning ma'lumoti ham kerak.
   *
   * Kiyim faqat ro'yxatdan tanlanadi, ya'ni tanlangan payt u albatta
   * yuklangan bo'ladi — shu payt keshga tushadi.
   */
  const [seen, setSeen] = useState<Record<string, Garment>>({});

  const stripRef = useRef<FlatList<Garment>>(null);

  const outfit = useAiFlowStore((state) => state.outfit);
  const wear = useAiFlowStore((state) => state.wear);
  const takeOff = useAiFlowStore((state) => state.takeOff);
  const storeId = useAiFlowStore((state) => state.storeId);
  const storeName = useAiFlowStore((state) => state.storeName);
  const setStore = useAiFlowStore((state) => state.setStore);

  /**
   * Kiyintirish — AI faqat shu yerdan (kiyim bosilganda) ishga tushadi.
   *
   * ⚠️ AVTOMATIK OLD BURCHAKKA O'TAMIZ (2026-09-26). AI generatsiyasi
   * faqat `angle === 'front'` da ishga tushadi (yon/orqa varaqdan
   * kesiladi, alohida kredit sarflamaslik uchun). Foydalanuvchi Yon yoki
   * Orqa burchakda turib kiyim bossa, sahna qotib qolardi: hech narsa
   * generatsiyaga ketmasdi va vizual signal ham chiqmasdi. Endi bosish
   * bilan sahna Old ga qaytadi — foydalanuvchi kiyintirish jarayonini
   * ko'radi. Tayyor bo'lgach yon/orqa ham keshda bo'ladi (server 3
   * burchakni bitta varaqdan kesadi) va tegishli tugmani bosib yana
   * yonga o'tsa bo'ladi.
   */
  const putOn = (category: string, variantId: string): void => {
    wear(category, variantId);
    setSize(null);
    setNotice(null);
    if (angle !== 'front') setAngle('front');
  };

  const remove = (category: string): void => {
    takeOff(category);
    setSize(null);
    setNotice(null);
  };

  const profile = useQuery({ queryKey: ['profile'], queryFn: getFullProfile, enabled: signedIn });
  const avatar = useQuery({
    queryKey: ['avatar'],
    queryFn: getAvatar,
    enabled: signedIn,
    refetchInterval: (query) =>
      (query.state.data as { anglePending?: string | null } | undefined)?.anglePending
        ? 3000
        : false,
  });
  const cutoutRequested = useRef(false);
  const ensureCutout = useMutation({
    mutationFn: requestAvatarCutout,
    onSuccess: (data) => queryClient.setQueryData(['avatar'], data),
  });

  useEffect(() => {
    if (cutoutRequested.current || ensureCutout.isPending) return;
    if (avatar.data?.status !== 'ready' || !avatar.data.imageUrl || avatar.data.cutoutUrl) return;
    cutoutRequested.current = true;
    ensureCutout.mutate();
  }, [avatar.data, ensureCutout]);

  const measurements = profile.data?.measurements;
  const gender = profile.data?.gender ?? null;

  /*
   * ── Sevimlilar ──
   *
   * Ro'yxat butunlay olinadi (limit 50), chunki bitta mahsulot sevimlimi
   * yoki yo'qligini so'raydigan endpoint yo'q. Ro'yxat kichik va u
   * profil ekranida ham kerak — kesh baham ko'riladi.
   */
  const favorites = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavorites,
    enabled: signedIn,
  });

  const favoriteIds = useMemo(
    () => new Set((favorites.data ?? []).map((item) => item.id)),
    [favorites.data],
  );

  const favorite = useMutation({
    mutationFn: ({ productId, on }: { productId: string; on: boolean }) =>
      on ? addFavorite(productId) : removeFavorite(productId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
    onError: () => setNotice('Sevimlilarga qo`shib bo`lmadi'),
  });

  /*
   * ⚠️ TAYYORLIK QADAMLARDAN OLDIN HISOBLANADI, chunki undan SO'ROVLAR
   * ham bog'liq. Ilgari tekshiruv shartli `return` da, hamma so'rovdan
   * KEYIN turardi: surati yo'q yangi foydalanuvchi uchun ham kiyimlar
   * yuklanardi va tasmani oldindan tayyorlash boshlanardi — server esa
   * har birini «avval avatar yasang» deb rad etardi. Foydalanuvchi
   * buni ko'rmasdi, lekin log xatoga to'lardi.
   *
   * ⚠️ DO'KON HAM SHART: kiyimlar do'konga bog'langan (aks holda
   * ro'yxat butun katalogdan kelib, komplekt bir necha do'kondan
   * yig'ilardi va uni bitta buyurtma qilib bo'lmasdi).
   */
  const hasPhoto = avatar.data?.status === 'ready' || Boolean(profile.data?.bodyPhotoUrl);
  const hasSizes =
    typeof measurements?.height === 'number' && typeof measurements?.weight === 'number';
  const ready = signedIn && hasPhoto && hasSizes && Boolean(storeId);

  const activeTab = TABS.find((item) => item.category === tab) ?? TABS[0];

  /**
   * Joriy turkum uchun tavsiya etilgan o'lcham.
   *
   * ⚠️ TAVSIYA EMAS, FILTR SIFATIDA HAM ISHLATILADI — ro'yxatga faqat
   * shu o'lchami omborda borlari kiradi (`onlyMySize`).
   */
  const fitSize = useMemo(
    () => (measurements ? recommendSize(activeTab?.slot ?? 'top', measurements) : null),
    [measurements, activeTab?.slot],
  );

  const sizeFilter = onlyMySize ? fitSize : null;

  const fetchGarments = (size: string | null) =>
    getGarments({
      // Bo'sh turkum — «faqat slot bo'yicha» degani (oyoq kiyim tabi)
      category: tab || undefined,
      slot: tab ? undefined : (activeTab?.slot ?? 'feet'),
      style: styleFilter,
      storeId,
      size,
      gender,
      limit: 30,
    });

  const garments = useQuery({
    queryKey: ['garments', tab, storeId, sizeFilter, gender, styleFilter],
    queryFn: () => fetchGarments(sizeFilter),
    enabled: ready,
  });

  /*
   * ⚠️ MOS RAZMER YO'Q — HOZIRGIDEK ISHLAYVERADI (2026-09-25, so'rovga ko'ra).
   * Do'konda mijozning razmeridagi kiyim bo'lmasa ro'yxat bo'sh qolmaydi:
   * razmersiz qayta so'raladi va hamma kiyim ko'rsatiladi, tepada esa
   * «sizning razmeringiz yo'q» izohi turadi. Kiyintirish baribir ishlaydi —
   * mijoz kiyimni o'zida ko'radi, razmerni esa mahsulot sahifasida tanlaydi.
   */
  const needFallback =
    Boolean(sizeFilter) && garments.isSuccess && (garments.data?.length ?? 0) === 0;
  const fallback = useQuery({
    queryKey: ['garments', tab, storeId, null, gender, styleFilter],
    queryFn: () => fetchGarments(null),
    enabled: ready && needFallback,
  });
  const usingFallback = needFallback && (fallback.data?.length ?? 0) > 0;

  const items = useMemo(
    () => (usingFallback ? (fallback.data ?? []) : (garments.data ?? [])),
    [usingFallback, fallback.data, garments.data],
  );
  const itemsLoading = garments.isLoading || (needFallback && fallback.isLoading);

  // Ro'yxatga tushgan har kiyim keshga yoziladi — komplekt jamlanmasi uchun
  useEffect(() => {
    if (items.length === 0) return;
    setSeen((current) => {
      const next = { ...current };
      for (const item of items) next[item.variantId] = item;
      return next;
    });
  }, [items]);

  /*
   * ── Komplekt zanjiri ──
   *
   * `scope: 'all'` — HAR asos ustidagi natija keladi. Aynan shu bilan
   * zanjir tiklanadi: qaysi qatlam qaysining ustida turgani natijalarning
   * o'zidan o'qiladi (`resolveOutfit`).
   */
  const outfitIds = useMemo(() => outfit.map((layer) => layer.variantId), [outfit]);

  const outfitRenders = useQuery({
    queryKey: ['renders', 'outfit', angle, outfitIds.join(',')],
    queryFn: () => getRenders(outfitIds, angle, null, 'all'),
    enabled: ready && outfitIds.length > 0,
    // Tayyor bo'lgan render tezroq ko'rinsin; ilovaga qaytganda ham yangilanadi
    refetchInterval: (query) => (isWorking(query.state.data as TryonRender[]) ? 1000 : false),
    refetchOnWindowFocus: true,
    // Keshdagi burchak ma'lumoti darhol ishlatilsin (almashganda tarmoq kutmaslik)
    staleTime: 30_000,
  });

  /*
   * ⚠️ FRONT ZANJIRI HAR JOYDA (2026-09-26). Server operator 3 panelli
   * varaqni chizib, qo'shimcha burchaklar (yon · orqa) yozuvlariga
   * ONA-RENDER (=FRONT so'rovda ishlatilgan) BAZASINI yozadi. Ya'ni
   * yon renderining kaliti (variantId, FRONT_base). Ilgari mobile
   * yon burchakda YON zanjirini qurardi — birinchi qatlam yon renderi
   * boshqa id oladi va keyingi qatlamlar «bu bazadagi yon» ni topa
   * olmasdi (haqiqatda ular FRONT bazasi bilan yozilgan). Endi:
   *
   * - `frontRenders` — FRONT so'rovidan olingan indeks (yon burchakda
   *   `frontFallback` dan, old burchakda `outfitRenders` dan). BAZA
   *   ZANJIRI shundan tiklanadi.
   * - `frontResolved` — komplekt FRONT zanjiri; `stripBase` shundan.
   * - `resolved` — sahna uchun. Old: bir xil chiqadi. Yon/Orqa: FRONT
   *   zanjiri yuriladi, har qatlamning shu bazadagi YON renderi
   *   izlanadi — zanjir uzilmaydi.
   */
  const frontFallback = useQuery({
    queryKey: ['renders', 'outfit', 'front-fallback', outfitIds.join(',')],
    queryFn: () => getRenders(outfitIds, 'front', null, 'all'),
    enabled: ready && angle !== 'front' && outfitIds.length > 0,
  });

  const frontRenders = useMemo(
    () =>
      indexRenders(
        angle === 'front' ? (outfitRenders.data ?? []) : (frontFallback.data ?? []),
      ),
    [angle, outfitRenders.data, frontFallback.data],
  );

  /** FRONT zanjiri — `stripBase` va yon/orqa render izlashi uchun. */
  const frontResolved = useMemo(
    () => resolveOutfit(outfit, frontRenders),
    [outfit, frontRenders],
  );

  /**
   * Yon/orqa uchun old zaxirasi — STRICTLY joriy tab qatlami.
   *
   * ⚠️ `topReady` EMAS, VA TAB QATLAMIGACHA. Ko'ylak (top layer) old
   * renderi hali kelmagan bo'lsa yoki foydalanuvchi Futbolka tabida
   * bo'lsa, ekranda faqat tabga mos qatlam ko'rinishi kerak.
   */
  const wornFront = useMemo(() => {
    if (angle === 'front') return null;
    const top = frontResolved
      .filter((layer) => layerRank(layer.category) <= layerRank(tab))
      .at(-1);
    return top?.render?.status === 'ready' ? top.render : null;
  }, [angle, frontResolved, tab]);

  /**
   * Joriy turkumdagi kiyimlar qaysi surat ustiga kiydiriladi.
   *
   * ⚠️ FRONT ZANJIRIDAN. Yon/orqa burchakda ham baza FRONT bo'ladi —
   * chunki strip so'rovi ham (variantId, FRONT_base) bilan kalitlangan
   * yon renderlarni oladi.
   */
  const stripBase = useMemo(() => baseForCategory(frontResolved, tab), [frontResolved, tab]);

  const stripIds = useMemo(() => items.map((item) => item.variantId), [items]);

  const stripRenders = useQuery({
    queryKey: ['renders', 'strip', angle, stripBase.baseRenderId, stripIds.join(',')],
    queryFn: () => getRenders(stripIds, angle, stripBase.baseRenderId),
    enabled: ready && stripIds.length > 0 && stripBase.ready,
    refetchInterval: (query) => (isWorking(query.state.data as TryonRender[]) ? 1000 : false),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  /*
   * ⚠️ QOLGAN BURCHAKLARNI OLDINDAN YUKLASH (2026-09-25). Uch burchak
   * (old · yon · orqa) bitta varaqdan keladi va bir vaqtda tayyor bo'ladi.
   * Joriy burchak yuklangach, qolgan ikkitasini keshga oldindan solamiz —
   * foydalanuvchi svayp qilganda yoki tugmani bosganda tarmoq kutilmaydi,
   * surat darhol almashadi.
   */
  useEffect(() => {
    if (!ready) return;
    /* URL keshga tushgach, o'sha kiyimning yuqori qatlami suratini
       RN kesh'iga BAYT bilan solamiz — svaypda tarmoq umuman kutilmaydi. */
    const warm = (renders: TryonRender[] | undefined): void => {
      const top = topReady(resolveOutfit(outfit, indexRenders(renders ?? [])));
      if (top?.cutoutUrl) void Image.prefetch(top.cutoutUrl);
      if (top?.imageUrl) void Image.prefetch(top.imageUrl);
    };

    for (const other of ['front', 'side', 'back'] as const) {
      if (other === angle) continue;
      if (outfitIds.length > 0) {
        const key = ['renders', 'outfit', other, outfitIds.join(',')];
        void queryClient
          .prefetchQuery({
            queryKey: key,
            queryFn: () => getRenders(outfitIds, other, null, 'all'),
            staleTime: 30_000,
          })
          .then(() => warm(queryClient.getQueryData<TryonRender[]>(key)));
      }
      if (stripIds.length > 0 && stripBase.ready) {
        void queryClient.prefetchQuery({
          queryKey: ['renders', 'strip', other, stripBase.baseRenderId, stripIds.join(',')],
          queryFn: () => getRenders(stripIds, other, stripBase.baseRenderId),
          staleTime: 30_000,
        });
      }
    }
  }, [ready, angle, outfitIds, stripIds, stripBase.ready, stripBase.baseRenderId, outfit, queryClient]);

  /*
   * ⚠️ JORIY BURCHAK SURATINI OLDINDAN YUKLASH. Varaq generatsiya
   * tugashi bilan (yoki keshdan) URL kelganda RN suratni ko'rsatishdan
   * OLDIN baytlarni yuklab qo'yamiz — shunda ekranga darhol chiqadi,
   * "sekin kelyabdi" holati yo'qoladi. Yon/orqa uchun old zaxira ham.
   */
  useEffect(() => {
    if (!ready) return;
    const top = topReady(resolveOutfit(outfit, indexRenders(outfitRenders.data ?? [])));
    if (top?.cutoutUrl) void Image.prefetch(top.cutoutUrl);
    if (top?.imageUrl) void Image.prefetch(top.imageUrl);
    const ff = topReady(resolveOutfit(outfit, indexRenders(frontFallback.data ?? [])));
    if (ff?.imageUrl) void Image.prefetch(ff.imageUrl);
  }, [ready, outfit, outfitRenders.data, frontFallback.data]);

  /**
   * Ikkala ro'yxat bitta jadvalga qo'shiladi.
   *
   * ⚠️ TARTIB MUHIM: komplekt ro'yxati OXIRIDA. Bitta kiyim ikkalasida
   * ham bo'lishi mumkin (kiyilgan kiyim o'z turkumining tasmasida ham
   * turadi) va komplekt so'rovi yangiroq — u kuzatib turiladi.
   */
  const renderIndex = useMemo(
    () => indexRenders([...(stripRenders.data ?? []), ...(outfitRenders.data ?? [])]),
    [stripRenders.data, outfitRenders.data],
  );

  /**
   * Sahna va zanjir rejasi uchun ishlatiladigan resolved.
   *
   * ⚠️ OLD BURCHAKDA: `renderIndex` (outfit + strip) ga tayanadi — bu
   * kiyim tasmadan bosilgan zahoti tepadagi sahna almashishini
   * ta'minlaydi (kartochkadagi render outfit query kelguncha kutmaydi).
   *
   * ⚠️ YON/ORQADA: FRONT zanjiri yuriladi, har qatlamning shu bazadagi
   * yon/orqa renderi izlanadi. Chunki server operator 3 panelli varaqni
   * qo'shimcha burchaklarga FRONT bazasi bilan yozadi.
   *
   * ⚠️ `nextPending` HAM shu resolved ustida ishlaydi — strip'da tayyor
   * bo'lgan renderni topsa, yangi generatsiya so'rovi yuborilmaydi.
   */
  const resolved = useMemo(() => {
    if (angle === 'front') return resolveOutfit(outfit, renderIndex);
    return resolveAtFrontChain(outfit, frontRenders, renderIndex);
  }, [angle, outfit, renderIndex, frontRenders]);

  /* ── So'rovlar ── */

  /**
   * Yuborilgan so'rovlar belgisi.
   *
   * ⚠️ `useRef` — HOLAT EMAS. Bu qiymat faqat «shuni allaqachon
   * so'raganmiz» degan xotira; holatda bo'lsa har yozuv qayta chizishni
   * keltirib chiqarardi. Va u chizishga umuman ta'sir qilmaydi.
   *
   * ⚠️ USIZ PUL SARFLANARDI. Effektlar so'rov natijalari o'zgarganda
   * qayta ishlaydi; belgisiz har kelgan javob yangi navbat yaratardi.
   */
  const asked = useRef(new Set<string>());

  /*
   * Sahnani serverdan qayta olish (o'ng-yuqoridagi «Yangilash» tugmasi).
   * Natija tayyor bo'lsa-yu ilova eski holatda qotib qolsa yoki tarmoq
   * uzilib-ulangan bo'lsa qo'l bilan yangilash uchun. Yangi generatsiya
   * BOSHLAMAYDI — faqat mavjud ma'lumotni qayta so'raydi.
   */
  const refreshScene = useCallback(() => {
    asked.current.clear();
    setNotice(null);
    void queryClient.invalidateQueries({ queryKey: ['renders'] });
    void queryClient.invalidateQueries({ queryKey: ['garments'] });
    void queryClient.invalidateQueries({ queryKey: ['avatar'] });
    void queryClient.invalidateQueries({ queryKey: ['profile'] });
  }, [queryClient]);

  const single = useMutation({
    mutationFn: (input: { variantId: string; base: string | null }) =>
      requestRender(input.variantId, angle, input.base),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['renders'] }),
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') setLimitReached(true);
      else setNotice(err instanceof ApiError ? err.message : 'Kiyintirib bo`lmadi');
    },
  });

  /*
   * ⚠️ OLDINDAN TAYYORLASH OLIB TASHLANDI (2026-09-25, so'rovga ko'ra).
   * Ilgari turkum ochilishi bilan tasmadagi birinchi kiyim o'zi
   * kiyintirilardi — mijoz hech narsa bosmasdan AI ishga tushib, kredit
   * va operator vaqti ketardi. Endi AI faqat kiyim BOSILGANDA ishlaydi
   * (`wear` → komplekt zanjiri).
   */

  /*
   * ── Komplekt zanjirini tiklash ──
   *
   * Bir vaqtda faqat BITTA qatlam so'raladi: keyingisining asosi shu
   * natija bo'ladi va uning `id` si hali mavjud emas. Natija kelishi
   * bilan effekt qaytadan ishlaydi va navbatdagisini so'raydi.
   *
   * ⚠️ SHU BILAN PASTKI QATLAM ALMASHGANDA TEPADAGILAR O'ZI TIKLANADI.
   * Foydalanuvchi futbolkani almashtirsa kurtkaning eski surati
   * yaroqsiz bo'ladi (u boshqa asos ustida edi) — `resolveOutfit` uni
   * topa olmaydi va shu yerda qaytadan so'raladi.
   */
  useEffect(() => {
    if (!ready || limitReached) return;
    /*
     * ⚠️ YON/ORQA AI'NI ISHGA TUSHIRMAYDI. Burchak tugmasi — faqat ko'rish:
     * tayyor natija bo'lsa o'sha, bo'lmasa avatarning o'sha burchagi.
     * Aks holda har bosishda yangi kiyintirish ishi (kredit) ketardi.
     */
    if (angle !== 'front') return;

    const pending = nextPending(resolved);
    if (!pending) return;

    const key = `one:${angle}:${renderKey(pending.variantId, pending.baseRenderId)}`;
    if (asked.current.has(key)) return;
    asked.current.add(key);

    // `single` bog'liqliklarda yo'q — yuqoridagi bilan bir xil sabab
    single.mutate({ variantId: pending.variantId, base: pending.baseRenderId });
  }, [ready, angle, resolved, limitReached]);

  /*
   * ⚠️ AVTOMATIK KIYINTIRISH YO'Q (2026-09-25, so'rovga ko'ra). Turkum
   * ochilganda hech narsa generatsiya qilinmaydi — AI FAQAT mijoz kiyimni
   * BOSGANDA ishlaydi (`putOn` → `wear` → komplekt zanjiri). Avatar o'zi
   * birinchi mahsulotni kiyib turadi (operator `makeAvatar`), shuning
   * uchun sahna baribir bo'sh emas.
   */

  // Tab almashganda o'lcham tanlovi tozalanadi — eski o'lcham yangi
  // kiyimda bo'lmasligi mumkin
  useEffect(() => {
    setSize(null);
    setNotice(null);
  }, [tab]);

  const cart = useMutation({
    mutationFn: async (lines: Array<{ variantId: string; chosenSize: string }>) => {
      // Ketma-ket: savat endpointi bitta qator qabul qiladi
      for (const line of lines) await addToCart(line.variantId, line.chosenSize);
      return lines.length;
    },
    onSuccess: (count) => setNotice(`${count} ta mahsulot savatga qo\`shildi`),
    onError: (err) => setNotice(err instanceof ApiError ? err.message : 'Qo`shilmadi'),
  });

  if (!signedIn) {
    return (
      <Screen>
        <SignInRequired hint="Kiyintirish avataringizga bog`langan." />
      </Screen>
    );
  }

  if (profile.isSuccess && avatar.isSuccess && !ready) {
    return <Redirect href="/ai/avatar" />;
  }

  const angles = avatar.data?.angles ?? {};
  const baseImage = angles[angle] ?? avatar.data?.imageUrl ?? profile.data?.bodyPhotoUrl ?? null;
  const baseCutout = angle === 'front' ? (avatar.data?.cutoutUrl ?? null) : null;
  const preparingCutout =
    angle === 'front' &&
    avatar.data?.status === 'ready' &&
    Boolean(avatar.data.imageUrl) &&
    !avatar.data.cutoutUrl &&
    !ensureCutout.isError;

  /**
   * Sahnada ko'rsatiladigan natija.
   *
   * ⚠️ TAB QATLAMIGACHA (2026-09-26). Foydalanuvchi Futbolka tabga
   * o'tsa-yu ustida ko'ylak/kurtka bor bo'lsa, sahnada u kiyimlar tabi
   * bilan mos kelmasdi va foydalanuvchi tanlagan futbolkasini KO'RA
   * OLMASDI. Endi sahna JORIY TAB qatlamigacha chiqadi — yuqoridagi
   * qatlamlar vaqtincha yashiriladi (komplekt buzilmaydi, faqat ko'rish
   * uchun). Tab almashilsa yuqoridagilar qaytadan ko'rinadi.
   *
   * ⚠️ NOMA'LUM TURKUM (oyoq kiyim tabining `category: ''` bo'ladi) eng
   * tepaga tushadi (`layerRank(unknown) = LAYER_ORDER.length`), ya'ni
   * oyoq kiyim tabida butun komplekt ko'rinadi.
   *
   * ⚠️ OLD VA YON/ORQADA MANTIQ HAR XIL. Old: progressive (`topReady`) —
   * kutayotgan qatlam paytida oldingi tayyor qatlam ko'rinadi.
   * Yon/Orqa: STRICTLY eng tepa qatlam — u qatlamning shu burchakdagi
   * surati yo'q bo'lsa `null` (past qatlam chiqmaydi), `wornFront`
   * old zaxirasi ishga tushadi.
   */
  const tabRank = layerRank(tab);
  const visibleResolved = useMemo(
    () => resolved.filter((layer) => layerRank(layer.category) <= tabRank),
    [resolved, tabRank],
  );
  const visibleTop = visibleResolved.at(-1);
  const worn =
    angle === 'front'
      ? topReady(visibleResolved)
      : visibleTop?.render?.status === 'ready'
        ? visibleTop.render
        : null;

  const failed = resolved.find((layer) => layer.render?.status === 'failed');

  /* ── Joriy turkumdagi tanlov ── */
  const wornHere = outfit.find((layer) => layer.category === tab)?.variantId ?? null;
  const current: Garment | undefined =
    items.find((item) => item.variantId === wornHere) ?? items[0];

  /**
   * Sahnada ko'rsatilayotgan kartaning natijasi.
   *
   * ⚠️ INDIKATOR BUTUN ZANJIRGA EMAS, SHUNGA BOG'LIQ. Ilgari «kutish»
   * belgisi zanjirda BIROR qatlam tayyor bo'lmasa chiqardi. Komplekt
   * beshta qatlamdan iborat bo'lgani va har tabga o'tishda yangisi
   * qo'shilgani uchun bu amalda «doim aylanib turadigan indikator»
   * degani edi — foydalanuvchi tayyor suratni ham xira parda ostida
   * ko'rardi.
   *
   * Endi u faqat KO'RINAYOTGAN narsa kutilayotganda chiqadi.
   */
  const shown = current
    ? renderIndex.get(renderKey(current.variantId, stripBase.baseRenderId))
    : undefined;

  /*
   * ⚠️ CHEGARA TUGAGANDA INDIKATOR CHIQMAYDI. Aks holda u abadiy
   * aylanardi: yangi so'rov yuborilmaydi, natija esa hech qachon
   * kelmaydi. Bunday holda foydalanuvchi tepadagi bannerni o'qiydi va
   * kiyimning oddiy suratini ko'radi.
   */
  /*
   * ⚠️ SPINNER FAQAT OLD KO'RINISHDA (2026-09-25). Generatsiya faqat oldda
   * bo'ladi; yon va orqa varaqdan kesib olinadi (server). Shuning uchun
   * yon/orqada «AI kiyintirmoqda» ko'rsatilmaydi — tayyor bo'lak bo'lsa
   * o'sha, bo'lmasa avatarning o'sha tomoni chiqadi, spinner emas.
   */
  const currentWorking = Boolean(
    angle === 'front' &&
    current &&
    !(limitReached && !shown) &&
    (!stripBase.ready || !shown || shown.status === 'pending' || shown.status === 'processing'),
  );

  /** Sahnadagi yagona holat — ustuvorlik: kiyintirish → sahnaga tayyorlash → xato */
  const stageStatus: { title: string; hint: string; error?: boolean } | null = currentWorking
    ? !worn
      ? {
          title: '5 daqiqada tayyor bo`ladi',
          hint: 'Kiyim ustingizga kiydirilyapti — ilovani ochiq qoldiring',
        }
      : {
          title: 'AI kiyintirmoqda…',
          hint: stripBase.ready
            ? 'Har qatlam 10–20 soniya'
            : 'Avval ostidagi qatlam tayyorlanmoqda',
        }
    : preparingCutout
      ? { title: 'Avatar sahnaga tayyorlanmoqda…', hint: 'Fon bir marta ajratiladi' }
      : failed
        ? {
            title: 'Kiyintirib bo`lmadi',
            hint: failed.render?.error ?? 'Boshqa kiyim bilan urinib ko`ring',
            error: true,
          }
        : null;

  /* Svayp burchakni almashtiradi: Old → Yon → Orqa */
  const angleIndex = Math.max(
    0,
    ANGLE_OPTIONS.findIndex((option) => option.value === angle),
  );

  /**
   * Joriy turkumning OSTIDAGI komplekt surati.
   *
   * ⚠️ ENG TEPA NATIJA EMAS. Foydalanuvchi futbolkalar tabida turganda
   * unga futbolkalar KURTKASIZ ko'rsatiladi — u aynan futbolkani
   * tanlayapti va kurtka uni bekitib turardi. Shuning uchun zaxira
   * surat ham shu qatlamning asosi bo'lishi kerak; `topReady` olinsa
   * tayyor kartada kurtkasiz, tayyor bo'lmaganida kurtkali surat
   * chiqib, tasma sakrab ketardi.
   */
  /*
   * ⚠️ SVAYP KIYIMNI EMAS, BURCHAKNI ALMASHTIRADI (2026-09-25, so'rovga
   * ko'ra). Avatarni chapga/o'ngga surib Old · Yon · Orqa ko'riladi;
   * kiyim esa pastdagi tasmadan BOSIB tanlanadi. Har karta o'sha
   * burchakdagi suratni ko'rsatadi: joriy burchakda kiyintirilgan natija,
   * qolgan burchaklarda avatarning o'sha tomoni (svayp paytida ko'rinadi,
   * qo'yib yuborilgach o'sha burchakning kiyimli natijasi yuklanadi).
   */
  const angleDeck = ANGLE_OPTIONS.map((option) => {
    if (option.value === angle) {
      const url =
        worn?.cutoutUrl ??
        worn?.imageUrl ??
        wornFront?.imageUrl ??
        angles[option.value] ??
        baseImage;
      return { key: option.value, url, resizeMode: 'contain' as const };
    }
    return {
      key: option.value,
      url: angles[option.value] ?? baseImage,
      resizeMode: 'contain' as const,
    };
  });

  /*
   * ⚠️ SERVERDAN KELADI, RO'YXATDAN QIDIRILMAYDI.
  /*
   * ⚠️ SERVERDAN KELADI, RO'YXATDAN QIDIRILMAYDI.
   *
   * Ilgari bu yerda `items.filter(productId bir xil)` turardi. Server esa
   * har mahsulotdan BITTA karta qaytaradi, ya'ni moslik hech qachon
   * topilmasdi va `colorOptions.length > 1` sharti bajarilmasdi —
   * rang tanlagich umuman chizilmasdi.
   */
  const colorOptions = current?.colors ?? [];
  const sizes = current?.sizes ?? [];
  const soldOutSizes = current?.soldOutSizes ?? [];
  const picked = size ?? matchSize(sizes, fitSize) ?? sizes[0] ?? null;

  /* ── Komplekt jamlanmasi ── */
  const outfitItems = outfit
    .map((layer) => seen[layer.variantId])
    .filter((item): item is Garment => Boolean(item));

  const outfitTotal = outfitItems.reduce((sum, item) => sum + Number(item.price), 0);
  const outfitCurrency = outfitItems[0]?.currency ?? 'UZS';

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
          <View style={styles.headerButton} />
        )}
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Kiyintirish</Text>
          {/*
            ⚠️ SARLAVHA OSTIDA DO'KON — VA U BOSILADI. Ilgari bu yerda
            «Kiyimni tanlang» degan yozuv turardi: u hech narsa
            aytmasdi va hech qayerga olib bormasdi. Do'kon esa
            foydalanuvchi ko'rayotgan ro'yxatni belgilaydi va uni
            almashtirish eng ko'p kerak bo'ladigan amal.
          */}
          <Pressable onPress={() => setStoreOpen(true)} hitSlop={8} style={styles.storeChip}>
            <Icon name="stores" size={12} color={colors.accent} />
            <Text style={styles.storeChipText} numberOfLines={1}>
              {storeName ?? "Do'kon tanlang"}
            </Text>
            <Icon name="next" size={12} color={colors.textDim} />
          </Pressable>
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

      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        {/* ── Avatar maydoni ── */}
        <View style={styles.stage}>
          <AvatarStage
            zoomed={zoomed}
            imageUrl={preparingCutout ? null : (worn?.imageUrl ?? wornFront?.imageUrl ?? baseImage)}
            cutoutUrl={worn?.cutoutUrl ?? baseCutout}
            dimmed={!worn && currentWorking}
            showRings
          >
            <PhotoSwipe
              photos={angleDeck}
              index={angleIndex}
              onIndexChange={(next) => {
                const option = ANGLE_OPTIONS[next];
                if (option) setAngle(option.value);
              }}
            />
          </AvatarStage>

          <View style={styles.sideControls} pointerEvents="box-none">
            <Control
              icon="zoom"
              label={zoomed ? 'Kichraytir' : 'Yaqinlashtir'}
              onPress={() => setZoomed((value) => !value)}
            />

            {/* Yangilash — natija/ro'yxatni serverdan qayta oladi (qulaylik uchun) */}
            <Control icon="reset" label="Yangilash" onPress={refreshScene} />

            {/* Burchak — bosilganda sahna darhol o'sha ko'rinishga almashadi */}
            <View style={styles.angleSwitch} accessibilityRole="radiogroup">
              {ANGLE_OPTIONS.map((option) => {
                const active = angle === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={option.label}
                    onPress={() => setAngle(option.value)}
                    style={[styles.angleButton, active && styles.angleButtonActive]}
                  >
                    <Text style={[styles.angleText, active && styles.angleTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Kiyilgan qatlamlar — maketdagi ko'rsatkich */}
          {resolved.length > 0 ? (
            <View style={styles.layerRail} pointerEvents="none">
              {resolved.map((layer) => (
                <View
                  key={layer.category}
                  style={[
                    styles.layerDot,
                    layer.render?.status === 'ready' && styles.layerDotReady,
                    layer.category === tab && styles.layerDotActive,
                  ]}
                />
              ))}
            </View>
          ) : null}

          {/*
            ⚠️ BITTA HOLAT KARTASI (2026-09-25). Ilgari «5 daqiqada tayyor»
            va «AI kiyintirmoqda» ALOHIDA qatlam edi va `currentWorking`
            bo'lganda IKKALASI birdan markazga chizilardi — matnlar
            ustma-ust tushib o'qib bo'lmasdi. Endi ustuvorlik bilan faqat
            bittasi, to'q karta ichida (avatar rasmi ustida ham o'qiladi).
          */}
          {stageStatus ? (
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.statusCard}>
                {stageStatus.error ? (
                  <Icon name="close" size={26} color={colors.danger} />
                ) : (
                  <ActivityIndicator size="large" color={colors.accent} />
                )}
                <Text style={styles.statusTitle}>{stageStatus.title}</Text>
                <Text style={styles.statusHint} numberOfLines={3}>
                  {stageStatus.hint}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Barcha turkumlar bitta gorizontal qatorda, qolganlari surib ko'riladi. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsWrap}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map((item) => {
            const active = tab === item.category;
            const dressed = outfit.some((layer) => layer.category === item.category);

            return (
              <Pressable
                key={item.category || item.slot}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(item.category)}
                style={[styles.tab, active && styles.tabActive]}
              >
                {active ? (
                  <LinearGradient
                    colors={['rgba(139,92,246,0.34)', 'rgba(76,42,158,0.18)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                ) : null}
                <View style={[styles.tabIcon, active && styles.tabIconActive]}>
                  <Icon
                    name={item.icon}
                    size={17}
                    color={active ? colors.accent : colors.textMuted}
                  />
                </View>
                <Text numberOfLines={1} style={[styles.tabText, active && styles.tabTextActive]}>
                  {item.label}
                </Text>
                {/* Kiyilgan turkum belgilanadi — komplekt qayerda yig'ilgani ko'rinsin */}
                {dressed ? <View style={styles.tabDressed} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {/*
        ── Uslub chiplari ──

        ⚠️ TANLANGAN KIYIMDAN TASHQARIDA TURADI. Ilgari o'lcham va rang
        `current ? (...)` ichida edi; uslubni ham o'sha yerga qo'ysak,
        bo'sh ro'yxatda chiplar yo'qolardi va foydalanuvchi o'zi qo'ygan
        filtrni BEKOR QILA OLMASDI — boshi berk ko'cha.

        Filtr serverda bajariladi: chip `queryKey` ni o'zgartiradi va
        ro'yxat qaytadan so'raladi. Qayta bosilsa — bekor bo'ladi.
      */}
        <View style={styles.styleRowWrap}>
          <View style={styles.styleRow}>
            {GARMENT_STYLES.map((item) => {
              const active = styleFilter === item;

              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Uslub: ${STYLE_LABEL[item]}`}
                  onPress={() => setStyleFilter((value) => (value === item ? null : item))}
                  style={[styles.styleChip, active && styles.styleChipActive]}
                >
                  <Text style={[styles.styleChipText, active && { color: colors.text }]}>
                    {STYLE_LABEL[item]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.bottom}>
          {limitReached ? (
            <View style={styles.banner}>
              <Icon name="clock" size={14} color={colors.warning} />
              <Text style={styles.bannerText}>
                Kunlik AI chegarasi tugadi. Tayyor suratlar qoladi, yangilari ertaga.
              </Text>
            </View>
          ) : null}

          {/* ── Kiyim tasmasi ── */}
          {usingFallback && !itemsLoading ? (
            <Text style={styles.fallbackNote}>
              Sizning {fitSize} razmeringiz bu do‘konda yo‘q — barcha kiyimlar ko‘rsatilmoqda
            </Text>
          ) : null}

          {itemsLoading ? (
            <ActivityIndicator color={colors.accent} style={styles.stripLoader} />
          ) : items.length === 0 ? (
            /*
            ⚠️ BO'SH RO'YXAT — BOSHI BERK KO'CHA EMAS. Ikkala chiqish
            yo'li ham shu yerda: filtrni bo'shatish yoki do'konni
            almashtirish. Ilgari faqat «kiyim yo'q» yozuvi turardi.
          */
            <View style={styles.emptyBox}>
              <Text style={styles.emptyStrip}>
                {styleFilter
                  ? `${STYLE_LABEL[styleFilter]} uslubidagi ${activeTab?.label.toLowerCase()} topilmadi`
                  : sizeFilter
                    ? `${storeName ?? 'Bu do‘kon'}da ${sizeFilter} o‘lchamdagi ${activeTab?.label.toLowerCase()} yo‘q`
                    : 'Bu turkumda hozircha kiyim yo`q'}
              </Text>
              <View style={styles.emptyActions}>
                {/* Uslub filtri bo'sh qilgan bo'lsa — birinchi chiqish yo'li shu */}
                {styleFilter ? (
                  <Button
                    title="Uslub filtrini olib tashlash"
                    variant="ghost"
                    onPress={() => setStyleFilter(null)}
                  />
                ) : null}
                {sizeFilter ? (
                  <Button
                    title="Barcha o`lchamlarni ko`rsat"
                    variant="ghost"
                    onPress={() => setOnlyMySize(false)}
                  />
                ) : null}
                <Button title="Boshqa do`kon tanlash" onPress={() => setStoreOpen(true)} />
              </View>
            </View>
          ) : (
            <FlatList
              ref={stripRef}
              data={items}
              keyExtractor={(item) => item.variantId}
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
                // Faqat haqiqatan KIYILGANI ajratiladi — kiyim bosilmaguncha hech biri
                const selected = item.variantId === wornHere;
                const render = renderIndex.get(renderKey(item.variantId, stripBase.baseRenderId));
                const isReady = render?.status === 'ready';
                const busy = render?.status === 'pending' || render?.status === 'processing';

                /*
                 * ⚠️ KARTOCHKADA ODAMNING O'ZI — MAKETDAGI ASOSIY FIKR.
                 * Har kartochka kiyimning yassi suratini emas, MODELNI
                 * o'sha kiyimda ko'rsatadi. Endi bu deyarli hamma
                 * kartochkada bor: tasma oldindan tayyorlanadi.
                 */
                const preview = isReady ? (render.cutoutUrl ?? render.imageUrl) : item.image;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    onPress={() => {
                      /*
                       * ⚠️ BOSISH = KIYINTIRISH. Ilgari bosish faqat
                       * tanlardi va pastda alohida «Kiyintirish» tugmasi
                       * bor edi — ya'ni natijani ko'rish uchun ikki
                       * bosish kerak edi.
                       */
                      putOn(tab, item.variantId);
                    }}
                    style={[styles.thumbWrap, selected && styles.thumbSelected]}
                  >
                    <Image
                      source={{ uri: preview ?? undefined }}
                      style={[styles.thumb, isReady && styles.thumbWorn]}
                      resizeMode={isReady ? 'contain' : 'cover'}
                    />

                    {busy ? (
                      <View style={styles.thumbBusy}>
                        <ActivityIndicator size="small" color={colors.accent} />
                      </View>
                    ) : null}

                    {isReady ? (
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
              {/*
              ── Mahsulot sarlavhasi ──

              Chapda nom, do'kon va NARX; o'ngda sevimli va ulashish.

              ⚠️ NARX YUQORIGA CHIQDI. Ilgari u faqat «Savatga» tugmasida
              ko'rinardi — ya'ni foydalanuvchi kiyimni tanlab, o'lcham
              qo'yib, pastgacha tushmaguncha narxini bilmasdi. Endi u
              tanlov bilan birga ko'rinadi.
            */}
              <View style={styles.detailsHead}>
                <View style={styles.detailsText}>
                  <Text style={styles.title} numberOfLines={1}>
                    {current.title}
                  </Text>
                  <Text style={styles.store} numberOfLines={1}>
                    {current.store.name}
                  </Text>
                  <Text style={styles.price}>{money(current.price, current.currency)}</Text>
                </View>

                <View style={styles.detailsActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      favoriteIds.has(current.productId)
                        ? 'Sevimlilardan olib tashlash'
                        : 'Sevimlilarga qo`shish'
                    }
                    accessibilityState={{ selected: favoriteIds.has(current.productId) }}
                    hitSlop={6}
                    disabled={favorite.isPending}
                    onPress={() =>
                      favorite.mutate({
                        productId: current.productId,
                        on: !favoriteIds.has(current.productId),
                      })
                    }
                    style={styles.roundButton}
                  >
                    <Icon
                      name={favoriteIds.has(current.productId) ? 'favoriteOn' : 'favorite'}
                      size={17}
                      color={favoriteIds.has(current.productId) ? colors.accent : colors.text}
                    />
                  </Pressable>

                  {/*
                  ⚠️ HAVOLA EMAS, MATN. Mahsulotning veb sahifasi hali
                  yo'q, shuning uchun soxta manzil yubormaymiz — nom,
                  do'kon va narx yuboriladi. Sahifa paydo bo'lganda shu
                  yerga havola qo'shiladi.
                */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ulashish"
                    hitSlop={6}
                    onPress={() => {
                      void Share.share({
                        message: `${current.title} — ${current.store.name}\n${money(
                          current.price,
                          current.currency,
                        )}\n\nLookSave'da ko'rdim`,
                      });
                    }}
                    style={styles.roundButton}
                  >
                    <Icon name="share" size={17} color={colors.text} />
                  </Pressable>
                </View>
              </View>

              {colorOptions.length > 1 ? (
                <>
                  <Text style={styles.label}>Rang</Text>
                  <View style={styles.colors}>
                    {colorOptions.map((option) => (
                      <Pressable
                        key={option.variantId}
                        accessibilityRole="button"
                        accessibilityLabel={`Rang: ${option.colorHex ?? 'variant'}`}
                        onPress={() => {
                          putOn(tab, option.variantId);
                        }}
                        style={[
                          styles.color,
                          option.variantId === current.variantId && styles.colorActive,
                        ]}
                      >
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: option.colorHex ?? colors.surface2 },
                          ]}
                        />
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              {sizes.length > 0 ? (
                <>
                  <View style={styles.sizeHead}>
                    <Text style={styles.label}>
                      O`lcham
                      {fitSize ? <Text style={styles.recommend}> · sizga {fitSize}</Text> : null}
                    </Text>
                    {/*
                    Filtr holati ko'rinib tursin: foydalanuvchi ro'yxat
                    nega qisqa ekanini bilishi kerak
                  */}
                    {fitSize ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setOnlyMySize((value) => !value)}
                        hitSlop={8}
                        style={[styles.filterPill, onlyMySize && styles.filterPillActive]}
                      >
                        <Icon
                          name="filter"
                          size={12}
                          color={onlyMySize ? colors.accent : colors.textDim}
                        />
                        <Text style={[styles.filterText, onlyMySize && { color: colors.accent }]}>
                          Faqat mening o`lchamim
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

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

                    {/*
                    ⚠️ TUGAGANLARI HAM KO'RSATILADI — bosib bo'lmaydi.

                    Ilgari ular ro'yxatdan shunchaki tushib qolardi va
                    foydalanuvchi «bu o'lcham umuman yo'q» deb tushunardi.
                    Ko'rsatilsa, u kutishi yoki boshqa do'konni ochishi
                    mumkin — qaror uniki bo'ladi.
                  */}
                    {soldOutSizes.map((item) => (
                      <View
                        key={`sold-${item}`}
                        accessible
                        accessibilityLabel={`${item} — tugagan`}
                        style={[styles.size, styles.sizeSoldOut]}
                      >
                        <Text style={styles.sizeSoldOutText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={styles.soldOut}>Bu mahsulot omborda tugagan</Text>
              )}

              {notice ? <Text style={styles.notice}>{notice}</Text> : null}

              {/*
              ── Komplekt ──

              ⚠️ ILGARI BU YERDA «Uslub» QATORI TURARDI. U tanlovni
              filtrlamasdi va faqat `aiFlowStore` ga yozardi — ya'ni
              ekranda hech narsani o'zgartirmaydigan beshta tugma.
              Uning o'rnida endi komplektning o'zi: nima kiyilgan,
              qancha turadi va bir bosishda savatga.
            */}
              {outfitItems.length > 0 ? (
                <View style={styles.outfitCard}>
                  <View style={styles.outfitHead}>
                    <Text style={styles.outfitTitle}>Komplekt · {outfitItems.length} ta</Text>
                    <Text style={styles.outfitTotal}>
                      {money(String(outfitTotal), outfitCurrency)}
                    </Text>
                  </View>

                  <View style={styles.outfitRow}>
                    {resolved.map((layer) => {
                      const item = seen[layer.variantId];
                      if (!item) return null;

                      return (
                        <Pressable
                          key={layer.category}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.title} — yechish`}
                          onPress={() => remove(layer.category)}
                          style={styles.outfitItem}
                        >
                          <Image source={{ uri: item.image }} style={styles.outfitThumb} />
                          <View style={styles.outfitRemove}>
                            <Icon name="close" size={9} color={colors.text} />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.actions}>
                {/*
                ⚠️ NARX ENDI TUGMADA EMAS. U yuqorida, nom ostida turadi —
                maketdagidek. Tugmada takrorlash faqat joy egallardi va
                uzun narxda yozuv ikki qatorga tushardi.
              */}
                <Button
                  title={picked ? 'Savatga qo`shish' : 'O`lcham tanlang'}
                  icon="tryon"
                  trailingIcon={picked ? 'next' : undefined}
                  pill
                  disabled={!picked || cart.isPending}
                  loading={cart.isPending}
                  onPress={() =>
                    picked && cart.mutate([{ variantId: current.variantId, chosenSize: picked }])
                  }
                />

                {/*
                Butun komplektni savatga — bir bosishda.

                ⚠️ FAQAT BIRDAN KO'P BO'LSA. Bitta kiyimda u yuqoridagi
                tugmani takrorlaydi va foydalanuvchi qaysi biri nima
                qilishini o'ylab qolardi.

                ⚠️ HAR MAHSULOTGA O'ZINING TAVSIYA O'LCHAMI. Ustki va
                pastki kiyimning o'lchami har xil hisoblanadi (ko'krak /
                bel) — birini ikkinchisiga qo'llasak, shim noto'g'ri
                o'lchamda savatga tushardi.
              */}
                {outfitItems.length > 1 ? (
                  <Button
                    title={`Butun komplektni savatga · ${money(String(outfitTotal), outfitCurrency)}`}
                    variant="ghost"
                    disabled={cart.isPending}
                    onPress={() => {
                      const lines = outfitItems
                        .map((item) => {
                          const fit = measurements ? recommendSize(item.slot, measurements) : null;
                          const chosenSize = matchSize(item.sizes, fit) ?? item.sizes[0] ?? null;
                          return chosenSize ? { variantId: item.variantId, chosenSize } : null;
                        })
                        .filter((line): line is { variantId: string; chosenSize: string } =>
                          Boolean(line),
                        );

                      if (lines.length === 0) {
                        setNotice('Komplektdagi mahsulotlar omborda tugagan');
                        return;
                      }

                      cart.mutate(lines);
                    }}
                  />
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <StorePicker
        visible={storeOpen}
        onClose={() => setStoreOpen(false)}
        selectedId={storeId}
        size={sizeFilter}
        gender={gender}
        onSelect={(store) => {
          setStore(store.id, store.name);
          setLimitReached(false);
          setNotice(null);
          /*
           * ⚠️ BELGILAR TOZALANADI. Ular «shu asos ustida shu kiyimni
           * allaqachon so'radik» degani; do'kon almashsa kiyimlar ham,
           * asoslar ham boshqa bo'ladi va eski belgilar yangi so'rovlarni
           * to'sib qo'yardi.
           */
          asked.current.clear();
        }}
      />
    </Screen>
  );
}

/** Avatar yonidagi dumaloq tugma — maketdagi uslubda. */
const ANGLE_OPTIONS: Array<{ value: AvatarAngle; label: string }> = [
  { value: 'front', label: 'Old' },
  { value: 'side', label: 'Yon' },
  { value: 'back', label: 'Orqa' },
];

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
  angleSwitch: {
    gap: 6,
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(10,10,15,0.7)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'stretch',
  },
  angleButton: {
    minWidth: 52,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  angleButtonActive: { backgroundColor: colors.primary },
  angleText: { ...text.tiny, color: colors.textMuted, fontFamily: fonts.semibold },
  angleTextActive: { color: colors.text },
  fallbackNote: {
    ...text.small,
    color: colors.warning,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: { ...text.h3, color: colors.text },

  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 200,
  },
  storeChipText: { ...text.tiny, color: colors.textMuted, flexShrink: 1 },

  /* Sahna portret nisbatida; sahifa scroll bo'lgani uchun tor ekranlarda siqilmaydi. */
  stage: {
    aspectRatio: 0.76,
    margin: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  page: { paddingBottom: spacing.xl },
  avatar: { flex: 1 },
  dimmed: { opacity: 0.35 },
  statusCard: {
    maxWidth: 280,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(10,10,15,0.82)',
  },
  statusTitle: { ...text.h3, color: colors.text, textAlign: 'center' },
  statusHint: { ...text.small, color: colors.textMuted, textAlign: 'center' },

  /* Chapdagi tik qator — maketdagi Rotate / Zoom / Reset */
  sideControls: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.lg,
    gap: spacing.lg,
  },
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
  controlBoxed: { borderRadius: radius.md, width: 46, height: 46 },
  controlDanger: { borderColor: colors.danger, backgroundColor: 'rgba(239, 68, 68, 0.12)' },
  controlBusy: { borderColor: colors.borderAccent },
  controlLabel: { ...text.tiny, color: colors.textMuted },

  /*
   * O'ngdagi qatlam ko'rsatkichi — nechta kiyim kiyilgani.
   *
   * ⚠️ RAQAM EMAS, NUQTA. Komplektda ko'pi bilan beshta qatlam bo'ladi
   * va ularni sanashdan ko'ra ko'rish tez: to'lgan nuqta — tayyor
   * qatlam, bo'shi — kelayotgani.
   */
  layerRail: {
    position: 'absolute',
    right: spacing.sm,
    top: '40%',
    gap: spacing.xs,
  },
  layerDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  layerDotReady: { backgroundColor: colors.accent, borderColor: colors.accent },
  layerDotActive: { width: 8, height: 18 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },

  /*
   * ⚠️ GORIZONTAL `ScrollView` EMAS, ODDIY `View`.
   *
   * Bu ekranda gorizontal ScrollView ichidagi MATN CHIZILMAYDI: joyni
   * egallaydi, o'lchami to'g'ri, lekin ko'rinmaydi (2026-09-14 da
   * simulyatorda o'lchangan — chipga fon berilsa fon chiqadi, yozuv yo'q).
   * Shu sabab turkum tablarining yozuvlari ham yo'qolgan.
   *
   * Beshta chip 402pt ekranga sig'adi, shuning uchun bu yerda scroll
   * kerak emas — `flexWrap` tor ekranda ikkinchi qatorga tushiradi.
   */
  /* Balandlik SHART — tablardagi bilan bir sabab (kesilish) */
  /*
   * ⚠️ FON SHART. Bu qator aylanadigan maydondan tashqarida turadi;
   * fonsiz pastdagi matn chiplar orasidan ko'rinib qoladi.
   */
  /*
   * ⚠️ IKKI QATOR ORASIDA NAFAS. Ilgari tab qatori va chip qatori
   * bir-biriga yopishib, qisilib turardi (foydalanuvchi 2026-09-20 da
   * shuni ko'rsatdi). Endi balandlik va yuqori padding kattaroq.
   */
  styleRowWrap: {
    height: 46,
    paddingTop: 6,
    marginBottom: 8,
    backgroundColor: colors.bg,
    flexShrink: 0,
  },
  styleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  /*
   * ⚠️ BALANDLIK ANIQ BERILADI, padding bilan emas. Gorizontal
   * ScrollView ichida balandligi o'lchanadigan bola yig'ilib qoladi va
   * yozuvi pastdan kesiladi — tablarda ham shu sabab `height: 34` bor.
   */
  styleChip: {
    flex: 1,
    minWidth: 0,
    height: 32,
    paddingHorizontal: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(155,150,174,0.16)',
    backgroundColor: 'rgba(20,18,28,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleChipActive: { borderColor: colors.accent, backgroundColor: colors.primarySoft },
  styleChipText: { ...text.tiny, fontSize: 10, color: colors.textMuted },
  tabsWrap: {
    height: 74,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: colors.bg,
    flexGrow: 0,
    flexShrink: 0,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 8,
  },
  /* Maketdagi pilla: ikonka va yozuv YONMA-YON, dumaloq chegara */
  tab: {
    width: 142,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(155,150,174,0.14)',
    backgroundColor: 'rgba(20,18,28,0.78)',
    overflow: 'hidden',
  },
  /*
   * ⚠️ SOYASIZ. Ilgari faol tabda nurlanish uchun `shadowRadius` bor edi;
   * fon yarim shaffof bo'lgani uchun iOS soya konturini har kadrda qayta
   * hisoblardi. Qalinroq chegara bir xil «yorqin» taassurot beradi.
   */
  tabActive: {
    borderColor: colors.accent,
    borderWidth: 1.5,
    backgroundColor: colors.surface2,
  },
  tabIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  tabIconActive: { backgroundColor: 'rgba(192,132,252,0.14)' },
  tabText: { ...text.tiny, color: colors.textMuted },
  tabTextActive: { color: colors.text, fontFamily: text.label.fontFamily },
  tabDressed: {
    position: 'absolute',
    top: 4,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
  },

  bottom: { paddingTop: spacing.xs, paddingBottom: 96 },
  stripLoader: { marginVertical: spacing.lg },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
  },
  bannerText: { ...text.tiny, color: colors.textMuted, flex: 1 },

  emptyBox: { padding: spacing.lg, gap: spacing.md },
  emptyStrip: { ...text.small, color: colors.textDim, textAlign: 'center' },
  emptyActions: { gap: spacing.sm },

  strip: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  thumbWrap: {
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbSelected: { borderColor: colors.accent },
  thumb: { width: 72, height: 92, backgroundColor: colors.surface2 },
  thumbWorn: { backgroundColor: colors.bg },
  thumbBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 10, 15, 0.55)',
  },
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

  /* ── Maketdagi mahsulot sarlavhasi ── */
  detailsHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  detailsText: { flex: 1, minWidth: 0, gap: 2 },
  price: { ...text.price, fontSize: 21, lineHeight: 27, color: colors.accent, marginTop: 3 },
  detailsActions: { flexDirection: 'row', gap: spacing.sm },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  store: { ...text.tiny, color: colors.textDim },

  label: { ...text.label, color: colors.textDim, marginTop: spacing.md },
  recommend: { ...text.tiny, color: colors.accent },

  sizeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySoft },
  filterText: { ...text.tiny, color: colors.textDim },

  colors: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  /*
   * Maketdagi halqa: tashqi chegara TANLOVNI bildiradi, ichki dumaloq —
   * rangning o'zi. Ilgari chegara rangning ustida turardi va och
   * ranglarda tanlangan-tanlanmagani bilinmasdi.
   */
  color: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  colorActive: { borderColor: colors.accent },

  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  size: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 52,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /*
   * Tugagan o'lcham — bor, lekin tanlab bo'lmaydi. Chegara punktir:
   * to'liq chiziq «tanlanadi» degani, punktir esa «bu boshqa holat».
   */
  sizeSoldOut: { borderStyle: 'dashed', opacity: 0.55 },
  sizeSoldOutText: { ...text.bodyMed, color: colors.textDim, textDecorationLine: 'line-through' },
  sizeActive: { borderColor: colors.borderAccent, backgroundColor: colors.primarySoft },
  sizeText: { ...text.bodyMed, color: colors.textMuted },

  outfitCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  outfitHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  outfitTitle: { ...text.label, color: colors.textMuted },
  outfitTotal: { ...text.bodyMed, color: colors.accent },
  outfitRow: { flexDirection: 'row', gap: spacing.sm },
  outfitItem: { position: 'relative' },
  outfitThumb: {
    width: 44,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
  },
  outfitRemove: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  soldOut: { ...text.small, color: colors.warning, marginTop: spacing.sm },
  notice: { ...text.small, color: colors.accent, marginTop: spacing.sm },
  actions: { marginTop: spacing.md, gap: spacing.sm },
});
