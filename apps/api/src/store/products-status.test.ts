import { describe, expect, it } from 'vitest';

import { statusOnUpdate } from './products';

/**
 * Tahrirda mahsulot holati.
 *
 * ⚠️ NIMANI QO'RIQLAYDI. Sotuvchi faol mahsulotning narxini tuzatib
 * «Saqlash» ni bosganda ilova `status: 'pending'` yuboradi. Ilgari server
 * buni aynan yozardi va mahsulot katalogdan jimgina yo'qolardi.
 */
describe('statusOnUpdate', () => {
  it('faol mahsulot tahrirda faol qoladi', () => {
    expect(statusOnUpdate('active', 'pending')).toBe('active');
  });

  it('qoralama «nashr» qilinsa darhol faol bo`ladi (yaratishdagi qoida)', () => {
    expect(statusOnUpdate('draft', 'pending')).toBe('active');
    expect(statusOnUpdate('archived', 'pending')).toBe('active');
  });

  it('admin rad etgan mahsulot qayta yuborilsa ko`rib chiqishda qoladi', () => {
    expect(statusOnUpdate('rejected', 'pending')).toBe('pending');
  });

  it('qoralamaga olish va holatsiz tahrir o`zgarmaydi', () => {
    expect(statusOnUpdate('active', 'draft')).toBe('draft');
    expect(statusOnUpdate('active', undefined)).toBeUndefined();
  });
});
