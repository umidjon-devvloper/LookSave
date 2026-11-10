import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
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
  requestBundleRender,
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

const FEMALE_TRYON_BACKGROUND = require('../../../assets/tryon-boutique-female-v1.png');
const MALE_TRYON_BACKGROUND = require('../../../assets/tryon-boutique-male-v1.png');
/** Hero fon cho'zilish diapazoni — Home ekrani kabi: 560 px */
const TRYON_HERO_STRETCH = 560;
/*
 * Hero fon rasmi balandligi — Scroll'dan tashqarida qotirilgan (`tryonHeroFixed`).
 * Ekran balandligining ~95%'i: avatar sahnasi + maniken tag qismigacha butun
 * fon rasm bilan qoplanadi. Ilgari 72% edi — manikenning oyoq qismi fon rasm
 * chegarasidan pastda qolib, oq fon ko'rinib qolar edi.
 */
const TRYON_HERO_HEIGHT = Math.round(Dimensions.get('window').height * 0.85);

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
const STRIP_ITEM = 76 + 10;

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
  // «Hammasi» — birinchi tab, do'kondagi barcha AI-mos kiyimlar bir ro'yxatda.
  // Bo'sh category + bo'sh slot: backend `AI_TRYON_SLOTS` ni ishlatadi, hamma
  // kiyim qaytadi. recommendSize uchun ham slot kerak emas — bu tab tanlanganda
  // mos-o'lcham filtri qo'llanmaydi, barcha narsa ko'rinadi.
  { category: 'all', label: 'Hammasi', icon: 'tryon', slot: '' },
  // Ustki kiyimlar — sotuvchi formasidagi barcha variantlar
  { category: 'tshirt', label: 'Futbolka', icon: 'slotTop', slot: 'top' },
  { category: 'hoodie', label: 'Hoody', icon: 'slotTop', slot: 'top' },
  { category: 'sweater', label: 'Sviter', icon: 'slotTop', slot: 'top' },
  { category: 'shirt', label: "Ko'ylak", icon: 'slotTop', slot: 'top' },
  // Tashqi — alohida qatlam, komplekt tepasiga tushadi
  { category: 'jacket', label: 'Kurtka', icon: 'slotOuter', slot: 'outer' },
  { category: 'coat', label: 'Palto', icon: 'slotOuter', slot: 'outer' },
  // Pastki — bel o'lchamidan filtrlanadi
  { category: 'trousers', label: 'Shim', icon: 'slotBottom', slot: 'bottom' },
  { category: 'jeans', label: 'Jinsi', icon: 'slotBottom', slot: 'bottom' },
  { category: 'shorts', label: 'Shorti', icon: 'slotBottom', slot: 'bottom' },
  { category: 'skirt', label: 'Yubka', icon: 'slotBottom', slot: 'bottom' },
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

/** Ready rasm yozilgach, server shaffof kesimni biroz keyin ulaydi. */
function needsRenderRefresh(renders: readonly TryonRender[] | undefined): boolean {
  return (renders ?? []).some(
    (render) =>
      render.status === 'pending' ||
      render.status === 'processing' ||
      (render.status === 'ready' && Boolean(render.imageUrl) && !render.cutoutUrl),
  );
}

export function FittingExperience({ showBack = false }: FittingExperienceProps): JSX.Element {
  const insets = useSafeAreaInsets();
  // Pastga tortilganda hero fon rasmini "rezinkadek" cho'zish uchun
  const scrollY = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';
  // Demo (Apple App Review) akkaunt — yon/orqa tugmalari yashirin
  const currentPhone = useAuthStore((state) => state.user?.phone ?? '');
  const isDemoAccount = currentPhone === '+998900007777';

  const [tab, setTab] = useState('all');
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
  const [styleFilter, setStyleFilter] = useState<GarmentStyle | null>('sport');
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
  /*
   * «Almashtir» rejimi — Look ichida vaqtincha katalog ochish uchun.
   * Look saqlanib turadi (lookFilter o'zgarmaydi), lekin strip katalogdan
   * tanlash imkonini beradi. Mijoz yangi variant bossa — wear() slotni
   * almashtiradi, outfit yangilanadi, lookFilter ham sinxronlanadi va
   * rejim o'z-o'zidan chiqadi.
   */
  const [browseMode, setBrowseMode] = useState(false);

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

  /*
   * ⚠️ BUNDLE TANLOV (2026-11-10). Foydalanuvchi bir nechta kiyimni
   * (futbolka + shim + krossovka) tanlab, hammasini birgalikda kiyintirish
   * uchun. Karta burchagidagi checkbox bilan ishlaydi. Oddiy tap hali ham
   * BITTA kiyimni darhol kiyintiradi — bu Flow buzilmaydi.
   */
  const [bundleSelection, setBundleSelection] = useState<Set<string>>(() => new Set());
  const toggleBundleItem = useCallback((item: Garment): void => {
    // Keshga ham qo'shamiz — bundle yig'ilganda item ma'lumotlari kerak
    setSeen((prev) => (prev[item.variantId] ? prev : { ...prev, [item.variantId]: item }));
    setBundleSelection((prev) => {
      const next = new Set(prev);
      if (next.has(item.variantId)) next.delete(item.variantId);
      else next.add(item.variantId);
      return next;
    });
  }, []);

  const stripRef = useRef<FlatList<Garment>>(null);

  const outfit = useAiFlowStore((state) => state.outfit);
  const wear = useAiFlowStore((state) => state.wear);
  const takeOff = useAiFlowStore((state) => state.takeOff);
  const storeId = useAiFlowStore((state) => state.storeId);
  const storeName = useAiFlowStore((state) => state.storeName);
  const setStore = useAiFlowStore((state) => state.setStore);
  /*
   * ⚠️ "LOOK REJIMI" (2026-11-05). Foydalanuvchi saqlangan Look'ni bosib
   * kiyintirishga kirsa, tasmada FAQAT shu kiyimlar ko'rinadi — butun
   * katalog emas. "Boshqa kiyim tanlash" bossa filtr tozalanadi va
   * katalog ochiladi. Tab orqali (`showBack === false`) kirsa — Look
   * rejimi avtomatik tozalanadi.
   */
  const lookFilter = useAiFlowStore((state) => state.lookFilter);
  const setLookFilter = useAiFlowStore((state) => state.setLookFilter);

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
    /*
     * ⚠️ FAQAT BITTA KIYIM (2026-11-09, so'rovga ko'ra).
     *
     * Komplekt yig'ish olib tashlandi — har bosilgan kiyim asl avatar
     * ustiga yagona qatlam bo'lib kiyiladi. Foydalanuvchi svayp qilib
     * boshqa kiyimlarni erkin sinab ko'rsin. Komplekt yig'ish kerak
     * bo'lsa — Look rejimi orqali bo'ladi (alohida oqim).
     */
    for (const layer of outfit) {
      if (layer.category !== category) {
        takeOff(layer.category);
      }
    }
    wear(category, variantId);
    setSize(null);
    setNotice(null);
    if (angle !== 'front') setAngle('front');
    /*
     * ⚠️ "ALMASHTIR" REJIMIDAN AVTOMATIK CHIQISH (2026-11-05).
     * Mijoz Look ichidan almashtirish uchun katalog ochgan edi: yangi
     * variant bosilganda rejim yopiladi va Look qayta aktivlashadi —
     * lookFilter'ga YANGI variantni qo'shamiz, eskisi o'sha slotdan
     * chiqqani uchun ularni outfit'dan olib sinxronlaymiz.
     */
    if (browseMode && lookFilter) {
      const next = Array.from(
        new Set([...outfit.map((l) => l.variantId), variantId]),
      );
      setLookFilter(next);
      setBrowseMode(false);
    }
  };

  const remove = (category: string): void => {
    takeOff(category);
    setSize(null);
    setNotice(null);
  };

  /*
   * ⚠️ BUNDLE KIYINTIRISH (2026-11-10). Checkbox orqali tanlangan kiyimlar
   * ONE-CALL bilan backend'ga yuboriladi — bitta GPT chaqiruvi, bitta
   * mannequin, hamma kiyim bir rasmda. Server har variant uchun bir xil
   * result_url yozadi, shuning uchun outfit'ga wear() ham qilamiz va
   * mavjud `useEffect` chain ishga tushmasligi uchun BIRON BIR narsa
   * qilmaydi (chunki hamma qatorlar darhol pending→processing bo'ladi).
   */
  const putOnBundle = (variantIds: string[]): void => {
    // Avval eski outfit tozalanadi, keyin yangi qatlamlar qo'yiladi
    for (const layer of outfit) takeOff(layer.category);
    for (const id of variantIds) {
      const item = seen[id];
      if (!item) continue;
      wear(item.slot, item.variantId);
    }
    setBundleSelection(new Set());
    setSize(null);
    setNotice('Komplekt yuborildi — AI hammasini birgalikda kiyintiryapti…');
    if (angle !== 'front') setAngle('front');

    // ONE-CALL backend chaqiruv
    void (async () => {
      try {
        await requestBundleRender(variantIds, 'front');
        void queryClient.invalidateQueries({ queryKey: ['renders'] });
      } catch (err) {
        if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
          setLimitReached(true);
        } else {
          setNotice(err instanceof ApiError ? err.message : 'Komplekt kiyintirib bo`lmadi');
        }
      }
    })();
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
  // Avatar yaratishda tanlangan jins primerka sahnasining butik fonini ham belgilaydi.
  const tryonBackground = gender === 'male' ? MALE_TRYON_BACKGROUND : FEMALE_TRYON_BACKGROUND;

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
      // «all» — na category, na slot: backend sukutdagi `AI_TRYON_SLOTS` bilan
      // har bir slotdan kiyim qaytaradi. Bo'sh category (`''`) esa «faqat
      // slot bo'yicha» (oyoq kiyim tabi): kategoriya yo'q, lekin slot bor.
      category: tab && tab !== 'all' ? tab : undefined,
      slot: tab ? undefined : (activeTab?.slot ?? 'feet'),
      style: styleFilter,
      storeId,
      size,
      gender,
      limit: 30,
    });

  /*
   * ⚠️ LOOK REJIMIDA: tasmada faqat o'sha Look'dagi kiyimlar. Boshqa
   * filtrlar (tab, do'kon, uslub, o'lcham) e'tiborga olinmaydi — mijoz
   * aynan shu komplektni ko'rish uchun kirdi. Katalogga chiqish esa pastdagi
   * "Boshqa kiyim tanlash" tugmasi orqali (filtrni tozalaydi).
   */
  // Look mode DB-filter aktiv — faqat lookFilter bor va browseMode o'chik bo'lsa
  const inLookMode = (lookFilter?.length ?? 0) > 0 && !browseMode;
  // Banner ko'rinishi (Almashtir rejimida ham ko'rinadi, shunchaki strip katalogdan kelmoqda)
  const lookPinned = (lookFilter?.length ?? 0) > 0;

  const garments = useQuery({
    queryKey: inLookMode
      ? ['garments', 'look-mode', (lookFilter ?? []).join(',')]
      : ['garments', tab, storeId, sizeFilter, gender, styleFilter],
    queryFn: () =>
      inLookMode ? getGarments({ variantIds: lookFilter ?? [] }) : fetchGarments(sizeFilter),
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
    !inLookMode &&
    Boolean(sizeFilter) &&
    garments.isSuccess &&
    (garments.data?.length ?? 0) === 0;
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
   * ⚠️ OUTFIT SINXRONLASHI (2026-11-05).
   *
   * Ikki ish bir useEffectda:
   *
   * 1) Home'dan qo'shilgan `pick:<productId>` qatlamlarini haqiqiy slot va
   *    variantId'ga aylantirish. Home ekranidagi "Look" tugmasi mahsulot
   *    ID bilan qo'shadi (variant noma'lum). Backend garments so'roviga
   *    productId'ni ham qabul qiladi va shu mahsulotning default variantini
   *    qaytaradi — shu yerda uni real slotga ko'chiramiz.
   *
   * 2) O'chirilgan variantlarni komplektdan olib tashlash — do'kondan
   *    o'chirilgan narsa qaytmasa, "AI kiyintirmoqda…" abadiy aylanardi.
   */
  useEffect(() => {
    if (!inLookMode || itemsLoading || !garments.isSuccess) return;

    const byProduct = new Map<string, typeof items[number]>();
    const availableVariants = new Set<string>();
    for (const it of items) {
      availableVariants.add(it.variantId);
      // Har mahsulotning birinchi variantini olamiz (default)
      if (!byProduct.has(it.productId)) byProduct.set(it.productId, it);
    }

    // 1) pick:* → haqiqiy slot. Bir nechta mahsulot bir slotda bo'lsa,
    //    birinchisigina kiyiladi; qolgan pick:* layerlari olib tashlanadi
    //    (strip baribir backend'dan hamma mahsulotning variantlarini
    //    ko'rsatadi, chunki lookFilter o'zgarmagan). Tasmadan boshqa
    //    variant tanlasa — "Almashtir" oqimi ishga tushadi.
    const slotsFilled = new Set(
      outfit.filter((l) => !l.category.startsWith('pick:')).map((l) => l.category),
    );
    const picks = outfit.filter((l) => l.category.startsWith('pick:'));
    for (const layer of picks) {
      const match = byProduct.get(layer.variantId); // variantId = productId
      if (!match) {
        // Mahsulot DB'da yo'q — pick:* ni olib tashlab yuboramiz
        takeOff(layer.category);
        continue;
      }
      takeOff(layer.category);
      if (!slotsFilled.has(match.slot)) {
        wear(match.slot, match.variantId);
        slotsFilled.add(match.slot);
      }
    }

    // 2) Qatlamda bor, lekin katalogda yo'q — o'chirilgan
    const toRemove = outfit.filter(
      (l) => !l.category.startsWith('pick:') && !availableVariants.has(l.variantId),
    );
    toRemove.forEach((l) => takeOff(l.category));
  }, [inLookMode, itemsLoading, garments.isSuccess, items, outfit, takeOff, wear]);

  /*
   * ⚠️ CROSS-STORE LOOK — YIG'ILGAN KIYIM DO'KONIDAN QAT'I NAZAR KO'RINSIN
   * (2026-11-04).
   *
   * Ilgari `seen` faqat joriy do'konning ro'yxatidan to'ldirilardi: boshqa
   * do'kondan "Look" bosilgan kiyim komplekt qatoriga umuman tushmasdi va
   * foydalanuvchi uni yecha olmasdi.
   *
   * Endi outfit ichidagi `seen` da bo'lmagan ID'lar bitta so'rov bilan
   * tortiladi — natijada chip qatorida turli do'kon kiyimlari ham chiqadi.
   */
  const missingOutfitIds = useMemo(
    () => outfit.map((layer) => layer.variantId).filter((id) => !seen[id]),
    [outfit, seen],
  );
  const missingGarments = useQuery({
    queryKey: ['garments', 'outfit', missingOutfitIds.join(',')],
    queryFn: () => getGarments({ variantIds: missingOutfitIds }),
    enabled: missingOutfitIds.length > 0,
  });
  useEffect(() => {
    const extras = missingGarments.data;
    if (!extras || extras.length === 0) return;
    setSeen((current) => {
      const next = { ...current };
      for (const item of extras) next[item.variantId] = item;
      return next;
    });
  }, [missingGarments.data]);

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
    refetchInterval: (query) =>
      needsRenderRefresh(query.state.data as TryonRender[]) ? 1500 : false,
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
    refetchInterval: (query) =>
      needsRenderRefresh(query.state.data as TryonRender[]) ? 1500 : false,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  /**
   * HAR qanday base ustidagi renderlarni oladi — faqat aniq (variantId+base)
   * emas, variantId uchun mavjud BARCHASI.
   *
   * ⚠️ NEGA (2026-11-09, so'rovga ko'ra): foydalanuvchi oldin kiyintirgan
   * kiyimni qayta bosganda u YANA navbatga ketardi, chunki stripBase
   * o'zgargan bo'lishi mumkin (masalan boshqa kiyim bosilgandan keyin).
   * Server allaqachon tayyor renderni keshdan qaytaradi, lekin mijoz tomoni
   * uni "topa olmay" qayta mutatsiya yuborardi — ekranda "generating..."
   * ko'rinardi. Endi avval HAR qanday render borligini tekshiramiz.
   */
  const anyStripRenders = useQuery({
    queryKey: ['renders', 'strip-any', angle, stripIds.join(',')],
    queryFn: () => getRenders(stripIds, angle, null, 'all'),
    enabled: ready && stripIds.length > 0,
    refetchInterval: (query) =>
      needsRenderRefresh(query.state.data as TryonRender[]) ? 1500 : false,
    staleTime: 30_000,
  });

  /** variantId → eng yangi tayyor render (har qanday base) */
  const anyRenderByVariant = useMemo(() => {
    const map = new Map<string, TryonRender>();
    for (const render of anyStripRenders.data ?? []) {
      if (render.status !== 'ready') continue;
      const existing = map.get(render.variantId);
      // `getRenders` created_at DESC — birinchisi eng yangisi
      if (!existing) map.set(render.variantId, render);
    }
    return map;
  }, [anyStripRenders.data]);

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

  /*
   * ⚠️ STRIP TAYYOR RENDERLARINI OLDINDAN YUKLASH (2026-11-09).
   *
   * Thumbnail bosilganda sahnada rasm darhol almashsin — foydalanuvchi
   * svayp qilib tez-tez boshqa manikenlarni ko'rmoqchi bo'ladi. Oldin
   * faqat joriy komplektning yuqori qatlami prefetch qilinardi, strip
   * ichidagi tayyor kiyimlar esa bosilgandan keyin tarmoqdan kelishini
   * kutar edi (~1-2s "sekin kelmoqda" holati).
   */
  useEffect(() => {
    if (!ready) return;
    for (const render of stripRenders.data ?? []) {
      if (render.status !== 'ready') continue;
      if (render.cutoutUrl) void Image.prefetch(render.cutoutUrl);
      if (render.imageUrl) void Image.prefetch(render.imageUrl);
    }
    for (const render of anyStripRenders.data ?? []) {
      if (render.status !== 'ready') continue;
      if (render.cutoutUrl) void Image.prefetch(render.cutoutUrl);
      if (render.imageUrl) void Image.prefetch(render.imageUrl);
    }
  }, [ready, stripRenders.data, anyStripRenders.data]);

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

  /*
   * ⚠️ TAB QATLAMIGACHA (2026-09-27). `visibleResolved` HOOKS ROYIXATIDA
   * shu joyda — quyidagi early return'lardan OLDIN. Ilgari uni sahna
   * qismida `worn` yonida qo'yganman, `if (!ready) return <Redirect />`
   * dan KEYIN — birinchi render'da hooks ro'yxati boshqa, ikkinchisida
   * boshqa bo'lardi va React «Rendered more hooks than during the
   * previous render» xatosi tashlardi.
   */
  const tabRank = layerRank(tab);
  const visibleResolved = useMemo(
    () => resolved.filter((layer) => layerRank(layer.category) <= tabRank),
    [resolved, tabRank],
  );

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
    onMutate: () => setNotice('AI yuborildi — kiyintiryapti…'),
    onSuccess: () => {
      setNotice(null);
      void queryClient.invalidateQueries({ queryKey: ['renders'] });
    },
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
     * ⚠️ DEMO AKKAUNT (Apple App Review) — AI GENERATSIYASI UMUMAN YO'Q
     * (2026-11-06). Reviewer kiyimni bossa yangi OpenAI chaqiruvi ketmasin:
     * sahnada avatarning o'zi (tayyor maneken) ko'rinib tursin, kredit
     * sarflanmasin. Kiyim tanlash, savat, do'kon almashish — hammasi
     * ishlayveradi; faqat kiyintirish AI'si bloklanadi.
     */
    if (isDemoAccount) return;
    /*
     * ⚠️ YON/ORQA AI'NI ISHGA TUSHIRMAYDI. Burchak tugmasi — faqat ko'rish:
     * tayyor natija bo'lsa o'sha, bo'lmasa avatarning o'sha burchagi.
     * Aks holda har bosishda yangi kiyintirish ishi (kredit) ketardi.
     */
    if (angle !== 'front') return;

    const pending = nextPending(resolved);
    if (!pending) return;

    /*
     * ⚠️ QAYTA SO'RAMAYMIZ (2026-11-09, so'rovga ko'ra). Agar shu kiyim
     * uchun biror tayyor render bor bo'lsa (hatto boshqa base ustida),
     * yangi generatsiyaga chiqarmaymiz — foydalanuvchi oldin yasagan
     * natijasini qayta ko'ryapti xolos. Server baribir keshdan qaytarardi,
     * lekin mutatsiya ketgani uchun UI "pending" ko'rsatardi.
     */
    if (anyRenderByVariant.has(pending.variantId)) return;

    const key = `one:${angle}:${renderKey(pending.variantId, pending.baseRenderId)}`;
    if (asked.current.has(key)) return;
    asked.current.add(key);

    // `single` bog'liqliklarda yo'q — yuqoridagi bilan bir xil sabab
    single.mutate({ variantId: pending.variantId, base: pending.baseRenderId });
  }, [ready, angle, resolved, limitReached, isDemoAccount, anyRenderByVariant]);

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

  /*
   * ⚠️ LOOK REJIMI NAVIGATSIYADA SAQLANADI (2026-11-05, so'rovga ko'ra).
   *
   * Ilgari tab orqali kirganda Look rejimi avtomatik tozalanardi — mijoz
   * "Look'ni tanlab, uyga qaytib, AI bossa katalog chiqyapti — nega?"
   * degan edi. Endi Look rejimi **faqat** mijoz "Boshqa kiyim tanlash"
   * tugmasini bosganda yoki chip'dan hamma kiyimni yechib tashlaganda
   * tozalanadi. Ya'ni Look tanlovi sessiya davomida saqlanadi, qaysi
   * yo'ldan kirsa ham.
   *
   * ⚠️ VA AVTOMATIK TOZALASH YO'Q, chunki tab ochilishi oddiy navigatsiya
   * — tanlovni yo'qotish uchun yetarli sabab emas.
   */

  const cart = useMutation({
    mutationFn: async (lines: Array<{ variantId: string; chosenSize: string }>) => {
      // Ketma-ket: savat endpointi bitta qator qabul qiladi
      for (const line of lines) await addToCart(line.variantId, line.chosenSize);
      return lines.length;
    },
    onSuccess: (count) => setNotice(`${count} ta mahsulot savatga qo\`shildi`),
    onError: (err) => setNotice(err instanceof ApiError ? err.message : 'Qo`shilmadi'),
  });

  /*
   * ⚠️ PULL-TO-REFRESH hook'lari SHU YERDA — hamma early return'dan OLDIN.
   * Avval pastroqda edi va "Rendered fewer hooks than expected" xatosi
   * chiqardi: birinchi render'da `!signedIn` early return'ga tushgach,
   * useState va useCallback chaqirilmasdi; keyingi render'da esa
   * chaqirilib, hook tartibi buzilardi.
   */
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['garments'] }),
        queryClient.invalidateQueries({ queryKey: ['renders'] }),
        queryClient.invalidateQueries({ queryKey: ['avatar'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

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
  /*
   * ⚠️ TAYYOR BO'LGANDAGINA ASL AVATAR, aks holda `null`.
   *
   * Avatar hali yasalmagan bo'lsa (yangi foydalanuvchi, generatsiya kutilyapti,
   * yoki xato bo'lgan) ilgari zaxiraga foydalanuvchining o'z yuz selfie'si
   * ko'rsatilardi — bu "AI avatar"ga umuman o'xshamasdi va ekran qo'pol
   * ko'rinardi. `null` qaytarsak, AvatarStage neytral manikenni ko'rsatadi.
   */
  /*
   * ⚠️ FRONT: `imageUrl` NI AFZAL KO'R. `angles.front` ba'zan boshqa jinsda
   * yasalgan yoki eskirgan bo'lishi mumkin (serverda pipeline xatosi);
   * asosiy `imageUrl` esa foydalanuvchining o'z avatari — u ishonchli.
   * Yon/orqa uchun `angles` dan boshqa manba yo'q, shuning uchun ularda
   * eski mantiq qoladi.
   */
  const baseImage =
    angle === 'front'
      ? avatar.data?.status === 'ready'
        ? (avatar.data?.imageUrl ?? angles[angle] ?? null)
        : null
      : (angles[angle] ?? (avatar.data?.status === 'ready' ? (avatar.data?.imageUrl ?? null) : null));
  const baseCutout = angle === 'front' ? (avatar.data?.cutoutUrl ?? null) : null;
  /*
   * ⚠️ `ensureCutout.isError` SHARTI OLIB TASHLANDI (2026-11-10).
   *
   * Avval cutout so'rovi muvaffaqiyatsiz bo'lsa, `preparingCutout` false
   * bo'lar va asl `imageUrl` (studio fon bilan JPEG) ko'rsatila boshlanar
   * edi — foydalanuvchi "ghost" effektni ko'rardi: shop fon ustida odam
   * o'zining eski studio fon bilan.
   *
   * Endi cutout yo'q — bu VAZIYAT, HOLAT emas. Agar yo'q bo'lsa, surat
   * ko'rsatmaymiz (overlay "Fon ajratilyapti" chiqadi), xato bo'lsa ham
   * raw imageUrl'ni ochmaymiz.
   */
  const preparingCutout =
    angle === 'front' &&
    avatar.data?.status === 'ready' &&
    Boolean(avatar.data.imageUrl) &&
    !avatar.data.cutoutUrl;

  /**
   * Sahnada ko'rsatiladigan natija.
   *
   * ⚠️ TAB QATLAMIGACHA (2026-09-26). Foydalanuvchi Futbolka tabga
   * o'tsa-yu ustida ko'ylak/kurtka bor bo'lsa, sahnada u kiyimlar tabi
   * bilan mos kelmasdi. Endi sahna JORIY TAB qatlamigacha chiqadi —
   * yuqoridagi qatlamlar vaqtincha yashiriladi (`visibleResolved`
   * useMemo'si tepada, hooks ro'yxati barqaror bo'lsin uchun).
   *
   * ⚠️ OLD VA YON/ORQADA MANTIQ HAR XIL. Old: progressive (`topReady`) —
   * kutayotgan qatlam paytida oldingi tayyor qatlam ko'rinadi.
   * Yon/Orqa: STRICTLY eng tepa qatlam — u qatlamning shu burchakdagi
   * surati yo'q bo'lsa `null` (past qatlam chiqmaydi), `wornFront`
   * old zaxirasi ishga tushadi.
   */
  const visibleTop = visibleResolved.at(-1);
  const worn =
    angle === 'front'
      ? topReady(visibleResolved)
      : visibleTop?.render?.status === 'ready'
        ? visibleTop.render
        : null;

  const failed = resolved.find((layer) => layer.render?.status === 'failed');

  /* ── Joriy turkumdagi tanlov ──
   *
   * ⚠️ "HAMMASI" TABINING TUZATISHI (2026-11-09).
   *
   * tab='all' uchun `wornHere` har doim null edi (outfit layer'da
   * `category='all'` yo'q), natijada `current` har doim `items[0]`
   * bo'lib qolar edi — foydalanuvchi boshqa kiyimni bossa ham sahna
   * birinchi kiyimda qotib qolardi. Endi tabni 'all' bo'lsa, outfit
   * ichidagi ENG TEPA qatlamning variantId'si bilan topamiz.
   */
  /*
   * ⚠️ useMemo EMAS — early return'lardan keyin bo'lgani uchun hooks
   * tartibini buzadi (React hooks rules). Oddiy reduce, outfit qisqa.
   */
  const topOutfitLayer = outfit.reduce<typeof outfit[number] | null>(
    (best, cur) =>
      !best || layerRank(cur.category) > layerRank(best.category) ? cur : best,
    null,
  );
  const wornHere =
    outfit.find((layer) => layer.category === tab)?.variantId
    ?? (tab === 'all' ? topOutfitLayer?.variantId ?? null : null);
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
  /*
   * ⚠️ FALLBACK — HAR QANDAY BAZADAGI RENDER (2026-11-09).
   * Avval faqat aniq base'ga mos render topilardi. Endi topilmasa, shu
   * variant uchun MAVJUD bo'lgan har qanday renderga tushadi — foydalanuvchi
   * oldin kiyintirgan natijani qayta ko'radi, "pending" indicator yo'q.
   */
  const shown = current
    ? renderIndex.get(renderKey(current.variantId, stripBase.baseRenderId))
      ?? anyRenderByVariant.get(current.variantId)
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
  /*
   * ⚠️ HAMMASI TAB — BUTUN KOMPLEKT TAYYOR BO'LSA LOADER YO'Q (2026-11-06).
   *
   * «Hammasi» noaniq tab — hech bir slotga tegishli emas. `stripBase.ready`
   * doim `false` edi va `current` birinchi items'ga tushardi — natijada
   * «✓ Kiyilgan» tugmasi ostida yuqoridagi overlay «AI kiyintirmoqda»
   * ko'rsatardi. Noizchil.
   *
   * Agar komplektdagi hamma qatlam `ready` bo'lsa — loader chiqmaydi,
   * foydalanuvchi tayyor rasmni tinch ko'radi.
   */
  const outfitAllReady =
    resolved.length > 0 && resolved.every((l) => l.render?.status === 'ready');

  /*
   * ⚠️ TAYYOR SURATGA LOADER CHIQMAYDI (2026-11-06).
   *
   * «Hammasi» tabda `stripBase.ready` doim `false` edi (chunki Hammasi
   * slotning asosi yo'q), shuning uchun avatar ustida tayyor rasmga ham
   * loader chiqib qolardi. Endi `shown` natijasi `ready` bo'lsa darhol
   * ishonamiz — stripBase holatiga qaramaymiz.
   */
  /*
   * ⚠️ "HAMMASI" TAB OVERLAY'NI ISHGA TUSHIRMAYDI (2026-11-06).
   *
   * Hammasi — slot emas, filtr. Mijoz hech narsa tanlamayapti, shunchaki
   * ro'yxatni ko'rib turibdi. Bu paytda "AI kiyintirmoqda" chiqarish
   * mantiqsiz — rendering boshqa biror slotda ketayotgan bo'lsa ham,
   * foydalanuvchining hozirgi diqqat markazidan tashqarida.
   */
  /*
   * Hozirgi bosilgan kiyim uchun mutatsiya ketayotgan bo'lsa ham "ishda" deymiz —
   * server javob kelgunicha overlay darrov chiqadi (2026-11-09).
   */
  const currentInFlight = Boolean(
    single.isPending && current && single.variables?.variantId === current.variantId,
  );

  const currentWorking = Boolean(
    // Demo akkauntda AI chaqiruvi yo'q — "AI kiyintirmoqda" overlay ham chiqmaydi
    // "Hammasi" tabida ham overlay kerak: mijoz model bosib tanlasa holatni biladi
    !isDemoAccount &&
    angle === 'front' &&
    current &&
    !outfitAllReady &&
    shown?.status !== 'ready' &&
    !(limitReached && !shown) &&
    (currentInFlight
      || !stripBase.ready
      || !shown
      || shown.status === 'pending'
      || shown.status === 'processing'),
  );

  /*
   * Ready natija hali shaffof kesimga ega bo'lmasa, `imageUrl`ni butik
   * ustiga qo'ymaymiz. Operator/AI ba'zan uch pozali fonli varaq qaytaradi;
   * raw rasm ko'rsatilsa to'rtburchak fon va yon siluetlar ham chiqadi.
   */
  const renderPreparingCutout = Boolean(
    angle === 'front' &&
    shown?.status === 'ready' &&
    shown.imageUrl &&
    !shown.cutoutUrl,
  );

  /** Sahnadagi yagona holat — ustuvorlik: kiyintirish → sahnaga tayyorlash → xato */
  const stageStatus: { title: string; hint: string; error?: boolean } | null = currentWorking
    ? currentInFlight
      ? {
          title: 'AI yuborildi — kiyintiryapti…',
          hint: 'Server qabul qildi, kiyim ustingizga tayyorlanmoqda',
        }
      : !worn
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
    : renderPreparingCutout
      ? { title: 'Kiyim sahnaga tayyorlanmoqda…', hint: 'Rasm foni ajratilmoqda' }
      : preparingCutout
      ? { title: 'Avatar sahnaga tayyorlanmoqda…', hint: 'Fon bir marta ajratiladi' }
      : failed
        ? {
            title: 'Kiyintirib bo`lmadi',
            hint: failed.render?.error ?? 'Boshqa kiyim bilan urinib ko`ring',
            error: true,
          }
        : null;

  const angleOptions = ANGLE_OPTIONS;

  /* Svayp burchakni almashtiradi: Old → Yon → Orqa */
  const angleIndex = Math.max(
    0,
    angleOptions.findIndex((option) => option.value === angle),
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
  const angleDeck = angleOptions.map((option) => {
    if (option.value === angle) {
      // AvatarStage `cutoutUrl ?? imageUrl` ni tanlaydi, shuning uchun
      // thumbnail'ni AYNAN shunday zanjirga qo'yamiz — main va thumb
      // bir xil rasmni ko'rsatadi.
      /*
       * ⚠️ FON TAYYORLANAYOTGAN PAYTDA RASM YO'Q (2026-11-10). Cutout hali
       * yo'q bo'lsa `baseImage` (studio fon bilan JPEG) ni ko'rsatmaymiz —
       * shop fon ichida ghost bo'lib ko'rinardi. Overlay status matni
       * "Fon ajratilyapti" chiqadi.
       */
      const sceneRender =
        shown?.status === 'ready'
          ? shown
          : visibleTop?.render?.status === 'ready'
            ? visibleTop.render
            : null;
      const url = sceneRender
        ? (sceneRender.cutoutUrl ?? baseCutout)
        : preparingCutout
          ? null
          : (baseCutout ?? angles[option.value] ?? null);
      return { key: option.value, url, resizeMode: 'contain' as const };
    }
    return {
      key: option.value,
      url: preparingCutout ? null : (angles[option.value] ?? baseImage ?? null),
      resizeMode: 'contain' as const,
    };
  });
  const anglePreviews = angleDeck;

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
      {/*
        ⚠️ HERO RASMI SCROLLVIEW'DAN TASHQARIDA. Rasm Screen'ning
        eng pastki qatlamida fixed turadi; ScrollView uning ustidan
        scroll bo'ladi — pastga tortilganda kartalar rasm ustini
        yopadi, overscroll'da esa rasm pastga cho'ziladi (tepa oq
        fonda emas, cho'zilgan rasmda spinner chiqadi).
      */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tryonHeroFixed,
          {
            transform: [
              {
                translateY: scrollY.interpolate({
                  inputRange: [-TRYON_HERO_STRETCH, 0],
                  outputRange: [-TRYON_HERO_STRETCH / 2, 0],
                  extrapolateRight: 'clamp' as const,
                }),
              },
              {
                scaleY: scrollY.interpolate({
                  inputRange: [-TRYON_HERO_STRETCH, 0],
                  outputRange: [2, 1],
                  extrapolateRight: 'clamp' as const,
                }),
              },
            ],
          },
        ]}
      >
          <Animated.Image
            source={tryonBackground}
            resizeMode="stretch"
            style={styles.tryonHeroBackground}
          />
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/*
          ⚠️ HERO PINNED. Avatar sahnasi (header + maniken + controls + angle
          rail) scroll bo'ylab viewport'ning tepasida qoladi: `translateY: scrollY`
          — pastga scroll bo'lsa content ko'tariladi, hero esa shuncha pastga
          siljib joyida qolgandek ko'rinadi, kartalar esa uning ustini yopadi.
          pullDown (`scrollY < 0`) uchun 0 — pastga qo'shimcha siljitmaydi.
        */}
        <Animated.View
          style={[
            styles.tryonHero,
            {
              transform: [
                {
                  translateY: scrollY.interpolate({
                    inputRange: [0, 10_000],
                    outputRange: [0, 10_000],
                    extrapolateLeft: 'clamp' as const,
                  }),
                },
              ],
            },
          ]}
        >
        <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Orqaga"
          hitSlop={10}
          onPress={() => (showBack ? goBack('/(tabs)') : router.back())}
          style={styles.headerButton}
        >
          <Icon name="back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <View style={styles.headerTitleRow}>
            <Icon name="slotTop" size={30} color="#FFFFFF" />
            <Text style={styles.headerTitle}>Looksave</Text>
          </View>
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
        {/* ── Avatar maydoni ── */}
        <View style={styles.stage}>
          <AvatarStage
            zoomed={zoomed}
            /*
             * ⚠️ `shown` FALLBACK (2026-11-09). Asosiy sahna faqat chain-matched
             * render emas, variant uchun har qanday mavjud render bilan ham
             * mos kelsin — thumbnail va sahna sinxron qoladi. Aks holda
             * foydalanuvchi "Kiyilgan" ni Varsity'da ko'radi, lekin sahnada
             * eski Tommy Jeans rasm turadi.
             */
            imageUrl={preparingCutout ? null : (shown?.imageUrl ?? worn?.imageUrl ?? wornFront?.imageUrl ?? baseImage)}
            cutoutUrl={
              shown?.status === 'ready' ? (shown.cutoutUrl ?? null)
                : worn ? (worn.cutoutUrl ?? null)
                : wornFront ? (wornFront.cutoutUrl ?? null)
                : baseCutout
            }
            /*
             * ⚠️ DIMMED OLIB TASHLANDI (2026-11-10). Avval "AI kiyintirmoqda"
             * paytida avatar 35% opacity'ga tushardi — foydalanuvchiga ghost
             * bo'lib ko'rinardi va shop fon ichidan o'tib turardi. Overlay
             * matn (`stageStatus`) AI ishlayotganini aytadi, dimming ortiqcha.
             */
            dimmed={false}
            showRings
          >
            {/*
             * ⚠️ SVAYP OLDDA HAM ISHLASIN. Ilgari `angle === 'front'`
             * da PhotoSwipe umuman chizilmasdi — foydalanuvchi oldindan
             * boshlab chapga/o'ngga sursa, hech narsa bo'lmasdi (default
             * `front`; ya'ni svayp amalda hech qachon ishlamasdi,
             * faqat o'ngdagi 3 ta tugmani bosish qoldi).
             */}
            <PhotoSwipe
              photos={angleDeck}
              index={angleIndex}
              onIndexChange={(next) => {
                const option = angleOptions[next];
                if (option) setAngle(option.value);
              }}
            />

          </AvatarStage>

          <View style={styles.sideControls} pointerEvents="box-none">
            <Control
              icon="zoom"
              label={zoomed ? 'Kichraytir' : 'Yaqinlashtir'}
              onPress={() => setZoomed((value) => !value)}
              active
            />

            <Control icon="compare" label="Fon" onPress={() => router.push('/ai/avatar')} />

            <Control icon="filter" label="Sozlamalar" onPress={() => router.push('/settings/measurements')} />

          </View>

          {/*
            ⚠️ ANGLE RAIL faqat 2 va undan ko'p burchak bo'lsa ko'rsatiladi.
            ANGLE_OPTIONS = [front] bo'lgach rail yagona thumbnail bilan
            ekranni behuda to'ldirardi.
          */}
          {angleOptions.length > 1 ? (
            <View style={styles.angleRail} pointerEvents="box-none">
              {anglePreviews.map((photo, index) => {
                const optionIndex = index;
                const selected = index === angleIndex;
                return (
                  <Pressable
                    key={photo.key}
                    accessibilityRole="button"
                    accessibilityLabel={angleOptions[optionIndex]?.label}
                    onPress={() => {
                      const option = angleOptions[optionIndex];
                      if (option) setAngle(option.value);
                    }}
                    style={[styles.anglePreview, selected && styles.anglePreviewActive]}
                  >
                    {photo.url ? (
                      <Image source={{ uri: photo.url }} style={styles.anglePreviewImage} resizeMode="contain" />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/*
            ⚠️ 360° ROTATION NAV OLIB TASHLANDI. Avvallari pastda ikki ↔ tugma
            va "360°" matni bor edi — svayp va o'ngdagi anglePreview rail
            ikkinchi marta shu funksiyani beradi, qo'sh element ekranni
            chalkashtirar edi. Angle almashtirish endi faqat svayp yoki
            o'ngdagi thumbnail'lar orqali.
          */}

          {/*
            «Lookda» chiplari — sahnaning TEPASIDA, kategoriya nomi + × bilan.
            Ilgari mayda nuqtalar edi va foydalanuvchi nima yig'ganini tushunmasdi.
            Chip bosilsa — shu kategoriya tabiga o'tadi (mahsulotni almashtirish uchun);
            × bosilsa — kiyim yechiladi.
          */}
          {false && resolved.length > 0 ? (
            <View style={styles.lookChipRow} pointerEvents="box-none">
              {resolved.map((layer) => {
                const tabInfo = TABS.find((item) => item.category === layer.category);
                const label = tabInfo?.label ?? layer.category;
                const active = layer.category === tab;
                return (
                  <View key={layer.category} style={[styles.lookChip, active && styles.lookChipActive]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${label} tabiga o'tish`}
                      onPress={() => setTab(layer.category)}
                      hitSlop={6}
                    >
                      <Text style={[styles.lookChipText, active && styles.lookChipTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${label}ni yechish`}
                      onPress={() => remove(layer.category)}
                      hitSlop={8}
                      style={styles.lookChipClose}
                    >
                      <Icon
                        name="close"
                        size={12}
                        color={active ? colors.primary : colors.textMuted}
                      />
                    </Pressable>
                  </View>
                );
              })}
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
            <View
              style={styles.overlay}
              // Faqat error holatda overlay interaktiv — "Qayta urinish" tugmasi bosilsin
              pointerEvents={stageStatus.error ? 'box-none' : 'none'}
            >
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
                {stageStatus.error ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Qayta urinish"
                    onPress={refreshScene}
                    style={({ pressed }) => [
                      styles.statusRetry,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Icon name="reset" size={16} color={colors.textOnPrimary} />
                    <Text style={styles.statusRetryText}>Qayta urinish</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
        </Animated.View>

        {/*
          Gorizontal qator — ixcham tab'lar, qolganlari surib ko'riladi.
          ⚠️ LOOK REJIMIDA YASHIRINADI (2026-11-05). Mijoz aniq komplektni
          tanlagan, kategoriya tanlash ortiqcha — tasma faqat Look
          kiyimlari bilan to'lgan va boshqa narsalar chalg'itmasin.
        */}
        <View style={styles.selectorPanel}>
        {inLookMode ? null : (
        <>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingTitle}>
            <Icon name="looks" size={20} color={colors.primary} />
            <Text style={styles.sectionHeadingText}>Kategoriya</Text>
          </View>
          {/*
           * ⚠️ "Barchasi" tugmasi olib tashlandi (2026-11-09).
           * Tab ro'yxatida "Hammasi" tabi bor — foydalanuvchi uni
           * to'g'ridan-to'g'ri bosadi, qo'shimcha tugma ortiqcha edi.
           */}
        </View>
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
                {/* Atelier: faol tabda binafsha gradient yo'q — faqat chegara
                    va primarySoft fon aktiv holatni ko'rsatadi */}
                <View style={[styles.tabIcon, active && styles.tabIconActive]}>
                  <Icon
                    name={item.icon}
                    size={14}
                    color={active ? colors.textOnPrimary : colors.textMuted}
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
        </>
        )}

        {/*
        ── Uslub chiplari ──

        ⚠️ TANLANGAN KIYIMDAN TASHQARIDA TURADI. Ilgari o'lcham va rang
        `current ? (...)` ichida edi; uslubni ham o'sha yerga qo'ysak,
        bo'sh ro'yxatda chiplar yo'qolardi va foydalanuvchi o'zi qo'ygan
        filtrni BEKOR QILA OLMASDI — boshi berk ko'cha.

        ⚠️ LOOK REJIMIDA USLUB FILTR HAM KERAK EMAS (2026-11-05) —
        aniq komplekt tanlangan, filtr bo'sh ro'yxatga aylantirishi
        mumkin. Mijoz "Boshqa kiyim tanlash" bossa Look chiqadi va
        uslub chiplari qaytadan paydo bo'ladi.

        Filtr serverda bajariladi: chip `queryKey` ni o'zgartiradi va
        ro'yxat qaytadan so'raladi. Qayta bosilsa — bekor bo'ladi.
      */}
        {inLookMode ? null : (
        <>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingTitle}>
            <Icon name="filter" size={20} color={colors.primary} />
            <Text style={styles.sectionHeadingText}>Uslub</Text>
          </View>
        </View>
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
                  <Text style={[styles.styleChipText, active && styles.styleChipTextActive]}>
                    {STYLE_LABEL[item]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        </>
        )}
        </View>

        <View style={styles.bottom}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingTitle}>
              <Icon name="profile" size={20} color={colors.primary} />
              <Text style={styles.sectionHeadingText}>Modellar</Text>
            </View>
            {/* "Barchasini ko'rish" tugmasi olib tashlandi (2026-11-09). */}
          </View>
          {/*
            Interaktsiyani ko'rsatuvchi qisqa chip — birinchi marta kirayotgan
            foydalanuvchi (va App Review'chi) uchun model bosish = AI kiyintirish
            ekanini bir qarashda tushuntiradi.
          */}
          <View style={styles.modelHint}>
            <Icon name="tryon" size={12} color={colors.primary} />
            <Text style={styles.modelHintText}>
              Modelni bosing — AI sizni o‘sha kiyimda ko‘rsatadi
            </Text>
          </View>
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

          {/*
            ⚠️ "Look rejimi" banner (2026-11-05). Mijoz saqlangan Look'dan
            kirgan — tasmada faqat o'sha kiyimlar. Boshqa kiyim qo'shish
            uchun filtrdan chiqish kerak.
          */}
          {lookPinned && browseMode ? (
            // "Almashtir" — Look saqlangan, lekin strip katalogdan ko'rsatmoqda
            <View style={styles.lookModeBanner}>
              <Icon name="looks" size={14} color={colors.accent} />
              <Text style={styles.lookModeText}>
                Almashtiring — yangi kiyim bossangiz Look'ga qo'shiladi
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setBrowseMode(false)}
                hitSlop={8}
              >
                <Text style={styles.lookModeAction}>Bekor</Text>
              </Pressable>
            </View>
          ) : null}

          {inLookMode ? (
            <>
              <View style={styles.lookModeBanner}>
                <Icon name="looks" size={14} color={colors.accent} />
                <Text style={styles.lookModeText}>
                  {/*
                    Agar katalogdan qaytgan son lookFilter'dan kam bo'lsa,
                    foydalanuvchi "qani qolganlari" deb hayron qoladi —
                    aniq sabab ko'rsatamiz: ba'zilari do'kondan olib tashlangan.
                  */}
                  {items.length < (lookFilter?.length ?? 0) && !itemsLoading
                    ? `Look rejimi — ${items.length}/${lookFilter?.length} ta kiyim (qolgani o'chirilgan)`
                    : `Look rejimi — ${lookFilter?.length ?? 0} ta kiyim`}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setBrowseMode(true)}
                  hitSlop={8}
                  style={{ marginRight: spacing.sm }}
                >
                  <Text style={styles.lookModeAction}>Almashtir</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setLookFilter(null)}
                  hitSlop={8}
                >
                  <Text style={styles.lookModeAction}>Boshqa</Text>
                </Pressable>
              </View>

              {/*
                ⚠️ "KIYINTIRISH" TUGMASI (2026-11-05). Look rejimida yagona
                CTA — mijoz hamma kiyim + yuzni bir urinishda ishga tushirishi
                uchun. Hozirgi arxitektura qatlamma-qatlam generatsiya qiladi
                (baseRenderId zanjiri), lekin bu tugma zanjirni ishga tushiradi
                va mijozga aniq holat ko'rsatadi:
                  - pending bor → "AI kiyintirmoqda..." + loader
                  - hammasi ready → "Kiyilgan ✓"
                  - failed → "Qayta urinish"
              */}
              {(() => {
                const anyPending = resolved.some(
                  (layer) =>
                    !layer.render ||
                    layer.render.status === 'pending' ||
                    layer.render.status === 'processing',
                );
                const anyFailed = resolved.some(
                  (layer) => layer.render?.status === 'failed',
                );
                const allReady =
                  resolved.length > 0 &&
                  resolved.every((layer) => layer.render?.status === 'ready');

                const label = anyFailed
                  ? 'Qayta kiyintirish'
                  : anyPending
                    ? 'AI kiyintirmoqda…'
                    : allReady
                      ? '✓ Kiyilgan'
                      : 'Kiyintirish';

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Hammasini birdan kiyintirish"
                    onPress={refreshScene}
                    disabled={anyPending && !anyFailed}
                    style={[
                      styles.lookDressButton,
                      allReady && styles.lookDressButtonDone,
                      anyFailed && styles.lookDressButtonError,
                    ]}
                  >
                    {anyPending && !anyFailed ? (
                      <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                      <Icon
                        name={allReady ? 'check' : anyFailed ? 'reset' : 'tryon'}
                        size={16}
                        color={colors.text}
                      />
                    )}
                    <Text style={styles.lookDressButtonText}>{label}</Text>
                  </Pressable>
                );
              })()}
            </>
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
              style={styles.modelStrip}
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
                /*
                 * KIYILGANNI ANIQLASH (2026-11-09 — "Hammasi" tabi tuzatildi).
                 *
                 * ⚠️ `wornHere` faqat joriy tab'ning slotiga qaraydi — tab='all'
                 * bo'lsa hech narsa topmaydi. Endi faqat ENG TEPA outfit qatlami
                 * (visible) belgilanadi — barcha qatlamlarni emas, aks holda
                 * foydalanuvchi "nimaga ikkitasi" deb hayron qoladi (futbolka
                 * va uning ustidagi hoodie ikkalasi ham outfitda, lekin faqat
                 * hoodie ko'rinadi).
                 */
                /* Eng tepa qatlam — layerRank bo'yicha eng katta. */
                const topLayer = outfit.reduce<typeof outfit[number] | null>(
                  (best, cur) =>
                    !best || layerRank(cur.category) > layerRank(best.category) ? cur : best,
                  null,
                );
                const selected = item.variantId === (wornHere ?? topLayer?.variantId);
                const render = renderIndex.get(renderKey(item.variantId, stripBase.baseRenderId))
                  ?? anyRenderByVariant.get(item.variantId);
                const isReady = render?.status === 'ready';
                /*
                 * ⚠️ MUTATSIYA KETAYOTGANI HAM "BUSY" (2026-11-09).
                 * Foydalanuvchi bossa, server javob kelgunicha ham thumbnail
                 * belgilansin — "bosdim lekin hech narsa bo'lmadi" hissi
                 * yo'qoladi. `single.variables.variantId` — hozir qaysi kiyim
                 * mutatsiyada ekani.
                 */
                const inFlight =
                  single.isPending && single.variables?.variantId === item.variantId;
                const busy = inFlight
                  || render?.status === 'pending'
                  || render?.status === 'processing';

                /*
                 * ⚠️ KARTOCHKADA ODAMNING O'ZI — MAKETDAGI ASOSIY FIKR.
                 * Har kartochka kiyimning yassi suratini emas, MODELNI
                 * o'sha kiyimda ko'rsatadi. Endi bu deyarli hamma
                 * kartochkada bor: tasma oldindan tayyorlanadi.
                 */
                // Fonli AI varaqni thumbnail'da ham ko'rsatmaymiz.
                const preview = isReady ? (render.cutoutUrl ?? item.image) : item.image;

                const bundled = bundleSelection.has(item.variantId);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    onPress={() => {
                      putOn(tab === 'all' ? item.slot : tab, item.variantId);
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
                        <ActivityIndicator size="large" color={colors.accent} />
                        <Text style={styles.thumbBusyLabel}>AI kiyintiryapti</Text>
                      </View>
                    ) : null}

                    {isReady ? (
                      <View style={styles.readyBadge}>
                        <Icon name="authentic" size={10} color={colors.bg} />
                      </View>
                    ) : null}

                    {/*
                     * ⚠️ BUNDLE CHECKBOX (2026-11-10). Yuqori chap burchakda
                     * bosiladigan tik maydon — tap propagation to'xtatiladi
                     * ki main Pressable darhol kiyintirmasin.
                     */}
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={bundled ? 'Tanlovdan olib tashlash' : 'Bundle ga qo\'shish'}
                      accessibilityState={{ checked: bundled }}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        toggleBundleItem(item);
                      }}
                      hitSlop={12}
                      style={[styles.bundleCheck, bundled && styles.bundleCheckOn]}
                    >
                      {bundled ? (
                        <Icon name="authentic" size={14} color="#FFFFFF" />
                      ) : (
                        <Text style={styles.bundleCheckPlus}>+</Text>
                      )}
                    </Pressable>

                    {selected ? (
                      <View style={styles.thumbWornBadge}>
                        <Text style={styles.thumbWornBadgeText}>Kiyilgan</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
            />
          )}

          {/*
            ⚠️ BUNDLE QATORI (2026-11-10). Checkbox orqali tanlangan kiyimlar
            soni ≥ 2 bo'lsa chiqadi. Bosganda hammasini birdaniga kiyintiradi.
          */}
          {bundleSelection.size >= 2 ? (
            <View style={styles.bundleBar}>
              <View style={styles.bundleBarLeft}>
                <Icon name="looks" size={16} color={colors.primary} />
                <Text style={styles.bundleBarText}>
                  {bundleSelection.size} ta kiyim tanlangan
                </Text>
              </View>
              <View style={styles.bundleBarActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setBundleSelection(new Set())}
                  hitSlop={8}
                  style={({ pressed }) => [styles.bundleCancel, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.bundleCancelText}>Bekor</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => putOnBundle(Array.from(bundleSelection))}
                  hitSlop={8}
                  style={({ pressed }) => [styles.bundleGo, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.bundleGoText}>Hammasini kiyintir</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

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
                  {/*
                   * ⚠️ KOMPLEKT SARLAVHASI TAPPABLE (2026-11-10). Bosilsa
                   * butun komplektni sahnaga qayta ko'rsatadi — foydalanuvchi
                   * boshqa kiyimni bosib ko'rgandan keyin komplektga qaytishi
                   * uchun. `putOnBundle` keshdan foydalanadi, yangi GPT
                   * chaqiruv bo'lmaydi.
                   */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Komplektni sahnaga qaytarish"
                    onPress={() => {
                      const ids = outfitItems.map((item) => item.variantId);
                      if (ids.length >= 2) putOnBundle(ids);
                    }}
                    style={({ pressed }) => [styles.outfitHead, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.outfitTitle}>Komplekt · {outfitItems.length} ta</Text>
                    <Text style={styles.outfitTotal}>
                      {money(String(outfitTotal), outfitCurrency)}
                    </Text>
                  </Pressable>

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
      </Animated.ScrollView>

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

/*
 * ⚠️ FAQAT OLD BURCHAK (2026-11-09). Yon va orqa chiqarilgan edi, lekin:
 *   - OpenAI varaq'da 3 figura doim bir xil pozada chiqmasdi
 *   - Facefusion yon/orqaga yuzni mos qo'yolmasdi
 *   - Operator qo'lda 3 pozani bir rasm bilan chiqarish mushkul
 * Natijada ikkinchi/uchinchi burchakda sifat past bo'lardi. Faqat old
 * qoldirildi — svayp va angle rail avtomatik ravishda bo'sh bo'ladi.
 */
const ANGLE_OPTIONS: Array<{ value: AvatarAngle; label: string }> = [
  { value: 'front', label: 'Old' },
];

function Control({
  icon,
  label,
  onPress,
  danger = false,
  busy = false,
  boxed = false,
  active = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  /** Ish ketayotganda tugma bloklanadi — takroriy bosish kredit yeydi */
  busy?: boolean;
  /** To'rtburchak ramka — maketdagi «Remove Clothing» uslubi */
  boxed?: boolean;
  active?: boolean;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={busy}
      style={[styles.control, active && styles.controlWrapActive]}
    >
      <View
        style={[
          styles.controlIcon,
          boxed && styles.controlBoxed,
          active && styles.controlActive,
          danger && styles.controlDanger,
          busy && styles.controlBusy,
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Icon
            name={icon}
            size={14}
            color={danger ? colors.danger : active ? colors.textOnPrimary : colors.text}
          />
        )}
      </View>
      <Text
        style={[
          styles.controlLabel,
          active && styles.controlLabelActive,
          danger && { color: colors.danger },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Atelier: burchak tanlagich — oq segmented control, hair-thin chegara.
  // Faol segment solid anor, matn cream.
  angleSwitch: {
    gap: 3,
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
    alignItems: 'stretch',
    shadowColor: '#32105B',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  angleButton: {
    minWidth: 52,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  angleButtonActive: { backgroundColor: colors.primary },
  angleText: { ...text.tiny, color: colors.textMuted, fontFamily: fonts.semibold },
  angleTextActive: { color: colors.textOnPrimary },
  fallbackNote: {
    ...text.small,
    color: colors.warning,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  lookModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  lookModeText: { ...text.small, color: colors.text, flex: 1 },
  lookModeAction: { ...text.eyebrow, color: colors.primary },
  // Atelier: "Kiyintirish" tugma — solid anor, kichikroq radius, cream matn
  lookDressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  lookDressButtonDone: { backgroundColor: colors.success },
  lookDressButtonError: { backgroundColor: colors.danger },
  lookDressButtonText: { ...text.bodyMed, color: colors.textOnPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'transparent',
  },
  tryonHero: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    paddingBottom: spacing.sm,
  },
  /*
   * ⚠️ FIXED HERO — ScrollView dan tashqarida, ekranning yuqori yarmida
   * absolyut turadi. Yuqori qismi `0`, balandligi `TRYON_HERO_HEIGHT` —
   * bu avatar sahnasining yuqori yarmini qoplaydi. Scroll pastga tortilsa
   * kartalar uning ustini yopadi, pulldown'da `scaleY`/`translateY` orqali
   * cho'ziladi.
   */
  tryonHeroFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TRYON_HERO_HEIGHT,
    backgroundColor: '#EEE7F7',
    overflow: 'hidden',
    zIndex: 0,
  },
  tryonHeroBackground: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#251133',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  headerPlaceholder: { width: 42, height: 42 },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: {
    ...text.h2,
    color: '#FFFFFF',
    textShadowColor: 'rgba(60,20,80,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.74)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    maxWidth: 220,
    marginTop: 2,
  },
  storeChipText: { ...text.tiny, color: colors.textMuted, flexShrink: 1 },

  /* Sahna portret nisbatida; sahifa scroll bo'lgani uchun tor ekranlarda siqilmaydi. */
  stage: {
    aspectRatio: 0.72,
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  page: { paddingBottom: 148 },
  avatar: { flex: 1 },
  dimmed: { opacity: 0.35 },
  // Atelier: sahna ustidagi holat kartasi — cream to'ldirish, hair-thin
  statusCard: {
    maxWidth: 280,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(247,242,234,0.94)',
  },
  statusTitle: { ...text.h3, color: colors.text, textAlign: 'center' },
  statusHint: { ...text.small, color: colors.textMuted, textAlign: 'center' },
  statusRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  statusRetryText: { ...text.bodyMed, color: colors.textOnPrimary, fontWeight: '700' },

  /* Chapdagi tik qator — maketdagi Rotate / Zoom / Reset */
  sideControls: {
    position: 'absolute',
    left: 8,
    top: 70,
    gap: spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: radius.xxl,
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#4C1D95',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    zIndex: 4,
  },
  control: { alignItems: 'center', gap: 2 },
  controlWrapActive: {
    minWidth: 58,
    paddingHorizontal: 4,
    paddingVertical: 5,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  // Atelier: rasm ustidagi tugma — oq pill, ink ikon, hair-thin
  controlIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#32105B',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  controlBoxed: { borderRadius: radius.sm, width: 36, height: 36 },
  controlActive: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.22)' },
  controlDanger: { borderColor: colors.danger, backgroundColor: 'rgba(142,45,34,0.08)' },
  controlBusy: { borderColor: colors.primary },
  controlLabel: {
    ...text.tiny,
    color: colors.text,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  controlLabelActive: { color: colors.textOnPrimary, fontFamily: fonts.semibold },
  angleRail: {
    position: 'absolute',
    top: 58,
    right: 10,
    gap: spacing.sm,
    padding: 8,
    borderRadius: radius.xxl,
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#4C1D95',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    overflow: 'hidden',
    zIndex: 4,
  },
  anglePreview: {
    width: 54,
    height: 76,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  anglePreviewActive: {
    borderWidth: 2,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.42,
    shadowRadius: 8,
    elevation: 4,
  },
  anglePreviewImage: { width: '100%', height: '100%' },
  rotationNav: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 4,
  },
  rotationButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#4C1D95',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  rotationArrow: { ...text.h3, color: colors.primary, fontFamily: fonts.semibold },
  rotationText: {
    ...text.h2,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(139,44,255,0.32)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  selectorPanel: {
    marginHorizontal: spacing.sm,
    marginTop: -10,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(143,91,210,0.15)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#5D2B91',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 9 },
    elevation: 6,
    overflow: 'hidden',
  },

  /*
   * O'ngdagi qatlam ko'rsatkichi — nechta kiyim kiyilgani.
   *
   * ⚠️ RAQAM EMAS, NUQTA. Komplektda ko'pi bilan beshta qatlam bo'ladi
   * va ularni sanashdan ko'ra ko'rish tez: to'lgan nuqta — tayyor
   * qatlam, bo'shi — kelayotgani.
   */
  // «Lookda» chiplari — sahnaning tepasida, kategoriya nomi + × bilan
  lookChipRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 76,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sectionHeading: {
    minHeight: 30,
    marginTop: 2,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeadingTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionHeadingText: { ...text.h3, fontSize: 18, color: colors.text },
  sectionHeadingAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionHeadingActionText: { ...text.small, color: colors.primary, fontFamily: fonts.semibold },
  modelHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.md,
    marginTop: 0,
    marginBottom: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignSelf: 'flex-start',
  },
  modelHintText: { ...text.tiny, color: colors.primary, fontFamily: fonts.semibold },
  // Atelier: "Lookda" chip — oq pill ustida ink matn (rasm ustida bo'ladi)
  lookChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: spacing.sm,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  lookChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(44,14,68,0.92)' },
  lookChipText: { ...text.tiny, color: colors.text, fontWeight: '600' },
  lookChipTextActive: { color: colors.textOnPrimary },
  lookChipClose: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
    height: 36,
    paddingTop: 2,
    marginBottom: 2,
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  styleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  /*
   * ⚠️ BALANDLIK ANIQ BERILADI, padding bilan emas. Gorizontal
   * ScrollView ichida balandligi o'lchanadigan bola yig'ilib qoladi va
   * yozuvi pastdan kesiladi — tablarda ham shu sabab `height: 34` bor.
   */
  // Atelier: style chip — oq fon, hair-thin, faol anor to'ldirish
  styleChip: {
    flex: 1,
    minWidth: 0,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  styleChipText: { ...text.tiny, fontSize: 11, color: colors.textMuted },
  styleChipTextActive: { color: colors.textOnPrimary, fontFamily: fonts.semibold },
  tabsWrap: {
    height: 66,
    marginTop: 0,
    marginBottom: 0,
    backgroundColor: 'transparent',
    flexGrow: 0,
    flexShrink: 0,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: 8,
  },
  /* Ixcham gorizontal tab: ikonka tepada, yozuv pastda — 5-6 tab bir
     ekranga sig'adi, qolganlari surib ko'riladi. */
  // Atelier: kategoriya tabi — oq quti, hair-thin, faol anor chegara
  tab: {
    width: 68,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 56,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  tabActive: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: colors.primary,
  },
  tabIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  tabIconActive: { backgroundColor: 'rgba(255,255,255,0.14)' },
  tabText: { ...text.tiny, color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  tabTextActive: { color: colors.textOnPrimary, fontFamily: text.label.fontFamily },
  tabDressed: {
    position: 'absolute',
    top: 4,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
  },

  bottom: {
    marginTop: 8,
    paddingTop: 4,
    paddingBottom: 160,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  stripLoader: { marginVertical: spacing.lg },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.warning,
    // Atelier: ogohlantirish — oxra chegara + yumshoq ichki to'ldirish
    backgroundColor: 'rgba(184,129,42,0.08)',
  },
  bannerText: { ...text.tiny, color: colors.textMuted, flex: 1 },

  emptyBox: { padding: spacing.lg, gap: spacing.md },
  emptyStrip: { ...text.small, color: colors.textDim, textAlign: 'center' },
  emptyActions: { gap: spacing.sm },

  modelStrip: {
    flexGrow: 0,
  },
  strip: {
    paddingTop: 4,
    paddingBottom: 6,
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  thumbWrap: {
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  /*
   * ⚠️ TANLANGAN KIYIM AJRALIB TURSIN. Ilgari 2px shaffof border edi —
   * foydalanuvchi qaysi kiyimni kiyganini ekranda ko'ra olmasdi (strip'da
   * 3 ta rasm yonma-yon, bosilgani bilinmasdi). 3px brand rangi + yengil
   * glow + pastda "Kiygandir" badge — uchta signal, birortasi ham o'tib
   * ketmasin.
   */
  thumbSelected: {
    borderColor: colors.accent,
    borderWidth: 4,
    shadowColor: colors.accent,
    shadowOpacity: 0.85,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    transform: [{ scale: 1.06 }],
  },
  thumbWornBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  thumbWornBadgeText: { ...text.tiny, color: colors.bg, fontWeight: '700' },
  /*
   * ⚠️ BUNDLE CHECKBOX (2026-11-10). Kartochka yuqori chap burchagida 20x20
   * dumaloq. Bo'sh — '+' belgisi, bosilgan — oq galochka primary rangda.
   */
  bundleCheck: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bundleCheckOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  bundleCheckPlus: { ...text.tiny, color: colors.primary, fontWeight: '800', lineHeight: 16 },
  /* Bundle action bar — Kiyintir va Bekor tugmalari */
  bundleBar: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  bundleBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  bundleBarText: { ...text.body, color: colors.text, fontWeight: '600' },
  bundleBarActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bundleCancel: { paddingHorizontal: spacing.sm, paddingVertical: 8 },
  bundleCancelText: { ...text.body, color: colors.textMuted },
  bundleGo: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  bundleGoText: { ...text.body, color: colors.textOnPrimary, fontWeight: '700' },
  thumb: { width: 78, height: 88, backgroundColor: colors.surface2 },
  thumbWorn: { backgroundColor: colors.bg },
  // Thumbnail busy overlay — kiyim bosilgani aniq ko'rinsin
  thumbBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(247,242,234,0.88)',
  },
  thumbBusyLabel: {
    ...text.tiny,
    color: colors.accent,
    fontWeight: '800',
    fontSize: 9,
    textAlign: 'center',
    paddingHorizontal: 4,
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

  details: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  title: { ...text.h3, color: colors.text },

  /* ── Maketdagi mahsulot sarlavhasi ── */
  detailsHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: 96,
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
    // Atelier: ingichka ink chegara, faol anor
    borderColor: colors.border,
  },
  colorActive: { borderColor: colors.primary },

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
