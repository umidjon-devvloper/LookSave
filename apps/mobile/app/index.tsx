import { Redirect } from 'expo-router';

/**
 * Kirish nuqtasi.
 *
 * ⚠️ KIRISH SO'RALMAYDI. Ilgari bu yerda auth holati tekshirilib,
 * kirmagan foydalanuvchi `welcome` ekraniga yuborilardi — ya'ni ilovani
 * ochgan odam birinchi ko'radigan narsa parol so'rovi bo'lardi.
 *
 * Magazin ilovasida bu noto'g'ri: katalogni ko'rish, do'konlarni izlash va
 * narxlarni solishtirish uchun akkaunt kerak emas. Kirish faqat shaxsiy
 * qismga o'tganda so'raladi — profil, buyurtma, avatar.
 *
 * O'sha ekranlar `SignInRequired` bilan o'zini himoya qiladi.
 */
export default function Index(): JSX.Element {
  return <Redirect href="/(tabs)" />;
}
