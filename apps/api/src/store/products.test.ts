import {
  createProductSchema,
  presignSchema,
  stockUpdateSchema,
  updateProductSchema,
  variantInputSchema,
} from '@looksave/validation';
import { describe, expect, it } from 'vitest';

const CAT = '11111111-1111-1111-1111-111111111111';

function product(over: Record<string, unknown> = {}) {
  return {
    title: 'Puma Suede Classic',
    categoryId: CAT,
    gender: 'unisex',
    basePrice: '890000.00',
    variants: [{ sizes: [{ size: '41', stock: 3 }] }],
    ...over,
  };
}

describe('mahsulot sxemasi', () => {
  it('qoralama rasm talab qilmaydi', () => {
    expect(createProductSchema.safeParse(product()).success).toBe(true);
  });

  it('nashr qilishda kamida 3 rasm kerak', () => {
    const two = product({
      status: 'pending',
      images: ['https://cdn.looksave.app/a.webp', 'https://cdn.looksave.app/b.webp'],
    });
    expect(createProductSchema.safeParse(two).success).toBe(false);

    const three = product({
      status: 'pending',
      images: [
        'https://cdn.looksave.app/a.webp',
        'https://cdn.looksave.app/b.webp',
        'https://cdn.looksave.app/c.webp',
      ],
    });
    expect(createProductSchema.safeParse(three).success).toBe(true);
  });

  it('do`kon `active` statusini bera olmaydi — moderatsiya orqali', () => {
    expect(createProductSchema.safeParse(product({ status: 'active' })).success).toBe(false);
    expect(updateProductSchema.safeParse({ status: 'active' }).success).toBe(false);
    expect(updateProductSchema.safeParse({ status: 'pending' }).success).toBe(true);
  });

  it('eski narx joriysidan katta bo`lishi kerak', () => {
    expect(createProductSchema.safeParse(product({ oldPrice: '500000.00' })).success).toBe(false);
    expect(createProductSchema.safeParse(product({ oldPrice: '1100000.00' })).success).toBe(true);
  });

  it('narx float bo`lmaydi', () => {
    expect(createProductSchema.safeParse(product({ basePrice: '890000.5' })).success).toBe(false);
    expect(createProductSchema.safeParse(product({ basePrice: 890000 })).success).toBe(false);
  });

  it('kamida bitta variant kerak', () => {
    expect(createProductSchema.safeParse(product({ variants: [] })).success).toBe(false);
  });

  it('variantda kamida bitta o`lcham kerak', () => {
    expect(variantInputSchema.safeParse({ sizes: [] }).success).toBe(false);
  });

  it('rang formati tekshiriladi', () => {
    expect(
      variantInputSchema.safeParse({ colorHex: 'qora', sizes: [{ size: 'M', stock: 1 }] }).success,
    ).toBe(false);
    expect(
      variantInputSchema.safeParse({ colorHex: '#1a1a1a', sizes: [{ size: 'M', stock: 1 }] })
        .success,
    ).toBe(true);
  });

  it('bo`sh PATCH rad etiladi', () => {
    expect(updateProductSchema.safeParse({}).success).toBe(false);
  });

  it('manfiy ombor rad etiladi', () => {
    expect(stockUpdateSchema.safeParse({ sizes: [{ size: 'M', stock: -1 }] }).success).toBe(false);
  });
});

describe('presign sxemasi', () => {
  it('faqat rasm turlari', () => {
    expect(
      presignSchema.safeParse({ fileName: 'a.webp', contentType: 'image/webp', purpose: 'product' })
        .success,
    ).toBe(true);
    expect(
      presignSchema.safeParse({
        fileName: 'a.php',
        contentType: 'application/php',
        purpose: 'product',
      }).success,
    ).toBe(false);
  });
});
