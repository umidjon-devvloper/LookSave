import { describe, expect, it } from 'vitest';

import { keepOrderKeyAfter, orderKeyFor } from './orderKey';

/** `ApiError` shakli — haqiqiysi React Native'ni tortadi, testga kerak emas */
const apiError = (code: string, status: number): Error & { code: string; status: number } =>
  Object.assign(new Error(code), { code, status });

/**
 * ⚠️ NIMANI QO'RIQLAYDI. Bitta kalit butun ekranga ishlatilganda birinchi
 * server radidan keyin buyurtma berish qulflanib qolardi (server kalitni
 * tana bilan birga eslaydi). Bu sinovlar ikki xavfni ham ushlaydi:
 * qulflanish VA takroriy buyurtma.
 */
describe('buyurtma idempotentlik kaliti', () => {
  let n = 0;
  const make = (): string => `k${(n += 1)}`;

  it('bir xil tana — bir xil kalit (qayta yuborish ikkinchi buyurtma ochmaydi)', () => {
    const first = orderKeyFor(null, { a: 1 }, make);
    expect(orderKeyFor(first, { a: 1 }, make)).toBe(first);
  });

  it('tana o`zgarsa — yangi kalit (tuzatilgan so`rov eski kalit bilan rad etilmaydi)', () => {
    const first = orderKeyFor(null, { deliveryType: 'delivery' }, make);
    const second = orderKeyFor(first, { deliveryType: 'pickup' }, make);
    expect(second.key).not.toBe(first.key);
  });

  it('server xato bilan javob bersa kalit tashlanadi', () => {
    expect(keepOrderKeyAfter(apiError('INVALID_STATE', 409))).toBe(false);
    expect(keepOrderKeyAfter(apiError('VALIDATION_ERROR', 422))).toBe(false);
    expect(keepOrderKeyAfter(new Error('Savat topilmadi'))).toBe(false);
  });

  it('tarmoq xatosida kalit saqlanadi (buyurtma yaratilgan bo`lishi mumkin)', () => {
    expect(keepOrderKeyAfter(apiError('NETWORK', 0))).toBe(true);
  });
});
