import { Redirect } from 'expo-router';

/**
 * Eski 3D kiyib ko'rish ekrani — endi AI oqimiga yo'naltiradi.
 *
 * ⚠️ FAYL NEGA SAQLANDI: `(tabs)/_layout.tsx` da shu nomdagi `Tabs.Screen`
 * ro'yxatdan o'tgan va u markazdagi AI tugmasini joylashtirish uchun kerak.
 * Faylni o'chirsak marshrut yo'qoladi va tab qatori buziladi.
 *
 * ⚠️ NEGA YO'NALTIRISH KERAK BO'LDI: bu yerda 3D sahna bor edi va u
 * qurilmada UMUMAN chizilmasdi — kontekst yaratilardi, kadrlar sanalardi,
 * lekin ekran bo'sh qolardi. Mahsulot sahifasidagi "kiyib ko'rish" tugmasi
 * aynan shu ekranni ochardi, ya'ni foydalanuvchi buzuq ekranga tushardi.
 *
 * Kiyintirish endi AI orqali: `ai/avatar` -> `ai/fitting`. Eski 3D kodi
 * `src/three/` da qoladi va keyinchalik "360° ko'rish" imkoniyati sifatida
 * qaytishi mumkin.
 */
export default function TryOnRedirect(): JSX.Element {
  return <Redirect href="/ai" />;
}
