import { describe, expect, it } from 'vitest';

import { planFromRules } from './stylist';

describe('planFromRules', () => {
  it("to'y uchun pidjak+shim+tufli komplekt beradi", () => {
    const plan = planFromRules("To'y uchun");
    expect(plan.picks.map((p) => p.slot)).toEqual(
      expect.arrayContaining(['top', 'bottom', 'feet']),
    );
    expect(plan.answer).toMatch(/to'y/i);
  });

  it('ish so`zi ofis komplektini keltiradi', () => {
    const plan = planFromRules('Ish uchun');
    expect(plan.picks[0]?.slot).toBe('top');
    expect(plan.picks.find((p) => p.slot === 'bottom')?.search).toBe('shim');
  });

  it("sport so'zi krasovka taklif qiladi", () => {
    const plan = planFromRules('sport zaliga');
    expect(plan.picks.find((p) => p.slot === 'feet')?.search).toBe('krasovka');
  });

  it('noma`lum so`rov ham umumiy komplekt qaytaradi', () => {
    const plan = planFromRules('xxxxxxxx');
    expect(plan.picks.length).toBeGreaterThan(0);
    expect(plan.answer).toContain('xxxxxxxx');
  });

  it('bo`sh matn ham xavfsiz ishlaydi', () => {
    const plan = planFromRules('');
    expect(plan.picks.length).toBeGreaterThan(0);
  });
});
