import { env } from '../config/env';
import { logger } from '../logger';

import { describeNetworkError } from './openai';

/**
 * OpenAI matn modeli — AI stilist uchun.
 *
 * Rasm chaqiruvi (`openai.ts`) bilan bir xil provayder, lekin BOSHQA oqim:
 * matn modeli `chat/completions` ga boradi va `response_format=json_object`
 * bilan tushunarli JSON qaytaradi. Rasm bilan aralashtirmaslik uchun
 * alohida modul.
 *
 * ⚠️ MODEL FAQAT BERILGAN RO'YXATDAN TANLAYDI (2026-11-24). Ilgari model
 * qidiruv so'zi («ko'ylak», «shim») qaytarardi, DB'da esa bunday mahsulot
 * yo'q edi — javob «taklif qilaman» derdi-yu, bitta ham mahsulot chiqmasdi.
 * Endi chaqiruvchi (`catalog/stylist.ts`) mavjud mahsulotlarni raqamlangan
 * ro'yxat qilib beradi, model esa raqam qaytaradi. Uydirma mahsulot bo'lmaydi.
 *
 * ⚠️ BU MODUL HAM PUL SARFLAYDI. `gpt-4o-mini` ~$0.15/1M input, $0.60/1M
 * output — 150 qatorlik ro'yxat bilan ham bir chaqiruv ~$0.0005.
 *
 * ⚠️ JAVOB QO'LDA TEKSHIRILADI. Model vaqti-vaqti bilan sxemadan chetga
 * chiqadi (ro'yxatda yo'q raqam, bo'sh maydon). Yaroqsiz raqamlar tashlanadi;
 * javob umuman yaroqsiz bo'lsa xato tashlanadi va chaqiruvchi fallback'ga
 * tushadi — foydalanuvchi bo'sh oyna ko'rmaydi.
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

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const CHAT_TIMEOUT_MS = 30_000;

/**
 * Stilist kaliti: avval `OPENAI_STYLIST_API_KEY` (faqat stilist uchun
 * ajratilgan), bo'sh bo'lsa umumiy `OPENAI_API_KEY`. Rasm chaqiruvlari
 * (`openai.ts`) bu funksiyani ISHLATMAYDI — ular doim umumiy kalitda.
 */
function stylistApiKey(): string {
  return env().OPENAI_STYLIST_API_KEY || env().OPENAI_API_KEY;
}

export function isTextAiEnabled(): boolean {
  return stylistApiKey().length > 0;
}

/**
 * Stilist: mavjud mahsulotlar ro'yxatidan komplekt tanlatadi.
 *
 * `catalogLines` — tayyor qatorlar (`"[feet] Krasovka Open Walk"`), raqamni
 * shu funksiya qo'yadi. Qaytgan `picks` — 1 dan boshlanuvchi raqamlar,
 * faqat ro'yxat chegarasidagilari qoladi.
 *
 * ⚠️ XATOLAR YUQORIGA TASHLANADI, fallback chaqiruvchida.
 *
 * ⚠️ JSON MODE — `response_format: {type:"json_object"}`. Usiz model ba'zan
 * markdown kod blok ichida qaytaradi va `JSON.parse` yiqiladi.
 */
export async function chooseFromCatalog(
  userPrompt: string,
  catalogLines: string[],
): Promise<StylistChoice> {
  const key = stylistApiKey();
  if (!key) throw new Error('OpenAI kaliti sozlanmagan');

  const list = catalogLines.map((line, i) => `${i + 1}. ${line}`).join('\n');
  const messages: ChatMessage[] = [
    { role: 'system', content: STYLIST_SYSTEM_PROMPT },
    { role: 'user', content: `Request: ${userPrompt}\n\nProducts:\n${list}` },
  ];

  let response: Response;
  try {
    response = await fetch(`${env().OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env().OPENAI_TEXT_MODEL,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = describeNetworkError(err);
    logger.error({ err, reason }, 'openai-text: aloqa uzildi');
    throw new Error(`OpenAI bilan aloqa uzildi (${reason})`);
  }

  const body = (await response.json().catch(() => ({}))) as ChatResponse;

  if (!response.ok) {
    const message = body.error?.message ?? `HTTP ${response.status}`;
    logger.error({ status: response.status, message }, 'openai-text: so`rov yiqildi');
    throw new Error(`OpenAI xatosi: ${message}`);
  }

  if (body.usage) {
    logger.info({ usage: body.usage, model: env().OPENAI_TEXT_MODEL }, 'openai-text: narx');
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI bo`sh javob qaytardi');

  const parsed = parseChoice(content, catalogLines.length);
  if (!parsed) throw new Error('OpenAI javobi sxemaga mos emas');

  return parsed;
}

/**
 * Model javobini tekshiradi. `answer` bo'sh bo'lsa — yaroqsiz (null).
 * `picks` dan faqat 1..count oralig'idagi butun sonlar qoladi, takrorsiz,
 * ko'pi bilan 6 ta. Raqam matn ko'rinishida kelsa ham («3») qabul qilinadi.
 */
export function parseChoice(raw: string, count: number): StylistChoice | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
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
