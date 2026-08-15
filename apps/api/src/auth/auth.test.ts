import { registerSchema, loginSchema, passwordSchema } from '@looksave/validation';
import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password';
import { ttlToSeconds } from './tokens';

describe('parol hashlash', () => {
  it('to`g`ri parolni tanidi, noto`g`risini rad etdi', async () => {
    const hash = await hashPassword('parol12345');
    expect(await verifyPassword('parol12345', hash)).toBe(true);
    expect(await verifyPassword('parol12346', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('har safar boshqa hash beradi (salt tasodifiy)', async () => {
    const a = await hashPassword('parol12345');
    const b = await hashPassword('parol12345');
    expect(a).not.toBe(b);
    expect(await verifyPassword('parol12345', b)).toBe(true);
  });

  it('formatni saqlaydi: scrypt$N$r$p$salt$hash', async () => {
    const hash = await hashPassword('parol12345');
    const parts = hash.split('$');
    expect(parts[0]).toBe('scrypt');
    expect(parts).toHaveLength(6);
  });

  it('buzuq hash bilan yiqilmaydi, false qaytaradi', async () => {
    expect(await verifyPassword('x', 'buzuq')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$1$2$3$4$5')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$a$b$c$d$e')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });

  it('unicode parol normallashtiriladi (NFKC)', async () => {
    // "é" ikki xil kodlanishi mumkin — foydalanuvchi kirolmay qolmasin
    const hash = await hashPassword('par\u00E9l1234');
    expect(await verifyPassword('pare\u0301l1234', hash)).toBe(true);
  });
});

describe('ttlToSeconds', () => {
  it('birliklarni to`g`ri o`giradi', () => {
    expect(ttlToSeconds('30s')).toBe(30);
    expect(ttlToSeconds('15m')).toBe(900);
    expect(ttlToSeconds('2h')).toBe(7200);
    expect(ttlToSeconds('30d')).toBe(2_592_000);
  });

  it('noto`g`ri formatda yiqiladi', () => {
    expect(() => ttlToSeconds('15')).toThrow();
    expect(() => ttlToSeconds('15y')).toThrow();
  });
});

describe('auth sxemalari', () => {
  const valid = {
    phone: '+998901234567',
    fullName: 'Aziz Karimov',
    password: 'parol12345',
  };

  it('to`g`ri ma`lumot o`tadi', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('shahar raqami rad etiladi (mobil emas)', () => {
    const result = registerSchema.safeParse({ ...valid, phone: '+998712345678' });
    expect(result.success).toBe(false);
  });

  it('qo`llab-quvvatlanmaydigan mamlakat rad etiladi', () => {
    expect(registerSchema.safeParse({ ...valid, phone: '+79161234567' }).success).toBe(false);
  });

  it('BAA raqami o`tadi', () => {
    expect(registerSchema.safeParse({ ...valid, phone: '+971501234567' }).success).toBe(true);
  });

  it('ismda raqam bo`lsa rad etiladi', () => {
    expect(registerSchema.safeParse({ ...valid, fullName: 'Aziz1' }).success).toBe(false);
  });

  it('parol 8 belgidan qisqa bo`lsa rad etiladi', () => {
    expect(passwordSchema.safeParse('1234567').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(true);
    expect(passwordSchema.safeParse('x'.repeat(129)).success).toBe(false);
  });

  it('login sxemasi parol uzunligini talab qilmaydi (eski parollar uchun)', () => {
    expect(loginSchema.safeParse({ phone: '+998901234567', password: 'a' }).success).toBe(true);
  });
});
