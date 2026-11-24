import { env } from '../config/env';
import { logger } from '../logger';

import { describeNetworkError } from './openai';

/**
 * Matn AI — AI stilist uchun. Asosiy provayder OpenAI, zaxira — Gemini.
 *
 * Rasm chaqiruvi (`openai.ts`) bilan aralashtirilmaydi: matn modeli
 * `chat/completions` ga boradi va JSON qaytaradi, kalitlari ham alohida
 * (`OPENAI_STYLIST_API_KEY`, `GEMINI_STYLIST_API_KEY`).
 *
 * ⚠️ MODEL FAQAT BERILGAN RO'YXATDAN TANLAYDI (2026-11-24). Ilgari model
 * qidiruv so'zi («ko'ylak», «shim») qaytarardi, DB'da esa bunday mahsulot
 * yo'q edi — javob «taklif qilaman» derdi-yu, bitta ham mahsulot chiqmasdi.
 * Endi chaqiruvchi (`catalog/stylist.ts`) mavjud mahsulotlarni raqamlangan
 * ro'yxat qilib beradi, model esa raqam qaytaradi. Uydirma mahsulot bo'lmaydi.
 *
 * ⚠️ ZAXIRA ZANJIRI (2026-11-24, egasining talabi: «GPT puli tugasa
 * Gemini'ga yuborsin»). Tartib: OpenAI → Gemini modellari → (chaqiruvchida)
 * qoidalar. OpenAI balansi tugasa (429 `insufficient_quota`) yoki kaliti
 * yaroqsiz bo'lsa (401), u 10 daqiqaga chetlab o'tiladi — har so'rov avval
 * yiqiladigan chaqiruvni kutmasin va logni to'ldirmasin.
 *
 * ⚠️ UMUMIY VAQT 20 s. Mobil ilova javobni 25 s kutadi (`api()` sukuti).
 * Har chaqiruv o'z chegarasini oladi, lekin hammasi bitta muddatga sig'adi;
 * vaqt qolmasa keyingi provayder sinalmaydi va chaqiruvchi qoidaga tushadi.
 *
 * ⚠️ BU MODUL HAM PUL SARFLAYDI. `gpt-4o-mini` ~$0.15/1M input, $0.60/1M
 * output — 150 qatorlik ro'yxat bilan ham bir chaqiruv ~$0.0005. Gemini
 * «lite» modellari shu darajada yoki arzonroq.
 *
 * ⚠️ JAVOB QO'LDA TEKSHIRILADI. Model vaqti-vaqti bilan sxemadan chetga
 * chiqadi (ro'yxatda yo'q raqam, bo'sh maydon). Yaroqsiz raqamlar tashlanadi;
 * javob umuman yaroqsiz bo'lsa keyingi provayder sinaladi, hammasi yiqilsa
 * xato tashlanadi va chaqiruvchi qoidaga tushadi — foydalanuvchi bo'sh oyna
 * ko'rmaydi.
 */

export interface StylistPick {
  /** Mahsulot slot'i — `products.slot` qiymatlariga mos */
  slot: 'top' | 'bottom' | 'outer' | 'feet' | 'bag' | 'head' | 'neck';
  /** Qidiruv kaliti — sarlavhaga mos keladi */
  search?: string;
  /** Rang tavsiyasi — ixtiyoriy */
  color?: string;
}

export interface StylistPlan {
  /** Foydalanuvchiga ko'rinadigan qisqa javob (o'zbekcha, 1-2 jumla) */
  answer: string;
  /** Komplekt — har slot bitta kiyim; 2-4 ta tavsiya etiladi */
  picks: StylistPick[];
}

/** Model tanlovi: javob matni va ro'yxatdagi raqamlar (1 dan boshlanadi). */
export interface StylistChoice {
  answer: string;
  picks: number[];
}

const STYLIST_SYSTEM_PROMPT = `
You are the outfit stylist of LookSave, an Uzbek fashion marketplace.
You receive the user's request and a numbered list of products that are in
stock right now. Each line is: <number>. [<slot>] <title>.

Pick 2 to 4 products FROM THIS LIST ONLY that best fit the request. Prefer
different slots (one shoe, one bag, one cap...), best match first. Never
invent products and never recommend anything that is not in the list.

Return STRICT JSON (no prose, no markdown fences):
{ "answer": "<text>", "picks": [<number>, ...] }

Rules for "answer":
- 1-2 short sentences in Uzbek Latin; if the user wrote in Russian or English,
  answer in that language. Warm tone, no emoji.
- Name only what you actually picked (e.g. "qora krossovka va kepka").
- If nothing in the list really suits the occasion (e.g. formal clothes are
  requested but only sneakers exist), say so honestly in one short clause and
  offer the closest items.
- If the request is not about clothing or style, reply briefly and politely
  and return "picks": [].
`.trim();

/** Bitta stilist so'rovining umumiy muddati — mobil 25 s kutishidan kam. */
const TOTAL_BUDGET_MS = 20_000;
const OPENAI_TIMEOUT_MS = 10_000;
const GEMINI_TIMEOUT_MS = 8_000;
/** Shundan kam vaqt qolsa keyingi provayder sinalmaydi. */
const MIN_ATTEMPT_MS = 1_500;
/** Balans tugagan / kalit yaroqsiz OpenAI shuncha vaqt chetlab o'tiladi. */
const OPENAI_PAUSE_MS = 10 * 60_000;

/**
 * Provayder xatosi. `retryOther` — keyingi modelni sinash ma'nolimi
 * (band / vaqt tugadi). `pauseOpenAi` — OpenAI balansi tugagan yoki kalit
 * yaroqsiz: bir muddat unga umuman bormaymiz.
 */
class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryOther: boolean,
    readonly pauseOpenAi = false,
  ) {
    super(message);
  }
}

let openAiPausedUntil = 0;

/** Faqat sinovlar uchun — modul holatini (OpenAI pauzasi) tozalaydi. */
export function resetTextAiStateForTests(): void {
  openAiPausedUntil = 0;
}

/**
 * Stilist kaliti: avval `OPENAI_STYLIST_API_KEY` (faqat stilist uchun
 * ajratilgan), bo'sh bo'lsa umumiy `OPENAI_API_KEY`. Rasm chaqiruvlari
 * (`openai.ts`) bu funksiyani ISHLATMAYDI — ular doim umumiy kalitda.
 */
function stylistApiKey(): string {
  return env().OPENAI_STYLIST_API_KEY || env().OPENAI_API_KEY;
}

function geminiModels(): string[] {
  return env()
    .GEMINI_TEXT_MODELS.split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

export function isTextAiEnabled(): boolean {
  return stylistApiKey().length > 0 || env().GEMINI_STYLIST_API_KEY.length > 0;
}

function userContent(userPrompt: string, catalogLines: string[]): string {
  const list = catalogLines.map((line, i) => `${i + 1}. ${line}`).join('\n');
  return `Request: ${userPrompt}\n\nProducts:\n${list}`;
}

/**
 * Stilist: mavjud mahsulotlar ro'yxatidan komplekt tanlatadi.
 *
 * `catalogLines` — tayyor qatorlar (`"[feet] Krasovka Open Walk"`), raqamni
 * shu funksiya qo'yadi. Qaytgan `picks` — 1 dan boshlanuvchi raqamlar,
 * faqat ro'yxat chegarasidagilari qoladi.
 *
 * Provayderlar tartib bilan sinaladi (yuqoridagi «zaxira zanjiri»).
 *
 * ⚠️ HAMMASI YIQILSA XATO TASHLANADI, qoidaga o'tish chaqiruvchida.
 */
export async function chooseFromCatalog(
  userPrompt: string,
  catalogLines: string[],
): Promise<StylistChoice> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const content = userContent(userPrompt, catalogLines);
  const count = catalogLines.length;
  const remaining = (cap: number): number => Math.min(cap, deadline - Date.now());
  let lastError: Error | null = null;

  const openAiKey = stylistApiKey();
  if (openAiKey && Date.now() >= openAiPausedUntil) {
    try {
      return await chooseViaOpenAi(openAiKey, content, count, remaining(OPENAI_TIMEOUT_MS));
    } catch (err) {
      lastError = err as Error;
      if (err instanceof ProviderError && err.pauseOpenAi) {
        openAiPausedUntil = Date.now() + OPENAI_PAUSE_MS;
      }
      logger.warn({ reason: lastError.message }, 'stylist-ai: OpenAI yiqildi, Gemini sinaladi');
    }
  }

  const geminiKey = env().GEMINI_STYLIST_API_KEY;
  if (geminiKey) {
    for (const model of geminiModels()) {
      const timeout = remaining(GEMINI_TIMEOUT_MS);
      if (timeout < MIN_ATTEMPT_MS) break;
      try {
        return await chooseViaGemini(geminiKey, model, content, count, timeout);
      } catch (err) {
        lastError = err as Error;
        logger.warn({ model, reason: lastError.message }, 'stylist-ai: Gemini modeli yiqildi');
        if (!(err instanceof ProviderError) || !err.retryOther) break;
      }
    }
  }

  throw lastError ?? new Error('Stilist uchun AI kaliti sozlanmagan');
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string; code?: string };
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * OpenAI `chat/completions`.
 *
 * ⚠️ JSON MODE — `response_format: {type:"json_object"}`. Usiz model ba'zan
 * markdown kod blok ichida qaytaradi va `JSON.parse` yiqiladi.
 */
async function chooseViaOpenAi(
  key: string,
  content: string,
  count: number,
  timeoutMs: number,
): Promise<StylistChoice> {
  const model = env().OPENAI_TEXT_MODEL;
  let response: Response;
  try {
    response = await fetch(`${env().OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: STYLIST_SYSTEM_PROMPT },
          { role: 'user', content },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new ProviderError(`OpenAI bilan aloqa uzildi (${describeNetworkError(err)})`, true);
  }

  const body = (await response.json().catch(() => ({}))) as ChatResponse;

  if (!response.ok) {
    const message = body.error?.message ?? `HTTP ${response.status}`;
    // Balans tugagan, kalit yaroqsiz yoki hudud yopiq — tez orada o'zgarmaydi
    const pause =
      response.status === 401 ||
      response.status === 403 ||
      (response.status === 429 && body.error?.code === 'insufficient_quota');
    logger.error({ status: response.status, code: body.error?.code, message }, 'openai-text: so`rov yiqildi');
    throw new ProviderError(`OpenAI xatosi: ${message}`, true, pause);
  }

  if (body.usage) {
    logger.info({ provider: 'openai', usage: body.usage, model }, 'stylist-ai: narx');
  }

  const raw = body.choices?.[0]?.message?.content;
  if (!raw) throw new ProviderError('OpenAI bo`sh javob qaytardi', true);

  const parsed = parseChoice(raw, count);
  if (!parsed) throw new ProviderError('OpenAI javobi sxemaga mos emas', true);
  return parsed;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: Record<string, unknown>;
  modelVersion?: string;
  error?: { code?: number; message?: string; status?: string };
}

/** Shu holatlarda boshqa Gemini modeli yordam berishi mumkin. */
// 404 — model eskirgan/yopilgan (Google eski avlodni yangi kalitlarga yopadi)
const GEMINI_RETRY_STATUSES = new Set([404, 429, 500, 503, 504]);

/**
 * Gemini `generateContent` (Google AI Studio kaliti, `x-goog-api-key`).
 *
 * ⚠️ `responseMimeType: application/json` — OpenAI'ning JSON mode'iga teng.
 * ⚠️ `maxOutputTokens` 1024: yangi modellarda «fikrlash» tokenlari ham shu
 * chegaradan yeydi; 300 qo'yilsa javob yarim yo'lda `MAX_TOKENS` bilan
 * uziladi. Fikrlash qismlari (`thought: true`) javobga qo'shilmaydi.
 */
async function chooseViaGemini(
  key: string,
  model: string,
  content: string,
  count: number,
  timeoutMs: number,
): Promise<StylistChoice> {
  let response: Response;
  try {
    response = await fetch(`${env().GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: STYLIST_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: content }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.5,
          maxOutputTokens: 1024,
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new ProviderError(`Gemini bilan aloqa uzildi (${describeNetworkError(err)})`, true);
  }

  const body = (await response.json().catch(() => ({}))) as GeminiResponse;

  if (!response.ok) {
    const message = body.error?.message ?? `HTTP ${response.status}`;
    logger.error({ status: response.status, model, message }, 'gemini-text: so`rov yiqildi');
    throw new ProviderError(`Gemini xatosi: ${message}`, GEMINI_RETRY_STATUSES.has(response.status));
  }

  if (body.promptFeedback?.blockReason) {
    throw new ProviderError(`Gemini so'rovni to'sdi (${body.promptFeedback.blockReason})`, false);
  }

  logger.info(
    { provider: 'gemini', model, version: body.modelVersion, usage: body.usageMetadata },
    'stylist-ai: narx',
  );

  const candidate = body.candidates?.[0];
  const raw = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');
  if (!raw) throw new ProviderError(`Gemini bo'sh javob qaytardi (${candidate?.finishReason ?? '?'})`, true);

  const parsed = parseChoice(raw, count);
  if (!parsed) throw new ProviderError('Gemini javobi sxemaga mos emas', true);
  return parsed;
}

/**
 * Model javobini tekshiradi. `answer` bo'sh bo'lsa — yaroqsiz (null).
 * `picks` dan faqat 1..count oralig'idagi butun sonlar qoladi, takrorsiz,
 * ko'pi bilan 6 ta. Raqam matn ko'rinishida kelsa ham («3») qabul qilinadi.
 * Javob markdown kod blokiga o'ralgan bo'lsa (```json … ```), o'rami olinadi.
 */
export function parseChoice(raw: string, count: number): StylistChoice | null {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }

  if (!obj || typeof obj !== 'object') return null;
  const data = obj as Record<string, unknown>;

  const answer = typeof data['answer'] === 'string' ? data['answer'].trim() : '';
  if (!answer) return null;

  const picksRaw = Array.isArray(data['picks']) ? (data['picks'] as unknown[]) : [];
  const picks: number[] = [];
  for (const p of picksRaw) {
    const n = typeof p === 'number' ? p : typeof p === 'string' ? Number(p.trim()) : NaN;
    if (!Number.isInteger(n) || n < 1 || n > count) continue;
    if (picks.includes(n)) continue;
    picks.push(n);
    if (picks.length >= 6) break;
  }

  return { answer, picks };
}
