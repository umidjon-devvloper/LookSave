import type { Slot } from '@looksave/validation';

/**
 * Try-On ekranining SOF MANTIQI — GPU'siz, `three.js`siz.
 *
 * Nima uchun alohida: 3D kodning aksari qismi qurilmada sozlanadi, lekin
 * qaror qabul qilish mantig'i (qaysi LOD, qancha model xotirada qoladi,
 * qaysi slot band) oddiy funksiyalar. Ularni shu yerda test bilan
 * qotirib qo'ysak, qurilmada faqat render qismini sozlash qoladi.
 *
 * `three.js` obyektlari bu faylga kirmaydi.
 */

export type Quality = 'low' | 'medium' | 'high';

export type LodLevel = 'lod0' | 'lod1' | 'lod2';

export interface TryonItem {
  variantId: string;
  productId: string;
  title: string;
  colorHex: string | null;
  colorName: string;
  price: string;
  currency: string;
  thumbnail: string | null;
  glbUrl: string | null;
  lodUrls: Partial<Record<LodLevel, string>> | null;
  fileSizeBytes: number | null;
  hideBodyParts: string[];
  hasMorphs: boolean;
  storeId: string;
  storeName: string;
}

/**
 * Sifat → LOD. Yaqindagi model (kiyilgan) doim aniqroq bo'ladi,
 * prefetch qilinganlari bir pog'ona pastroq — ular hali ko'rinmaydi.
 */
const LOD_BY_QUALITY: Record<Quality, { equipped: LodLevel; prefetch: LodLevel }> = {
  high: { equipped: 'lod0', prefetch: 'lod1' },
  medium: { equipped: 'lod1', prefetch: 'lod2' },
  low: { equipped: 'lod2', prefetch: 'lod2' },
};

/**
 * Kerakli LOD topilmasa pastga tushamiz, u ham bo'lmasa yuqoriga.
 * Model umuman yuklanmasligidan ko'ra boshqa sifatda yuklangani yaxshi.
 */
const FALLBACK_ORDER: Record<LodLevel, LodLevel[]> = {
  lod0: ['lod0', 'lod1', 'lod2'],
  lod1: ['lod1', 'lod2', 'lod0'],
  lod2: ['lod2', 'lod1', 'lod0'],
};

export function pickModelUrl(
  item: TryonItem,
  quality: Quality,
  purpose: 'equipped' | 'prefetch' = 'equipped',
): string | null {
  const wanted = LOD_BY_QUALITY[quality][purpose];

  for (const level of FALLBACK_ORDER[wanted]) {
    const url = item.lodUrls?.[level];
    if (typeof url === 'string' && url.length > 0) return url;
  }

  // LOD'lar yo'q — asosiy GLB
  return item.glbUrl;
}

/**
 * FPS bo'yicha sifatni tuzatish (05-mobile §7.7).
 * Yangi sifat qaytadi; o'zgarish kerak bo'lmasa — o'sha qiymat.
 */
export function adjustQuality(current: Quality, fps: number): Quality {
  if (fps < 24 && current !== 'low') return 'low';
  if (fps < 40 && current === 'high') return 'medium';
  if (fps > 55 && current === 'low') return 'medium';
  return current;
}

/**
 * O'rtacha FPS — bitta sakrash sifatni tushirib yubormasligi kerak.
 * Oxirgi 60 kadr bo'yicha hisoblanadi.
 */
export class FpsMonitor {
  private readonly frames: number[] = [];
  private readonly windowSize: number;

  constructor(windowSize = 60) {
    this.windowSize = windowSize;
  }

  /** Har kadrda chaqiriladi, `delta` — soniyalarda. */
  push(delta: number): void {
    if (delta <= 0) return;
    this.frames.push(1 / delta);
    if (this.frames.length > this.windowSize) this.frames.shift();
  }

  /** Yetarli kadr yig'ilmagunча null — erta qaror qabul qilinmaydi. */
  average(): number | null {
    if (this.frames.length < this.windowSize / 2) return null;
    const sum = this.frames.reduce((total, value) => total + value, 0);
    return Math.round(sum / this.frames.length);
  }

  reset(): void {
    this.frames.length = 0;
  }
}

/** Slot holati uchun buyumdan talab qilinadigan yagona narsa. */
export interface Wearable {
  hideBodyParts: string[];
}

/**
 * Slot holati. Bir slotda bitta mahsulot — 3D avatarda ikkita
 * ko'ylakni bir vaqtda kiyib bo'lmaydi.
 *
 * Buyum tipi parametrlangan: serverdan kelgan `TryonItem` ham, ilova
 * ichiga joylashtirilgan namoyish modeli ham bir xil mantiqdan
 * foydalanadi. Standart qiymat `TryonItem` — mavjud chaqiruvlar
 * o'zgarishsiz ishlaydi.
 */
export class SlotState<T extends Wearable = TryonItem> {
  private readonly equipped = new Map<Slot, T>();

  get(slot: Slot): T | null {
    return this.equipped.get(slot) ?? null;
  }

  /** Almashtirilgan eski mahsulot qaytadi — uni tozalash kerak. */
  equip(slot: Slot, item: T): T | null {
    const previous = this.equipped.get(slot) ?? null;
    this.equipped.set(slot, item);
    return previous;
  }

  unequip(slot: Slot): T | null {
    const previous = this.equipped.get(slot) ?? null;
    this.equipped.delete(slot);
    return previous;
  }

  list(): Array<{ slot: Slot; item: T }> {
    return [...this.equipped.entries()].map(([slot, item]) => ({ slot, item }));
  }

  /**
   * Yashiriladigan tana qismlari — barcha kiyilgan kiyimlardan yig'iladi.
   * Bu qilinmasa oyoq krossovka ichidan chiqib turadi (Z-fighting).
   */
  hiddenBodyParts(): string[] {
    const parts = new Set<string>();
    for (const item of this.equipped.values()) {
      for (const part of item.hideBodyParts) parts.add(part);
    }
    return [...parts];
  }

  clear(): T[] {
    const items = [...this.equipped.values()];
    this.equipped.clear();
    return items;
  }
}

/**
 * Model keshi — xotira byudjeti bilan.
 *
 * 3D'dagi eng katta xavf: 20-30 svaypdan keyin ilova qulaydi (§7.6).
 * Bu klass qaysi modelni chiqarib tashlash kerakligini aytadi, tozalash
 * (`dispose`) chaqiruvchi tomonda — u `three.js` ga bog'liq.
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  sizeBytes: number;
}

export class ModelCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly pinned = new Set<string>();
  private readonly budgetBytes: number;

  constructor(budgetMb: number) {
    this.budgetBytes = budgetMb * 1024 * 1024;
  }

  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) return null;

    // LRU: eng oxirgi ishlatilgan oxirida turadi
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  /** Kiyilgan modellar chiqarilmaydi — ular ekranda ko'rinib turadi. */
  pin(key: string): void {
    this.pinned.add(key);
  }

  unpin(key: string): void {
    this.pinned.delete(key);
  }

  usedBytes(): number {
    let total = 0;
    for (const entry of this.entries.values()) total += entry.sizeBytes;
    return total;
  }

  size(): number {
    return this.entries.size;
  }

  /** Qo'shilgandan keyin chiqarib tashlangan yozuvlar qaytadi — ularni dispose qilish kerak. */
  set(key: string, value: T, sizeBytes: number): CacheEntry<T>[] {
    this.entries.delete(key);
    this.entries.set(key, { key, value, sizeBytes });
    return this.evict();
  }

  private evict(): CacheEntry<T>[] {
    const removed: CacheEntry<T>[] = [];

    for (const [key, entry] of this.entries) {
      if (this.usedBytes() <= this.budgetBytes) break;
      // Kiyilganini va oxirgi qo'shilganini chiqarmaymiz
      if (this.pinned.has(key)) continue;
      this.entries.delete(key);
      removed.push(entry);
    }

    return removed;
  }

  /** Xotira kam degan signal kelganda (§7.8) — kiyilmaganlarning hammasi ketadi. */
  purgeUnpinned(): CacheEntry<T>[] {
    const removed: CacheEntry<T>[] = [];
    for (const [key, entry] of this.entries) {
      if (this.pinned.has(key)) continue;
      this.entries.delete(key);
      removed.push(entry);
    }
    return removed;
  }

  clear(): CacheEntry<T>[] {
    const removed = [...this.entries.values()];
    this.entries.clear();
    this.pinned.clear();
    return removed;
  }
}

/** Sifatga qarab xotira byudjeti. Past sifatli qurilmada kam. */
export const CACHE_BUDGET_MB: Record<Quality, number> = { low: 24, medium: 48, high: 96 };

/**
 * Prefetch: joriy elementdan ±2 ta (§7.2).
 * Ro'yxat aylanma — oxiridan boshiga o'tadi, svayp uzilmaydi.
 */
export function prefetchTargets<T>(items: T[], index: number, radius = 2): T[] {
  if (items.length <= 1) return [];

  const targets: T[] = [];
  for (let offset = 1; offset <= radius; offset += 1) {
    for (const direction of [1, -1]) {
      const position = (index + direction * offset + items.length * radius) % items.length;
      const item = items[position];
      if (item !== undefined && !targets.includes(item)) targets.push(item);
    }
  }

  return targets.filter((item) => item !== items[index]);
}

/** Svayp: keyingi/oldingi indeks, aylanma. */
export function nextIndex(current: number, direction: 1 | -1, length: number): number {
  if (length === 0) return 0;
  return (current + direction + length) % length;
}
