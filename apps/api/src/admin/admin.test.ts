import {
  assetUpdateSchema,
  adminStoresQuerySchema,
  adminUsersQuerySchema,
  rejectReasonSchema,
} from '@looksave/validation';
import { describe, expect, it } from 'vitest';

const QA = {
  fpsHighEnd: 60,
  fpsMidRange: 38,
  fpsLowEnd: 27,
  loadMs: 640,
  ramMb: 42,
  checklistPassed: true,
};

describe('3D nashr qoidalari', () => {
  it('GLB va QA bilan nashr qilinadi', () => {
    const result = assetUpdateSchema.safeParse({
      status: 'ready',
      glbUrl: 'https://cdn.looksave.app/m/1.glb',
      qaResult: QA,
    });
    expect(result.success).toBe(true);
  });

  it('QA natijasisiz nashr qilib bo`lmaydi', () => {
    const result = assetUpdateSchema.safeParse({
      status: 'ready',
      glbUrl: 'https://cdn.looksave.app/m/1.glb',
    });
    expect(result.success).toBe(false);
  });

  it('GLB havolasisiz nashr qilib bo`lmaydi', () => {
    expect(assetUpdateSchema.safeParse({ status: 'ready', qaResult: QA }).success).toBe(false);
  });

  it('checklist belgilanmasa nashr qilib bo`lmaydi — bitta sifatsiz model tajribani buzadi', () => {
    const result = assetUpdateSchema.safeParse({
      status: 'ready',
      glbUrl: 'https://cdn.looksave.app/m/1.glb',
      qaResult: { ...QA, checklistPassed: false },
    });
    expect(result.success).toBe(false);
  });

  it('`failed` uchun xato sababi majburiy', () => {
    expect(assetUpdateSchema.safeParse({ status: 'failed' }).success).toBe(false);
    expect(
      assetUpdateSchema.safeParse({ status: 'failed', errorMessage: 'Fotolar yetarli emas' })
        .success,
    ).toBe(true);
  });

  it('navbatga qaytarish uchun qo`shimcha maydon kerak emas', () => {
    expect(assetUpdateSchema.safeParse({ status: 'queued' }).success).toBe(true);
  });

  it('tashqi havola ham qabul qilinadi, lekin URL bo`lishi shart', () => {
    expect(
      assetUpdateSchema.safeParse({ status: 'ready', glbUrl: 'model.glb', qaResult: QA }).success,
    ).toBe(false);
  });
});

describe('admin so`rov sxemalari', () => {
  it('do`konlar standart holati — tekshiruv kutayotganlar', () => {
    expect(adminStoresQuerySchema.parse({}).status).toBe('pending');
  });

  it('rad etish sababi majburiy va uzunligi tekshiriladi', () => {
    expect(rejectReasonSchema.safeParse({}).success).toBe(false);
    expect(rejectReasonSchema.safeParse({ reason: 'ab' }).success).toBe(false);
    expect(rejectReasonSchema.safeParse({ reason: 'Manzil topilmadi' }).success).toBe(true);
  });

  it('`restricted` query string`dan boolean`ga o`giriladi', () => {
    expect(adminUsersQuerySchema.parse({ restricted: 'true' }).restricted).toBe(true);
    expect(adminUsersQuerySchema.parse({ restricted: 'false' }).restricted).toBe(false);
    expect(adminUsersQuerySchema.parse({}).restricted).toBe(false);
  });
});
