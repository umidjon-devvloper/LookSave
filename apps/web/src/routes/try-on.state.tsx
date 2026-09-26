import {
  baseForCategory,
  indexRenders,
  recommendSize,
  resolveOutfit,
  slotForCategory,
  type OutfitLayer,
} from '@looksave/validation';
// Yon/orqa uchun FRONT zanjiri kerak — server operator 3 panelli varaqni
// qo'shimcha burchak yozuvlariga FRONT bazasi bilan yozadi (mobil bilan bir xil).

import {
  getAvatar,
  getGarments,
  getProfile,
  getRenders,
  type AvatarAngle,
  type FullProfile,
  type Garment,
  type TryonRender,
  type UserAvatar,
} from '@/api/endpoints';
import { isLocale } from '@/i18n/locale';
import { auth } from '@/session.server';

import type { Route } from './+types/try-on.state';

/**
 * Kiyintirish holati — BFF resurs marshruti.
 *
 * ⚠️ NEGA BU KERAK, ILOVADA ESA EMAS. Mobil ilova API ga to'g'ridan-
 * to'g'ri boradi: token qurilmada. Saytda esa token `httpOnly`
 * cookie'da va brauzer JS uni umuman ko'rmaydi (`api/client.ts`).
 * Ya'ni sahifa `/v1/tryon/*` ga o'zi murojaat qila olmaydi — hammasi
 * shu marshrut orqali o'tadi.
 *
 * ⚠️ QOBIQDAN TASHQARIDA (`routes.ts` ga qarang). U `layouts/shell.tsx`
 * ichiga qo'yilsa har so'rovda shapka va futer uchun ma'lumot ham
 * yuklanardi — bu esa har 2.5 soniyada takrorlanadigan so'rov.
 *
 * ⚠️ BITTA SO'ROVDA HAMMASI. Kiyimlar, komplekt natijalari va tasma
 * natijalari uchun uchta alohida so'rov bo'lsa, brauzer ularni
 * parallel yuborardi va ular BIR-BIRIGA BOG'LIQ: tasma natijalari
 * qaysi asos ustida so'ralishi komplekt natijalaridan kelib chiqadi.
 * Alohida so'rovlarda mijoz avval birini kutib, keyin ikkinchisini
 * yuborishi kerak bo'lardi — ya'ni ikki marta yo'l vaqti.
 */

/** Sahifa polling qiladi, shuning uchun javob KESHLANMAYDI. */
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TryonState {
  signedIn: boolean;
  /** Nimalar yetishmayotgani — sahifa sozlash sehrgarini shundan chizadi */
  needs: { photo: boolean; sizes: boolean; store: boolean };
  ready: boolean;
  profile: {
    gender: string | null;
    measurements: Record<string, number | null>;
    faceTextureUrl: string | null;
    bodyPhotoUrl: string | null;
  } | null;
  avatar: UserAvatar | null;
  /**
   * Joriy turkum uchun tavsiya etilgan o'lcham (`M`, `L` …).
   *
   * ⚠️ SERVERDA HISOBLANADI, MIJOZDA EMAS. Sahifa uni o'zi hisoblasa
   * birinchi so'rov o'lchamsiz ketardi (o'lchovlar hali kelmagan),
   * keyin esa u qaytadan so'rashi kerak bo'lardi — ya'ni har ochilishda
   * ikkita so'rov va ro'yxatning ko'z oldida almashishi.
   */
  fitSize: string | null;
  garments: Garment[];
  outfitRenders: TryonRender[];
  stripRenders: TryonRender[];
  /**
   * FRONT burchak renderlari.
   *
   * ⚠️ YON/ORQA UCHUN. Server operator 3 panelli varaqni chizganda
   * qo'shimcha burchak yozuvlari FRONT so'rovi bazasi bilan saqlanadi.
   * Mijoz yon/orqada zanjirni FRONT'dan yuradi va har qatlamning shu
   * bazadagi yon/orqa renderini izlaydi. Old burchakda bo'sh massiv.
   */
  frontRenders: TryonRender[];
  /** Joriy turkumdagi kiyimlar qaysi natija ustiga kiydiriladi */
  base: { baseRenderId: string | null; ready: boolean };
  error: string | null;
}

/**
 * `tshirt:uuid,jacket:uuid` → komplekt.
 *
 * ⚠️ MIJOZDAN KELADI, ya'ni ishonchsiz. Noto'g'ri bo'lakni tashlab
 * yuboramiz, butun so'rovni yiqitmaymiz: eng yomon holatda komplekt
 * bir qatlam kam ko'rinadi va foydalanuvchi uni qaytadan tanlaydi.
 */
function parseOutfit(raw: string | null): OutfitLayer[] {
  if (!raw) return [];

  return raw
    .split(',')
    .map((part) => {
      const [category, variantId] = part.split(':');
      return category && variantId ? { category, variantId } : null;
    })
    .filter((layer): layer is OutfitLayer => layer !== null)
    .slice(0, 8);
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await auth(request, locale);

  const headers = context.setCookie
    ? { ...NO_STORE, 'Set-Cookie': context.setCookie }
    : { ...NO_STORE };

  const empty: TryonState = {
    signedIn: false,
    needs: { photo: true, sizes: true, store: true },
    ready: false,
    profile: null,
    avatar: null,
    garments: [],
    outfitRenders: [],
    stripRenders: [],
    frontRenders: [],
    base: { baseRenderId: null, ready: true },
    fitSize: null,
    error: null,
  };

  /*
   * ⚠️ 401 EMAS, `signedIn: false`. Resurs marshruti `requireAuth` bilan
   * yo'naltirilsa `fetch()` ga HTML sahifa qaytardi va mijozning
   * `response.json()` i tushunarsiz xato bilan yiqilardi. Sahifa esa
   * bu holatni o'zi chiroyli ko'rsatadi.
   */
  if (!context.user) return Response.json(empty, { headers });

  const url = new URL(request.url);
  const category = url.searchParams.get('category') ?? 'tshirt';

  /*
   * ⚠️ DO'KON `id` SI TEKSHIRILADI. U brauzerning `localStorage` idan
   * keladi va u yerda eskirgan yoki buzilgan qiymat qolishi mumkin
   * (qo'lda tahrirlangan, eski versiyadan qolgan). Tekshirilmasa API
   * 422 qaytarardi va sahifa «Kiyimlar yuklanmadi» da qotib qolardi —
   * foydalanuvchi esa sababini bilmasdi.
   *
   * Noto'g'ri qiymat «do'kon tanlanmagan» deb qaraladi: sozlash
   * qadamiga tushadi va u yerdan chiqish yo'li bor.
   */
  const rawStoreId = url.searchParams.get('storeId');
  const storeId = rawStoreId && UUID.test(rawStoreId) ? rawStoreId : null;
  /*
   * ⚠️ O'LCHAM QIYMAT EMAS, BAYROQ BO'LIB KELADI. Mijoz «mening
   * o'lchamim bo'yicha filtrla» deydi, qaysi o'lcham ekanini esa server
   * o'zi hisoblaydi — o'lchovlar unda. Aks holda mijoz o'lchamni
   * bilmasdan turib so'rov yubora olmasdi.
   */
  const useFit = url.searchParams.get('fit') !== '0';
  const angle = (url.searchParams.get('angle') ?? 'front') as AvatarAngle;
  const outfit = parseOutfit(url.searchParams.get('outfit'));

  let profile: FullProfile;
  let avatar: UserAvatar;

  try {
    [profile, avatar] = await Promise.all([
      getProfile(context.options),
      getAvatar(context.options),
    ]);
  } catch (error) {
    return Response.json(
      {
        ...empty,
        signedIn: true,
        error: error instanceof Error ? error.message : 'Profil yuklanmadi',
      } satisfies TryonState,
      { headers },
    );
  }

  const measurements = profile.measurements ?? {};

  /*
   * ⚠️ TAYYORLIK UCH QISMDAN: SURAT, O'LCHAMLAR VA DO'KON — ilovadagi
   * bilan bir xil ro'yxat (`FittingExperience.tsx`). Bittasi yetishmasa
   * kiyintirish ma'nosiz: surat bo'lmasa kimni kiyintirishni,
   * o'lchamsiz qaysi razmerni, do'konsiz esa qaysi kiyimlarni
   * ko'rsatishni bilmaymiz.
   */
  const needs = {
    /*
     * ⚠️ AVATAR TAYYORLIGI SHART EMAS — YUZ SURATI YETADI.
     *
     * Ilgari shart `avatar.status === 'ready'` edi va bu AYLANMA
     * bog'liqlik hosil qilardi: avatar yasash uchun bo'y va vazn kerak,
     * ular esa KEYINGI («sizes») bosqichda kiritiladi. Yangi
     * foydalanuvchi surat bosqichida abadiy qolib ketardi — skanerlaydi,
     * avatar 422 bilan yiqiladi, `needs.photo` hamon rost bo'lib
     * qolaveradi va sehrgar oldinga o'tmaydi.
     */
    photo: !(
      avatar.status === 'ready' ||
      Boolean(profile.bodyPhotoUrl) ||
      Boolean(profile.faceTextureUrl)
    ),
    sizes: !(
      typeof measurements['height'] === 'number' && typeof measurements['weight'] === 'number'
    ),
    store: !storeId,
  };

  const ready = !needs.photo && !needs.sizes && !needs.store;

  const state: TryonState = {
    ...empty,
    signedIn: true,
    needs,
    ready,
    profile: {
      gender: profile.gender,
      measurements,
      faceTextureUrl: profile.faceTextureUrl,
      bodyPhotoUrl: profile.bodyPhotoUrl,
    },
    avatar,
    fitSize: recommendSize(slotForCategory(category), measurements),
  };

  if (!ready) return Response.json(state, { headers });

  const size = useFit ? state.fitSize : null;

  try {
    /*
     * Komplekt natijalari `scope: 'all'` bilan olinadi — HAR asos
     * ustidagisi. Zanjirni aynan shundan tiklaymiz: qaysi qatlam
     * qaysining ustida turgani natijalarning o'zidan o'qiladi.
     *
     * ⚠️ YON/ORQA UCHUN FRONT RENDERLARI HAM YUKLANADI (2026-09-26).
     * Server operator 3 panelli varaqni qo'shimcha burchak yozuvlariga
     * FRONT bazasi bilan yozadi — mijoz zanjirni FRONT'dan yurishi kerak.
     * Old burchakda `frontRenders` bo'sh (`outfitRenders` ning o'zi
     * front bo'ladi).
     */
    const variantIds = outfit.map((layer) => layer.variantId);
    const [garments, outfitRenders, frontRenders] = await Promise.all([
      getGarments({ category, storeId, size, gender: profile.gender, limit: 30 }, context.options),
      getRenders({ variantIds, angle, scope: 'all' }, context.options),
      angle === 'front'
        ? Promise.resolve([] as TryonRender[])
        : getRenders({ variantIds, angle: 'front', scope: 'all' }, context.options),
    ]);

    /*
     * ⚠️ ZANJIR SERVERDA TIKLANADI. Mijoz ham shu modulni ishlata olardi
     * (`@looksave/validation`), lekin u payt tasma natijalari uchun
     * IKKINCHI so'rov kerak bo'lardi: asosning `id` si birinchi javobdan
     * chiqadi. Bu yerda ikkalasi bitta yo'lda bajariladi.
     *
     * ⚠️ `base` HAR DOIM FRONT ZANJIRIDAN. Yon/orqa render kalitlari ham
     * FRONT bazasi bilan yoziladi (yuqoridagi izohga qarang), shuning
     * uchun strip so'rovi ham FRONT bazasi bilan chaqiriladi.
     */
    const chainRenders = angle === 'front' ? outfitRenders : frontRenders;
    const resolved = resolveOutfit(outfit, indexRenders(chainRenders));
    const base = baseForCategory(resolved, category);

    const stripRenders = base.ready
      ? await getRenders(
          {
            variantIds: garments.map((item) => item.variantId),
            angle,
            baseRenderId: base.baseRenderId,
          },
          context.options,
        )
      : [];

    return Response.json(
      { ...state, garments, outfitRenders, stripRenders, frontRenders, base },
      { headers },
    );
  } catch (error) {
    return Response.json(
      {
        ...state,
        error: error instanceof Error ? error.message : 'Kiyimlar yuklanmadi',
      } satisfies TryonState,
      { headers },
    );
  }
}
