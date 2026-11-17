import { Platform } from 'react-native';

/**
 * Sotuvchi panelining suzuvchi tab bari egallagan joy.
 *
 * ⚠️ TAB BAR `position: 'absolute'` — EKRAN UNING OSTIGA HAM CHIZILADI
 * (`app/seller/_layout.tsx`). Ekranning pastiga yopishtirilgan har qanday
 * narsa (suzuvchi tugma, ro'yxatning oxirgi qatori) shu balandlikdan
 * yuqorida turishi kerak, aks holda bar ostida ko'rinmay va bosilmay qoladi.
 *
 * 2026-11-18 gacha ikki joy shunday edi: «Mahsulotlar» tabidagi «Mahsulot
 * qo'shish» tugmasi butunlay bar ostida yashirin turardi, bosh ekrandagi
 * oxirgi amal («Do'kon sozlamalari») esa oxirigacha aylantirilganda ham
 * yarmi bilan bar ostida qolardi. Kadrda sezilmaydi — tugma shunchaki yo'q;
 * XCUITest'ning `isHittable` tekshiruvi topdi.
 *
 * O'lchamlar shu yerdan olinadi — tab barning o'zi ham, ekranlar ham.
 * Bittasini o'zgartirsangiz ikkinchisi orqada qolmaydi.
 */
export const SELLER_TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 92 : 76;

/** Tab bar ekranning pastki chetidan shuncha ko'tarilgan */
export const SELLER_TAB_BAR_BOTTOM = 8;

/** Ekranning pastki chetidan tab barning TEPASIGACHA */
export const SELLER_TAB_BAR_SPACE = SELLER_TAB_BAR_HEIGHT + SELLER_TAB_BAR_BOTTOM;
