import { describe, expect, it } from 'vitest';

import { isPushEnabled } from './push';

describe('push sozlamalari', () => {
  it('EXPO_ACCESS_TOKEN bo`sh bo`lsa push o`chirilgan', () => {
    // vitest.config.ts da token berilmagan — dev muhitidagi holat
    expect(isPushEnabled()).toBe(false);
  });
});
