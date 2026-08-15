import { create } from 'zustand';

/**
 * AI Designer oqimining holati.
 *
 * NEGA DO'KON: oqim bir necha ekranga yoyilgan (kirish → avatar yasash →
 * kiyintirish), lekin bitta suhbat. Navigatsiya parametrlari orqali
 * uzatilsa har qadamda serializatsiya qilinadi va orqaga qaytganda
 * yo'qoladi. Bu yerda esa u sessiya davomida turadi.
 *
 * ⚠️ Bu ma'lumot serverga YUBORILMAYDI (uslub/kayfiyat uchun endpoint yo'q).
 * Hozircha u faqat mahsulot tanlashni filtrlash uchun ishlatiladi. AI
 * tavsiyasi serverda paydo bo'lgach shu joydan jo'natiladi.
 */

export const OCCASIONS = ['Kundalik', 'Ish', 'Uchrashuv', 'Bayram', 'Sport'] as const;
export const STYLES = ['Smart Casual', 'Klassik', 'Streetwear', 'Sport', 'Minimal'] as const;
export const MOODS = ['Ishonchli', 'Xotirjam', 'Jasur', 'Erkin'] as const;

export type Occasion = (typeof OCCASIONS)[number];
export type StyleName = (typeof STYLES)[number];
export type Mood = (typeof MOODS)[number];

interface AiFlowState {
  occasion: Occasion;
  style: StyleName;
  mood: Mood;
  /** Qaysi do'kondan buyurtma qilinadi — kiyimlar shu do'kondan tanlanadi */
  storeId: string | null;
  storeName: string | null;

  setOccasion: (value: Occasion) => void;
  setStyle: (value: StyleName) => void;
  setMood: (value: Mood) => void;
  setStore: (id: string | null, name: string | null) => void;
  reset: () => void;
}

const INITIAL = {
  occasion: OCCASIONS[0],
  style: STYLES[0],
  mood: MOODS[0],
  storeId: null,
  storeName: null,
} satisfies Omit<AiFlowState, 'setOccasion' | 'setStyle' | 'setMood' | 'setStore' | 'reset'>;

export const useAiFlowStore = create<AiFlowState>((set) => ({
  ...INITIAL,
  setOccasion: (occasion) => set({ occasion }),
  setStyle: (style) => set({ style }),
  setMood: (mood) => set({ mood }),
  setStore: (storeId, storeName) => set({ storeId, storeName }),
  reset: () => set(INITIAL),
}));
