import type { Mood, Occasion, StyleName } from '../store/aiFlowStore';
import type { Dictionary } from './dictionaries';

export type AiOption = Occasion | StyleName | Mood;

/*
 * Tanlov qiymatlari (`aiFlowStore`) o'zbekcha satrlar va serverga shu
 * ko'rinishda ketadi — ularni o'zgartirib bo'lmaydi. Ekranda esa qurilma
 * tilidagi yozuv ko'rsatiladi: inglizcha telefonda «Kundalik» emas, «Everyday».
 *
 * ⚠️ BITTA JOYDA. Bu xarita ilgari faqat `/ai` ekranining ichida edi;
 * `/ai/look` esa xom qiymatni chiqarardi va inglizcha qurilmada sarlavha
 * ostida «Kundalik · Smart Casual» turardi.
 */
const AI_OPTION_KEY = {
  Kundalik: 'optEveryday',
  Ish: 'optWork',
  Uchrashuv: 'optDate',
  Bayram: 'optParty',
  Sport: 'optSport',
  'Smart Casual': 'optSmartCasual',
  Klassik: 'optClassic',
  Streetwear: 'optStreetwear',
  Minimal: 'optMinimal',
  Ishonchli: 'optConfident',
  Xotirjam: 'optCalm',
  Jasur: 'optBold',
  Erkin: 'optFree',
} as const satisfies Record<AiOption, keyof Dictionary['ai']>;

/** Tanlov qiymatining ekranda ko'rinadigan, qurilma tilidagi nomi. */
export function aiOptionLabel(t: Dictionary, option: AiOption): string {
  return t.ai[AI_OPTION_KEY[option]];
}
