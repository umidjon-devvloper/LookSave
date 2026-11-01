import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { clearLayer, setLayer, type OutfitLayer } from '@looksave/validation';

/**
 * Tanlangan do'kon qurilmada saqlanadi.
 *
 * ⚠️ USIZ SEHRGAR HAR ISHGA TUSHISHDA QAYTA CHIQARDI. Kiyintirish ekrani
 * do'kon tanlanmagan bo'lsa sehrgarga yo'naltiradi (kiyimlar do'konga
 * bog'langan). Do'kon esa faqat XOTIRADA edi — ilova yopilishi bilan
 * yo'qolardi va foydalanuvchi ertasiga yana yuz skaneri, o'lchamlar va
 * do'kon qadamlaridan o'tishga majbur bo'lardi.
 *
 * ⚠️ `SecureStore` — SIR SAQLAGANI UCHUN EMAS, boshqa omborimiz
 * bo'lmagani uchun. `AsyncStorage` loyihaga qo'shilmagan (`api/client.ts`
 * dagi izoh), do'kon `id` si esa maxfiy ma'lumot emas. Yozuv nosozligi
 * jimgina o'tkazib yuboriladi: eng yomon holatda sehrgar bir marta
 * ortiqcha chiqadi, ilova esa yiqilmaydi.
 */
const STORE_KEY = 'ai.store';
const OUTFIT_KEY = 'ai.outfit';

async function persistStore(id: string | null, name: string | null): Promise<void> {
  try {
    if (id && name) await SecureStore.setItemAsync(STORE_KEY, JSON.stringify({ id, name }));
    else await SecureStore.deleteItemAsync(STORE_KEY);
  } catch (err) {
    console.warn('[ai-flow] do`konni saqlab bo`lmadi', err);
  }
}

/**
 * Yig'ilgan komplektni qurilmaga saqlash.
 *
 * ⚠️ Ilova yopilib ochilganda ham mijoz "Look" bosganini yo'qotmaydi:
 * primerka ekrani shu saqlangan ro'yxatni tiklab, kiyilgan mahsulotlarni
 * avatar ustida ko'rsatadi. Faqat `{category, variantId}` saqlanadi,
 * renderlar emas — ular serverda bepul kutib turadi.
 */
async function persistOutfit(outfit: OutfitLayer[]): Promise<void> {
  try {
    if (outfit.length > 0) {
      await SecureStore.setItemAsync(OUTFIT_KEY, JSON.stringify(outfit));
    } else {
      await SecureStore.deleteItemAsync(OUTFIT_KEY);
    }
  } catch (err) {
    console.warn('[ai-flow] komplektni saqlab bo`lmadi', err);
  }
}

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

  /**
   * Kiyilgan komplekt — turkum bo'yicha tanlangan kiyimlar.
   *
   * ⚠️ NEGA EKRANDA EMAS, DO'KONDA. Kiyintirish ekrani ikki joydan
   * ochiladi (tab va AI oqimi) va tab almashganda `FittingExperience`
   * qayta yasaladi. Komplekt ekran ichida `useState` da tursa,
   * foydalanuvchi savatga o'tib qaytganda yalang'och avatarni ko'rardi —
   * holbuki suratlar serverda tayyor turadi.
   *
   * ⚠️ FAQAT TANLOVLAR SAQLANADI, natijalar emas — ular serverdan
   * keladi (`src/ai/outfit.ts` dagi izohga qarang).
   */
  outfit: OutfitLayer[];

  setOccasion: (value: Occasion) => void;
  setStyle: (value: StyleName) => void;
  setMood: (value: Mood) => void;
  setStore: (id: string | null, name: string | null) => void;
  /** Ilova ochilganda saqlangan do'konni tiklaydi */
  restoreStore: () => Promise<void>;
  /** Qurilmada saqlangan komplektni tiklaydi (ilova ochilishida chaqiriladi). */
  restoreOutfit: () => Promise<void>;
  wear: (category: string, variantId: string) => void;
  takeOff: (category: string) => void;
  resetOutfit: () => void;
  reset: () => void;
}

const INITIAL = {
  occasion: OCCASIONS[0],
  style: STYLES[0],
  mood: MOODS[0],
  storeId: null,
  storeName: null,
  outfit: [],
} satisfies Omit<
  AiFlowState,
  | 'setOccasion'
  | 'setStyle'
  | 'setMood'
  | 'setStore'
  | 'restoreStore'
  | 'restoreOutfit'
  | 'wear'
  | 'takeOff'
  | 'resetOutfit'
  | 'reset'
>;

export const useAiFlowStore = create<AiFlowState>((set) => ({
  ...INITIAL,
  setOccasion: (occasion) => set({ occasion }),
  setStyle: (style) => set({ style }),
  setMood: (mood) => set({ mood }),

  /*
   * ⚠️ DO'KON ALMASHSA KOMPLEKT TOZALANADI. Kiyimlar do'konga bog'langan:
   * eski do'konning futbolkasi yangi do'kon ro'yxatida yo'q va uni savatga
   * qo'shib bo'lmaydi. Tozalanmasa foydalanuvchi sotib ololmaydigan
   * komplektni kiyib yurardi.
   *
   * Suratlar serverda qoladi — eski do'konga qaytilsa ular bepul keladi.
   */
  setStore: (storeId, storeName) => {
    void persistStore(storeId, storeName);
    set((state) =>
      state.storeId === storeId ? { storeName } : { storeId, storeName, outfit: [] },
    );
  },

  /*
   * ⚠️ MAVJUD TANLOVNI BOSIB KETMAYDI. Tiklash ilova ochilganda ishlaydi,
   * lekin foydalanuvchi shu orada do'kon tanlab ulgurishi mumkin (masalan
   * deep link bilan to'g'ridan-to'g'ri kiyintirishga kirdi). Bunday holda
   * saqlangan eski qiymat yangisini almashtirib qo'ymasligi kerak.
   */
  restoreStore: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw) as { id?: unknown; name?: unknown };
      if (typeof saved.id !== 'string' || typeof saved.name !== 'string') return;

      set((state) =>
        state.storeId ? {} : { storeId: saved.id as string, storeName: saved.name as string },
      );
    } catch (err) {
      console.warn('[ai-flow] saqlangan do`kon o`qilmadi', err);
    }
  },

  /*
   * ⚠️ WEAR/TAKEOFF/RESETOUTFIT HAR DOIM QURILMAGA YOZADI (fire-and-forget).
   * Shu bois mijoz Lookga qo'shib ilovani yopsa, keyingi ochishda primerka
   * aynan o'sha komplekt bilan ochiladi — tanlov esdan chiqmaydi.
   */
  wear: (category, variantId) =>
    set((state) => {
      const next = setLayer(state.outfit, category, variantId);
      void persistOutfit(next);
      return { outfit: next };
    }),
  takeOff: (category) =>
    set((state) => {
      const next = clearLayer(state.outfit, category);
      void persistOutfit(next);
      return { outfit: next };
    }),
  resetOutfit: () => {
    void persistOutfit([]);
    set({ outfit: [] });
  },

  restoreOutfit: async () => {
    try {
      const raw = await SecureStore.getItemAsync(OUTFIT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      // Zararli yozuvdan himoyalanish — faqat to'g'ri shaklli yozuvlar
      const outfit: OutfitLayer[] = [];
      for (const item of parsed) {
        if (
          item && typeof item === 'object' &&
          typeof (item as OutfitLayer).category === 'string' &&
          typeof (item as OutfitLayer).variantId === 'string'
        ) {
          outfit.push({
            category: (item as OutfitLayer).category,
            variantId: (item as OutfitLayer).variantId,
          });
        }
      }
      set((state) => (state.outfit.length ? {} : { outfit }));
    } catch (err) {
      console.warn('[ai-flow] saqlangan komplektni o`qib bo`lmadi', err);
    }
  },

  /* ⚠️ To'liq tozalash saqlangan do'konni ham, komplektni ham o'chiradi — chiqishda chaqiriladi */
  reset: () => {
    void persistStore(null, null);
    void persistOutfit([]);
    set(INITIAL);
  },
}));
