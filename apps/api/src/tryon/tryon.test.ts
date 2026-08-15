import { createLookSchema, tryonSlotQuerySchema, tryonEventSchema } from '@looksave/validation';
import { describe, expect, it } from 'vitest';

const VARIANT = '11111111-1111-1111-1111-111111111111';
const VARIANT_2 = '22222222-2222-2222-2222-222222222222';

describe('komplekt sxemasi', () => {
  it('har slotda bitta mahsulot', () => {
    const ok = createLookSchema.safeParse({
      items: [
        { slot: 'top', variantId: VARIANT },
        { slot: 'feet', variantId: VARIANT_2 },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it('bir slot ikki marta kelsa rad etiladi', () => {
    const result = createLookSchema.safeParse({
      items: [
        { slot: 'top', variantId: VARIANT },
        { slot: 'top', variantId: VARIANT_2 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('bo`sh komplekt rad etiladi', () => {
    expect(createLookSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('noma`lum slot rad etiladi', () => {
    expect(
      createLookSchema.safeParse({ items: [{ slot: 'elbow', variantId: VARIANT }] }).success,
    ).toBe(false);
  });

  it('`isPublic` standart holatda yopiq', () => {
    const result = createLookSchema.parse({ items: [{ slot: 'top', variantId: VARIANT }] });
    expect(result.isPublic).toBe(false);
  });
});

describe('svayp so`rovi', () => {
  it('standart limit 50 — ilova ro`yxatni xotirada saqlaydi', () => {
    expect(tryonSlotQuerySchema.parse({}).limit).toBe(50);
  });

  it('100 dan ortiq so`ralmaydi', () => {
    expect(tryonSlotQuerySchema.safeParse({ limit: '200' }).success).toBe(false);
  });

  it('radius standart 10 km, 50 km dan katta emas', () => {
    expect(tryonSlotQuerySchema.parse({}).radius).toBe(10_000);
    expect(tryonSlotQuerySchema.safeParse({ radius: '99999' }).success).toBe(false);
  });
});

describe('tryon event', () => {
  it('davomiylik ixtiyoriy', () => {
    expect(tryonEventSchema.safeParse({ variantId: VARIANT }).success).toBe(true);
  });

  it('manfiy davomiylik rad etiladi', () => {
    expect(tryonEventSchema.safeParse({ variantId: VARIANT, durationMs: -1 }).success).toBe(false);
  });
});
