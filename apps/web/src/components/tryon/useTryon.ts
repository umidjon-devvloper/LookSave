import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  baseForCategory,
  clearLayer,
  indexRenders,
  layerRank,
  nextPending,
  renderKey,
  resolveAtFrontChain,
  resolveOutfit,
  setLayer,
  topReady,
  type OutfitLayer,
} from '@looksave/validation';

import type { AvatarAngle, Garment, TryonRender } from '@/api/endpoints';
import type { TryonState } from '@/routes/try-on.state';

/**
 * Kiyintirish sahifasining butun mantiqi.
 *
 * ⚠️ NEGA HOOK, KOMPONENT EMAS. Bu yerda o'nga yaqin bog'liq holat bor
 * (turkum, burchak, komplekt, do'kon, chegara, so'ralganlar belgisi) va
 * ular orasidagi qoidalar sahifaning JSX'i bilan aralashib ketsa, har
 * o'zgarishda ikkalasini birga o'qishga to'g'ri kelardi.
 *
 * ⚠️ MOBIL ILOVADAGI `FittingExperience.tsx` BILAN BIR XIL QOIDALAR.
 * Umumiy mantiq (`resolveOutfit`, `recommendSize`) `@looksave/validation`
 * da — ikki tomon ajralib ketmasligi uchun. Bu yerda faqat brauzerga xos
 * qism: `fetch`, polling va `localStorage`.
 *
 * ⚠️ REACT QUERY ISHLATILMAYDI. Paket bog'liqlikda bor, lekin saytda
 * hech qayerda ulanmagan (`root.tsx` da provayder yo'q). Bitta sahifa
 * uchun butun ilovaga provayder qo'shish — alohida qaror; oddiy
 * `fetch` + interval bu yerda yetarli.
 */

/** Tanlangan do'kon brauzerda saqlanadi — sahifa har ochilganda so'ralmasin */
const STORE_KEY = 'looksave.tryon.store';

/** Natija kutilayotganda holat shu oraliqda qayta so'raladi */
const POLL_MS = 2500;

export interface ChosenStore {
  id: string;
  name: string;
}

function readStore(): ChosenStore | null {
  /*
   * ⚠️ SSR'DA `localStorage` YO'Q va `try/catch` shart: brauzerda ham u
   * o'chirilgan bo'lishi mumkin (maxfiylik rejimi, korporativ siyosat).
   * Bunday holda do'kon shunchaki har safar so'raladi.
   */
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;

    const saved = JSON.parse(raw) as { id?: unknown; name?: unknown };
    return typeof saved.id === 'string' && typeof saved.name === 'string'
      ? { id: saved.id, name: saved.name }
      : null;
  } catch {
    return null;
  }
}

function writeStore(store: ChosenStore | null): void {
  try {
    if (store) window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    // Saqlanmasa do'kon keyingi safar qaytadan so'raladi — ekran buzilmaydi
  }
}

interface ActBody {
  op: string;
  [key: string]: unknown;
}

export function useTryon(locale: string) {
  const [tab, setTab] = useState('tshirt');
  const [angle, setAngle] = useState<AvatarAngle>('front');
  const [outfit, setOutfit] = useState<OutfitLayer[]>([]);
  const [store, setStoreState] = useState<ChosenStore | null>(null);
  const [onlyMySize, setOnlyMySize] = useState(true);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [limitReached, setLimitReached] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [state, setState] = useState<TryonState | null>(null);
  const [loading, setLoading] = useState(true);

  /*
   * ⚠️ DO'KON BIRINCHI CHIZISHDA O'QILMAYDI. Server `localStorage` ni
   * ko'rmaydi va agar uni boshlang'ich holatga qo'ysak, serverning
   * chizgani bilan brauzerniki mos kelmay hidratsiya xatosi chiqardi.
   */
  useEffect(() => setStoreState(readStore()), []);

  const setStore = useCallback((next: ChosenStore | null) => {
    writeStore(next);
    setLimitReached(false);
    setNotice(null);
    /*
     * ⚠️ DO'KON ALMASHSA KOMPLEKT TOZALANADI. Kiyimlar do'konga
     * bog'langan: eski do'konning futbolkasi yangi ro'yxatda yo'q va
     * uni savatga qo'shib bo'lmaydi.
     */
    setOutfit([]);
    setDismissed([]);
    setStoreState(next);
  }, []);

  /**
   * Yuborilgan so'rovlar belgisi.
   *
   * ⚠️ USIZ PUL SARFLANARDI. Effektlar holat har yangilanganda qayta
   * ishlaydi; belgisiz har kelgan javob yangi navbat yaratardi.
   */
  const asked = useRef(new Set<string>());

  /** Eskirgan javoblarni tashlash uchun — so'rovlar ketma-ket kelmasligi mumkin */
  const requestSeq = useRef(0);

  const outfitParam = useMemo(
    () => outfit.map((layer) => `${layer.category}:${layer.variantId}`).join(','),
    [outfit],
  );

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;

    const params = new URLSearchParams({ category: tab, angle, fit: onlyMySize ? '1' : '0' });
    if (store) params.set('storeId', store.id);
    if (outfitParam) params.set('outfit', outfitParam);

    try {
      const response = await fetch(`/${locale}/try-on/state?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as TryonState;

      // Kechikkan javob yangisini bosib ketmasin
      if (seq === requestSeq.current) setState(payload);
    } catch {
      if (seq === requestSeq.current) {
        setNotice('Tarmoq bilan bog`lanib bo`lmadi');
      }
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [locale, tab, angle, onlyMySize, store, outfitParam]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Natijalar jadvali — tasma va komplekt bir joyda qidiriladi */
  const renderIndex = useMemo(
    () => indexRenders([...(state?.stripRenders ?? []), ...(state?.outfitRenders ?? [])]),
    [state?.stripRenders, state?.outfitRenders],
  );

  /**
   * FRONT renderlari — yon/orqa uchun zanjir shundan tiklanadi (server
   * qo'shimcha burchak yozuvlariga FRONT bazasi bilan yozadi). Old
   * burchakda `outfitRenders` ning o'zi front.
   */
  const frontIndex = useMemo(
    () =>
      indexRenders(
        angle === 'front' ? (state?.outfitRenders ?? []) : (state?.frontRenders ?? []),
      ),
    [angle, state?.outfitRenders, state?.frontRenders],
  );

  /** FRONT zanjiri — `stripBase` va yon/orqa render izlashi uchun. */
  const frontResolved = useMemo(
    () => resolveOutfit(outfit, frontIndex),
    [outfit, frontIndex],
  );

  /**
   * Sahna uchun resolved.
   *
   * - Old: `renderIndex` (outfit + strip) — tasmadan bosilgan zahoti almashadi.
   * - Yon/Orqa: FRONT zanjiri yuriladi, har qatlamning shu bazadagi yon/orqa
   *   renderi izlanadi (`resolveAtFrontChain`).
   */
  const resolved = useMemo(() => {
    if (angle === 'front') return resolveOutfit(outfit, renderIndex);
    return resolveAtFrontChain(outfit, frontIndex, renderIndex);
  }, [angle, outfit, renderIndex, frontIndex]);

  /**
   * Joriy turkumdagi kiyimlar qaysi natija ustiga kiydiriladi.
   *
   * ⚠️ FRONT ZANJIRIDAN. Yon/orqa burchakda ham baza FRONT bo'ladi —
   * chunki strip so'rovi (variantId, FRONT_base) bilan kalitlangan
   * yon/orqa renderlarni oladi.
   */
  const stripBase = useMemo(() => baseForCategory(frontResolved, tab), [frontResolved, tab]);

  /*
   * ⚠️ AVATARSIZ KIYINTIRISH BOSHLANMAYDI.
   *
   * Server model surati sifatida avatarni (yoki gavda suratini) talab
   * qiladi; ularsiz har so'rov «Avval avatar yasang» bilan qaytadi.
   * Ilgari bu tekshiruv YO'Q edi: sahifa `state.ready` ni ko'rib
   * kiyintirishni boshlayverardi, so'rovlar ketma-ket yiqilardi va
   * spinner TO'XTAMASDI — ekranda cheksiz «AI kiyintirmoqda…» turardi.
   */
  const hasBase = state?.avatar?.status === 'ready' || Boolean(state?.profile?.bodyPhotoUrl);

  const items = useMemo(() => state?.garments ?? [], [state?.garments]);

  /** Natija kutilayotgan bo'lsa holat qayta so'raladi */
  const pending = useMemo(
    () =>
      [...(state?.stripRenders ?? []), ...(state?.outfitRenders ?? [])].some(
        (render) => render.status === 'pending' || render.status === 'processing',
      ) || state?.avatar?.status === 'processing',
    [state],
  );

  useEffect(() => {
    if (!pending) return;

    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [pending, refresh]);

  const act = useCallback(
    async (body: ActBody): Promise<{ data?: unknown; error?: string; code?: string }> => {
      /*
       * ⚠️ IKKALA QADAM HAM OTIB KETISHI MUMKIN, va ikkalasida ham
       * natija bir xil ko'rinardi: xom brauzer xabari ekranga chiqib
       * qolardi («Load failed» / «Failed to fetch»). Bu chaqiruvchilar
       * `error` maydonini o'qishini hisobga olib, xatoni TASHLAMAYMIZ —
       * o'sha shaklda qaytaramiz.
       */
      let response: Response;
      try {
        response = await fetch(`/${locale}/try-on/act`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body),
        });
      } catch {
        return { error: 'Serverga ulanib bo`lmadi — ulanishni tekshiring' };
      }

      /*
       * ⚠️ JSON BO'LMASLIGI MUMKIN: proksi yoki SSR qatlami xato
       * sahifasini (HTML) qaytarsa `response.json()` otib ketadi va
       * yuqoridagi `catch` uni ushlamaydi — u faqat tarmoq uchun.
       */
      const payload = (await response.json().catch(() => null)) as {
        data?: unknown;
        error?: string;
        code?: string;
        fields?: string[];
      } | null;

      if (!payload) {
        return { error: `Server kutilmagan javob qaytardi (HTTP ${response.status})` };
      }

      /*
       * BFF validatsiyasi yiqilsa qaysi maydon aybdorligini xabarga
       * qo'shamiz — aks holda ekranda quruq «So`rov noto`g`ri» qoladi
       * va sababni topib bo'lmaydi.
       */
      if (payload.fields?.length) {
        return { ...payload, error: `${payload.error ?? 'Xato'} — ${payload.fields.join('; ')}` };
      }

      return payload;
    },
    [locale],
  );

  /*
   * ── Tasma OLDINDAN TAYYORLANMAYDI ──
   *
   * ⚠️ ILGARI BU YERDA `op: 'batch'` TURARDI: tasmadagi HAMMA kiyim
   * bir yo'la kiyintirilardi. Ikki jiddiy kamchiligi bor edi.
   *
   * 1. PUL. Har kiyim alohida OpenAI chaqiruvi. Foydalanuvchi
   *    turkumni ochishi bilanoq o'nlab so'rov ketardi — ko'rmagan
   *    kiyimlari uchun ham to'lanardi.
   *
   * 2. KUTISH. Hammasi navbatga tushgani uchun BIRINCHI natija ham
   *    oxirigacha kutardi: ekranda uzoq vaqt spinner turardi.
   *
   * Mijoz qarori (2026-09-10): avval TANLANGAN kiyim chiqsin, qolganlari
   * kutib tursin. Quyidagi effekt aynan shuni qiladi — faqat joriy
   * tanlovni kiyintiradi, boshqa kartochka bosilganda esa navbatdagisini.
   */
  /*
   * ── Komplekt zanjirini tiklash ──
   *
   * Bir vaqtda faqat BITTA qatlam so'raladi: keyingisining asosi shu
   * natija bo'ladi va uning `id` si hali mavjud emas.
   *
   * ⚠️ SHU BILAN PASTKI QATLAM ALMASHGANDA TEPADAGILAR O'ZI TIKLANADI:
   * eski surat boshqa asos ustida edi, `resolveOutfit` uni topa olmaydi
   * va u shu yerda qaytadan so'raladi.
   */
  useEffect(() => {
    if (!state?.ready || !hasBase || limitReached) return;

    const next = nextPending(resolved);
    if (!next) return;

    const key = `one:${angle}:${renderKey(next.variantId, next.baseRenderId)}`;
    if (asked.current.has(key)) return;
    asked.current.add(key);

    void act({
      op: 'render',
      variantId: next.variantId,
      angle,
      baseRenderId: next.baseRenderId,
    }).then((result) => {
      if (result.code === 'RATE_LIMITED') setLimitReached(true);
      void refresh();
    });
  }, [state?.ready, hasBase, limitReached, resolved, angle, act, refresh]);

  const wear = useCallback((category: string, variantId: string) => {
    setDismissed((current) => current.filter((item) => item !== category));
    setOutfit((current) => setLayer(current, category, variantId));
    setNotice(null);
    /*
     * ⚠️ AVTOMATIK OLD BURCHAKKA O'TAMIZ (2026-09-26). AI generatsiyasi
     * faqat old da ishga tushadi (yon/orqa qo'shimcha varaqdan kesiladi).
     * Foydalanuvchi yon/orqa turgan bo'lsa vizual signal ko'rmasdi.
     */
    setAngle((current) => (current === 'front' ? current : 'front'));
  }, []);

  const takeOff = useCallback((category: string) => {
    /*
     * ⚠️ BELGI SHART. Turkum ochilganda birinchi kiyim o'zi kiyiladi;
     * yechilgani belgilanmasa o'sha qoida uni darhol qaytarardi va
     * tugma buzuq ko'rinardi.
     */
    setDismissed((current) => (current.includes(category) ? current : [...current, category]));
    setOutfit((current) => clearLayer(current, category));
    setNotice(null);
  }, []);

  /*
   * ── Turkum ochilganda birinchi kiyim kiyiladi ──
   *
   * ⚠️ MAKETNING VA'DASI SHU: foydalanuvchi turkumni ochganda o'zini
   * ALLAQACHON kiyingan holda ko'rishi kerak, bo'sh sahna emas.
   */
  useEffect(() => {
    if (!state?.ready || items.length === 0) return;
    if (dismissed.includes(tab)) return;
    if (outfit.some((layer) => layer.category === tab)) return;

    const first = items[0];
    if (first) wear(tab, first.variantId);
  }, [state?.ready, items, dismissed, outfit, tab, wear]);

  /* ── Ko'rilgan kiyimlar keshi — komplekt jamlanmasi uchun ── */
  const [seen, setSeen] = useState<Record<string, Garment>>({});

  useEffect(() => {
    if (items.length === 0) return;
    setSeen((current) => {
      const next = { ...current };
      for (const item of items) next[item.variantId] = item;
      return next;
    });
  }, [items]);

  /* ── Ko'rsatiladigan qiymatlar ── */

  const wornHere = outfit.find((layer) => layer.category === tab)?.variantId ?? null;
  const current = items.find((item) => item.variantId === wornHere) ?? items[0];

  const shown: TryonRender | undefined = current
    ? renderIndex.get(renderKey(current.variantId, stripBase.baseRenderId))
    : undefined;

  /*
   * ⚠️ CHEGARA TUGAGANDA INDIKATOR CHIQMAYDI — aks holda u abadiy
   * aylanardi: yangi so'rov yuborilmaydi, natija ham kelmaydi.
   */
  const rendering = Boolean(
    current &&
    !(limitReached && !shown) &&
    (!stripBase.ready || !shown || shown.status === 'pending' || shown.status === 'processing'),
  );

  const failed = resolved.find((layer) => layer.render?.status === 'failed')?.render ?? null;

  /**
   * Sahna uchun tanlangan render.
   *
   * ⚠️ TAB QATLAMIGACHA (2026-09-26). Foydalanuvchi Futbolka tabga
   * o'tsa-yu ustida ko'ylak/kurtka bor bo'lsa, yuqoridagi qatlamlar
   * yashiriladi — tanlangan kiyim aniq ko'rinadi (komplekt buzilmaydi,
   * faqat ko'rish uchun).
   *
   * ⚠️ OLD: `topReady` (progressive). Yon/Orqa: STRICTLY eng tepa qatlam
   * — u qatlamning shu burchakdagi surati yo'q bo'lsa `null` (past
   * qatlam chiqmaydi), `wornFront` old zaxirasi ishga tushadi.
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

  /**
   * Yon/orqa uchun old zaxirasi — STRICTLY joriy tab qatlami.
   *
   * ⚠️ `topReady` EMAS, VA TAB QATLAMIGACHA. Ko'ylak (top layer) old
   * renderi hali kelmagan bo'lsa yoki foydalanuvchi Futbolka tabida
   * bo'lsa, ekranda faqat tabga mos qatlam ko'rinishi kerak.
   */
  const wornFront = useMemo(() => {
    if (angle === 'front') return null;
    const top = frontResolved.filter((layer) => layerRank(layer.category) <= tabRank).at(-1);
    return top?.render?.status === 'ready' ? top.render : null;
  }, [angle, frontResolved, tabRank]);

  /**
   * Joriy turkum OSTIDAGI komplekt surati (FRONT bazasi).
   *
   * ⚠️ FRONT ZANJIRIDAN. `stripBase.baseRenderId` FRONT id — layerBase
   * ham FRONT resolvedidan izlanadi.
   */
  const layerBase = stripBase.baseRenderId
    ? (frontResolved.find((layer) => layer.render?.id === stripBase.baseRenderId)?.render ?? null)
    : null;

  const outfitItems = outfit
    .map((layer) => seen[layer.variantId])
    .filter((item): item is Garment => Boolean(item));

  return {
    // holat
    state,
    loading,
    busy,
    notice,
    limitReached,
    setNotice,

    // tanlovlar
    tab,
    setTab,
    angle,
    setAngle,
    onlyMySize,
    setOnlyMySize,
    store,
    setStore,

    // komplekt
    outfit,
    resolved,
    outfitItems,
    wear,
    takeOff,

    // ko'rsatish
    items,
    current,
    shown,
    worn,
    wornFront,
    layerBase,
    stripBase,
    renderIndex,
    rendering,
    failed,

    // amallar
    act,
    refresh,
    setBusy,
    setLimitReached,
  };
}

export type TryonController = ReturnType<typeof useTryon>;
