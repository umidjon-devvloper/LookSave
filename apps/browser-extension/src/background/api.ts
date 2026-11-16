/**
 * LookSave API mijozi — panelnikiga o'xshash, lekin sessiyasi ALOHIDA.
 *
 * ⚠️ NEGA PANELNING TOKENINI O'G'IRLAB OLMAYMIZ. Panel refresh tokenni
 * `localStorage` da saqlaydi va uni kengaytma content script orqali o'qishi
 * mumkin edi — bir qarashda qulay. Lekin server `/auth/refresh` da tokenni
 * ROTATSIYA qiladi va eskisini DARHOL bekor qiladi (`consumeRefreshToken`).
 * Ya'ni kengaytma bir marta yangilasa, panelning tokeni o'lik bo'lardi va
 * operator ish o'rtasida tizimdan uchib chiqardi. Shuning uchun kengaytma
 * o'zi alohida kiradi — ikki mustaqil sessiya.
 */

const DEFAULT_BASE = 'https://api.looksave.uz';
const REFRESH_KEY = 'looksave.extension.refresh';
const BASE_KEY = 'looksave.extension.apiBase';
const ACCESS_KEY = 'looksave.extension.access';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function apiBase(): Promise<string> {
  const stored = await chrome.storage.local.get([BASE_KEY]);
  const value = typeof stored[BASE_KEY] === 'string' ? stored[BASE_KEY] : DEFAULT_BASE;
  return `${value.replace(/\/+$/, '')}/v1`;
}

/*
 * ⚠️ ACCESS TOKEN `storage.session` DA, XOTIRADA EMAS. MV3 service worker
 * 30 soniya bo'sh tursa O'CHIRILADI va modul o'zgaruvchilari yo'qoladi —
 * navbat o'rtasida har safar qayta login talab qilinardi. `session` esa
 * brauzer yopilguncha yashaydi va diskka yozilmaydi.
 */
async function readAccess(): Promise<string | null> {
  const stored = await chrome.storage.session.get([ACCESS_KEY]);
  return typeof stored[ACCESS_KEY] === 'string' ? stored[ACCESS_KEY] : null;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

async function saveTokens(tokens: Tokens): Promise<void> {
  await chrome.storage.session.set({ [ACCESS_KEY]: tokens.accessToken });
  await chrome.storage.local.set({ [REFRESH_KEY]: tokens.refreshToken });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.session.remove([ACCESS_KEY]);
  await chrome.storage.local.remove([REFRESH_KEY]);
}

export async function hasSession(): Promise<boolean> {
  const stored = await chrome.storage.local.get([REFRESH_KEY]);
  return typeof stored[REFRESH_KEY] === 'string';
}

interface Envelope<T> {
  ok?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

async function unwrap<T>(response: Response, what: string): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as Envelope<T>;

  if (!response.ok) {
    throw new ApiError(
      body.error?.code ?? 'HTTP_ERROR',
      body.error?.message ?? `${what}: HTTP ${response.status}`,
      response.status,
    );
  }

  return body.data as T;
}

export async function login(phone: string, password: string): Promise<void> {
  const response = await fetch(`${await apiBase()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password, platform: 'web' }),
  });

  await saveTokens(await unwrap<Tokens>(response, 'Kirish'));
}

/*
 * ⚠️ BIR VAQTDA BITTA YANGILASH. Navbat bir nechta so'rovni ketma-ket
 * yuboradi va ikkitasi bir vaqtda 401 olsa, ikkalasi ham refresh qilardi:
 * birinchisi tokenni rotatsiya qiladi, ikkinchisi esa ALLAQACHON bekor
 * qilingan tokenni ko'rsatadi va server butun sessiyani yopadi. Natijada
 * navbat o'rtasida «Qayta kirish talab qilinadi» chiqardi.
 */
let refreshing: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  const stored = await chrome.storage.local.get([REFRESH_KEY]);
  const refreshToken = stored[REFRESH_KEY];
  if (typeof refreshToken !== 'string') return false;

  const response = await fetch(`${await apiBase()}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    await clearSession();
    return false;
  }

  const body = (await response.json()) as Envelope<Tokens>;
  if (!body.data) {
    await clearSession();
    return false;
  }

  await saveTokens(body.data);
  return true;
}

function refresh(): Promise<boolean> {
  refreshing ??= refreshOnce().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function authed<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  retry = true,
): Promise<T> {
  const access = await readAccess();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (access) headers['Authorization'] = `Bearer ${access}`;

  const url = `${await apiBase()}${path}`;
  const method = init.method ?? 'GET';

  /*
   * ⚠️ GET VAQTINCHA XATODA QAYTA URINILADI (2026-09-25). Server kichik
   * VPS'da: og'ir ish (masalan, fon olib tashlash) paytida nginx 504
   * qaytarardi va avatar tayyor bo'lsa ham kiyimlar navbati yiqilardi.
   * Faqat GET — POST takrorlansa natija ikki marta yozilishi mumkin.
   */
  const attempts = method === 'GET' ? 4 : 1;
  let response: Response | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    response = await fetch(url, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }).catch(() => null);

    const transient = response === null || [502, 503, 504].includes(response.status);
    if (!transient || attempt === attempts) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 4_000));
  }

  if (!response) {
    throw new ApiError('NETWORK', `Serverga ulanib bo\`lmadi — ${hostOf(url)}`, 0);
  }

  if (response.status === 401 && retry && (await refresh())) {
    return authed<T>(path, init, false);
  }

  return unwrap<T>(response, path);
}

// ── Navbat ──

export interface Task {
  id: string;
  kind: string;
  userId: string;
  status: string;
  payload: {
    gender?: string | null;
    measurements?: Record<string, number | string>;
    faceUrl?: string;
    [key: string]: unknown;
  };
  previews: Record<string, string>;
  resultUrl: string | null;
  createdAt: string;
}

export const listTasks = (status = 'open'): Promise<Task[]> =>
  authed<Task[]>(`/developer-ai/tasks?status=${status}&limit=100`);

export interface DressGarment {
  variantId: string;
  productId: string;
  title: string;
  slot: string;
  garmentImage: string | null;
  done: boolean;
}

export interface DressBoard {
  avatarImage: string | null;
  garments: DressGarment[];
}

export const dressBoard = (taskId: string): Promise<DressBoard> =>
  authed<DressBoard>(`/developer-ai/tasks/${taskId}/garments`);

/**
 * Ishni band qiladi.
 *
 * ⚠️ NATIJANI TOPSHIRISHDAN OLDIN SHART. Server natijani faqat ishni
 * BAND QILGAN operatordan qabul qiladi (`finish` — `claimed_by = $2`).
 * Bandsiz yuborilsa «Ish band qilinmagan» bilan qaytadi.
 *
 * ⚠️ `ALREADY_EXISTS` HAR DOIM XATO EMAS. Operator ishni panelda qo'lda
 * band qilgan bo'lishi mumkin — u holda server o'sha ishni qaytaradi va
 * davom etaveramiz. Xato faqat ish BOSHQA operatorda bo'lsa.
 */
export const claimTask = (taskId: string): Promise<Task> =>
  authed<Task>(`/developer-ai/tasks/${taskId}/claim`, { method: 'POST' });

/**
 * Server ishni yopishga ulgurmay ulanish uzildimi.
 *
 * 502/503/504 — oraliqdagi proksi (nginx) kutishdan charchadi; 0 — ulanish
 * javobsiz yopildi. Bularning hech biri «server rad etdi» degani emas.
 */
function cutShort(error: unknown): boolean {
  return error instanceof ApiError && [0, 502, 503, 504].includes(error.status);
}

/** Ish `done` bo'lguncha kutadi; muddat ichida bo'lmasa `null`. */
async function waitUntilDone(taskId: string): Promise<Task | null> {
  const deadline = Date.now() + 4 * 60_000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));

    const done = await listTasks('done').catch(() => [] as Task[]);
    const task = done.find((item) => item.id === taskId);
    if (task) return task;
  }

  return null;
}

/**
 * Ishni yopadi — natija `profiles` yoki `tryon_renders` ga ko'chiriladi.
 *
 * ⚠️ ULANISH UZILSA ISH «YIQILDI» DEB OLINMAYDI (2026-11-12). Server ishni
 * yopayotib suratga mijozning asl yuzini joylaydi; o'lchangan vaqt 40–75
 * soniya, xizmat band bo'lsa bir necha daqiqa. Oraliqdagi proksi shuncha
 * kutmasligi mumkin va 504 qaytaradi — server esa ishni OXIRIGACHA
 * bajaradi. Ilgari kengaytma buni xato deb olardi: avatar aslida tayyor
 * bo'lsa ham jurnalda «✗» chiqardi va avatar bilan birga yoziladigan
 * birinchi kiyim umuman yozilmasdi.
 *
 * ⚠️ `POST` QAYTA YUBORILMAYDI — natija ikki marta yozilmasin. Buning
 * o'rniga ish `done` ro'yxatida paydo bo'lishi kutiladi.
 */
export async function completeTask(taskId: string, resultUrl: string): Promise<Task> {
  try {
    return await authed<Task>(`/developer-ai/tasks/${taskId}/result`, {
      method: 'POST',
      body: { resultUrl },
    });
  } catch (error) {
    if (!cutShort(error)) throw error;

    const settled = await waitUntilDone(taskId);
    if (settled) return settled;
    throw error;
  }
}

interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  headers: Record<string, string>;
}

/**
 * Natijani R2 ga yuklab, ochiq havolasini qaytaradi.
 *
 * ⚠️ IKKI QADAM. Server tashqi havolani qabul qilmaydi (`isOwnCdnUrl`) —
 * ya'ni AI saytining havolasini to'g'ridan-to'g'ri berib bo'lmaydi. Surat
 * avval bizning omborga ko'chiriladi. Bu shart emas, shart: AI saytidagi
 * havola bir necha soatdan keyin o'ladi va mijozning gallereyasida
 * singan rasm qolardi.
 */
export async function uploadResult(mime: string, bytes: Blob): Promise<string> {
  const presign = await authed<PresignResult>('/developer-ai/uploads/presign', {
    method: 'POST',
    body: { purpose: 'avatar', contentType: mime, fileName: `tryon${extensionFor(mime)}` },
  });

  const uploaded = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: presign.headers,
    body: bytes,
  }).catch(() => null);

  if (!uploaded) {
    throw new ApiError(
      'NETWORK',
      `Surat omborga yetmadi — ${hostOf(presign.uploadUrl)} ${PERMISSION_HINT}, yoki internet uzilgan`,
      0,
    );
  }

  if (!uploaded.ok) {
    throw new ApiError('NETWORK', `Surat yuklanmadi (${uploaded.status})`, uploaded.status);
  }

  return presign.publicUrl;
}

function extensionFor(mime: string): string {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '.jpg';
}

export const submitDress = (
  taskId: string,
  variantId: string,
  resultUrl: string,
): Promise<{ variantId: string; done: true }> =>
  authed(`/developer-ai/tasks/${taskId}/garments/${variantId}`, {
    method: 'POST',
    body: { resultUrl },
  });

/**
 * Manzildagi suratni oladi.
 *
 * ⚠️ WORKER'DA, CONTENT SCRIPT'DA EMAS. Avatar havolasi imzolangan R2
 * manzili, kiyim esa CDN'da — ikkalasi ham AI saytining origin'idan
 * boshqa. Content script'dan olinsa CORS to'sadi; worker esa
 * `host_permissions` bilan bemalol oladi.
 */
export async function fetchImage(url: string): Promise<{ mime: string; base64: string }> {
  const response = await fetch(url).catch(() => {
    /*
     * ⚠️ BRAUZER BU YERDA «Failed to fetch» DAN BOSHQA HECH NARSA
     * AYTMAYDI. Sabab esa deyarli har doim bitta: manzilning domeni
     * `host_permissions` da yo'q. Worker unda turgan domenlarga CORS'siz
     * chiqadi, qolganiga esa oddiy sahifadek — R2 bo'lsa uni rad etadi.
     *
     * Bu 2026-09-23 da haqiqatan bo'lgan: CDN `pub-….r2.dev` da edi,
     * ro'yxatda esa faqat `cloudflarestorage.com` turardi. Xato matni
     * «Failed to fetch» bo'lgani uchun sabab ko'rinmasdi.
     */
    throw new ApiError('NETWORK', `Surat olinmadi — ${hostOf(url)} ${PERMISSION_HINT}`, 0);
  });

  if (!response.ok)
    throw new ApiError('NETWORK', `Surat olinmadi (${response.status})`, response.status);

  const blob = await response.blob();
  return { mime: blob.type || 'image/jpeg', base64: await toBase64(blob) };
}

const PERMISSION_HINT = 'kengaytmaning ruxsat ro`yxatida yo`q (manifest.json → host_permissions)';

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'manzil';
  }
}

export async function toBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());

  /*
   * ⚠️ `String.fromCharCode(...buffer)` EMAS. 1 MB li surat 1 million
   * argument bo'lib tarqaladi va `RangeError: Maximum call stack size
   * exceeded` beradi — aynan katta, ya'ni eng muhim suratlarda yiqiladi.
   */
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buffer.length; i += CHUNK) {
    binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK));
  }

  return btoa(binary);
}

export function fromBase64(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
