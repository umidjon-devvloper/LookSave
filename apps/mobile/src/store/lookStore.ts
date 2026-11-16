import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import {
  addItem,
  forgetTry,
  migrateOutfit,
  packTray,
  packTries,
  rememberTry,
  removeItem,
  resolveItem,
  toggleItem,
  unpackTray,
  unpackTries,
  wearOnly,
  type TrayInput,
  type TrayItem,
  type TryRecord,
} from '../ai/lookTray';

/**
 * Look savati — «Look» tugmasi bilan yig'ilgan kiyimlar.
 *
 * Bitta ro'yxat, uch joydan to'ldiriladi (bosh sahifa kartasi, mahsulot
 * sahifasi, saqlangan komplektlar) va bitta joyda ishlatiladi — primerka
 * ekranida (`components/ai/LookRoom.tsx`). Qoidalar `ai/lookTray.ts` da.
 *
 * ⚠️ `aiFlowStore.outfit` O'RNINI BOSADI. U yerda kiyimlar turkum bo'yicha
 * qatlam edi va bosh sahifa bilan mahsulot sahifasi uni HAR XIL kalit
 * bilan yozardi (`pick:<mahsulot>` va slot) — ikkalasi bir-birini
 * ko'rmasdi: kartada «Lookda» turgan kiyim o'z sahifasida «qo'shilmagan»
 * bo'lib chiqardi.
 *
 * ⚠️ `SecureStore` — sir saqlagani uchun emas, loyihada boshqa ombor
 * yo'qligi uchun (`aiFlowStore` dagi izoh). Yozuv nosozligi jimgina
 * o'tkaziladi: eng yomon holatda savat keyingi ochilishda bo'sh bo'ladi.
 */
const TRAY_KEY = 'look.tray';
const TRIES_KEY = 'look.tries';
/** Eski yozuvlar — bir marta ko'chiriladi va o'chiriladi */
const OLD_OUTFIT_KEY = 'ai.outfit';
const OLD_FILTER_KEY = 'ai.lookFilter';

async function write(key: string, value: string, empty: boolean): Promise<void> {
  try {
    if (empty) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.warn('[look] qurilmaga yozib bo`lmadi', key, err);
  }
}

/*
 * Oxirgi yozilgan matn. Serverdan aniqlash (`resolve`) har ochilishda
 * ishlaydi, lekin ko'pincha saqlanadigan maydonlarni o'zgartirmaydi —
 * bir xil matnni qayta yozmaymiz.
 */
let trayOnDisk: string | null = null;

function saveTray(items: TrayItem[]): void {
  const packed = packTray(items);
  if (packed === trayOnDisk) return;
  trayOnDisk = packed;
  void write(TRAY_KEY, packed, items.length === 0);
}

function saveTries(tries: TryRecord[]): void {
  void write(TRIES_KEY, packTries(tries), tries.length === 0);
}

interface LookState {
  items: TrayItem[];
  tries: TryRecord[];

  /** Qo'shadi va yoqadi; savatda bor bo'lsa yangilaydi */
  add: (input: TrayInput) => void;
  remove: (ref: string) => void;
  /** Yoqadi yoki o'chiradi — kiyim savatda qoladi */
  toggle: (ref: string) => void;
  /** Serverdan kelgan ma'lumot; `null` — mahsulot endi yo'q */
  resolve: (ref: string, garment: TrayInput | null) => void;
  /** Faqat shu kiyimlarni kiyadi (saqlangan komplekt) */
  wearOnly: (inputs: TrayInput[]) => void;

  remember: (record: TryRecord) => void;
  forget: (key: string) => void;

  /** Ilova ochilganda saqlangan savatni tiklaydi */
  restore: () => Promise<void>;
}

export const useLookStore = create<LookState>((set) => {
  /** Savatni o'zgartiradi va natijani qurilmaga yozadi. */
  const change = (update: (items: TrayItem[]) => TrayItem[]): void =>
    set((state) => {
      const items = update(state.items);
      saveTray(items);
      return { items };
    });

  return {
    items: [],
    tries: [],

    add: (input) => change((items) => addItem(items, input)),
    remove: (ref) => change((items) => removeItem(items, ref)),
    toggle: (ref) => change((items) => toggleItem(items, ref)),
    resolve: (ref, garment) => change((items) => resolveItem(items, ref, garment)),
    wearOnly: (inputs) => change((items) => wearOnly(items, inputs)),

    remember: (record) =>
      set((state) => {
        const tries = rememberTry(state.tries, record);
        saveTries(tries);
        return { tries };
      }),
    forget: (key) =>
      set((state) => {
        const tries = forgetTry(state.tries, key);
        saveTries(tries);
        return { tries };
      }),

    restore: async () => {
      try {
        const rawTray = await SecureStore.getItemAsync(TRAY_KEY);
        let saved = unpackTray(rawTray);
        // O'qilgan matn — allaqachon diskda; pastdagi `saveTray` uni qayta yozmasin
        if (rawTray !== null) trayOnDisk = rawTray;

        /*
         * ⚠️ ESKI YOZUV BIR MARTA KO'CHIRILADI VA O'CHIRILADI. O'chirilmasa
         * foydalanuvchi savatni bo'shatgach (yangi kalit ham o'chadi) eski
         * kiyimlar keyingi ochilishda «tirilib» qaytardi.
         */
        if (rawTray === null) {
          const rawOld = await SecureStore.getItemAsync(OLD_OUTFIT_KEY);
          if (rawOld !== null) {
            saved = migrateOutfit(rawOld);
            await SecureStore.deleteItemAsync(OLD_OUTFIT_KEY);
            await SecureStore.deleteItemAsync(OLD_FILTER_KEY);
          }
        }

        const tries = unpackTries(await SecureStore.getItemAsync(TRIES_KEY));

        /*
         * ⚠️ MAVJUD TANLOVNI BOSIB KETMAYDI. Tiklash asinxron; shu orada
         * foydalanuvchi «Look» bosib ulgurgan bo'lsa, saqlangan eski
         * ro'yxat uning yangi tanlovini almashtirib qo'ymasligi kerak.
         */
        set((state) => {
          const items = state.items.length > 0 ? state.items : saved;
          saveTray(items);
          return { items, tries: state.tries.length > 0 ? state.tries : tries };
        });
      } catch (err) {
        console.warn('[look] saqlangan savat o`qilmadi', err);
      }
    },
  };
});
