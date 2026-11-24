import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as EnvModule from '../config/env';

/**
 * Stilist matn AI'si: javobni tekshirish va OpenAI → Gemini zaxira zanjiri.
 *
 * ⚠️ ZANJIR NIMANI QO'RIQLAYDI. OpenAI balansi tugasa (429
 * `insufficient_quota`) stilist jim qoidaga tushib qolardi — foydalanuvchi
 * AI o'rniga oddiy kalit so'z moslashni ko'rardi va buni hech kim sezmasdi.
 * Bu sinovlar o'sha paytda so'rov Gemini'ga ketishini, Gemini modeli band
 * bo'lsa keyingisi sinalishini va balans tugagan OpenAI har so'rovda qayta
 * chaqirilmasligini tekshiradi.
 */

// `vi.mock` fayl boshiga ko'tariladi — holat ham `vi.hoisted` bilan
const settings = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock('../config/env', async (original) => {
  const actual = await original<typeof EnvModule>();
  const base = actual.loadEnv();
  return { ...actual, env: () => ({ ...base, ...settings }) };
});

import { chooseFromCatalog, isTextAiEnabled, parseChoice, resetTextAiStateForTests } from './openai-text';

const LINES = ['[feet] Krasovka Open Walk', '[head] Kepka qora', '[bag] Sumka charm'];

const OPENAI_OK = {
  choices: [{ message: { content: '{"answer":"OpenAI tanladi","picks":[1,2]}' } }],
};
const OPENAI_NO_MONEY = {
  error: { message: 'You exceeded your current quota', code: 'insufficient_quota' },
};
const geminiOk = (text: string) => ({
  candidates: [{ content: { parts: [{ text, thought: false }] }, finishReason: 'STOP' }],
});

type Reply = { status: number; body: unknown };
let calls: string[] = [];

/** Har URL turi uchun javoblar navbati; tugasa oxirgisi takrorlanadi. */
function stubFetch(replies: { openai?: Reply[]; gemini?: Record<string, Reply[]> }): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      let queue: Reply[] | undefined;
      if (url.includes('/chat/completions')) queue = replies.openai;
      const model = /models\/([^:]+):generateContent/.exec(url)?.[1];
      if (model) queue = replies.gemini?.[decodeURIComponent(model)];
      if (!queue?.length) throw new Error(`kutilmagan so'rov: ${url}`);
      const reply = queue.length > 1 ? queue.shift()! : queue[0]!;
      return new Response(JSON.stringify(reply.body), { status: reply.status });
    }),
  );
}

beforeEach(() => {
  calls = [];
  resetTextAiStateForTests();
  settings.OPENAI_API_KEY = '';
  settings.OPENAI_STYLIST_API_KEY = 'sk-test';
  settings.GEMINI_STYLIST_API_KEY = 'gm-test';
  settings.GEMINI_TEXT_MODELS = 'lite-a,lite-b';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('zaxira zanjiri', () => {
  it('OpenAI ishlasa Gemini chaqirilmaydi', async () => {
    stubFetch({ openai: [{ status: 200, body: OPENAI_OK }] });
    await expect(chooseFromCatalog('to`y', LINES)).resolves.toEqual({ answer: 'OpenAI tanladi', picks: [1, 2] });
    expect(calls).toHaveLength(1);
  });

  it('OpenAI balansi tugasa so`rov Gemini`ga ketadi', async () => {
    stubFetch({
      openai: [{ status: 429, body: OPENAI_NO_MONEY }],
      gemini: { 'lite-a': [{ status: 200, body: geminiOk('{"answer":"Gemini tanladi","picks":[3]}') }] },
    });
    await expect(chooseFromCatalog('to`y', LINES)).resolves.toEqual({ answer: 'Gemini tanladi', picks: [3] });
    expect(calls.map((u) => (u.includes('chat') ? 'openai' : 'gemini'))).toEqual(['openai', 'gemini']);
  });

  it('balansi tugagan OpenAI keyingi so`rovda chetlab o`tiladi', async () => {
    stubFetch({
      openai: [{ status: 429, body: OPENAI_NO_MONEY }],
      gemini: { 'lite-a': [{ status: 200, body: geminiOk('{"answer":"G","picks":[1]}') }] },
    });
    await chooseFromCatalog('bir', LINES);
    calls = [];
    await chooseFromCatalog('ikki', LINES);
    expect(calls.every((u) => u.includes('generateContent'))).toBe(true);
  });

  it('oddiy 429 (tezlik chegarasi) OpenAI`ni pauzaga qo`ymaydi', async () => {
    stubFetch({
      openai: [
        { status: 429, body: { error: { message: 'Rate limit', code: 'rate_limit_exceeded' } } },
        { status: 200, body: OPENAI_OK },
      ],
      gemini: { 'lite-a': [{ status: 200, body: geminiOk('{"answer":"G","picks":[1]}') }] },
    });
    await chooseFromCatalog('bir', LINES);
    await expect(chooseFromCatalog('ikki', LINES)).resolves.toMatchObject({ answer: 'OpenAI tanladi' });
  });

  it('Gemini modeli band (503) bo`lsa keyingi model sinaladi', async () => {
    stubFetch({
      openai: [{ status: 500, body: { error: { message: 'server' } } }],
      gemini: {
        'lite-a': [{ status: 503, body: { error: { code: 503, message: 'high demand' } } }],
        'lite-b': [{ status: 200, body: geminiOk('```json\n{"answer":"B model","picks":[2]}\n```') }],
      },
    });
    await expect(chooseFromCatalog('to`y', LINES)).resolves.toEqual({ answer: 'B model', picks: [2] });
  });

  it('Gemini kaliti yaroqsiz (400) bo`lsa boshqa model sinalmaydi, xato yuqoriga chiqadi', async () => {
    stubFetch({
      openai: [{ status: 401, body: { error: { message: 'bad key' } } }],
      gemini: { 'lite-a': [{ status: 400, body: { error: { code: 400, message: 'API key not valid' } } }] },
    });
    await expect(chooseFromCatalog('to`y', LINES)).rejects.toThrow(/Gemini xatosi/);
    expect(calls.filter((u) => u.includes('lite-b'))).toHaveLength(0);
  });

  it('fikrlash qismlari javobga qo`shilmaydi', async () => {
    stubFetch({
      openai: [{ status: 429, body: OPENAI_NO_MONEY }],
      gemini: {
        'lite-a': [
          {
            status: 200,
            body: {
              candidates: [
                {
                  content: {
                    parts: [
                      { text: 'avval o`ylab olaman...', thought: true },
                      { text: '{"answer":"Tayyor","picks":[1]}' },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    });
    await expect(chooseFromCatalog('to`y', LINES)).resolves.toEqual({ answer: 'Tayyor', picks: [1] });
  });

  it('faqat Gemini kaliti bo`lsa ham stilist yoqiladi va OpenAI chaqirilmaydi', async () => {
    settings.OPENAI_STYLIST_API_KEY = '';
    stubFetch({ gemini: { 'lite-a': [{ status: 200, body: geminiOk('{"answer":"G","picks":[1]}') }] } });
    expect(isTextAiEnabled()).toBe(true);
    await chooseFromCatalog('to`y', LINES);
    expect(calls.some((u) => u.includes('chat/completions'))).toBe(false);
  });

  it('hech qanday kalit yo`q — stilist AI o`chiq', () => {
    settings.OPENAI_STYLIST_API_KEY = '';
    settings.GEMINI_STYLIST_API_KEY = '';
    expect(isTextAiEnabled()).toBe(false);
  });
});

describe('parseChoice', () => {
  it('to`g`ri javobni qabul qiladi', () => {
    expect(parseChoice('{"answer":"Mana","picks":[3,1]}', 5)).toEqual({ answer: 'Mana', picks: [3, 1] });
  });

  it('chegaradan tashqari, takroriy va kasr raqamlar tashlanadi', () => {
    expect(parseChoice('{"answer":"x","picks":[0,6,2,2,1.5,"4"]}', 5)?.picks).toEqual([2, 4]);
  });

  it('bo`sh javob yoki buzuq JSON — null', () => {
    expect(parseChoice('{"answer":"","picks":[1]}', 5)).toBeNull();
    expect(parseChoice('```json {}```', 5)).toBeNull();
    expect(parseChoice('Mana sizga komplekt', 5)).toBeNull();
  });

  it('markdown kod blokiga o`ralgan JSON ham o`qiladi', () => {
    expect(parseChoice('```json\n{"answer":"Ok","picks":[1]}\n```', 5)).toEqual({ answer: 'Ok', picks: [1] });
  });

  it('picks yo`q bo`lsa bo`sh massiv (mavzudan tashqari savol)', () => {
    expect(parseChoice('{"answer":"Salom"}', 5)).toEqual({ answer: 'Salom', picks: [] });
  });
});
