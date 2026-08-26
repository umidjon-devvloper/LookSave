/**
 * Base64 → bayt.
 *
 * ⚠️ NEGA QO'LDA. Hermes'da `atob` ham, `Buffer` ham YO'Q. `global.atob`
 * ishlatilsa kod jimgina yiqiladi va (catch bo'lsa) sabab ko'rinmaydi —
 * shunchaki tekstura tushmaydi.
 *
 * ⚠️ NEGA ALOHIDA FAYL. Ilgari bu `loader.ts` ichida edi. `textures.ts`
 * ham shu ishni talab qilgach, undan import qilish AYLANMA bog'liqlik
 * yasardi (`loader.ts` → `textures.ts` → `loader.ts`).
 */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array((clean.length * 3) >> 2);

  let byte = 0;
  let bits = 0;
  let out = 0;

  for (let i = 0; i < clean.length; i++) {
    byte = (byte << 6) | B64.indexOf(clean[i] as string);
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes[out++] = (byte >> bits) & 0xff;
    }
  }

  return bytes;
}
