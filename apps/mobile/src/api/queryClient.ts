import { QueryClient } from '@tanstack/react-query';

/**
 * Yagona React Query keshi.
 *
 * ⚠️ NEGA `_layout.tsx` DA EMAS, ALOHIDA MODULDA (2026-11-16). Chiqishda
 * keshni tozalash kerak, lekin `signOut` — zustand store'i, React
 * kontekstidan tashqarida: `useQueryClient()` ga yeta olmaydi. Kesh
 * `_layout.tsx` ichida yaratilganda unga faqat komponentlar yeta olardi
 * va chiqqandan keyin ESKI AKKAUNTNING ma'lumoti (profil, avatar,
 * komplektlar, primerka tarixi) xotirada qolib, yangi akkaunt ostida
 * ko'rinardi.
 *
 * Modul darajasidagi bitta nusxa — ilova bo'ylab bir xil kesh.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // Mobil tarmoq beqaror — oyna fokusida qayta so'rash trafikni yeydi
      refetchOnWindowFocus: false,
    },
  },
});
