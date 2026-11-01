import {
  ADAPTER_MATCH,
  ADAPTER_URL,
  type AdapterId,
  type ContentRequest,
  type ContentResponse,
  type RunStatus,
} from '../shared/messages';
import {
  buildAvatarRequestPrompt,
  buildTryonSheetPrompt,
  isSheetPrompt,
  garmentKindForSlot,
  type Measurements,
} from '../shared/prompt';
import {
  claimTask,
  completeTask,
  dressBoard,
  fetchImage,
  fromBase64,
  hasSession,
  listTasks,
  submitDress,
  uploadResult,
  type DressGarment,
  type Task,
} from './api';

/**
 * Operator navbati — to'liq avtomatik.
 *
 * Kengaytma navbatdagi ishni oladi, brauzerdagi AI'da bajaradi va
 * natijani serverga qaytaradi. Ikki xil ish bor va ularning ishlashi
 * BUTUNLAY BOSHQACHA:
 *
 *   `render` — bitta kiyim, bitta mijoz. Yuz + gavda + kiyim suratidan
 *              kiyintirilgan foto yasaladi va ish yopiladi.
 *   `avatar` — avval YUZ suratidan to'liq bo'yli gavda yasaladi, ish
 *              yopiladi; keyin o'sha gavdaga do'konning HAMMA kiyimi
 *              bittalab kiydiriladi.
 *
 * ⚠️ AVVAL FAQAT IKKINCHISI BOR EDI VA BU JIM NOSOZLIK BERARDI: navbatda
 * `render` ishlari turganda «Boshlash» server xatosi bilan yiqilardi
 * («Kiyintirish faqat avatar ishida bo'ladi»), xato esa hech qayerda
 * ko'rinmasdi — operator 0/0 va bo'sh jurnalni ko'rardi.
 *
 * ⚠️ HAR KIYIM ALOHIDA, YALANG'OCH AVATARGA. Kiyimlar bir-birining
 * ustiga taxlanmaydi (`base_render_id = NULL`): zanjirda birinchi natija
 * buzilsa keyingilari ham buzilardi.
 */

const SLOT_ORDER = ['top', 'outer', 'bottom', 'feet'];

/** Bitta suratga beriladigan vaqt. Brauzerdagi AI odatda 20–60 soniyada javob beradi. */
const DRESS_TIMEOUT_MS = 180_000;

/**
 * So'rovlar orasidagi tanaffus.
 *
 * ⚠️ NOLGA TUSHIRMANG. Ketma-ket, tanaffussiz o'nlab so'rov — AI sayti
 * uchun robot izi; hisob cheklanadi yoki bloklanadi.
 */
const PAUSE_MS = 8_000;

/** Avtomatik rejimda navbat bo'shaganda qayta qarashgacha. */
const IDLE_POLL_MS = 60_000;

/**
 * Ketma-ket necha marta yiqilgach ish chetga suriladi va qancha vaqtga.
 *
 * ⚠️ USIZ HALQA CHEKSIZ AYLANADI. Navbat eng eskisini birinchi beradi —
 * ya'ni yiqilayotgan ish HAR SAFAR yana o'sha bo'ladi. 2026-09-23 da
 * jurnal to'qqiz soniyada bir xil xato bilan to'lgan va navbatdagi
 * sog'lom ishlarga umuman navbat kelmagan edi.
 *
 * Butunlay tashlab yubormaymiz: sabab vaqtinchalik (internet uzilishi,
 * imzo muddati) bo'lishi mumkin. Sovish muddatidan keyin yana urinadi.
 */
const MAX_FAILS = 3;
const COOLDOWN_MS = 10 * 60_000;

const KEEPALIVE = 'looksave-keepalive';
const AUTO_KEY = 'looksave.extension.auto';
const ADAPTER_KEY = 'looksave.extension.adapter';

const EMPTY: RunStatus = {
  state: 'idle',
  auto: false,
  taskId: null,
  current: null,
  queued: 0,
  total: 0,
  finished: 0,
  failed: 0,
  log: [],
};

let status: RunStatus = EMPTY;
let stopRequested = false;
/** Halqa bir nechta bo'lib ketmasin — `tick` har daqiqada chaqiriladi. */
let looping = false;

/** Qaysi ish necha marta yiqildi va qachongacha chetda turadi. */
const troubled = new Map<string, { fails: number; until: number }>();

function skipped(taskId: string): boolean {
  const entry = troubled.get(taskId);
  if (!entry) return false;

  if (Date.now() >= entry.until) {
    troubled.delete(taskId);
    return false;
  }

  return entry.fails >= MAX_FAILS;
}

export function getStatus(): RunStatus {
  return status;
}

/**
 * Ishlayotgan qurilma versiyasi.
 *
 * ⚠️ JURNALGA YOZILADI VA BU KERAK. Kengaytma `dist` papkasidan
 * yuklanadi va uni yangilash uchun uch qadam bor: qayta yig'ish,
 * `chrome://extensions` da yangilash, AI tabini yangilash. Bittasi
 * o'tkazib yuborilsa ESKI kod ishlaydi — jurnal esa yangisiniki
 * bo'lib ko'rinadi va nosozlik qaytadan qidirilardi.
 */
function version(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return '?';
  }
}

export function note(text: string): void {
  const stamp = new Date().toLocaleTimeString('uz-UZ', { hour12: false });
  status = { ...status, log: [`${stamp} · ${text}`, ...status.log].slice(0, 80) };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function stop(): void {
  stopRequested = true;
  if (status.state === 'running') note('To`xtatish so`raldi — joriy qadam tugagach to`xtaydi');
}

export async function setAuto(enabled: boolean, adapter: AdapterId): Promise<void> {
  await chrome.storage.local.set({ [AUTO_KEY]: enabled, [ADAPTER_KEY]: adapter });
  status = { ...status, auto: enabled };

  if (!enabled) {
    stop();
    return;
  }

  stopRequested = false;
  note('Avtomatik rejim yoqildi');
  void loop(adapter);
}

async function readAuto(): Promise<{ enabled: boolean; adapter: AdapterId }> {
  const stored = await chrome.storage.local.get([AUTO_KEY, ADAPTER_KEY]);
  return {
    enabled: stored[AUTO_KEY] === true,
    adapter: stored[ADAPTER_KEY] === 'gemini' ? 'gemini' : 'chatgpt',
  };
}

/**
 * Har daqiqada chaqiriladi (alarm).
 *
 * ⚠️ HALQANI QAYTA KO'TARISH UCHUN KERAK. MV3 worker'i o'chirilsa
 * halqa ham o'ladi; brauzer qayta uyg'otganda avtomatik rejim
 * O'ZIDAN-O'ZI tiklanmasa, operator ertalab hech narsa qilinmaganini
 * ko'rardi.
 */
export async function tick(): Promise<void> {
  if (looping || status.state === 'running') return;

  const auto = await readAuto();
  status = { ...status, auto: auto.enabled };

  if (!auto.enabled || !(await hasSession())) return;

  stopRequested = false;
  void loop(auto.adapter);
}

// ── Halqa ──

async function loop(adapter: AdapterId): Promise<void> {
  if (looping) return;
  looping = true;

  /*
   * ⚠️ KEEPALIVE — MV3 NING ENG JIM TUZOG'I. Worker 30 soniya bo'sh
   * tursa o'chiriladi va navbat o'rtada uzilardi: ekranda «ishlayapti»
   * ko'rinardi, aslida hech narsa bo'lmasdi.
   */
  chrome.alarms.create(KEEPALIVE, { periodInMinutes: 25 / 60 });

  try {
    for (;;) {
      if (stopRequested) break;

      const tasks = await listTasks('open');
      status = { ...status, queued: tasks.length };

      /*
       * ⚠️ `tasks[0]` EMAS. Navbat eng eskisini birinchi beradi va agar
       * aynan o'sha yiqilayotgan bo'lsa, halqa undan nariga o'tmasdi.
       */
      const task = tasks.find((item) => !skipped(item.id));
      if (!task) {
        const auto = await readAuto();
        if (!auto.enabled) break;

        status = { ...status, state: 'idle', current: null, taskId: null };
        await sleep(IDLE_POLL_MS);
        continue;
      }

      await runTask(task, adapter);

      const auto = await readAuto();
      if (!auto.enabled) break;
    }
  } catch (error) {
    /*
     * ⚠️ XATO KO'RINISHI SHART. Ilgari u chaqiruvchining `.catch()` ida
     * yo'qolardi va operator sababsiz «Bo'sh 0/0» ni ko'rardi — aynan
     * shu narsa kengaytmani «umuman ishlamaydi» qilib ko'rsatgan edi.
     */
    note(`✗ ${error instanceof Error ? error.message : 'Kutilmagan xato'}`);
  } finally {
    await chrome.alarms.clear(KEEPALIVE);
    looping = false;
    status = { ...status, state: stopRequested ? 'stopped' : 'idle', current: null };
  }
}

/** Bitta ishni boshidan oxirigacha bajaradi. */
export async function runTask(task: Task, adapter: AdapterId): Promise<void> {
  status = {
    ...status,
    state: 'running',
    taskId: task.id,
    current: null,
    total: 0,
    finished: 0,
    failed: 0,
  };

  try {
    /*
     * ⚠️ BAND QILISH BIRINCHI. Serverdan natija faqat ishni band qilgan
     * operatordan qabul qilinadi. Ish boshqa operatorda bo'lsa bu yerda
     * to'xtaymiz — uning ishini tortib olmaymiz.
     */
    await claimTask(task.id);

    const tabId = await ensureTab(adapter);

    if (task.kind === 'avatar') {
      await runAvatarTask(task, tabId, adapter);
    } else {
      await runRenderTask(task, tabId, adapter);
    }

    troubled.delete(task.id);
  } catch (error) {
    status = { ...status, failed: status.failed + 1 };
    note(`✗ ${task.kind} ${task.id.slice(0, 8)} — ${message(error)}`);

    const fails = (troubled.get(task.id)?.fails ?? 0) + 1;
    troubled.set(task.id, { fails, until: Date.now() + COOLDOWN_MS });

    if (fails >= MAX_FAILS) {
      note(
        `↷ ${task.id.slice(0, 8)} ${MAX_FAILS} marta yiqildi — ${COOLDOWN_MS / 60_000} daqiqaga chetga surildi`,
      );
    }

    /*
     * ⚠️ NAVBAT TO'XTAMAYDI, LEKIN TANAFFUS QILADI. Xato serverdan
     * kelgan bo'lsa (masalan sessiya tugagan), keyingi ish ham darhol
     * yiqilardi va jurnal soniyada yuzta xato bilan to'lardi.
     */
    await sleep(PAUSE_MS);
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Noma`lum xato';
}

// ── `render` ishi: bitta kiyim ──

/**
 * Natija haqiqatan uch panelli varaqmi (landshaft).
 *
 * ⚠️ NEGA SHART (#f8196c0d, 2026-09-25). ChatGPT rasm o'rniga matn bilan
 * javob bersa, kengaytma sahifadagi BIZ biriktirgan suratni (yuzni)
 * «natija» deb olib mijozga yuborgan edi. Varaq har doim landshaft, yuz
 * surati esa tik — shakl bo'yicha ajratiladi va noto'g'ri surat umuman
 * yuborilmaydi.
 */
async function assertSheet(image: { mime: string; base64: string }): Promise<void> {
  const bitmap = await createImageBitmap(fromBase64(image.base64, image.mime));
  const { width, height } = bitmap;
  bitmap.close();
  if (width < height * 1.2) {
    throw new Error(
      `AI uch panelli rasm qaytarmadi (${width}×${height}) — natija yuborilmadi, ishni qayta boshlang`,
    );
  }
}

async function runRenderTask(task: Task, tabId: number, adapter: AdapterId): Promise<void> {
  const garment = task.previews['garmentImageUrl'];
  const face = task.previews['faceUrl'] ?? null;
  // Yuz surati bo'lmasa gavda suratidan yuz olinadi — boshqa manba yo'q
  const identity = face ?? task.previews['bodyUrl'] ?? null;

  if (!identity || !garment) throw new Error('Ishda yuz yoki kiyim surati yo`q');

  status = { ...status, total: 1, current: { title: 'Kiyintirish' } };

  const slot = typeof task.payload['slot'] === 'string' ? task.payload['slot'] : '';

  /*
   * ⚠️ FAQAT YUZ + KIYIM (2026-09-25). Gavda surati berilmaydi — gavda
   * o'lchamlardan quriladi, natija esa uch panelli varaq (server uni
   * old/yon/orqa qilib bo'ladi).
   *
   * ⚠️ YUZ UCH MARTA BIRIKTIRILADI (2026-10-30). Modellar ko'p marta
   * ko'rilgan rasmga ko'proq e'tibor beradi — bitta yuz surati bilan model
   * uni «bir chekka tafsilot» deb hisoblab, qayta chizib yuborardi. Uch
   * nusxa bilan u «ASOSIY mavzu» bo'ladi.
   */
  const faceImage = await fetchImage(identity);
  const images = [
    { name: 'face-1.jpg', ...faceImage },
    { name: 'face-2.jpg', ...faceImage },
    { name: 'face-3.jpg', ...faceImage },
    { name: 'garment.jpg', ...(await fetchImage(garment)) },
  ];

  const prompt = buildTryonSheetPrompt({
    kind: garmentKindForSlot(slot),
    measurements: measurementsOf(task.payload),
    gender: genderOf(task.payload),
  });

  const result = await generate(tabId, adapter, prompt, images);
  await assertSheet(result);
  await completeTask(task.id, await store(result));

  status = { ...status, finished: status.finished + 1, current: null };
  note(`✓ Kiyintirish ${task.id.slice(0, 8)} — mijozga yuborildi`);
}

// ── `avatar` ishi: gavda + do'konning hamma kiyimi ──

async function runAvatarTask(task: Task, tabId: number, adapter: AdapterId): Promise<void> {
  /*
   * ⚠️ FAQAT AVATAR + BIRINCHI MAHSULOT (2026-09-25, so'rovga ko'ra).
   * Ilgari avatar yasalgach do'konning HAMMA kiyimi ketma-ket
   * kiyintirilardi (`dressGarments`) — navbat o'nlab ish bilan to'lardi va
   * kredit behuda ketardi. Endi avatar birinchi mahsulot bilan yasaladi,
   * qolgan kiyimlar esa mijoz ilovada BOSGANDA alohida `render` ishi
   * bo'lib keladi.
   */
  if (task.status !== 'done') {
    await makeAvatar(task, tabId, adapter);
  }
}

async function makeAvatar(task: Task, tabId: number, adapter: AdapterId): Promise<void> {
  const faceUrl = task.previews['faceUrl'];
  if (!faceUrl) throw new Error('Ishda yuz surati yo`q');

  const bodyPrompt = typeof task.payload['prompt'] === 'string' ? task.payload['prompt'] : '';
  if (!bodyPrompt) throw new Error('Ishda gavda tavsifi yo`q');

  /*
   * ⚠️ AVATAR DARHOL DO'KONNING BIRINCHI USTKI KIYIMIDA YASALADI.
   *
   * Ilgari avatar kulrang maykada chiqardi va mijoz real mahsulotni
   * faqat KEYINGI generatsiyadan keyin ko'rardi — ya'ni ikki barobar
   * kutish va ikki barobar so'rov. Endi birinchi suratdayoq do'konning
   * futbolkasi bo'ladi.
   *
   * ⚠️ KIYIM TOPILMASA OQIM TO'XTAMAYDI. Do'kon tanlanmagan yoki
   * ustki kiyim qolmagan bo'lishi mumkin — u holda avatar eskicha,
   * kulrang asos bilan yasaladi.
   */
  const first = await firstTop(task.id);

  status = { ...status, total: 1, current: { title: 'Avatar yasash' } };
  if (first) note(`Avatar ${first.title} bilan yasaladi`);

  // Yuz uch marta — "Yuz UCH MARTA BIRIKTIRILADI" tushuntirishi runRenderTask'da
  const faceImage = await fetchImage(faceUrl);
  const images = [
    { name: 'face-1.jpg', ...faceImage },
    { name: 'face-2.jpg', ...faceImage },
    { name: 'face-3.jpg', ...faceImage },
    ...(first
      ? [{ name: 'garment.jpg', ...(await fetchImage(first.garmentImage as string)) }]
      : []),
  ];

  const result = await generate(
    tabId,
    adapter,
    buildAvatarRequestPrompt(bodyPrompt, first ? garmentKindForSlot(first.slot) : null),
    images,
  );

  if (isSheetPrompt(bodyPrompt)) await assertSheet(result);
  const resultUrl = await store(result);
  await completeTask(task.id, resultUrl);

  /*
   * Kiyim natijasi sifatida BUTUN varaq yuboriladi — server uni o'zi
   * old/yon/orqa renderlarga bo'ladi (`submitDress`, 2026-09-25).
   */
  const dressUrl = resultUrl;

  /*
   * ⚠️ O'SHA SURAT KIYIM NATIJASI SIFATIDA HAM YOZILADI. U aynan shu
   * odam shu futbolkada — ya'ni kiyintirishning tayyor natijasi. Qayta
   * yasash bir so'rovni va bir-ikki daqiqani bekorga yeb ketardi.
   *
   * ⚠️ YIQILSA AVATAR BUZILMAYDI: ish allaqachon yopilgan va bu
   * qo'shimcha yozuv. Kiyim keyin navbatda oddiy tartibda kiydiriladi.
   */
  if (first) {
    try {
      await submitDress(task.id, first.variantId, dressUrl);
      note(`✓ ${first.title} — avatar bilan birga mijozga yuborildi`);
    } catch (error) {
      note(`· ${first.title} kiyim natijasi yozilmadi: ${message(error)}`);
    }
  }

  status = { ...status, finished: status.finished + 1, current: null };
  note(`✓ Avatar yasaldi — ${task.id.slice(0, 8)}`);
}

/** Do'konning birinchi ustki kiyimi — avatar bilan birga yasaladigani. */
async function firstTop(taskId: string): Promise<DressGarment | null> {
  try {
    const board = await dressBoard(taskId);
    /*
     * ⚠️ `done` GA QARALMAYDI (2026-09-25). `ordered` allaqachon
     * kiyintirilgan (`done`) kiyimlarni tashlaydi — u kiyintirish
     * NAVBATI uchun to'g'ri. Lekin avatar uchun BIRINCHI mahsulotni
     * har doim olishimiz kerak: aks holda do'konda kiyim bo'lsa ham
     * avatar kulrang asosda chiqib qolardi. Faqat rasmi borlaridan,
     * ustki kiyim (`top`/`outer`) birinchi bo'lib tanlanadi.
     */
    const withImage = board.garments.filter((garment) => garment.garmentImage);
    if (withImage.length === 0) return null;
    const sorted = withImage.sort((a, b) => {
      const rank = SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot);
      return rank !== 0 ? rank : a.title.localeCompare(b.title);
    });
    return sorted.find((garment) => garment.slot === 'top' || garment.slot === 'outer') ?? sorted[0] ?? null;
  } catch {
    /* Taxta o'qilmasa avatar kiyimsiz yasalaveradi — bu to'xtatuvchi xato emas */
    return null;
  }
}

// ── Umumiy yordamchilar ──

/** Natijani omborga yozib, ochiq havolasini qaytaradi. */
async function store(image: { mime: string; base64: string }): Promise<string> {
  return uploadResult(image.mime, fromBase64(image.base64, image.mime));
}

async function generate(
  tabId: number,
  adapter: AdapterId,
  prompt: string,
  images: { name: string; mime: string; base64: string }[],
): Promise<{ mime: string; base64: string }> {
  await freshChat(tabId, adapter);

  const response = await ask(tabId, { type: 'DRESS', prompt, images, timeoutMs: DRESS_TIMEOUT_MS });

  if (!response.ok) throw new Error(response.error);

  /*
   * ⚠️ IKKI YO'L. Content script suratni o'zi o'qiy olsa — baytlar
   * darhol keladi. CORS to'sgan bo'lsa faqat havola keladi va uni
   * worker oladi (`host_permissions`).
   */
  if (response.type === 'IMAGE') return { mime: response.mime, base64: response.base64 };
  if (response.type === 'IMAGE_URL') return fetchImage(response.url);

  throw new Error('AI rasm qaytarmadi');
}

/**
 * Har so'rov uchun TOZA suhbat ochadi.
 *
 * ⚠️ ESKI SUHBATDA ISHLASH BIR NECHTA NOSOZLIK BERADI VA ULAR BIR-BIRIGA
 * O'XSHAMAYDI:
 *
 *   1. Oldingi urinishdan qolgan biriktirmalar matn maydonida turadi —
 *      yangilarini sanash chalkashadi va «biriktirilmadi» deb yiqiladi.
 *   2. Suhbatdagi eski suratlar «yangi natija» bo'lib olinishi mumkin.
 *   3. Model oldingi xabarlarni kontekst deb oladi va navbatning
 *      o'rtasida javoblari siljib ketadi.
 *
 * ⚠️ SAHIFA QAYTA YUKLANADI, YA'NI CONTENT SCRIPT HAM YANGIDAN QO'YILADI.
 * Shuning uchun keyin `ensureTab` bilan bir xil tekshiruvdan o'tiladi.
 */
async function freshChat(tabId: number, adapter: AdapterId): Promise<void> {
  await chrome.tabs.update(tabId, { url: ADAPTER_URL[adapter] });
  await sleep(5_000);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await ping(tabId)) return;
    await sleep(2_000);
  }

  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  await sleep(1_000);

  if (!(await ping(tabId))) throw new Error('Yangi suhbat ochilmadi — sahifa javob bermadi');
}

/**
 * AI sahifasi ochilgan tabni topadi va content script ishlayotganiga
 * ISHONCH HOSIL QILADI.
 *
 * ⚠️ SAHIFA OCHIQ BO'LISHI YETARLI EMAS. Content script sahifaga faqat
 * YUKLANISH paytida qo'yiladi. Kengaytma o'rnatilgandan oldin ochilgan
 * ChatGPT tabida u YO'Q — `PING` javobsiz qoladi va butun navbat
 * «AI sahifasi javob bermadi» bilan yiqilardi. Bu operator uchun eng
 * tushunarsiz xato edi: sahifa ko'z oldida ochiq turardi.
 */
async function ensureTab(adapter: AdapterId): Promise<number> {
  const tabs = await chrome.tabs.query({ url: ADAPTER_MATCH[adapter] });
  const existing = tabs.find((tab) => typeof tab.id === 'number');

  let tabId = existing?.id;

  if (tabId === undefined) {
    const created = await chrome.tabs.create({ url: ADAPTER_URL[adapter], active: true });
    if (created.id === undefined) throw new Error('AI sahifasi ochilmadi');
    tabId = created.id;
    await sleep(6_000);
  }

  if (await ping(tabId)) return tabId;

  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  await sleep(1_000);

  if (await ping(tabId)) return tabId;

  throw new Error('AI sahifasiga ulanib bo`lmadi — sahifani yangilab ko`ring');
}

async function ping(tabId: number): Promise<boolean> {
  const response = (await chrome.tabs
    .sendMessage(tabId, { type: 'PING' } satisfies ContentRequest)
    .catch(() => null)) as ContentResponse | null;

  return response?.ok === true;
}

async function ask(tabId: number, request: ContentRequest): Promise<ContentResponse> {
  const response = (await chrome.tabs
    .sendMessage(tabId, request)
    .catch(() => null)) as ContentResponse | null;

  if (!response) throw new Error('AI sahifasi javob bermadi — sahifa yopilgan bo`lishi mumkin');

  return response;
}

function genderOf(payload: Record<string, unknown>): string | null {
  const value = payload['gender'];
  return typeof value === 'string' ? value : null;
}

function measurementsOf(payload: Record<string, unknown>): Measurements {
  const raw = payload['measurements'];
  if (!raw || typeof raw !== 'object') return {};

  const source = raw as Record<string, unknown>;
  const pick = (key: string): number | undefined => {
    const value = source[key];
    const parsed = typeof value === 'string' ? Number(value) : value;
    return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  return {
    height: pick('height'),
    weight: pick('weight'),
    chest: pick('chest'),
    waist: pick('waist'),
    hips: pick('hips'),
    topSize: typeof source['topSize'] === 'string' ? source['topSize'] : undefined,
    bottomSize: typeof source['bottomSize'] === 'string' ? source['bottomSize'] : undefined,
  };
}

/** ⚠️ ASOSIY KIYIM BIRINCHI — mijoz ilovada avval ustki kiyimni ko'radi. */
function ordered(garments: DressGarment[]): DressGarment[] {
  return garments
    .filter((garment) => !garment.done && garment.garmentImage)
    .sort((a, b) => {
      const rank = SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot);
      return rank !== 0 ? rank : a.title.localeCompare(b.title);
    });
}

/**
 * Sahifa tekshiruvi — navbatga tegmaydi.
 *
 * ⚠️ NAVBAT ISHLAYOTGANDA RAD ETILADI. Tekshiruv matn maydoniga yozadi
 * va surat biriktiradi — kiyintirish o'rtasida bu tayyor so'rovni
 * buzardi.
 */
export async function runDiagnose(adapter: AdapterId): Promise<void> {
  if (status.state === 'running') throw new Error('Avval navbatni to`xtating');

  note(`— sahifa tekshiruvi · kengaytma v${version()} —`);

  const tabId = await ensureTab(adapter);
  const response = await ask(tabId, { type: 'DIAGNOSE' });

  if (!response.ok) {
    note(`✗ tekshiruv: ${response.error}`);
    return;
  }

  if (response.type !== 'REPORT') return;

  /* ⚠️ TESKARI TARTIBDA — jurnal eng yangisini boshida ko'rsatadi. */
  for (const line of [...response.lines].reverse()) note(line);
}

/** Yuborishni sinash — suhbatga qisqa matn yozib yuboradi. */
export async function runTestSend(adapter: AdapterId): Promise<void> {
  if (status.state === 'running') throw new Error('Avval navbatni to`xtating');

  note(`— yuborish sinovi · kengaytma v${version()} —`);

  const tabId = await ensureTab(adapter);
  const response = await ask(tabId, { type: 'TEST_SEND' });

  if (!response.ok) {
    note(`✗ sinov: ${response.error}`);
    return;
  }

  if (response.type !== 'REPORT') return;

  for (const line of [...response.lines].reverse()) note(line);
}

/** Bitta ishni qo'lda boshlash — paneldagi va popupdagi «Boshlash». */
export async function start(taskId: string, adapter: AdapterId): Promise<void> {
  if (status.state === 'running') throw new Error('Navbat allaqachon ishlayapti');

  stopRequested = false;
  status = { ...EMPTY, auto: status.auto };

  chrome.alarms.create(KEEPALIVE, { periodInMinutes: 25 / 60 });

  try {
    const tasks = await listTasks('open');
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error('Bu ish navbatda yo`q');

    status = { ...status, queued: tasks.length };
    await runTask(task, adapter);
  } catch (error) {
    note(`✗ ${message(error)}`);
  } finally {
    await chrome.alarms.clear(KEEPALIVE);
    status = { ...status, state: stopRequested ? 'stopped' : 'idle', current: null };
  }
}
