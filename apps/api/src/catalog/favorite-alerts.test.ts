import { describe, expect, it } from 'vitest';

import {
  buildAlertMessage,
  decideAlerts,
  formatPrice,
  isSendingHour,
  type FavoriteStateRow,
} from './favorite-alerts';

/**
 * «Narx tushsa xabar» qarori.
 *
 * ⚠️ NIMANI QO'RIQLAYDI. Bu push foydalanuvchiga to'g'ridan-to'g'ri boradi:
 * xato qaror = spam (har tekshiruvda bir xil xabar, 1% arzonlashishga xabar,
 * tunda xabar) yoki jim yo'qolgan xabar. Ikkalasi ham ko'zga tashlanmaydi —
 * hech qanday xato logga tushmaydi.
 */

const NOW = new Date('2026-11-24T08:00:00Z');

function row(over: Partial<FavoriteStateRow> = {}): FavoriteStateRow {
  return {
    user_id: 'u1',
    product_id: 'p1',
    title: 'Krossovka oq',
    base_price: '450000.00',
    currency: 'UZS',
    in_stock: true,
    seen_price: '500000.00',
    seen_in_stock: true,
    alerted_at: null,
    locale: 'uz',
    ...over,
  };
}

describe('decideAlerts', () => {
  it('10% arzonlashdi — xabar, yangi narx eslab qolinadi', () => {
    const { alerts, updates } = decideAlerts([row()], NOW);
    expect(alerts.get('u1')?.events).toEqual([
      { productId: 'p1', title: 'Krossovka oq', kind: 'drop', price: 450000, oldPrice: 500000, currency: 'UZS' },
    ]);
    expect(updates).toEqual([
      { userId: 'u1', productId: 'p1', seenPrice: 450000, seenInStock: true, alerted: true },
    ]);
  });

  it('5% dan kam arzonlashish — xabar yo`q, eski narx saqlanadi (keyingi pasayish yig`iladi)', () => {
    const { alerts, updates } = decideAlerts([row({ base_price: '490000.00' })], NOW);
    expect(alerts.size).toBe(0);
    expect(updates).toEqual([]);
  });

  it('narx oshdi — xabar yo`q va saqlangan narx ko`tarilmaydi', () => {
    const { alerts, updates } = decideAlerts([row({ base_price: '600000.00' })], NOW);
    expect(alerts.size).toBe(0);
    expect(updates).toEqual([]);
  });

  it('sotuvda yo`q mahsulot arzonlashsa xabar bormaydi', () => {
    const { alerts } = decideAlerts([row({ in_stock: false, seen_in_stock: false })], NOW);
    expect(alerts.size).toBe(0);
  });

  it('yana sotuvga chiqdi — «restock» xabari', () => {
    const { alerts, updates } = decideAlerts(
      [row({ base_price: '500000.00', seen_in_stock: false, in_stock: true })],
      NOW,
    );
    expect(alerts.get('u1')?.events[0]?.kind).toBe('restock');
    expect(updates[0]).toMatchObject({ seenInStock: true, alerted: true });
  });

  it('tugadi — xabar yo`q, lekin holat yoziladi (keyin qaytsa xabar boradi)', () => {
    const { alerts, updates } = decideAlerts([row({ base_price: '500000.00', in_stock: false })], NOW);
    expect(alerts.size).toBe(0);
    expect(updates).toEqual([
      { userId: 'u1', productId: 'p1', seenPrice: 500000, seenInStock: false, alerted: false },
    ]);
  });

  it('24 soat ichida xabar ketgan — kutiladi va holat o`zgarmaydi (hodisa yo`qolmaydi)', () => {
    const recent = new Date(NOW.getTime() - 3 * 60 * 60_000);
    const drop = decideAlerts([row({ alerted_at: recent })], NOW);
    expect(drop.alerts.size).toBe(0);
    expect(drop.updates).toEqual([]);

    const restock = decideAlerts(
      [row({ base_price: '500000.00', seen_in_stock: false, alerted_at: recent })],
      NOW,
    );
    expect(restock.alerts.size).toBe(0);
    expect(restock.updates).toEqual([]);
  });

  it('24 soatdan keyin yana xabar mumkin', () => {
    const old = new Date(NOW.getTime() - 25 * 60 * 60_000);
    expect(decideAlerts([row({ alerted_at: old })], NOW).alerts.size).toBe(1);
  });

  it('eski qator (seen_price yo`q) — faqat boshlang`ich holat, xabar yo`q', () => {
    const { alerts, updates } = decideAlerts([row({ seen_price: null, seen_in_stock: null })], NOW);
    expect(alerts.size).toBe(0);
    expect(updates).toEqual([
      { userId: 'u1', productId: 'p1', seenPrice: 450000, seenInStock: true, alerted: false },
    ]);
  });

  it('bitta foydalanuvchining hodisalari bitta guruhga yig`iladi', () => {
    const { alerts } = decideAlerts(
      [row(), row({ product_id: 'p2', title: 'Sumka' }), row({ user_id: 'u2', locale: 'en' })],
      NOW,
    );
    expect(alerts.get('u1')?.events).toHaveLength(2);
    expect(alerts.get('u2')?.locale).toBe('en');
  });
});

describe('buildAlertMessage', () => {
  it('bitta arzonlashish — mahsulot sahifasi ochiladi', () => {
    const { alerts } = decideAlerts([row()], NOW);
    const message = buildAlertMessage('uz', alerts.get('u1')!.events);
    expect(message).toEqual({
      title: 'Narx tushdi',
      body: "Krossovka oq — endi 450 000 so'm (avval 500 000 so'm)",
      data: { type: 'favorite_alert', productId: 'p1' },
    });
  });

  it('bir nechta hodisa — bitta umumiy xabar, sevimlilar ochiladi', () => {
    const { alerts } = decideAlerts([row(), row({ product_id: 'p2' })], NOW);
    const message = buildAlertMessage('ru', alerts.get('u1')!.events);
    expect(message.title).toBe('Новое в избранном');
    expect(message.data).toEqual({ type: 'favorite_alert' });
  });

  it('uzun nom qisqartiriladi', () => {
    const { alerts } = decideAlerts([row({ title: 'A'.repeat(100) })], NOW);
    const body = buildAlertMessage('en', alerts.get('u1')!.events).body;
    expect(body.startsWith(`${'A'.repeat(57)}…`)).toBe(true);
  });
});

describe('formatPrice va soat', () => {
  it('so`m tilga qarab yoziladi, boshqa valyuta kodi bilan', () => {
    expect(formatPrice(1200000, 'UZS', 'uz')).toBe("1 200 000 so'm");
    expect(formatPrice(1200000, 'UZS', 'ru')).toBe('1 200 000 сум');
    expect(formatPrice(250, 'AED', 'en')).toBe('250 AED');
  });

  it('tunda (Toshkent 21:00–09:00) yuborilmaydi', () => {
    expect(isSendingHour(new Date('2026-11-24T03:59:00Z'))).toBe(false); // 08:59
    expect(isSendingHour(new Date('2026-11-24T04:00:00Z'))).toBe(true); // 09:00
    expect(isSendingHour(new Date('2026-11-24T16:59:00Z'))).toBe(true); // 21:59
    expect(isSendingHour(new Date('2026-11-24T17:00:00Z'))).toBe(false); // 22:00
  });
});
