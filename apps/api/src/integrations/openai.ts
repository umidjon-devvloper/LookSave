import sharp from 'sharp';

import { env } from '../config/env';
import { logger } from '../logger';
import { faceLock } from '../tryon/avatar-prompt';

/**
 * OpenAI rasm modeli — avatar yasash va kiyintirish.
 *
 * ⚠️ BU YAGONA AI PROVAYDER. Ilgari FASHN ham bor edi va ikkalasi
 * `TRYON_PROVIDER` bilan almashtirilardi; FASHN butunlay olib tashlandi.
 *
 * ⚠️ MODEL SOZLAMADAN KELADI (`OPENAI_IMAGE_MODEL`), sukut bo'yicha
 * `gpt-image-2.5-sunburst` — OpenAI'ning tahrir aniqligiga yo'naltirilgan
 * modeli. `gpt-image-1` dan uchta farqi shu modul uchun muhim:
 *
 *   • kirish rasmlari HAR DOIM yuqori aniqlikda qayta ishlanadi, ya'ni
 *     `input_fidelity` ni so'rash SHART EMAS (va qabul qilinmaydi);
 *   • yuz va logo sezilarli aniqroq saqlanadi;
 *   • arzonroq — chiqish uchun 1M tokeniga $30 (`gpt-image-1` da $40).
 *
 * So'rov shakli o'zgarmadi: o'sha `/images/edits`, o'sha `image[]`,
 * o'sha `size`, javobda o'sha `b64_json`. Shuning uchun model nomini
 * almashtirish uchun quyida faqat `buildImageOptions` qaraydi.
 *
 * ⚠️ BILIB TURISH KERAK BO'LGAN CHEKLOV — KAMAYDI, YO'QOLMADI. Bu
 * baribir UMUMIY rasm modeli, kiyim try-on uchun maxsus o'qitilmagan:
 * u kiyimni nusxa ko'chirmaydi, balki ko'rganiga o'xshashini chizadi.
 * Brend logosi va naqsh o'zgarish EHTIMOLI `gpt-image-1` dagidan ancha
 * past, lekin nol emas.
 *
 * Marketplace uchun bu jiddiy: mahsulot sahifasida ko'rsatilgan narsa
 * yetkazilgani bilan mos kelishi kerak. Quyidagi promptdagi cheklovlar
 * shuni imkon qadar ushlab turadi, lekin kafolat bermaydi.
 *
 * ⚠️ BU MODUL PUL SARFLAYDI. Har rasm uchun to'lanadi. Shuning uchun bu
 * yerda takroriy urinish YO'Q — xato yuqoriga qaytariladi va qaror u
 * yerda qabul qilinadi.
 *
 * ⚠️ ODDIY `Error` TASHLANADI, `ApiError` EMAS. Integratsiya qatlami
 * HTTP holat kodini bilmasligi kerak; uni chaqiruvchi foydalanuvchi
 * ko'radigan xabarga aylantiradi.
 *
 * ⚠️ HAMMASI SINXRON. FASHN ish yaratib `id` qaytarardi va natija keyin
 * so'ralardi; `gpt-image-*` javobda darhol rasm beradi (30–60 s).
 * Shuning uchun chaqiruvchi buni FONDA bajarishi shart — HTTP so'rov
 * ichida kutish taymautga olib keladi.
 *
 * ⚠️ YUZ O'XSHASHLIGI UCH NARSAGA BOG'LIQ, FAQAT PROMPTGA EMAS:
 *
 *   1. `input_fidelity: 'high'`  — `buildImageOptions`. Eng muhimi.
 *   2. Yuz havolasining SIFATI  — `cropFace`, yaqin qirqim.
 *   3. Promptdagi cheklovlar    — `buildPrompt`.
 *
 * Uzoq vaqt faqat uchinchisi bor edi va natija yetarli emasdi: prompt
 * modelga NIYATNI aytadi, birinchi ikkitasi esa unga BERILADIGAN
 * ma'lumotni o'zgartiradi. Biri o'chirilsa qolgani qoplamaydi.
 */

/** Kiyim turi — promptda ishlatiladi, model qayerga kiydirishni bilishi uchun. */
export type GarmentKind = 'tops' | 'bottoms' | 'one-pieces' | 'footwear' | 'auto';

export function garmentKindForSlot(slot: string): GarmentKind {
  switch (slot) {
    case 'top':
    case 'outer':
      return 'tops';
    case 'bottom':
      return 'bottoms';
    case 'dress':
      return 'one-pieces';
    case 'feet':
      return 'footwear';
    default:
      return 'auto';
  }
}

export function isOpenAiEnabled(): boolean {
  return env().OPENAI_API_KEY.length > 0;
}

/**
 * Chiqish sozlamalari — ikkala chaqiruvda ham bir xil.
 *
 * ⚠️ KIRISH ANIQLIGI — YUZ SHU YERDA HAL BO'LADI.
 *
 * Kirish surati past aniqlikda kodlansa, model uni «taxminan» oladi va
 * kadrni erkin qaytadan chizadi — yuz aynan shunda boshqa odamnikiga
 * aylanadi. Promptdagi «do NOT redraw the face» buning O'RNINI BOSMAYDI:
 * u modelga NIYATNI aytadi, aniqlik esa unga BERILADIGAN ma'lumotni
 * belgilaydi.
 *
 * Modelga qarab bu ikki xil hal bo'ladi va farqni shu funksiya yutadi:
 *
 *   `gpt-2.5` va keyingilari — kirish HAR DOIM yuqori aniqlikda qayta
 *      ishlanadi. `input_fidelity` umuman qabul qilinmaydi va uni
 *      yuborish 400 bilan qaytadi.
 *   `gpt-image-1` / `1.5`     — sukut bo'yicha `low`. `high` ni ATAYLAB
 *      so'rash kerak; u har chaqiruvga ~6144 token qo'shadi.
 *
 * ⚠️ `gpt-image-1-mini` RO'YXATDA YO'Q — VA BU XATO EMAS. Nomi
 * `gpt-image-1` bilan boshlanadi, lekin `input_fidelity` ni qabul
 * qilmaydi. Shuning uchun tekshiruv prefiks emas, ANIQ ro'yxat.
 *
 * ⚠️ `output_format: 'jpeg'` — MAJBURIY, BEZAK EMAS. Sukut bo'yicha PNG
 * qaytadi, natija esa `.jpg` kaliti va `image/jpeg` sarlavhasi bilan R2
 * ga yozilardi (`render.ts` — `storeResult`, `avatar.ts` —
 * `storeAvatar`): bayt bilan yorliq mos kelmasdi. Ustiga 1024x1536
 * fotoning PNG'i JPEG'dan bir necha barobar og'ir — har ko'rish uchun
 * trafik.
 */

/**
 * `input_fidelity` ni qabul qiladigan modellar.
 *
 * Dasta nomlari sanaga ega bo'lishi mumkin (`gpt-image-1.5-2026-01-30`),
 * shuning uchun aniq tenglik ham, `-20` bilan boshlanadigan snapshot ham
 * hisobga olinadi. `-mini` esa shu tarzda O'TMAYDI.
 */
const INPUT_FIDELITY_MODELS = ['gpt-image-1', 'gpt-image-1.5'];

function supportsInputFidelity(model: string): boolean {
  return INPUT_FIDELITY_MODELS.some((name) => model === name || model.startsWith(`${name}-20`));
}

export function buildImageOptions(model: string): Record<string, string> {
  const options: Record<string, string> = {
    /*
     * Tik kadr — odam to'liq bo'yi bilan sig'adi.
     *
     * ⚠️ IKKALA TOMON 16 GA BO'LINISHI SHART (2.5 talabi), nisbat esa
     * 1:3 va 3:1 orasida. 1024x1536 — 64x96 va 2:3, ya'ni ikkalasiga
     * ham mos. O'zgartirilsa shu ikki shart qayta tekshirilsin.
     */
    size: '1024x1536',
    /*
     * ⚠️ CHIQISH SIFATI ENDI SOZLAMADAN (`OPENAI_IMAGE_QUALITY`), sukut
     * `high`. 2.5 da `xhigh` va `max` ham bor va ular matoni/naqshni
     * aniqroq chizadi, lekin chiqish tokenini (pulni) oshiradi — shuning
     * uchun qiymat prod'da sozlanadi, bu yerda qotirilmaydi.
     *
     * ⚠️ BU MAYDON `generationFingerprint` ICHIGA KIRADI: qiymat o'zgarsa
     * kesh avtomatik yangilanadi, ya'ni `xhigh` ga ko'tarilsa eski `high`
     * natijalar qaytmaydi, yangisi yasaladi. Shuning uchun u sozlamadan
     * o'qilishi SHART — qotirilsa kesh cho'kib qolardi.
     *
     * ⚠️ Yuz aniqligi baribir sifatdan emas, KIRISH aniqligidan keladi
     * (`cropFace`, `input_fidelity`). Sifat matoni va naqshni yaxshilaydi,
     * yuzni emas.
     */
    quality: env().OPENAI_IMAGE_QUALITY,
    // ⚠️ PNG — so'rovga ko'ra. JPEG'dan bir necha barobar og'ir (ko'proq
    // trafik), lekin yo'qotishsiz. R2 kaliti/turi ham `.png`/`image/png`
    // bo'lishi SHART (render.ts storeResult, avatar.ts storeAvatar) —
    // aks holda bayt bilan yorliq mos kelmaydi. `output_compression` PNG
    // uchun yo'q, shuning uchun berilmaydi.
    output_format: 'png',
    // ⚠️ SHAFFOF FON — natijada orqa fon bo'lmaydi (grey/oq quti yo'q),
    // avatar to'g'ridan-to'g'ri sahnaga singadi. `transparent` faqat png/
    // webp bilan ishlaydi (shuning uchun yuqorida png). Cutout endi shart
    // emas, lekin qoladi (zaxira).
    background: 'transparent',
    n: '1',
  };

  if (supportsInputFidelity(model)) {
    options.input_fidelity = 'high';
  }

  return options;
}

/**
 * Generatsiya retsepti — natija AYNAN shunga bog'liq.
 *
 * ⚠️ NEGA KERAK. Kiyintirish va avatar keshlari surat manzillari bo'yicha
 * kalitlanadi (`render.ts`, `avatar.ts` — `sourceHash`). Manzillar esa
 * model almashganda O'ZGARMAYDI: `gpt-image-1` dan `2.5` ga o'tilganda
 * kalit o'sha bo'lib qolardi va foydalanuvchi eski, yuzi buzuq natijani
 * ko'raverardi — yangi model umuman chaqirilmasdi.
 *
 * Retsept kalitga kiritilsa bu o'z-o'zidan hal bo'ladi: model yoki chiqish
 * sozlamasi o'zgarishi bilan xesh ham o'zgaradi va natija qaytadan
 * yasaladi.
 *
 * ⚠️ QAYTA YASASH PUL TURADI. Retsept o'zgarishi — BUTUN keshni bekor
 * qilish degani. Shuning uchun bu yerga faqat natijani HAQIQATAN
 * o'zgartiradigan narsa kiradi: model nomi va so'rov tanasidagi
 * sozlamalar. Tasodifiy qiymat qo'shilsa har deploy hammani qayta
 * to'latardi.
 *
 * ⚠️ KALITLAR SARALANADI. Usiz `buildImageOptions` ichidagi maydonlarni
 * joyini almashtirish ham xeshni o'zgartirardi — ya'ni bezak tahriri
 * jimgina butun keshni kuydirardi.
 *
 * ⚠️ PROMPT BU YERGA KIRMAYDI. Kiyintirish prompti kiyim turiga, yuz va
 * bosma manbasi borligiga bog'liq va ularning bir qismi faqat rasmlar
 * yuklab olingandan keyin ma'lum bo'ladi — so'rov paytida hisoblab
 * bo'lmaydi. `buildPrompt` o'zgartirilganda kesh QO'LDA tozalanadi.
 * (Avatarda esa prompt allaqachon xeshda — u o'lchovlardan tuziladi.)
 */
export function generationFingerprint(model: string): string {
  const options = Object.entries(buildImageOptions(model))
    .map(([key, value]) => `${key}=${value}`)
    .sort();

  return [model, ...options].join('|');
}

/** Sozlamalarni so'rov tanasiga qo'shadi. */
function appendImageOptions(form: FormData): void {
  for (const [key, value] of Object.entries(buildImageOptions(env().OPENAI_IMAGE_MODEL))) {
    form.append(key, value);
  }
}

/** Kiyim turini o'zbekcha emas, INGLIZCHA aytamiz — model shunga o'qitilgan. */
const PLACEMENT: Record<GarmentKind, string> = {
  tops: 'as the upper-body garment (shirt/top/jacket)',
  bottoms: 'as the lower-body garment (trousers/skirt)',
  'one-pieces': 'as the full-body garment (dress/jumpsuit)',
  /*
   * ⚠️ OYOQ KIYIMI ALOHIDA KO'RSATMA TALAB QILADI.
   *
   * «Kiyintir» degan umumiy buyruq bilan model poyabzalni gavdaga
   * yopishtirib qo'yardi yoki butun kiyimni almashtirib yuborardi.
   * Shuning uchun aniq aytiladi: FAQAT oyoqqa, qolgani tegilmaydi.
   */
  footwear: 'on the feet only, as footwear — leave every other garment untouched',
  auto: 'in its natural position on the body',
};

/**
 * Prompt.
 *
 * ⚠️ HAR BIR JUMLA SABABLI. Model erkin bo'lsa odamning yuzini, gavdasini
 * va fonini ham qayta chizadi — natijada foydalanuvchi o'zini emas,
 * boshqa odamni ko'radi. Quyidagi cheklovlar shuni to'sadi:
 *
 *   «keep the person's face … unchanged»  — yuz o'zgarmasin
 *   «keep the body proportions»           — gavda o'zgarmasin
 *   «photorealistic»                      — illyustratsiya emas
 *   «same lighting and background»        — kadr o'zgarmasin
 */
export function buildPrompt(
  kind: GarmentKind,
  extras: { face?: boolean; print?: boolean; layer?: boolean } = {},
): string {
  const lines = [
    'Photorealistic virtual try-on.',
    `Dress the person from the first image in the garment from the second image, ${PLACEMENT[kind]}.`,
    /*
     * ⚠️ YUZ ENG OG'RIQLI JOY. Bitta «unchanged» yetmadi — model yuzni
     * qayta chizib, «chiroyliroq» qilib qo'yardi va foydalanuvchi o'zini
     * tanimasdi. Buyruq uch qatlamga bo'lingan: NIMA qilma (qayta chizma,
     * go'zallashtirma), QAYERGACHA (bo'yindan yuqorisi butunlay), va
     * O'LCHOV (birinchi rasmdagi bilan bir xil piksel).
     */
    "Keep the person's face, hair, skin tone and body proportions completely unchanged.",
    'The head and face must stay EXACTLY as in the first image — same features, same expression, same age, same skin.',
    'Do NOT redraw, beautify, smooth, slim, retouch or re-generate the face in any way.',
    'Everything above the neckline is copied from the first image untouched; only the clothing below changes.',
  ];

  /*
   * ⚠️ QATLAM UCHUN ALOHIDA KO'RSATMA — SHUSIZ ZANJIR MA'NOSIZ.
   *
   * Qatlamda birinchi rasm — allaqachon kiyintirilgan odam (masalan
   * futbolkada), ikkinchisi esa kurtka. Model erkin qoldirilsa
   * «kiyintir» ko'rsatmasini ALMASHTIRISH deb tushunadi va futbolkani
   * kurtka bilan almashtirib qo'yadi. Natijada ekranda yana bitta kiyim
   * qoladi — komplekt esa yig'ilmaydi.
   *
   * Uchta jumla ham kerak: «ustiga», «ostidagilar ko'rinib tursin» va
   * «olib tashlama». Ikkitasi bilan sinovda model yengni yoki yoqani
   * baribir yeb qo'yardi.
   */
  if (extras.layer) {
    lines.push(
      'The person in the first image is ALREADY DRESSED — put the new garment ON TOP of what they are wearing, as an additional outer layer.',
      'The existing garments must stay visible where they naturally would be: collar, sleeves, hem and any part not covered by the new garment.',
      'Do NOT remove, replace or redraw the clothing already on the person.',
    );
  }

  /*
   * ⚠️ RAQAMLAR DINAMIK HISOBLANADI. Prompt rasmlarni «third/fourth
   * image» deb ataydi va bu raqamlar `image[]` tartibiga AYNAN mos
   * kelishi shart. Yuz surati bo'lmasa bosma uchinchi bo'lib qoladi —
   * raqamni qotirib qo'ysak, model noto'g'ri rasmga qarardi.
   */
  const ORDINALS = ['third', 'fourth'];
  let next = 0;

  if (extras.face) {
    const n = ORDINALS[next++];
    lines.push(
      `The ${n} image is a close-up reference of the same person's face.`,
      'Match the facial features, bone structure and skin tone to that reference exactly.',
      `Use the ${n} image ONLY for the face — take pose, body and framing from the first image.`,
      /*
       * ⚠️ ZANJIR DEGRADATSIYASIGA QARSHI.
       *
       * Birinchi rasm ko'pincha O'ZI yasalgan bo'ladi: saytda odam
       * selfi beradi, undan avatar yasaladi va kiyintirish o'sha
       * avatarga tushadi (`render.ts` — `loadSources`). Qatlamda esa
       * birinchi rasm — oldingi kiyintirish natijasi. Ya'ni model
       * taxminning taxminini oladi va yuz har qadamda «o'rtacha
       * odam»ga siljiydi.
       *
       * Yuz havolasi — zanjirdagi YAGONA haqiqiy surat. Bu jumla
       * modelga aynan shuni aytadi: birinchi rasmdagi yuzga emas,
       * havoladagiga ishon.
       */
      'If the face in the first image looks AI-generated or slightly off, restore the true identity from that reference — the result must be the real person, not a lookalike.',
    );
  }

  if (extras.print) {
    const n = ORDINALS[next++];
    /*
     * ⚠️ ENG QAT'IY JUMLA SHU YERDA. Model bosmani «qayta chizishga»
     * moyil: matnni to'g'ri, lekin ikonkalarni boshqa joyga qo'yadi.
     * Shuning uchun «copy exactly», «do not redraw», «do not rearrange»
     * uchalasi ham yoziladi — bittasi yetmasligi o'lchangan.
     */
    lines.push(
      `The ${n} image is a close-up of the exact artwork printed on the garment.`,
      `Copy that artwork EXACTLY onto the garment: same layout, same icon positions, same text, same colours.`,
      'Do not redraw, do not rearrange, do not substitute any element of the artwork.',
      'Only warp it naturally to follow the fabric folds and body curvature.',
    );
  }

  lines.push(
    /*
     * ⚠️ BU JUMLA HAR DOIM QOLADI. Bosma manbasi bo'lmagan kiyimlar ham
     * bor (bir rangli futbolka, oddiy shim) va ular uchun aniqlik talabi
     * shu yerda. Qayta tuzishda bir marta tushib qolgan edi — sinov
     * ushladi.
     */
    'Reproduce the garment colour, pattern and shape as accurately as possible.',
    'Keep the same pose, lighting and background.',
    'Natural fabric folds and realistic fit. No text or watermarks added.',
  );

  return lines.join(' ');
}

/**
 * Provayder chegarasi.
 *
 * ⚠️ `sweepStaleRenders` NING 10 DAQIQASIDAN QISQA bo'lishi shart: aks
 * holda osilib qolgan chaqiruvni supuruvchi yopadi, `fetch` esa hamon
 * kutib turadi va natija egasiz qatorga yozilardi.
 *
 * Odatdagi generatsiya 30–90 soniya, ya'ni bu chegara keng — tirik
 * so'rovni uzib qo'ymaydi.
 */
const OPENAI_TIMEOUT_MS = 240_000;

/**
 * `/images/edits` ga so'rov yuboradi.
 *
 * ⚠️ TAKRORIY URINISH YO'Q — ATAYLAB. Javob kelmasa ham generatsiya
 * qilingan bo'lishi MUMKIN, ya'ni qayta yuborish ikkinchi marta to'lash
 * xavfini tug'diradi. Qaror foydalanuvchiga qoldiriladi: ilova «qayta
 * urinish» tugmasini ko'rsatadi.
 *
 * ⚠️ XATO MATNI TUSHUNARLI BO'LISHI SHART. Xom holda bu yer
 * `TypeError: fetch failed` beradi va o'sha matn bazaga yozilib ekranda
 * ko'rinardi. Aloqa uzilgani bilan kaliti noto'g'ri bo'lgani bir xil
 * ko'rinardi — birinchisida qayta urinish yordam beradi, ikkinchisida
 * yo'q, lekin buni ajratib bo'lmasdi.
 */
async function callImagesEdit(form: FormData, key: string): Promise<Response> {
  try {
    return await fetch(`${env().OPENAI_BASE_URL}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = describeNetworkError(err);
    logger.error({ err, reason }, 'openai: aloqa uzildi');
    throw new Error(`OpenAI bilan aloqa uzildi (${reason}) — qaytadan urinib ko\`ring`);
  }
}

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string };
  /** Tokenlar — narx aynan shulardan hisoblanadi */
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { text_tokens?: number; image_tokens?: number };
  };
}

/**
 * Model bo'yicha narx — 1M token uchun dollar.
 *
 * ⚠️ NEGA KODDA. Har chaqiruvning narxi logda TURISHI kerak. Hisobni
 * faqat OpenAI panelidan ko'rish mumkin edi va u kechikib yangilanadi,
 * chaqiruvlarni esa bir-biridan ajratmaydi — «nega bu oyda ko'p ketdi»
 * degan savolga javob topilmasdi.
 *
 * ⚠️ RAQAMLAR ESKIRISHI MUMKIN. Ular faqat LOG uchun, hisob-kitob uchun
 * emas; noto'g'ri bo'lsa ham hech narsa buzilmaydi. Haqiqiy hisob doimo
 * OpenAI panelida.
 */
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  'gpt-image-2.5-sunburst': { input: 8, output: 30 },
  'gpt-image-2.5-flare': { input: 8, output: 30 },
  'gpt-image-1.5': { input: 8, output: 32 },
  'gpt-image-1': { input: 10, output: 40 },
  'gpt-image-1-mini': { input: 2.5, output: 8 },
};

/**
 * Chaqiruv narxini logga yozadi.
 *
 * ⚠️ BU MODULDAGI YAGONA JOY, QAYERDA PUL KO'RINADI. Qolgan hamma
 * izohlar «bu pul turadi» deydi, lekin QANCHA ekani hech qayerda
 * yozilmasdi. Endi har chaqiruvdan keyin logda aniq raqam qoladi va
 * sifat/o'lcham sozlamasini o'zgartirishning ta'siri darhol ko'rinadi.
 */
function logUsage(usage: OpenAiImageResponse['usage'], what: string): void {
  if (!usage) return;

  const model = env().OPENAI_IMAGE_MODEL;
  const price = PRICE_PER_MTOK[model];
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;

  const cost = price ? (input * price.input + output * price.output) / 1_000_000 : null;

  logger.info(
    {
      what,
      model,
      inputTokens: input,
      outputTokens: output,
      // Narxi noma'lum model uchun `null` — taxmin qilingan raqam yozishdan yaxshiroq
      usd: cost === null ? null : Number(cost.toFixed(4)),
    },
    'openai: chaqiruv narxi',
  );
}

/**
 * Kiyim suratidan BOSMA sohasini qirqib oladi.
 *
 * ⚠️ NEGA QIRQAMIZ. To'liq surat modelga «odam futbolkada» bo'lib
 * ko'rinadi va u bosmani tafsilot deb qabul qiladi. Yaqin qirqim esa
 * bosmani KADR MAVZUSIGA aylantiradi — «buni aynan takrorla» degan
 * ko'rsatma aniq nishonga tushadi.
 *
 * ⚠️ QIRQIM O'RTADAN, TAXMINIY. Bosma qayerdaligini bilmaymiz —
 * mahsulot suratlarida u deyarli doim ko'krak markazida bo'ladi.
 * Kengligi 60%, balandligi 45%, markazdan biroz yuqorida.
 *
 * Bu evristika: bosmasi chetda bo'lgan kiyimda qirqim bo'sh matoga
 * tushadi va foyda bermaydi — lekin zarar ham qilmaydi, chunki asosiy
 * kiyim surati baribir ikkinchi rasm bo'lib boradi.
 */
async function cropPrint(source: Blob): Promise<Blob | null> {
  try {
    const input = Buffer.from(await source.arrayBuffer());
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height) return null;

    const width = Math.round(meta.width * 0.6);
    const height = Math.round(meta.height * 0.45);
    const left = Math.round((meta.width - width) / 2);
    const top = Math.round(meta.height * 0.22);

    const out = await sharp(input)
      .extract({ left, top, width, height })
      // Kattalashtiramiz: mayda detal modelga yaxshiroq yetsin
      .resize({ width: 1024, withoutEnlargement: false })
      .jpeg({ quality: 92 })
      .toBuffer();

    return new Blob([out], { type: 'image/jpeg' });
  } catch {
    // Qirqib bo'lmasa kiyintirish bosmasiz davom etadi
    return null;
  }
}

/**
 * Yuz suratidan BOSHNI qirqib, kattalashtiradi.
 *
 * ⚠️ NEGA. Prompt uchinchi rasmni «close-up reference of the face» deb
 * ataydi, lekin unga skanerdan kelgan BOSH-YELKA kadri (4:5) berilardi —
 * ya'ni yuz kadrning uchdan biri, xolos. Bosma uchun aynan shu muammo
 * `cropPrint` bilan yechilgan: mayda detal KADR MAVZUSIGA aylantirilsa,
 * model unga «fon tafsiloti» emas, «nishon» deb qaraydi.
 *
 * ⚠️ QIRQIM ATAYIN KENG (80% x 72%, yuqoridan 4%). Yuz qayerdaligini
 * bilmaymiz: skaner silueti (`PhotoStep.tsx`) boshni markazda, yuqori
 * uchdan birida ushlab turadi, lekin galereyadan kelgan surat boshqacha
 * kadrlangan bo'lishi mumkin. Tor qirqim iyagini yoki peshonasini kesib
 * tashlardi — bu esa hozirgi holatdan YOMONROQ bo'lardi. Bu chegara
 * bilan bosh deyarli har qanday portret kadrida butun qoladi, lekin
 * kadrdagi ulushi ikki barobarga yaqin oshadi.
 *
 * ⚠️ XATO YIQITMAYDI. `null` qaytsa asl surat yuboriladi — qirqim
 * yaxshilash, shart emas.
 */
async function cropFace(source: Blob): Promise<Blob | null> {
  try {
    const input = Buffer.from(await source.arrayBuffer());
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height) return null;

    const width = Math.round(meta.width * 0.8);
    const height = Math.round(meta.height * 0.72);
    const left = Math.round((meta.width - width) / 2);
    const top = Math.round(meta.height * 0.04);

    const out = await sharp(input)
      .extract({ left, top, width, height })
      // Kattalashtiramiz: ko'z, burun va lab chizig'i modelga aniq yetsin
      .resize({ width: 1024, withoutEnlargement: false })
      .jpeg({ quality: 95 })
      .toBuffer();

    return new Blob([out], { type: 'image/jpeg' });
  } catch {
    // Qirqib bo'lmasa asl surat ishlatiladi
    return null;
  }
}

/**
 * Tarmoq xatosini O'QILADIGAN matnga aylantiradi.
 *
 * ⚠️ NEGA KERAK. Node'ning `fetch` i har qanday tarmoq nosozligini bir xil
 * `TypeError: fetch failed` bilan qaytaradi — haqiqiy sabab esa `cause`
 * ichida qoladi. Bu matn bazaga yozilib, ekranda foydalanuvchiga
 * ko'rsatilardi: «fetch failed». Undan na foydalanuvchi, na biz biror
 * narsa tushunardik — holbuki `cause` da aniq yozilgan edi:
 * «Connect Timeout Error (… r2.dev:443, timeout: 10000ms)».
 */
export function describeNetworkError(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause;
    if (cause instanceof Error && cause.message) return cause.message;
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return 'vaqt tugadi';
    if (err.message) return err.message;
  }
  return String(err);
}

/** 4xx — surat yo'q yoki ruxsat yo'q. Qayta urinish holatni o'zgartirmaydi. */
class PermanentFetchError extends Error {}

/**
 * Qayta urinishlar orasidagi kutish.
 *
 * ⚠️ IKKI URINISH, KO'P EMAS. Kiyintirish fon ishida ketadi va
 * foydalanuvchi natijani kutib turadi; uzoq qayta urinish «hech narsa
 * bo'lmayapti» degan holatni cho'zardi.
 */
const FETCH_RETRY_DELAYS_MS = [1_000, 3_000];

/** Bitta urinishning chegarasi — undici'ning 10 s ulanish chegarasidan uzun. */
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Havoladan suratni olib, `multipart/form-data` uchun `Blob` qiladi.
 *
 * ⚠️ QAYTA URINADI — VA BU BEKORGA EMAS. Amalda eng ko'p uchragan
 * nosozlik shu bo'ldi: R2 ning ommaviy manzili (`r2.dev`) ba'zan ulanmay
 * qoladi va undici 10 soniyadan keyin taslim bo'ladi. Bitta shunday
 * lahza butun kiyintirishni yiqitardi — natija yo'q, foydalanuvchi esa
 * «Kiyintirib bo'lmadi» ni ko'rardi.
 *
 * ⚠️ QAYTA URINISH BU YERDA BEPUL. Provayder chaqiruvi uchun takroriy
 * urinish YO'Q (u pul turadi va modul sarlavhasida shunday kelishilgan) —
 * bu esa faqat surat yuklab olish, ya'ni qayta urinishning narxi bir
 * necha soniya.
 */
async function fetchAsBlob(url: string, label: string): Promise<Blob> {
  let last = `${label} yuklanmadi`;

  for (let attempt = 0; attempt <= FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) {
      const wait = FETCH_RETRY_DELAYS_MS[attempt - 1] ?? 1_000;
      await new Promise((resolve) => setTimeout(resolve, wait));
      logger.warn({ label, attempt, reason: last }, 'surat yuklanmadi — qayta urinilmoqda');
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

      if (response.ok) return await response.blob();

      // 5xx — vaqtinchalik bo'lishi mumkin; 4xx esa yo'q
      if (response.status < 500) {
        throw new PermanentFetchError(`${label} yuklanmadi: HTTP ${response.status}`);
      }
      last = `HTTP ${response.status}`;
    } catch (err) {
      if (err instanceof PermanentFetchError) throw err;
      last = describeNetworkError(err);
    }
  }

  throw new Error(`${label} yuklanmadi — tarmoq xatosi (${last})`);
}

/**
 * Suratni provayderga yuborishdan oldin kichraytiradi.
 *
 * ⚠️ NEGA. Chiqish baribir 1024x1536, ya'ni undan kattaroq kirish
 * aniqlikka deyarli qo'shmaydi — lekin YUKLASHGA qo'shadi. Amalda bir
 * so'rovda to'rttagacha rasm ketadi (odam, kiyim, yuz, bosma) va odam
 * surati yolg'iz o'zi 2 MB dan oshardi. Sekin aloqada bu so'rovni
 * cho'zadi va ulanish uzilish ehtimolini oshiradi — o'lchangan hol:
 * chaqiruv 93 soniyadan keyin `fetch failed` bilan yiqilgan.
 *
 * ⚠️ XATO YIQITMAYDI: kichraytirib bo'lmasa asl surat yuboriladi.
 */
async function shrink(source: Blob, maxEdge: number): Promise<Blob> {
  try {
    const input = Buffer.from(await source.arrayBuffer());
    const out = await sharp(input)
      .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer();

    return new Blob([out], { type: 'image/jpeg' });
  } catch {
    return source;
  }
}

export interface OpenAiTryonInput {
  /** Foydalanuvchining to'liq bo'yli surati (ochiq HTTPS havola) */
  modelImageUrl: string;
  /** Kiyim surati */
  garmentImageUrl: string;
  kind: GarmentKind;
  /**
   * Yuz surati — ixtiyoriy uchinchi manba.
   *
   * ⚠️ BO'LSA O'XSHASHLIK SEZILARLI YAXSHILANADI, chunki model yuzni
   * gavda suratidan taxmin qilmaydi, haqiqiysini ko'radi.
   */
  faceReferenceUrl?: string | null;
  /**
   * Model surati allaqachon kiyintirilganmi (qatlam).
   *
   * ⚠️ PROMPTNI O'ZGARTIRADI: usiz model mavjud kiyimni almashtirib
   * qo'yadi va komplekt yig'ilmaydi.
   */
  layer?: boolean;
}

export interface OpenAiTryonBundleInput {
  modelImageUrl: string;
  /** 2+ kiyim — hammasi bir modelda. Tartib: tanlangan tartib bilan. */
  garments: ReadonlyArray<{ imageUrl: string; kind: GarmentKind }>;
  faceReferenceUrl?: string | null;
  /** To'liq prompt matni (bundle variantda alohida yasalgan) */
  prompt: string;
}

/**
 * KOMPLEKT kiyintirish — bir nechta kiyim bitta GPT chaqiruvida.
 *
 * ⚠️ TARTIB: rasmlar `image[]` ga shu tartibda yuklanadi:
 *   1) odam (model surati)
 *   2..N+1) har bir kiyim (prompt'dagi IMAGE 2..N bilan mos)
 *   N+2) yuz (bor bo'lsa) — oxirida
 */
export async function generateTryonBundle(input: OpenAiTryonBundleInput): Promise<Buffer> {
  const key = env().OPENAI_API_KEY;
  if (!key) throw new Error('OpenAI kaliti sozlanmagan');
  if (input.garments.length === 0) throw new Error('Komplekt bo`sh');

  const [person, garmentBlobs, face] = await Promise.all([
    fetchAsBlob(input.modelImageUrl, 'Foydalanuvchi surati').then((b) => shrink(b, 1536)),
    Promise.all(
      input.garments.map((g) =>
        fetchAsBlob(g.imageUrl, 'Kiyim surati').then((b) => shrink(b, 1024)),
      ),
    ),
    input.faceReferenceUrl
      ? fetchAsBlob(input.faceReferenceUrl, 'Yuz surati').catch(() => null)
      : Promise.resolve(null),
  ]);

  const faceCloseup = face ? await cropFace(face).catch(() => null) : null;

  const form = new FormData();
  form.append('model', env().OPENAI_IMAGE_MODEL);
  form.append('image[]', person, 'person.jpg');
  garmentBlobs.forEach((g, i) => form.append('image[]', g, `garment-${i + 1}.jpg`));
  if (face) form.append('image[]', faceCloseup ?? face, 'face.jpg');
  form.append('prompt', input.prompt);
  appendImageOptions(form);

  return readImage(await callImagesEdit(form, key), 'komplekt-kiyintirish');
}

/**
 * Kiyintirilgan suratni yasaydi va XOM BAYT qaytaradi.
 *
 * ⚠️ CHAQIRUVCHI BUNI FONDA BAJARISHI SHART. Model javobda
 * darhol rasm beradi, lekin 30–60 soniya oladi — HTTP so'rov ichida
 * kutish taymautga olib keladi.
 */
export async function generateTryon(input: OpenAiTryonInput): Promise<Buffer> {
  const key = env().OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI kaliti sozlanmagan');
  }

  const [person, garment, face] = await Promise.all([
    /*
     * ⚠️ ODAM SURATI ENG OG'IRI (amalda 2 MB dan oshgan) va u har
     * so'rovda ketadi. Chiqish 1536 piksel balandlikda, shuning uchun
     * undan kattasi yuklashni cho'zadi, xolos.
     */
    fetchAsBlob(input.modelImageUrl, 'Foydalanuvchi surati').then((blob) => shrink(blob, 1536)),
    fetchAsBlob(input.garmentImageUrl, 'Kiyim surati').then((blob) => shrink(blob, 1024)),
    /*
     * ⚠️ YUZ SURATI YIQILSA OQIM TO'XTAMAYDI. U yaxshilash, shart emas —
     * `null` bo'lsa kiyintirish yuzsiz manba bilan davom etadi.
     */
    input.faceReferenceUrl
      ? fetchAsBlob(input.faceReferenceUrl, 'Yuz surati').catch(() => null)
      : Promise.resolve(null),
  ]);

  /*
   * ⚠️ RASMLAR BIR MAYDONDA (`image[]`). Model 16 tagacha kirish rasmini
   * qabul qiladi va promptda ular «first/second/third image» deb ataladi.
   * TARTIB MUHIM va promptdagi raqamlar bilan mos kelishi shart:
   * birinchisi — odam, ikkinchisi — kiyim, uchinchisi — yuz (ixtiyoriy).
   */
  const form = new FormData();
  form.append('model', env().OPENAI_IMAGE_MODEL);
  const [print, faceCloseup] = await Promise.all([
    cropPrint(garment),
    /*
     * ⚠️ QIRQIM BO'LMASA ASL SURAT KETADI. `cropFace` faqat yaxshilaydi;
     * `null` qaytgan holat oqimni to'xtatmasligi kerak.
     */
    face ? cropFace(face) : Promise.resolve(null),
  ]);

  /*
   * ⚠️ ODAM BIRINCHI QOLADI — VA BU ATAYLAB.
   *
   * OpenAI ko'rsatmasi: kirish rasmlarining BIRINCHISI eng boy tafsilot
   * bilan saqlanadi, shuning uchun yuz bor rasm birinchi turishi kerak.
   * Bizda birinchi rasm — foydalanuvchining o'z surati, ya'ni yuz allaqachon
   * unda. Uni yuz qirqimi bilan almashtirsak, model poza, gavda va fonni
   * ham o'sha qirqimdan olishga urinardi — kadr bo'yidan kesilardi.
   *
   * ⚠️ TARTIB PROMPTDAGI RAQAMLAR BILAN BOG'LIQ — o'zgartirmang.
   */
  form.append('image[]', person, 'person.jpg');
  form.append('image[]', garment, 'garment.jpg');
  if (face) form.append('image[]', faceCloseup ?? face, 'face.jpg');
  if (print) form.append('image[]', print, 'print.jpg');
  form.append(
    'prompt',
    buildPrompt(input.kind, {
      face: Boolean(face),
      print: Boolean(print),
      layer: Boolean(input.layer),
    }),
  );
  appendImageOptions(form);

  return readImage(await callImagesEdit(form, key), 'kiyintirish');
}

/**
 * Javobdan rasmni oladi.
 *
 * ⚠️ IKKI SHAKL QO'LLAB-QUVVATLANADI. `gpt-image-*` oilasi doim base64
 * qaytaradi; `url` faqat eski `dall-e-*` modellarida bor. Model nomi
 * sozlama orqali almashtirilgani uchun ikkalasi ham hisobga olinadi.
 */
async function readImage(response: Response, what: string): Promise<Buffer> {
  const body = (await response.json().catch(() => ({}))) as OpenAiImageResponse;

  if (!response.ok) {
    const message = body.error?.message ?? `HTTP ${response.status}`;
    logger.error({ status: response.status, message, what }, 'openai: so`rov yiqildi');
    throw new Error(`OpenAI xatosi: ${message}`);
  }

  logUsage(body.usage, what);

  const first = body.data?.[0];
  if (first?.b64_json) return Buffer.from(first.b64_json, 'base64');

  if (first?.url) {
    const image = await fetch(first.url);
    if (!image.ok) {
      throw new Error(`natija yuklanmadi: HTTP ${image.status}`);
    }
    return Buffer.from(await image.arrayBuffer());
  }

  throw new Error('OpenAI rasm qaytarmadi');
}

/**
 * Avatar so'rovining to'liq matni.
 *
 * ⚠️ ALOHIDA FUNKSIYA — SINALISHI UCHUN. Ichkarida turganda bu matnni
 * faqat haqiqiy (pullik) chaqiruv orqali ko'rish mumkin edi, ya'ni
 * ziddiyatni sinov ushlay olmasdi. Aynan shunday ziddiyat bir necha
 * hafta e'tibordan chetda qolgan.
 */
export function buildAvatarRequestPrompt(
  bodyPrompt: string,
  angle: 'front' | 'side' | 'back' = 'front',
): string {
  return [
    'Full-body photorealistic portrait of the person in the reference image.',
    /*
     * ⚠️ POZA BU YERDA AYTILMAYDI — `buildAvatarPrompt` AYTADI.
     *
     * Ilgari bu yerda «standing straight, FACING THE CAMERA, arms
     * relaxed at the sides» turardi va u `prompt` ichidagi burchak
     * ko'rsatmasi bilan TO'G'RIDAN-TO'G'RI ZIDDIYATGA kirardi:
     * «Turned away from the camera, back view, face not visible».
     *
     * Model birinchisini tanlardi — u oldinroq turgan va qolgan ikki
     * jumla bilan mustahkamlangan edi. Natijada «orqa» avatar OLDINDAN
     * chiqardi, «yon» esa atigi 15 daraja burilardi. Foydalanuvchi har
     * burchak uchun alohida to'lardi va uchalasida bir xil suratni
     * olardi.
     */
    ...identityLines(angle),
    /*
     * ⚠️ FON VA KIYIM BU YERDA AYTILMAYDI — `buildAvatarPrompt` AYTADI.
     * Ilgari ikkalasi ham TAKRORLANARDI: «Plain light grey seamless
     * studio background…» va «Plain neutral studio background…» bitta
     * so'rovda birga ketardi. Takror ko'rsatma bepul emas — u kirish
     * tokenini yeydi va modelga qarama-qarshi signal beradi.
     */
    bodyPrompt,
    /*
     * ⚠️ KIYIM HAM BU YERDA AYTILMAYDI. `buildAvatarPrompt` dagi
     * `baseLayer()` aynan shu matnni beradi — ya'ni jumla so'zma-so'z
     * IKKI MARTA yuborilardi.
     *
     * («fitted» va «underclothes» ilgari olib tashlangan: OpenAI
     * so'rovni `safety_violations=[sexual]` bilan rad etardi. O'sha
     * yumshatilgan matn `avatar-prompt.ts` da saqlanadi.)
     */
    'No text, no watermarks, no props.',
  ].join(' ');
}

/**
 * Shaxsni bog'laydigan jumlalar — burchakka qarab.
 *
 * ⚠️ «YUZ O'ZGARMASIN» NI ORQA KO'RINISHDA AYTIB BO'LMAYDI. Orqadan
 * turgan odamning yuzi ko'rinmaydi; «keep the face exactly as in the
 * reference» esa modelni yuzni KO'RSATISHGA undaydi va u odamni
 * kameraga qaratib qo'yadi. Shuning uchun orqa ko'rinishda shaxs
 * boshqa belgilar bilan bog'lanadi: soch, bosh shakli, teri rangi,
 * gavda.
 */
function identityLines(angle: 'front' | 'side' | 'back'): string[] {
  const carry =
    'The reference shows the head and shoulders — carry the neck, shoulder line and build over to the full body.';

  if (angle === 'back') {
    return [
      'This is the SAME person as in the reference image: same hair, same hair colour, same head shape, same ears, same skin tone, same build.',
      'The person is turned away from the camera — the face is NOT visible, only the back of the head and body.',
      carry,
    ];
  }

  return [faceLock(false), carry];
}

/**
 * Yuz suratidan to'liq bo'yli avatar yasaydi.
 *
 * ⚠️ YUZ O'ZGARMASLIGI ENG MUHIM TALAB. Foydalanuvchi o'zini ko'rishi
 * kerak; boshqa odam chiqsa butun oqimning ma'nosi yo'qoladi. Shuning
 * uchun prompt yuzni ochiq-oydin qulflaydi va bu jumlani o'chirmaslik
 * kerak.
 *
 * ⚠️ GAVDA O'LCHOVLARDAN. `prompt` ni `avatar-prompt.ts` yasaydi — u
 * yerda bo'y, vazn va tana tuzilishi matnga aylanadi. Bu yerda faqat
 * yuz bog'lanadi.
 *
 * @param facePhotoUrl Foydalanuvchining yuz surati (ochiq HTTPS havola)
 * @param prompt       Gavda tavsifi — `buildAvatarPrompt` natijasi
 */
export async function generateAvatar(
  facePhotoUrl: string,
  prompt: string,
  angle: 'front' | 'side' | 'back' = 'front',
): Promise<Buffer> {
  const key = env().OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI kaliti sozlanmagan');
  }

  const face = await shrink(await fetchAsBlob(facePhotoUrl, 'Yuz surati'), 1024);

  const form = new FormData();
  form.append('model', env().OPENAI_IMAGE_MODEL);
  form.append('image[]', face, 'face.jpg');
  form.append('prompt', buildAvatarRequestPrompt(prompt, angle));
  appendImageOptions(form);

  return readImage(await callImagesEdit(form, key), 'avatar');
}
