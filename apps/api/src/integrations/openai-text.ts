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
 * ⚠️ BU MODUL HAM PUL SARFLAYDI. `gpt-4o-mini` ~$0.15/1M input, $0.60/1M
 * output — bir stilist chaqiruvi odatda $0.001 dan kam. Kunlik chegara
 * hozircha yo'q (chaqiruv rasm try-on'dan ancha arzon), lekin suiiste'mol
 * belgisi ko'ringanda `TRYON_DAILY_LIMIT` singari chegara qo'yiladi.
 *
 * ⚠️ JAVOB JSON `ZOD` BILAN TEKSHIRILADI. Model vaqti-vaqti bilan
 * ko'rsatilgan sxemadan chetga chiqadi (ekstra matn, bo'sh maydon). Xato
 * tashlanadi va chaqiruvchi fallback'ga tushadi — foydalanuvchi bo'sh
 * oyna ko'rmaydi.
 */

export interface StylistPick {
  /** Mahsulot slot'i — `products.slot` qiymatlariga mos */
  slot: 'top' | 'bottom' | 'outer' | 'feet' | 'bag' | 'head' | 'neck';
  /** Qidiruv kaliti — DB tags/title ga mos keladi */
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

const STYLIST_SYSTEM_PROMPT = `
You are an outfit stylist for LookSave, an Uzbek fashion marketplace.
The user writes in Uzbek (Latin), sometimes Russian or English.
Your job: understand the occasion and recommend a COMPLETE outfit — 2 to 4 items
drawn from these slots:
  - top       (shirt / blouse / t-shirt / sweater)
  - bottom    (trousers / jeans / skirt)
  - outer     (jacket / coat / cardigan)
  - feet      (shoes / sneakers / boots)
  - bag       (bag / purse)
  - head      (hat / cap)
  - neck      (scarf / tie)

Return STRICT JSON (no prose, no markdown fences) with this shape:
{
  "answer": "<1-2 sentence Uzbek-Latin reply, warm tone, no emoji>",
  "picks": [
    { "slot": "top",    "search": "<keyword in Uzbek or Russian>", "color": "<optional>" },
    { "slot": "bottom", "search": "<keyword>" },
    ...
  ]
}

Rules:
- Always include at least one top and one bottom (or a dress → use slot "top").
- Pick slots that fit the occasion (adding "feet" for most, "outer" for cold/formal).
- "search" is one or two Uzbek/Russian words likely to appear in a product title
  (e.g. "ko'ylak", "shim", "kurtka", "tufli", "krasovka", "jinsa", "kostyum",
  "платье", "блузка"). NEVER brand names.
- "answer" greets the user, names the occasion, and promises items below.
- If the user asks something off-topic, still return the shape with a short
  polite answer and an empty picks array.
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
 * Stilist uchun GPT chaqiruvi.
 *
 * ⚠️ XATOLAR YUQORIGA TASHLANADI, fallback chaqiruvchida.
 *
 * ⚠️ JSON MODE — `response_format: {type:"json_object"}`. Usiz model ba'zan
 * markdown kodo blok ichida qaytaradi va `JSON.parse` yiqiladi.
 */
export async function generateStylistPlan(userPrompt: string): Promise<StylistPlan> {
  const key = stylistApiKey();
  if (!key) throw new Error('OpenAI kaliti sozlanmagan');

  const messages: ChatMessage[] = [
    { role: 'system', content: STYLIST_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
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
        temperature: 0.4,
        max_tokens: 400,
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

  const parsed = parsePlan(content);
  if (!parsed) throw new Error('OpenAI javobi sxemaga mos emas');

  return parsed;
}

const VALID_SLOTS = new Set<StylistPick['slot']>([
  'top',
  'bottom',
  'outer',
  'feet',
  'bag',
  'head',
  'neck',
]);

function parsePlan(raw: string): StylistPlan | null {
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
  const picks: StylistPick[] = [];
  for (const p of picksRaw) {
    if (!p || typeof p !== 'object') continue;
    const item = p as Record<string, unknown>;
    const slot = item['slot'];
    if (typeof slot !== 'string' || !VALID_SLOTS.has(slot as StylistPick['slot'])) continue;

    picks.push({
      slot: slot as StylistPick['slot'],
      search: typeof item['search'] === 'string' ? item['search'].trim() : undefined,
      color: typeof item['color'] === 'string' ? item['color'].trim() : undefined,
    });

    if (picks.length >= 6) break;
  }

  return { answer, picks };
}
