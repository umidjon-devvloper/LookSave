import { describe, expect, it } from 'vitest';

import { decodeCursor, encodeCursor, paginate } from './cursor';
import { computeOpenState } from './hours';

/** Toshkent UTC+5, Dubay UTC+4. Sana UTC'da beriladi. */
const at = (iso: string): Date => new Date(iso);

const WEEKDAYS = [
  { day: 1, open: '09:00', close: '21:00' },
  { day: 2, open: '09:00', close: '21:00' },
  { day: 3, open: '09:00', close: '21:00' },
  { day: 4, open: '09:00', close: '21:00' },
  { day: 5, open: '09:00', close: '21:00' },
  { day: 6, open: '10:00', close: '18:00' },
  { day: 7, open: '10:00', close: '18:00', closed: true },
];

describe('computeOpenState', () => {
  it('ish vaqtida ochiq deb ko`rsatadi', () => {
    // 2026-08-12 chorshanba, UTC 10:00 → Toshkentda 15:00
    const state = computeOpenState(WEEKDAYS, 'UZ', at('2026-08-12T10:00:00Z'));
    expect(state.isOpen).toBe(true);
    expect(state.closesAt).toBe('21:00');
  });

  it('yopilgandan keyin yopiq, keyingi ochilish vaqtini beradi', () => {
    // UTC 18:00 → Toshkentda 23:00
    const state = computeOpenState(WEEKDAYS, 'UZ', at('2026-08-12T18:00:00Z'));
    expect(state.isOpen).toBe(false);
    expect(state.opensAt).toBe('09:00');
  });

  it('ochilishdan oldin yopiq', () => {
    // UTC 02:00 → Toshkentda 07:00
    const state = computeOpenState(WEEKDAYS, 'UZ', at('2026-08-12T02:00:00Z'));
    expect(state.isOpen).toBe(false);
    expect(state.opensAt).toBe('09:00');
  });

  it('`closed: true` bo`lgan kunni hisobga oladi', () => {
    // 2026-08-16 yakshanba, Toshkentda 15:00
    const state = computeOpenState(WEEKDAYS, 'UZ', at('2026-08-16T10:00:00Z'));
    expect(state.isOpen).toBe(false);
    // Keyingi ochiq kun — dushanba
    expect(state.opensAt).toBe('09:00');
  });

  it('yarim tundan o`tuvchi jadval: 01:00 da OCHIQ', () => {
    const night = [{ day: 1, open: '14:00', close: '02:00' }];
    // 2026-08-11 (dushanba) Toshkentda 23:00 → UTC 18:00
    expect(computeOpenState(night, 'UZ', at('2026-08-10T18:00:00Z')).isOpen).toBe(true);
    // Seshanba 01:00 Toshkentda → UTC dushanba 20:00. Kechagi oyna hali yopilmagan.
    const early = computeOpenState(night, 'UZ', at('2026-08-10T20:00:00Z'));
    expect(early.isOpen).toBe(true);
    expect(early.closesAt).toBe('02:00');
  });

  it('`close: "00:00"` sutka oxiri deb qabul qilinadi', () => {
    const hours = [{ day: 3, open: '10:00', close: '00:00' }];
    // Chorshanba Toshkentda 23:30 → UTC 18:30
    expect(computeOpenState(hours, 'UZ', at('2026-08-12T18:30:00Z')).isOpen).toBe(true);
  });

  it('Dubay va Toshkent bir xil UTC vaqtda turlicha hisoblanadi', () => {
    const hours = [
      { day: 3, open: '09:00', close: '21:00' },
      { day: 4, open: '09:00', close: '21:00' },
    ];
    // UTC 17:30 → Dubayda 21:30 (yopiq), Toshkentda 22:30 (yopiq)
    // UTC 16:30 → Dubayda 20:30 (OCHIQ), Toshkentda 21:30 (yopiq)
    const utc = at('2026-08-12T16:30:00Z');
    expect(computeOpenState(hours, 'AE', utc).isOpen).toBe(true);
    expect(computeOpenState(hours, 'UZ', utc).isOpen).toBe(false);
  });

  it('ish vaqti bo`sh yoki buzuq bo`lsa yiqilmaydi', () => {
    expect(computeOpenState([], 'UZ').isOpen).toBe(false);
    expect(computeOpenState(null, 'UZ').isOpen).toBe(false);
    expect(computeOpenState('buzuq', 'UZ').isOpen).toBe(false);
    expect(computeOpenState([{ day: 1, open: '25:99', close: 'x' }], 'UZ').isOpen).toBe(false);
  });
});

describe('cursor', () => {
  it('kodlangan qiymat qaytib o`qiladi', () => {
    const value = { k: '2026-08-12 18:49:12.919136+00', id: 'abc-123' };
    expect(decodeCursor(encodeCursor(value))).toEqual(value);
  });

  it('mikrosekundlar saqlanadi', () => {
    // Bu aynan sinovdan o'tgan xato: `Date.toISOString()` mikrosekundni
    // yo'qotadi va keyingi sahifa bo'sh qaytadi.
    const key = '2026-08-12 18:49:12.919136+00';
    expect(decodeCursor(encodeCursor({ k: key, id: 'x' })).k).toBe(key);
  });

  it('buzuq cursor 400 beradi', () => {
    expect(() => decodeCursor('!!!buzuq!!!')).toThrow();
    expect(() => decodeCursor(Buffer.from('{"k":1}').toString('base64url'))).toThrow();
  });

  it('paginate: ortiqcha qator bo`lsa hasMore', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const page = paginate(rows, 2, (row) => ({ k: row.id, id: row.id }));

    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeCursor(page.nextCursor ?? '').id).toBe('b');
  });

  it('paginate: oxirgi sahifada cursor null', () => {
    const page = paginate([{ id: 'a' }], 2, (row) => ({ k: row.id, id: row.id }));
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('paginate: bo`sh ro`yxat', () => {
    const page = paginate<{ id: string }>([], 20, (row) => ({ k: row.id, id: row.id }));
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});
