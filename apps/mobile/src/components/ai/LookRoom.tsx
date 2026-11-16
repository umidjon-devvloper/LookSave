import {
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { matchSize, recommendSize } from '@looksave/validation';

import {
  canWear,
  findTry,
  selectedForTryon,
  sortedIds,
  tryKey,
  unresolved,
  type TrayItem,
} from '../../ai/lookTray';
import { resolveGarment, startTryon } from '../../ai/lookTryon';
import { pastLooks, wearInputs, type PastLook } from '../../ai/pastLooks';
import { ApiError } from '../../api/client';
import {
  addToCart,
  getAvatar,
  getFullProfile,
  getRender,
  getTryonHistory,
  requestAvatarCutout,
  type Garment,
  type TryonHistoryItem,
  type TryonRender,
} from '../../api/endpoints';
import { explainError } from '../../api/explainError';
import { useI18n, type Dictionary } from '../../i18n';
import { goBack } from '../../navigation/back';
import { useAuthStore } from '../../store/authStore';
import { useLookStore } from '../../store/lookStore';
import { money } from '../../theme/format';
import { colors, fonts, radius, spacing, text } from '../../theme/tokens';
import { Icon, type IconName } from '../Icon';
import { SignInRequired } from '../SignInRequired';
import { Button, ErrorView, Loading, Screen } from '../ui';

/**
 * Kiyib ko'rish — sodda primerka.
 *
 * Ekranda uch narsa bor: avatar, yig'ilgan kiyimlar qatori va bitta tugma.
 * Tugma belgilangan kiyimlarning HAMMASINI bitta so'rovda yuboradi va bitta
 * rasm qaytadi — avatar shu kiyimlarda. Yoqmasa kiyim almashtiriladi va
 * yana bosiladi.
 *
 * ⚠️ `FittingExperience` O'RNIGA. U yerda kiyimlar qatlam-qatlam, har biri
 * alohida so'rov bilan kiyintirilardi (3 kiyim = 3 operator ishi), haqiqiy
 * «birdaniga» esa mayda «+» belgilar ortida yashiringan edi; yoniga
 * turkum tablari, uslub va o'lcham filtrlari, do'kon tanlash qo'shilib
 * ekran o'qib bo'lmas holga kelgandi. Bu yerda ulardan hech biri yo'q:
 * kiyim tanlash do'kon sahifalarida («Look» tugmasi), bu ekran esa faqat
 * kiyib ko'rish uchun.
 *
 * ⚠️ NATIJA DARHOL KELMAYDI. Kiyintirishni operator bajaradi — bir necha
 * daqiqa. Shuning uchun (1) kutish holati aniq yoziladi, (2) urinish
 * qurilmada eslab qolinadi: foydalanuvchi ilovadan chiqib qaytsa ekran
 * o'sha natijani topadi (`lookStore.tries`).
 *
 * ⚠️ NATIJA TANLOVGA ERGASHADI. Sahnada doim HOZIR BELGILANGAN to'plamning
 * natijasi turadi; bo'lmasa — avatarning o'zi. Oldin sinalgan to'plamga
 * qaytilsa natija darhol chiqadi, qayta so'ralmaydi.
 *
 * Tugma tepasidagi «Kiyib ko'rilganlar» qatori shu qoidaga tayanadi: undagi
 * surat bosilsa o'sha kiyimlar qayta yoqiladi — sahna ham, savat tugmasi
 * ham o'sha to'plamga o'tadi (`ai/pastLooks.ts`).
 *
 * ⚠️ QATOR DOIM TURADI — bitta tayyor natija bo'lishi bilan. Kiyim savatdan
 * olib tashlansa ham, savat bo'shasa ham mijoz kiyintirgan natijalar joyida
 * qoladi (egasining talabi, 2026-11-13).
 *
 * Qator ikki manbadan to'ladi: qurilma eslab qolgan urinishlar (oxirgi 6 ta)
 * va serverdagi tarix (`GET /tryon/history`) — ilova qayta o'rnatilsa yoki
 * boshqa telefon bo'lsa ham natijalar qaytadi. Eski serverda tarix yo'li
 * yo'q; u holda qator faqat qurilmadagilardan to'ladi.
 */

export interface LookRoomProps {
  /**
   * Orqaga tugmasi. Tabda ko'rsatilmaydi (tab qatorining o'zi navigatsiya),
   * tepadagi AI tugmasidan ochilganda esa kerak.
   */
  showBack?: boolean;
}

const FEMALE_BACKGROUND = require('../../../assets/tryon-boutique-female-v1.png');
const MALE_BACKGROUND = require('../../../assets/tryon-boutique-male-v1.png');

/*
 * Fon surati o'lchovlari (ikkala surat ham 941×1672, podium bir joyda).
 * Avatar oyog'i podium ustiga tushishi uchun sahna shu nisbatlardan
 * hisoblanadi — foizlar suratning O'ZIDAN o'lchangan.
 */
const BACKGROUND_ASPECT = 941 / 1672;
/** Podium ustki yuzasining markazi — surat balandligining shu qismida */
const PODIUM_CENTER = 0.775;
/** Suratning eng pastki bo'sh poli — sahnadan pastda qoladi, ko'rinmaydi */
const FLOOR_HIDDEN = 0.07;
/** Panel sahnaning ustiga shuncha chiqadi — dumaloq burchaklari ostida fon ko'rinsin */
const PANEL_OVERLAP = 26;

/** Navbatdagi ish holati shu oraliqda so'raladi — operator daqiqalab ishlaydi */
const POLL_MS = 4000;
/** Tayyor rasmga shaffof kesim odatda bir necha soniyada ulanadi */
const CUTOUT_POLL_MS = 2000;
/**
 * Kesim shu vaqt ichida kelmasa rasmning o'zi ko'rsatiladi.
 *
 * ⚠️ ABADIY KUTILMAYDI. Kesim xizmati yiqilishi mumkin; u holda «tayyor»
 * rasm hech qachon ochilmay, foydalanuvchi aylanayotgan belgiga qarab
 * o'tirardi. Foni bilan bo'lsa ham ko'rsatgan yaxshi.
 */
const CUTOUT_GRACE_MS = 45_000;
/**
 * Qayta so'ralgan, lekin server hali «xato» deb turgan komplekt shu
 * muddat davomida «navbatda» deb hisoblanadi (pastdagi `staleRetry`).
 */
const STALE_RETRY_MS = 30 * 60_000;
const STALE_POLL_MS = 15_000;
/**
 * «Kiyib ko'rilganlar» qatoridagi navbatdagi natijalar shu oraliqda
 * so'raladi. Sahnadagi to'plamdan sekinroq: foydalanuvchi ularni kutib
 * o'tirgani yo'q, ular bir nechta bo'lishi mumkin.
 */
const PAST_POLL_MS = 15_000;
/**
 * Serverdan nechta natija so'raladi. Qator — gorizontal suratchalar; eng
 * yangi o'ttiztasi yetarli (server ham shundan ortig'ini bermaydi).
 */
const HISTORY_LIMIT = 30;
/** Tarix kelmagan payt uchun — har chizishda yangi massiv bo'lmasin */
const NO_HISTORY: TryonHistoryItem[] = [];
/**
 * Ekran shundan past bo'lsa (iPhone SE va 8 Plus, iPad'dagi iPhone oynasi)
 * «Kiyib ko'rilganlar» suratlari kichikroq chiziladi — aks holda sahnaga
 * joy qolmaydi.
 */
const SHORT_SCREEN = 760;

type Phase =
  /** Savat bo'sh */
  | 'empty'
  /** Kiyim bor, lekin hech biri yoqilmagan */
  | 'none'
  /** Yoqilgan kiyim hali serverdan aniqlanmoqda */
  | 'loading'
  /** Shu to'plam hali kiyib ko'rilmagan */
  | 'idle'
  /** Eslab qolingan urinishning holati serverdan so'ralmoqda */
  | 'checking'
  | 'sending'
  /** Navbatda yoki operatorda */
  | 'waiting'
  /** Rasm tayyor, shaffof kesim ulanmoqda */
  | 'finishing'
  | 'ready'
  | 'failed';

const SLOT_META: Record<string, { icon: IconName; label: keyof Dictionary['look'] }> = {
  top: { icon: 'slotTop', label: 'slotTop' },
  outer: { icon: 'slotOuter', label: 'slotOuter' },
  bottom: { icon: 'slotBottom', label: 'slotBottom' },
  feet: { icon: 'slotFeet', label: 'slotFeet' },
};

/** Savatdagi kiyimning havolasi — variant aniqlangan bo'lsa u, aks holda mahsulot. */
const refOf = (item: TrayItem): string => item.variantId ?? item.productId ?? '';

/** 135 000 ms → «02:15» */
function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function LookRoom({ showBack = false }: LookRoomProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useI18n((state) => state.t);
  const signedIn = useAuthStore((state) => state.status) === 'signedIn';

  const items = useLookStore((state) => state.items);
  const tries = useLookStore((state) => state.tries);
  const toggle = useLookStore((state) => state.toggle);
  const remove = useLookStore((state) => state.remove);
  const resolve = useLookStore((state) => state.resolve);
  const wearOnly = useLookStore((state) => state.wearOnly);
  const remember = useLookStore((state) => state.remember);
  const forget = useLookStore((state) => state.forget);

  const [zoomed, setZoomed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  /** Qaysi to'plam savatga qo'shilgan — tugma «Savatni ochish» ga aylanadi */
  const [cartKey, setCartKey] = useState<string | null>(null);
  /** Kutish soatini yuritish uchun — qiymatning o'zi ishlatilmaydi */
  const [, setTick] = useState(0);

  /*
   * Ekran ko'rinib turgandagina so'rab turamiz. Markaziy tab `freezeOnBlur`
   * bilan ochiq qoladi; fokussiz ham so'rab tursak, foydalanuvchi savatda
   * yoki profilda yurganda ham tarmoq band bo'lardi.
   */
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      // Chiqib qaytganda holat darhol yangilansin — intervalni kutmasdan
      void queryClient.invalidateQueries({ queryKey: ['look-render'] });
      // Tarix ham: boshqa qurilmada kiyintirilgan natija shu yerda ko'rinsin
      void queryClient.invalidateQueries({ queryKey: ['look-history'] });
      return () => setFocused(false);
    }, [queryClient]),
  );

  // ── Foydalanuvchi va avatar ──

  const profile = useQuery({ queryKey: ['profile'], queryFn: getFullProfile, enabled: signedIn });
  const avatar = useQuery({ queryKey: ['avatar'], queryFn: getAvatar, enabled: signedIn });

  const measurements = profile.data?.measurements;
  const hasPhoto = avatar.data?.status === 'ready' || Boolean(profile.data?.bodyPhotoUrl);
  const hasSizes =
    typeof measurements?.height === 'number' && typeof measurements?.weight === 'number';
  /*
   * ⚠️ DO'KON ENDI SHART EMAS. Ilgari do'kon tanlanmagan bo'lsa ekran
   * avatar sehrgariga qaytarardi — yig'ilgan kiyimlar esa do'konga umuman
   * bog'liq emas (ular turli do'konlardan bo'lishi mumkin).
   */
  const ready = signedIn && hasPhoto && hasSizes;

  /*
   * Avatarning shaffof kesimi yo'q bo'lsa bir marta so'raymiz.
   *
   * ⚠️ KESIMSIZ SURAT KO'RSATILMAYDI: u studiya foni bilan keladi va butik
   * foni ustida «ruh»dek ko'rinadi (2026-11-10 dagi qaror). Kesim kelguncha
   * podium bo'sh turadi.
   */
  const cutoutRequested = useRef(false);
  const ensureCutout = useMutation({
    mutationFn: requestAvatarCutout,
    onSuccess: (data) => queryClient.setQueryData(['avatar'], data),
  });
  useEffect(() => {
    if (cutoutRequested.current) return;
    if (avatar.data?.status !== 'ready' || !avatar.data.imageUrl || avatar.data.cutoutUrl) return;
    cutoutRequested.current = true;
    ensureCutout.mutate();
  }, [avatar.data, ensureCutout]);

  const avatarCutout = avatar.data?.status === 'ready' ? (avatar.data.cutoutUrl ?? null) : null;
  const avatarPreparing =
    avatar.data?.status === 'ready' &&
    Boolean(avatar.data.imageUrl) &&
    !avatar.data.cutoutUrl &&
    !ensureCutout.isError;

  // ── Savatdagi kiyimlarni serverdan aniqlash ──

  const refs = items.map(refOf);
  const garmentQueries = useQueries({
    queries: refs.map((ref) => ({
      queryKey: ['look-garment', ref],
      queryFn: () => resolveGarment(ref),
      enabled: ready && ref.length > 0,
      staleTime: 5 * 60_000,
    })),
  });

  /*
   * Kelgan ma'lumot savatga ko'chiriladi: variant, slot, nom, surat, narx.
   *
   * ⚠️ `stamp` — bog'liqlik uchun. `useQueries` har chizishda YANGI massiv
   * qaytaradi; uni bog'liqlikka qo'ysak effekt har chizishda ishlardi.
   * Solishtirish esa aynan bir xil bo'lganda hech narsa yozmaydi, ya'ni
   * halqa bo'lmaydi.
   */
  const stamp = garmentQueries.map((query) => `${query.status}:${query.dataUpdatedAt}`).join('|');
  useEffect(() => {
    items.forEach((item, index) => {
      const query = garmentQueries[index];
      const ref = refs[index];
      if (!query?.isSuccess || !ref) return;

      const garment = query.data;
      if (garment === null) {
        if (!item.gone) resolve(ref, null);
        return;
      }

      const same =
        !item.gone &&
        item.variantId === garment.variantId &&
        item.productId === garment.productId &&
        item.slot === garment.slot &&
        item.title === garment.title &&
        item.image === garment.image &&
        item.price === garment.price &&
        item.currency === garment.currency;
      if (same) return;

      // Havola mahsulotdan variantga o'zgaradi — yangi kalit uchun qayta so'ralmasin
      queryClient.setQueryData(['look-garment', garment.variantId], garment);
      resolve(ref, {
        productId: garment.productId,
        variantId: garment.variantId,
        slot: garment.slot,
        title: garment.title,
        image: garment.image,
        price: garment.price,
        currency: garment.currency,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, items]);

  /** variantId → to'liq ma'lumot (o'lchamlar savat uchun kerak) */
  const garments = useMemo(() => {
    const map = new Map<string, Garment>();
    for (const query of garmentQueries) {
      if (query.data) map.set(query.data.variantId, query.data);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  // ── Hozirgi tanlov va uning natijasi ──

  const selected = useMemo(() => selectedForTryon(items), [items]);
  const pending = useMemo(() => unresolved(items), [items]);
  const resolveFailed = items.some(
    (item, index) =>
      item.on && (item.variantId === null || item.slot === null) && garmentQueries[index]?.isError,
  );

  const selectedIds = useMemo(
    () => sortedIds(selected.map((item) => item.variantId as string)),
    [selected],
  );
  const key = tryKey(selectedIds);
  const currentTry = selectedIds.length > 0 ? findTry(tries, key) : null;

  /*
   * ⚠️ QAYTA SO'RALGAN KOMPLEKT (server tomondagi kamchilikni yopadi).
   * Yiqilgan komplekt qayta so'ralganda server yangi operator ishini
   * ochadi, lekin eski yozuvlarni «xato» holatida qoldiradi — javob ham
   * «xato» bo'lib qaytadi. Usiz «Qayta urinish» bosilganda ekran darhol
   * yana xatoni ko'rsatardi, garchi ish navbatga tushgan bo'lsa ham.
   * Bunday javob kelganda shu to'plamni bir muddat «navbatda» deb
   * ko'rsatamiz va sekinroq so'rab turamiz.
   */
  const [staleRetry, setStaleRetry] = useState<Record<string, number>>({});
  const staleSince = staleRetry[key];
  const staleActive = staleSince !== undefined && Date.now() - staleSince < STALE_RETRY_MS;

  /** Rasm «tayyor» bo'lib, kesimsiz birinchi ko'ringan payt — yozuv bo'yicha */
  const readySince = useRef<Record<string, number>>({});
  const cutoutPending = (render: TryonRender | undefined): boolean => {
    if (!render || render.status !== 'ready' || render.cutoutUrl || !render.imageUrl) return false;
    const since = readySince.current[render.id];
    return since === undefined || Date.now() - since < CUTOUT_GRACE_MS;
  };

  const renderQuery = useQuery({
    queryKey: ['look-render', currentTry?.renderId],
    queryFn: () => getRender(currentTry!.renderId),
    enabled: ready && currentTry !== null,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => {
      if (!focused) return false;
      const data = query.state.data;
      if (!data) return false;
      if (data.status === 'pending' || data.status === 'processing') return POLL_MS;
      if (cutoutPending(data)) return CUTOUT_POLL_MS;
      if (data.status === 'failed' && staleActive) return STALE_POLL_MS;
      return false;
    },
  });
  const render = currentTry ? renderQuery.data : undefined;

  useEffect(() => {
    if (render?.status === 'ready' && !render.cutoutUrl && !readySince.current[render.id]) {
      readySince.current[render.id] = Date.now();
    }
  }, [render]);

  /*
   * Yozuv serverda yo'q (tozalangan yoki boshqa akkauntniki) — urinish
   * unutiladi va ekran «hali kiyib ko'rilmagan» holatiga qaytadi.
   */
  useEffect(() => {
    const err = renderQuery.error;
    if (currentTry && err instanceof ApiError && (err.status === 404 || err.code === 'NOT_FOUND')) {
      forget(currentTry.key);
    }
  }, [renderQuery.error, currentTry, forget]);

  // ── Kiyib ko'rilganlar ──

  /*
   * Eslab qolingan har urinishning natijasi — tugma tepasidagi qator uchun.
   *
   * Kalit sahnadagi so'rov bilan BIR XIL (`look-render`): hozirgi to'plam
   * ikki marta so'ralmaydi, qatordagi surat bosilganda esa sahna natijani
   * keshdan darhol oladi.
   *
   * ⚠️ FAQAT NAVBATDAGILARI KUZATILADI. Tayyor natija o'zgarmaydi. Navbatdagisi
   * esa foydalanuvchi boshqa to'plamga o'tib ketgan bo'lsa ham kuzatiladi —
   * tayyor bo'lgach qatorda o'zi paydo bo'lsin.
   */
  const pastQueries = useQueries({
    queries: tries.map((record) =>
      queryOptions({
        queryKey: ['look-render', record.renderId],
        queryFn: () => getRender(record.renderId),
        enabled: ready,
        staleTime: 60_000,
        retry: false,
        refetchInterval: (query) => {
          if (!focused) return false;
          const state = query.state.data?.status;
          return state === 'pending' || state === 'processing' ? PAST_POLL_MS : false;
        },
      }),
    ),
  });

  const pastRenders = new Map<string, TryonRender>();
  tries.forEach((record, index) => {
    const data = pastQueries[index]?.data;
    if (data) pastRenders.set(record.renderId, data);
  });

  /*
   * Serverdagi tarix — qurilma eslab qolmagan natijalar uchun: ilova qayta
   * o'rnatilgan, boshqa telefon yoki oltitadan eski urinish.
   *
   * ⚠️ XATO — «TARIX YO'Q» DEGANI, NOSOZLIK EMAS. Eski serverda bu yo'l
   * yo'q (404), tarmoq ham uzilishi mumkin; qator u holda faqat qurilmadagi
   * urinishlardan to'ladi. Shuning uchun xato ekranga chiqarilmaydi va
   * qayta urinilmaydi — keyingi ochilishda yana bir marta so'raladi.
   */
  const historyQuery = useQuery({
    queryKey: ['look-history'],
    queryFn: () => getTryonHistory(HISTORY_LIMIT),
    enabled: ready,
    staleTime: 60_000,
    retry: false,
  });
  const history = historyQuery.data ?? NO_HISTORY;

  /*
   * «Sahnada» deb faqat tanlov TO'LIQ aniqlangach belgilanadi: yoqiq kiyim
   * hali serverdan so'ralayotgan bo'lsa, tanlov chala bo'ladi va boshqa
   * to'plamning natijasi bir lahzaga belgilanib qolardi.
   */
  const past = pastLooks(
    tries,
    pastRenders,
    history,
    pending.length === 0 && currentTry ? currentTry.renderId : null,
  );

  const start = useMutation({
    mutationFn: (variantIds: string[]) => startTryon(variantIds),
    onMutate: () => {
      setNotice(null);
      setLimitReached(false);
    },
    onSuccess: (result, variantIds) => {
      if (result.kind === 'limit') {
        setLimitReached(true);
        return;
      }

      const tried = tryKey(variantIds);
      queryClient.setQueryData(['look-render', result.render.id], result.render);
      remember({
        key: tried,
        variantIds: sortedIds(variantIds),
        renderId: result.render.id,
        at: Date.now(),
      });
      // Javobning o'zi «xato» — server eski yozuvni tozalamagan (yuqoridagi izoh)
      if (result.render.status === 'failed') {
        setStaleRetry((current) => ({ ...current, [tried]: Date.now() }));
      }
    },
    /*
     * ⚠️ YUZ KERAK HOLATI ALOHIDA. Kiyintirish `face_texture_url`siz
     * VALIDATION_ERROR beradi, lekin `explainError` uni umumiy `generic`
     * («Something went wrong») ga tushiradi — foydalanuvchi nima qilishni
     * bilmaydi. Yuz yo'qligini mijoz o'zi biladi (`profile.faceTextureUrl`),
     * shuning uchun aniq ko'rsatma beramiz (avatar.tsx dagi kabi).
     */
    onError: (err) =>
      setNotice(
        err instanceof ApiError &&
          err.code === 'VALIDATION_ERROR' &&
          !profile.data?.faceTextureUrl
          ? t.avatar.needFaceHint
          : explainError(err, t),
      ),
  });

  // ── Holat ──

  let phase: Phase;
  if (items.length === 0) {
    phase = 'empty';
  } else if (start.isPending) {
    phase = 'sending';
  } else if (pending.length > 0) {
    phase = 'loading';
  } else if (selected.length === 0) {
    phase = 'none';
  } else if (!currentTry) {
    phase = 'idle';
  } else if (!render) {
    /*
     * Holat hali kelmagan. So'rab bo'lmagan bo'lsa (tarmoq) tugma ochiq
     * qoladi: qayta bosish xavfsiz — server mavjud yozuvni qaytaradi.
     */
    phase = renderQuery.isError ? 'idle' : 'checking';
  } else if (render.status === 'ready') {
    phase = cutoutPending(render) ? 'finishing' : 'ready';
  } else if (render.status === 'failed') {
    phase = staleActive ? 'waiting' : 'failed';
  } else {
    phase = 'waiting';
  }

  // Kutish paytida soat yuradi; shu bilan birga kesim muddati ham tekshiriladi
  const ticking = phase === 'waiting' || phase === 'finishing';
  useEffect(() => {
    if (!ticking) return undefined;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  // ── Savat ──

  const total = selected.reduce((sum, item) => sum + Number(item.price ?? 0), 0);
  const currency = selected[0]?.currency ?? 'UZS';

  const cart = useMutation({
    mutationFn: async (lines: Array<{ variantId: string; size: string }>) => {
      /*
       * ⚠️ KETMA-KET, PARALLEL EMAS. Savat bir foydalanuvchi uchun bitta
       * qator to'plami; bir vaqtda yozilsa ombor bandligi noto'g'ri
       * hisoblanishi mumkin. Kiyim kam (4 tagacha) — sekinligi sezilmaydi.
       */
      for (const line of lines) await addToCart(line.variantId, line.size);
      return lines.length;
    },
    onSuccess: (count) => {
      setNotice(t.tryon.addedToCart.replace('{n}', String(count)));
      setCartKey(key);
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (err) => setNotice(explainError(err, t)),
  });

  /**
   * Har kiyimga O'ZINING tavsiya o'lchami: ustki kiyim ko'krakdan, pastki
   * beldan hisoblanadi. Tavsiya omborda bo'lmasa — mavjud birinchisi.
   */
  const sizeFor = (item: TrayItem): string | null => {
    const garment = item.variantId ? garments.get(item.variantId) : undefined;
    if (!garment || !item.slot) return null;
    const fit = measurements ? recommendSize(item.slot, measurements) : null;
    return matchSize(garment.sizes, fit) ?? garment.sizes[0] ?? null;
  };

  const addSelectedToCart = (): void => {
    const lines = selected
      .map((item) => {
        const size = sizeFor(item);
        return size && item.variantId ? { variantId: item.variantId, size } : null;
      })
      .filter((line): line is { variantId: string; size: string } => line !== null);

    if (lines.length === 0) {
      setNotice(t.tryon.soldOut);
      return;
    }
    cart.mutate(lines);
  };

  /** Kiyim qo'shish — do'konga, «Look» tugmalari turgan joyga */
  const addMore = (): void => {
    if (showBack) goBack('/(tabs)');
    else router.navigate('/(tabs)');
  };

  /**
   * Kiyib ko'rilgan natijani sahnaga qaytaradi: o'sha kiyimlar yoqiladi
   * (savatdan olib tashlangani qaytadan qo'shiladi), qolganlari o'chadi —
   * natija esa tanlovga ergashib o'zi chiqadi.
   */
  const showPast = (look: PastLook): void => {
    if (look.current) return;
    setNotice(null);

    /*
     * ⚠️ SAHNA NATIJANI QURILMADAGI URINISHDAN TOPADI (`findTry`). Serverdan
     * kelgan natija u yerda yo'q bo'lishi mumkin (boshqa telefon, qayta
     * o'rnatish, oltitadan eski) — yoki shu to'plam uchun BOSHQA yozuv eslab
     * qolingan (surat almashgandan keyingi qayta urinish). Bosilgani eslab
     * qolinmasa, kiyimlar yoqilib, sahnada avatar qolardi.
     *
     * Tanlov o'zi mos kelganda esa tarix ISHLATILMAYDI: «Kiyintirish»
     * bosilsa server hozirgi surat uchun o'zi hal qiladi (kesh yoki yangi).
     * Eski suratdagi natija faqat mijoz uni o'zi bosganda ko'rsatiladi.
     */
    if (findTry(tries, look.key)?.renderId !== look.id) {
      // Sahna «tekshirilmoqda» ni ko'rsatib o'tirmasin — javob allaqachon qo'lda
      const known = history.find((item) => item.render.id === look.id)?.render;
      if (known && queryClient.getQueryData(['look-render', look.id]) === undefined) {
        queryClient.setQueryData(['look-render', look.id], known);
      }
      remember({
        key: look.key,
        variantIds: look.variantIds,
        renderId: look.id,
        at: look.at > 0 ? look.at : Date.now(),
      });
    }

    wearOnly(wearInputs(look.variantIds, items));
  };

  // ── Qorovullar (barcha hooklardan KEYIN — tartib buzilmasin) ──

  if (!signedIn) {
    return (
      <Screen>
        <SignInRequired hint={t.tryon.signInHint} />
      </Screen>
    );
  }

  if (profile.isError || avatar.isError) {
    return (
      <Screen>
        <ErrorView
          error={profile.error ?? avatar.error}
          onRetry={() => {
            void profile.refetch();
            void avatar.refetch();
          }}
        />
      </Screen>
    );
  }

  if (!profile.isSuccess || !avatar.isSuccess) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  // Avatar yoki o'lchamlar yo'q — avval sehrgar
  if (!ready) return <Redirect href="/ai/avatar" />;

  // ── Sahna o'lchovlari ──

  const background = profile.data.gender === 'male' ? MALE_BACKGROUND : FEMALE_BACKGROUND;

  /*
   * Tab qatori ekran ustida suzadi (`(tabs)/_layout.tsx`: 72 + chekka);
   * tabda panel uning ostida qolmasligi uchun joy qoldiriladi.
   */
  const bottomPad = showBack ? insets.bottom + spacing.md : Math.max(insets.bottom, 8) + 72 + 22;

  const stageSource =
    phase === 'ready' && render ? (render.cutoutUrl ?? render.imageUrl) : avatarCutout;

  const status: { title: string; hint?: string; busy: boolean; time?: string } | null =
    phase === 'sending' || phase === 'checking'
      ? { title: phase === 'sending' ? t.tryon.sendingTitle : t.tryon.checkingTitle, busy: true }
      : phase === 'waiting'
        ? {
            title: t.tryon.waitingTitle,
            hint: t.tryon.waitingHint,
            busy: true,
            ...(currentTry ? { time: clock(Date.now() - currentTry.at) } : {}),
          }
        : phase === 'finishing'
          ? { title: t.tryon.finishingTitle, hint: t.tryon.finishingHint, busy: true }
          : phase === 'failed'
            ? { title: t.tryon.failedTitle, hint: t.tryon.failedHint, busy: false }
            : avatarPreparing
              ? { title: t.tryon.avatarPreparing, busy: true }
              : null;

  const inCart = cartKey === key && phase === 'ready';

  /*
   * ⚠️ IKKALA HOLATDA HAM — savat bo'sh bo'lsa ham. Qator savatga emas,
   * natijalarga bog'liq: kiyimlar olib tashlangach yo'qolib qolsa, mijoz
   * kiyintirgan natijalariga qaytish yo'lini yo'qotardi.
   */
  const pastStrip =
    past.length > 0 ? (
      <PastStrip looks={past} compact={height < SHORT_SCREEN} t={t} onPick={showPast} />
    ) : null;

  return (
    <Screen>
      <Stage
        width={width}
        background={background}
        source={stageSource}
        zoomed={zoomed}
        top={insets.top}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
          {showBack ? (
            <RoundButton icon="back" label={t.tryon.back} onPress={() => goBack('/(tabs)')} />
          ) : (
            <View style={styles.roundPlaceholder} />
          )}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t.tryon.title}
          </Text>
          <RoundButton
            icon="camera"
            label={t.tryon.changeAvatar}
            onPress={() => router.push('/ai/avatar')}
          />
        </View>

        {stageSource ? (
          <View style={styles.zoom}>
            <RoundButton
              icon="zoom"
              label={zoomed ? t.tryon.zoomOut : t.tryon.zoomIn}
              active={zoomed}
              onPress={() => setZoomed((value) => !value)}
            />
          </View>
        ) : null}

        {status ? (
          <View style={styles.statusWrap} pointerEvents="none">
            <View style={styles.statusCard}>
              {status.busy ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Icon name="close" size={22} color={colors.danger} />
              )}
              <Text style={styles.statusTitle}>{status.title}</Text>
              {status.hint ? <Text style={styles.statusHint}>{status.hint}</Text> : null}
              {status.time ? <Text style={styles.statusTime}>{status.time}</Text> : null}
            </View>
          </View>
        ) : null}
      </Stage>

      <View style={[styles.panel, { paddingBottom: bottomPad }]}>
        {phase === 'empty' ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="looks" size={22} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t.tryon.emptyTitle}</Text>
            <Text style={styles.emptyHint}>{t.tryon.emptyHint}</Text>
            {pastStrip}
            <View style={styles.actions}>
              <Button title={t.tryon.pickClothes} icon="looks" pill onPress={addMore} />
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/looks')}
                hitSlop={8}
                style={styles.link}
              >
                <Text style={styles.linkText}>{t.tryon.savedLooks}</Text>
                <Icon name="next" size={14} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.trayHead}>
              <Text style={styles.trayTitle}>{t.tryon.trayTitle}</Text>
              <Text style={styles.trayCount}>
                {selected.length + pending.length}/{items.length}
              </Text>
            </View>

            {/*
              ⚠️ BALANDLIK IKKI JOYDA ANIQ BERILGAN — qatorning o'zida va har
              kartada. Gorizontal `ScrollView` balandligi berilmagan bolani
              yig'ib qo'yadi va karta ostidagi yozuv kesilib qoladi.
            */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.strip}
              contentContainerStyle={styles.stripContent}
            >
              {items.map((item) => (
                <TrayCard
                  key={refOf(item)}
                  item={item}
                  size={item.on ? sizeFor(item) : null}
                  t={t}
                  onToggle={() => {
                    setNotice(null);
                    toggle(refOf(item));
                  }}
                  onRemove={() => {
                    setNotice(null);
                    remove(refOf(item));
                  }}
                />
              ))}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.tryon.addMore}
                onPress={addMore}
                style={({ pressed }) => [styles.addCard, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.addThumb}>
                  <Text style={styles.addPlus}>+</Text>
                </View>
                <Text style={styles.cardLabel} numberOfLines={1}>
                  {t.tryon.addShort}
                </Text>
              </Pressable>
            </ScrollView>

            {pastStrip}

            <Text style={[styles.note, (limitReached || resolveFailed) && styles.noteWarn]}>
              {limitReached
                ? t.tryon.limit
                : resolveFailed
                  ? t.tryon.loadFailed
                  : (notice ?? (phase === 'ready' ? t.tryon.readyNote : t.tryon.trayHint))}
            </Text>

            <View style={styles.actions}>
              {resolveFailed ? (
                <Button
                  title={t.tryon.reload}
                  icon="reset"
                  variant="ghost"
                  pill
                  onPress={() => {
                    for (const query of garmentQueries) {
                      if (query.isError) void query.refetch();
                    }
                  }}
                />
              ) : phase === 'ready' ? (
                inCart ? (
                  <Button
                    title={t.tryon.openCart}
                    icon="bag"
                    trailingIcon="next"
                    pill
                    onPress={() => router.push('/(tabs)/cart')}
                  />
                ) : (
                  <Button
                    title={t.tryon.toCart.replace('{total}', money(String(total), currency))}
                    icon="bag"
                    pill
                    loading={cart.isPending}
                    onPress={addSelectedToCart}
                  />
                )
              ) : (
                <Button
                  title={
                    phase === 'none'
                      ? t.tryon.dressNone
                      : phase === 'loading' || phase === 'checking'
                        ? t.tryon.dressLoading
                        : phase === 'waiting' || phase === 'finishing'
                          ? t.tryon.waitingButton
                          : phase === 'failed'
                            ? t.tryon.retry
                            : t.tryon.dress.replace('{n}', String(selected.length))
                  }
                  icon={phase === 'failed' ? 'reset' : 'tryon'}
                  pill
                  loading={phase === 'sending'}
                  disabled={
                    phase === 'none' ||
                    phase === 'loading' ||
                    phase === 'checking' ||
                    phase === 'waiting' ||
                    phase === 'finishing'
                  }
                  onPress={() => start.mutate(selectedIds)}
                />
              )}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

/**
 * Sahna: butik foni va uning podiumida turgan odam.
 *
 * ⚠️ ODAM PODIUMGA HISOB BILAN QO'YILADI. Fon surati ekran kengligiga
 * moslab chiziladi va PASTIDAN langarlanadi (kesilsa — shift kesiladi,
 * podium emas). Podium markazi suratning ma'lum foizida, shuning uchun
 * odam ramkasining pasti aynan o'sha chiziqqa tushadi — ekran balandligi
 * qanday bo'lmasin.
 *
 * ⚠️ RAMKA TO'LIQ KENGLIKDA. Shunda `contain` suratni BALANDLIK bo'yicha
 * sig'diradi va odamning oyog'i ramkaning pastiga — podiumga — tegib
 * turadi. Tor ramkada surat kenglikka tiralib, odam havoda osilib qolardi.
 */
function Stage({
  width,
  background,
  source,
  zoomed,
  top,
  children,
}: {
  width: number;
  background: number;
  source: string | null;
  zoomed: boolean;
  /** Yuqoridagi xavfsiz chekka — sarlavha shundan keyin boshlanadi */
  top: number;
  children: ReactNode;
}): JSX.Element {
  const [stageHeight, setStageHeight] = useState(0);

  /*
   * Surat kenglikka mos chiziladi; sahna undan baland chiqib qolsa (juda
   * uzun ekran) — tepada bo'sh joy qolmasligi uchun kattalashtiriladi.
   */
  const fitted = width / BACKGROUND_ASPECT;
  const scale = Math.max(1, stageHeight / (fitted * (1 - FLOOR_HIDDEN)));
  const imageWidth = width * scale;
  const imageHeight = fitted * scale;

  /** Podium markazi sahna pastidan shuncha yuqorida */
  const podium = imageHeight * (1 - PODIUM_CENTER - FLOOR_HIDDEN);
  /** Odam ramkasi: sarlavha ostidan podiumgacha */
  const personTop = top + 52;
  const personHeight = Math.max(0, stageHeight - personTop - podium);

  return (
    <View
      style={styles.stage}
      onLayout={(event) => setStageHeight(event.nativeEvent.layout.height)}
    >
      <View style={styles.backdrop} pointerEvents="none">
        <Image
          source={background}
          resizeMode="stretch"
          style={{
            position: 'absolute',
            left: (width - imageWidth) / 2,
            bottom: -imageHeight * FLOOR_HIDDEN,
            width: imageWidth,
            height: imageHeight,
          }}
        />
      </View>

      {source && personHeight > 0 ? (
        <Image
          source={{ uri: source }}
          resizeMode="contain"
          style={[
            styles.person,
            { top: personTop, height: personHeight },
            zoomed && { transform: [{ scale: 1.5 }, { translateY: personHeight * 0.14 }] },
          ]}
        />
      ) : null}

      {children}
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  active = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        active && styles.roundActive,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Icon name={icon} size={20} color={active ? colors.textOnPrimary : colors.text} />
    </Pressable>
  );
}

/** Savatdagi bitta kiyim: bosilsa yoqiladi/o'chadi, burchakdagi × — olib tashlaydi. */
function TrayCard({
  item,
  size,
  t,
  onToggle,
  onRemove,
}: {
  item: TrayItem;
  /** Savatga tushadigan o'lcham — yoqiq kiyimda ko'rsatiladi */
  size: string | null;
  t: Dictionary;
  onToggle: () => void;
  onRemove: () => void;
}): JSX.Element {
  const wearable = canWear(item);
  const meta = item.slot ? SLOT_META[item.slot] : undefined;
  const label = item.gone ? t.tryon.gone : meta ? t.look[meta.label] : '';
  const name = item.title ?? label;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={name}
        accessibilityState={{ checked: item.on, disabled: !wearable }}
        disabled={!wearable}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.thumbWrap,
          item.on && styles.thumbOn,
          pressed && { opacity: 0.8 },
        ]}
      >
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            resizeMode="cover"
            style={[styles.thumb, !item.on && styles.thumbOff]}
          />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            {meta ? <Icon name={meta.icon} size={22} color={colors.textDim} /> : null}
          </View>
        )}

        {item.on ? (
          <View style={styles.check}>
            <Icon name="check" size={11} color={colors.textOnPrimary} />
          </View>
        ) : null}

        {size ? (
          <View style={styles.sizeTag}>
            <Text style={styles.sizeTagText}>{size}</Text>
          </View>
        ) : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.tryon.remove.replace('{title}', name)}
        hitSlop={10}
        onPress={onRemove}
        style={styles.remove}
      >
        <Icon name="close" size={10} color={colors.textMuted} />
      </Pressable>

      <Text style={[styles.cardLabel, item.on && styles.cardLabelOn]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Kiyib ko'rilganlar: mijoz kiyintirgan to'plamlarning suratlari, eng
 * yangisi boshida. Bosilgani sahnaga qaytadi; sahnada turgani hoshiya bilan
 * belgilangan.
 *
 * ⚠️ KICHIK — ATAYIN. Qator doim turadi va panelni balandlatadi, panel esa
 * sahnadan joy oladi: har qo'shilgan nuqta sahnadagi odamni shuncha
 * kichraytiradi. Surat bu yerda faqat tanib olish uchun; kattasi —
 * bosilganda, sahnada.
 *
 * ⚠️ SARLAVHA TEPADA EMAS, YONDA — shu sababdan. Alohida sarlavha qatori
 * sahnadan yana ~20 nuqta olardi; yozuv suratlardan keyin, qatorning o'zida
 * turadi (natija ko'payganda surilib ketadi — u paytda qator o'zi tushunarli).
 */
function PastStrip({
  looks,
  compact,
  t,
  onPick,
}: {
  looks: PastLook[];
  /** Past ekran: kichikroq suratlar */
  compact: boolean;
  t: Dictionary;
  onPick: (look: PastLook) => void;
}): JSX.Element {
  const step = (compact ? PAST_WIDTH_COMPACT : PAST_WIDTH) + spacing.sm;

  return (
    /*
     * ⚠️ `FlatList` — SURATLAR UCHUN. Tarix o'ttiztagacha natija beradi;
     * oddiy `ScrollView` hammasini birdan chizib, hamma suratni birdan
     * yuklardi (har biri ~200 KB). Bu yerda ko'ringanlari va yaqinlari
     * yuklanadi, qolgani — surilganda.
     *
     * ⚠️ Balandlik ikki joyda aniq — yuqoridagi kiyimlar qatoridagi sabab bilan.
     */
    <FlatList
      horizontal
      data={looks}
      keyExtractor={(look) => look.id}
      showsHorizontalScrollIndicator={false}
      style={[styles.pastStrip, compact && styles.pastStripCompact]}
      contentContainerStyle={styles.pastContent}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      getItemLayout={(_, index) => ({
        length: step - spacing.sm,
        offset: spacing.md + step * index,
        index,
      })}
      renderItem={({ item: look, index }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.tryon.pastOpen.replace('{n}', String(index + 1))}
          accessibilityState={{ selected: look.current }}
          onPress={() => onPick(look)}
          style={({ pressed }) => [
            styles.pastThumb,
            compact && styles.pastThumbCompact,
            look.current && styles.pastThumbOn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Image
            source={{ uri: look.image }}
            resizeMode={look.cutout ? 'contain' : 'cover'}
            style={styles.pastImage}
          />
        </Pressable>
      )}
      ListFooterComponent={
        <View style={[styles.pastCaption, compact && styles.pastCaptionCompact]}>
          <Text style={styles.pastCaptionText} numberOfLines={2}>
            {t.tryon.pastTitle}
          </Text>
        </View>
      }
    />
  );
}

const CARD_WIDTH = 68;
const THUMB_HEIGHT = 84;
const LABEL_HEIGHT = 18;
const CARD_HEIGHT = THUMB_HEIGHT + LABEL_HEIGHT;

const PAST_WIDTH = 48;
const PAST_HEIGHT = 64;
const PAST_WIDTH_COMPACT = 40;
const PAST_HEIGHT_COMPACT = 52;

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 220 },
  backdrop: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: '#EEE7F7' },
  person: { position: 'absolute', left: 0, right: 0 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: { ...text.h3, color: colors.text, flex: 1, textAlign: 'center' },
  round: {
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
  roundActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roundPlaceholder: { width: 42, height: 42 },
  zoom: { position: 'absolute', right: spacing.md, bottom: PANEL_OVERLAP + spacing.md },

  statusWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  statusCard: {
    maxWidth: 290,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#32105B',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  statusTitle: { ...text.h3, color: colors.text, textAlign: 'center', marginTop: spacing.xs },
  statusHint: { ...text.small, color: colors.textMuted, textAlign: 'center' },
  statusTime: {
    ...text.small,
    fontFamily: fonts.semibold,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },

  panel: {
    marginTop: -PANEL_OVERLAP,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    backgroundColor: colors.surface,
    shadowColor: '#5D2B91',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },

  trayHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  trayTitle: { ...text.h3, color: colors.text },
  trayCount: { ...text.small, color: colors.textDim, fontVariant: ['tabular-nums'] },

  strip: { flexGrow: 0, height: CARD_HEIGHT + 8, marginHorizontal: -spacing.md },
  stripContent: { paddingHorizontal: spacing.md, paddingTop: 8, gap: spacing.sm },
  card: { width: CARD_WIDTH, height: CARD_HEIGHT },
  thumbWrap: {
    width: CARD_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  thumbOn: { borderColor: colors.primary },
  thumb: { width: '100%', height: '100%' },
  thumbOff: { opacity: 0.4 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  check: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  sizeTag: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  sizeTagText: { ...text.tiny, fontSize: 10, lineHeight: 13, color: colors.text },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cardLabel: {
    ...text.tiny,
    height: LABEL_HEIGHT,
    lineHeight: LABEL_HEIGHT,
    color: colors.textDim,
    textAlign: 'center',
  },
  cardLabelOn: { color: colors.text },
  addCard: { width: CARD_WIDTH, height: CARD_HEIGHT },
  addThumb: {
    width: CARD_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: { fontFamily: fonts.regular, fontSize: 26, lineHeight: 30, color: colors.primary },

  pastStrip: {
    flexGrow: 0,
    height: PAST_HEIGHT,
    marginTop: spacing.sm,
    marginHorizontal: -spacing.md,
  },
  pastStripCompact: { height: PAST_HEIGHT_COMPACT },
  pastContent: { paddingHorizontal: spacing.md, gap: spacing.sm },
  pastThumb: {
    width: PAST_WIDTH,
    height: PAST_HEIGHT,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  pastThumbCompact: { width: PAST_WIDTH_COMPACT, height: PAST_HEIGHT_COMPACT },
  pastThumbOn: { borderColor: colors.primary },
  pastImage: { width: '100%', height: '100%' },
  pastCaption: {
    height: PAST_HEIGHT,
    maxWidth: 128,
    justifyContent: 'center',
    paddingLeft: spacing.xs,
  },
  pastCaptionCompact: { height: PAST_HEIGHT_COMPACT },
  pastCaptionText: { ...text.tiny, color: colors.textMuted },

  note: {
    ...text.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    minHeight: 20,
  },
  noteWarn: { color: colors.warning },
  actions: { marginTop: spacing.sm, gap: spacing.sm },

  empty: { alignItems: 'stretch', paddingTop: spacing.xs },
  emptyIcon: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.sm,
  },
  emptyTitle: { ...text.h3, color: colors.text, textAlign: 'center' },
  emptyHint: {
    ...text.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: spacing.md,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 32,
  },
  linkText: { ...text.bodyMed, color: colors.primary },
});
