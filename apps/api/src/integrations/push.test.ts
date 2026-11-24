import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as EnvModule from '../config/env';

/**
 * Push sozlamalari.
 *
 * ⚠️ NIMANI QO'RIQLAYDI. 2026-11-24 gacha push faqat `EXPO_ACCESS_TOKEN`
 * bo'lsa yoqilardi, prod'da esa kalit yo'q edi — buyurtma xabarlari ham
 * jim yuborilmagan, hech qayerda xato chiqmagan. Endi kalit ixtiyoriy.
 */

const settings = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock('../config/env', async (original) => {
  const actual = await original<typeof EnvModule>();
  const base = actual.loadEnv();
  return { ...actual, env: () => ({ ...base, ...settings }) };
});

import { loadEnv } from '../config/env';
import { isPushEnabled, pushHeaders } from './push';

afterEach(() => {
  for (const key of Object.keys(settings)) delete settings[key];
});

describe('push sozlamalari', () => {
  it('sinov muhitida push o`chiq — haqiqiy telefonga xabar ketmasin', () => {
    expect(isPushEnabled()).toBe(false);
  });

  it('kalitsiz ham yoqilgan (prod), PUSH_DISABLED bilan o`chadi', () => {
    settings.NODE_ENV = 'production';
    settings.EXPO_ACCESS_TOKEN = '';
    settings.PUSH_DISABLED = false;
    expect(isPushEnabled()).toBe(true);

    settings.PUSH_DISABLED = true;
    expect(isPushEnabled()).toBe(false);
  });

  it('kalit bo`lsa Authorization yuboriladi, bo`lmasa yo`q', () => {
    settings.EXPO_ACCESS_TOKEN = 'expo-kalit';
    expect(pushHeaders()).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer expo-kalit',
    });

    settings.EXPO_ACCESS_TOKEN = '';
    expect(pushHeaders()).toEqual({ 'Content-Type': 'application/json' });
  });

  it('PUSH_DISABLED satri to`g`ri o`qiladi («false» — o`chirmaydi)', () => {
    const base = {
      DATABASE_URL: 'postgres://x@localhost/x',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'a'.repeat(48),
      JWT_REFRESH_SECRET: 'b'.repeat(48),
    };
    expect(loadEnv({ ...base }).PUSH_DISABLED).toBe(false);
    expect(loadEnv({ ...base, PUSH_DISABLED: 'false' }).PUSH_DISABLED).toBe(false);
    expect(loadEnv({ ...base, PUSH_DISABLED: 'true' }).PUSH_DISABLED).toBe(true);
    expect(loadEnv({ ...base, PUSH_DISABLED: '1' }).PUSH_DISABLED).toBe(true);
  });
});
