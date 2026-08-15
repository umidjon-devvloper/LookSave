import type { CountryCode } from '@looksave/shared-types';

/**
 * `isOpen` va `closesAt` SERVERDA hisoblanadi (03-api-spec §8).
 * Ilova o'zi hisoblamasin: Dubay (UTC+4) va Toshkent (UTC+5) farq qiladi,
 * foydalanuvchi esa uchinchi vaqt zonasida bo'lishi mumkin.
 */
const TIMEZONES: Record<CountryCode, string> = {
  UZ: 'Asia/Tashkent',
  AE: 'Asia/Dubai',
};

export interface WorkingHour {
  /** 1 = dushanba … 7 = yakshanba */
  day: number;
  open: string;
  close: string;
  closed?: boolean;
}

export interface OpenState {
  isOpen: boolean;
  closesAt: string | null;
  opensAt: string | null;
}

/** `"22:00"` → 1320 daqiqa. `"00:00"` yopilish vaqti sifatida sutka oxiri (1440). */
function toMinutes(value: string, asClosing = false): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const total = hours * 60 + minutes;
  return asClosing && total === 0 ? 24 * 60 : total;
}

/** Do'kon vaqt zonasidagi hozirgi kun (1-7) va daqiqa. */
function localNow(timeZone: string, now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';

  const weekdays: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  const day = weekdays[get('weekday')] ?? 1;
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));

  return { day, minutes: hour * 60 + minute };
}

function parseHours(raw: unknown): WorkingHour[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter((entry): entry is WorkingHour => {
    if (typeof entry !== 'object' || entry === null) return false;
    const value = entry as Partial<WorkingHour>;
    return typeof value.day === 'number' && typeof value.open === 'string';
  });
}

/**
 * Yarim tundan o'tuvchi ish vaqti ham hisobga olinadi:
 * `{ open: "10:00", close: "02:00" }` — soat 01:00 da do'kon OCHIQ.
 */
export function computeOpenState(
  workingHours: unknown,
  country: CountryCode | null,
  now: Date = new Date(),
): OpenState {
  const hours = parseHours(workingHours);
  if (hours.length === 0) {
    return { isOpen: false, closesAt: null, opensAt: null };
  }

  const timeZone = TIMEZONES[country ?? 'UZ'] ?? TIMEZONES.UZ;
  const { day, minutes } = localNow(timeZone, now);

  const forDay = (target: number): WorkingHour | undefined =>
    hours.find((entry) => entry.day === target && entry.closed !== true);

  // 1) Bugungi oyna
  const today = forDay(day);
  if (today) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close, true);

    if (open !== null && close !== null) {
      if (close > open) {
        if (minutes >= open && minutes < close) {
          return { isOpen: true, closesAt: today.close, opensAt: null };
        }
        if (minutes < open) {
          return { isOpen: false, closesAt: null, opensAt: today.open };
        }
      } else if (minutes >= open) {
        // Yarim tundan o'tadi — ertaga yopiladi
        return { isOpen: true, closesAt: today.close, opensAt: null };
      }
    }
  }

  // 2) Kechagi oyna hali tugamagan bo'lishi mumkin (masalan 10:00–02:00)
  const yesterday = forDay(day === 1 ? 7 : day - 1);
  if (yesterday) {
    const open = toMinutes(yesterday.open);
    const close = toMinutes(yesterday.close, true);
    if (open !== null && close !== null && close <= open && minutes < close) {
      return { isOpen: true, closesAt: yesterday.close, opensAt: null };
    }
  }

  // 3) Yopiq — keyingi ochilish vaqtini topamiz
  for (let offset = 0; offset < 7; offset += 1) {
    const target = ((day - 1 + offset) % 7) + 1;
    const entry = forDay(target);
    if (!entry) continue;
    const open = toMinutes(entry.open);
    if (open === null) continue;
    if (offset > 0 || minutes < open) {
      return { isOpen: false, closesAt: null, opensAt: entry.open };
    }
  }

  return { isOpen: false, closesAt: null, opensAt: null };
}
