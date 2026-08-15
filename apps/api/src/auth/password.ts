import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

// `promisify` scrypt'ning options'li variantini tanimaydi — qo'lda o'raymiz
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

/**
 * Parol hashlash — `node:crypto` ning scrypt'i.
 *
 * Nega bcrypt/argon2 emas: ikkalasi ham native kompilyatsiya talab qiladi
 * (alpine Docker tasvirida qo'shimcha build-base kerak, tasvir kattalashadi).
 * scrypt xotira-og'ir va Node ichiga kirgan — nol bog'liqlik.
 *
 * Saqlash formati (yangi algoritmga o'tishni osonlashtirish uchun):
 *   scrypt$N$r$p$<salt-base64>$<hash-base64>
 *
 * Parametrlar OWASP tavsiyasi bo'yicha: N=2^16, r=8, p=1 (~64 MB, ~100 ms).
 */
const N = 65_536;
const R = 8;
const P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;

// scrypt N=65536, r=8 uchun standart 32 MB limit yetmaydi
const MAX_MEMORY = 128 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LEN, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEMORY,
  });

  return ['scrypt', N, R, P, salt.toString('base64'), derived.toString('base64')].join('$');
}

/**
 * Parolni tekshirish. Taqqoslash `timingSafeEqual` bilan — javob vaqti
 * bo'yicha parolni topib bo'lmaydi.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltB64 = parts[4];
  const hashB64 = parts[5];

  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (saltB64 === undefined || hashB64 === undefined) return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  if (expected.length === 0) return false;

  try {
    const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: MAX_MEMORY,
    });

    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
