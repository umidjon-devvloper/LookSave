import { describe, expect, it } from 'vitest';

import { GRACE_DAYS, scheduledDate } from './deletion';

/**
 * Bazaga tegmaydigan qism. Qolgani (`countOpenOrders`, `requestDeletion`,
 * `anonymizeDueAccounts`) integratsion testda — u yerda haqiqiy Postgres bor.
 */

describe('scheduledDate', () => {
  it('30 kun qo`shadi', () => {
    const requested = new Date('2026-08-14T10:00:00.000Z');
    expect(scheduledDate(requested).toISOString()).toBe('2026-09-13T10:00:00.000Z');
  });

  it('oy va yil chegarasidan to`g`ri o`tadi', () => {
    const requested = new Date('2026-12-20T00:00:00.000Z');
    expect(scheduledDate(requested).toISOString().slice(0, 10)).toBe('2027-01-19');
  });

  it('kabisa yilining fevralida ham to`g`ri', () => {
    const requested = new Date('2028-02-01T00:00:00.000Z');
    // 2028 kabisa: fevral 29 kun
    expect(scheduledDate(requested).toISOString().slice(0, 10)).toBe('2028-03-02');
  });

  it('asl sanani o`zgartirmaydi', () => {
    const requested = new Date('2026-08-14T10:00:00.000Z');
    scheduledDate(requested);
    expect(requested.toISOString()).toBe('2026-08-14T10:00:00.000Z');
  });

  it('muddat sozlanadi', () => {
    const requested = new Date('2026-08-14T00:00:00.000Z');
    expect(scheduledDate(requested, 7).toISOString().slice(0, 10)).toBe('2026-08-21');
  });

  it('standart muddat hujjatdagi 30 kun', () => {
    // 03-api-spec §5 — bu raqam o'zgarsa maxfiylik siyosati ham o'zgaradi
    expect(GRACE_DAYS).toBe(30);
  });
});
