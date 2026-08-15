import type { Response } from 'express';
import { describe, expect, it } from 'vitest';

import { escapeHtml, formatMoney } from '../integrations/telegram';
import { resolveStoreId } from './store';

function fakeRes(role: string, storeIds: string[]): Response {
  return { locals: { auth: { sub: 'u1', role, storeIds } } } as unknown as Response;
}

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

describe('resolveStoreId', () => {
  it('bitta do`kon bo`lsa avtomatik tanlanadi', () => {
    expect(resolveStoreId(fakeRes('store_owner', [A]))).toBe(A);
  });

  it('bir nechta bo`lsa X-Store-Id talab qilinadi', () => {
    expect(() => resolveStoreId(fakeRes('store_owner', [A, B]))).toThrow(/X-Store-Id/);
  });

  it('so`ralgan do`kon JWT da bo`lsa qabul qilinadi', () => {
    expect(resolveStoreId(fakeRes('store_owner', [A, B]), B)).toBe(B);
  });

  it('begona do`konga ruxsat berilmaydi — so`rovga ishonilmaydi', () => {
    expect(() => resolveStoreId(fakeRes('store_owner', [A]), B)).toThrow(/ruxsat/);
  });

  it('do`koni yo`q foydalanuvchi rad etiladi', () => {
    expect(() => resolveStoreId(fakeRes('store_owner', []))).toThrow();
  });

  it('admin istalgan do`konni ko`ra oladi, lekin id ko`rsatishi kerak', () => {
    expect(resolveStoreId(fakeRes('admin', []), B)).toBe(B);
    expect(() => resolveStoreId(fakeRes('admin', []))).toThrow(/storeId/);
  });
});

describe('telegram formatlash', () => {
  it('HTML ekranlanadi — mijoz matni orqali teg kirita olmaydi', () => {
    expect(escapeHtml('<b>Aziz</b> & Co')).toBe('&lt;b&gt;Aziz&lt;/b&gt; &amp; Co');
  });

  it('summa bo`shliq bilan ajratiladi', () => {
    expect(formatMoney('1250000.00', 'UZS')).toBe('1 250 000 UZS');
    expect(formatMoney('500.00', 'AED')).toBe('500 AED');
    expect(formatMoney('0.00', 'UZS')).toBe('0 UZS');
  });
});
