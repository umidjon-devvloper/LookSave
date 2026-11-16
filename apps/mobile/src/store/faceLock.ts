import * as SecureStore from 'expo-secure-store';

/**
 * Yuz qulfi — foydalanuvchi yuz suratini tasodifan almashtirib
 * qo'ymasligi uchun kichik qurilma-lokal bayroq.
 *
 * ⚠️ TURAR JOYI — QURILMA. Server bilmaydi: bu UX himoyasi, maxfiylik
 * himoyasi emas. Qulf shu telefondagi "/ai/avatar" oqimini to'xtatadi,
 * boshqa qurilmadan kirgan foydalanuvchi hali ham yuzni yangilashi
 * mumkin. Buni kuchli himoya deb reklama qilish MUMKIN EMAS.
 */
const KEY = 'face.locked';

export async function isFaceLocked(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw === '1';
  } catch {
    return false;
  }
}

export async function setFaceLocked(value: boolean): Promise<void> {
  try {
    if (value) {
      await SecureStore.setItemAsync(KEY, '1');
    } else {
      await SecureStore.deleteItemAsync(KEY);
    }
  } catch {
    // SecureStore ishlamasa — qulf ham yo'q; alohida xato ko'rsatmaymiz
  }
}
