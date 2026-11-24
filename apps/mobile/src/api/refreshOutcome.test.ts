import { describe, expect, it } from 'vitest';

import { refreshOutcome } from './refreshOutcome';

/**
 * ⚠️ NIMANI QO'RIQLAYDI. Server band (429) yoki qayta ishga tushayotgan
 * (502/503) paytda token yangilash sessiyani o'chirib yuborardi.
 */
describe('refreshOutcome', () => {
  it('2xx — yangilandi', () => {
    expect(refreshOutcome(200)).toBe('ok');
  });

  it('401/403 — sessiya rad etildi, tokenlar o`chiriladi', () => {
    expect(refreshOutcome(401)).toBe('rejected');
    expect(refreshOutcome(403)).toBe('rejected');
  });

  it('429 va 5xx — vaqtinchalik, sessiya SAQLANADI', () => {
    for (const status of [429, 500, 502, 503, 504]) expect(refreshOutcome(status)).toBe('unreachable');
  });

  it('boshqa 4xx ham sessiyani o`chirmaydi (noma`lum javob — ehtiyot)', () => {
    expect(refreshOutcome(404)).toBe('unreachable');
    expect(refreshOutcome(422)).toBe('unreachable');
  });
});
