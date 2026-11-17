import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { addFavorite, getFavorites, removeFavorite } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';

/**
 * Kartadagi yurakcha (bosh sahifa, katalog).
 *
 * NEGA KERAK: bu ekranlarda yurakcha ilgari bezak edi — tugmaga o'xshardi,
 * lekin bosilsa shunchaki mahsulot ochilardi. Endi u sevimlilarga qo'shadi
 * yoki olib tashlaydi, mahsulot sahifasidagi bilan bir xil.
 *
 * ⚠️ KIRMAGAN ODAMDA KIRISH EKRANI OCHILADI. So'rov yuborilsa 401 qaytardi
 * va yurakcha jimgina eski holatiga tushardi — tugma «ishlamayotgandek»
 * ko'rinardi (App Review 2.1 aynan shunday tugmalar uchun qaytaradi).
 *
 * Holat ikki manbadan yig'iladi: serverdagi ro'yxat (`['favorites']` —
 * sevimlilar ekrani bilan bitta kesh) va shu seansdagi bosishlar. Bosish
 * darhol ko'rinadi; server rad etsa orqaga qaytadi.
 */
export function useFavoriteToggle(): {
  isFavorite: (productId: string) => boolean;
  toggle: (productId: string) => void;
} {
  const router = useRouter();
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((state) => state.status === 'signedIn');

  const saved = useQuery({ queryKey: ['favorites'], queryFn: getFavorites, enabled: signedIn });
  const savedIds = useMemo(
    () => new Set((saved.data ?? []).map((product) => product.id)),
    [saved.data],
  );

  const [pressed, setPressed] = useState<Record<string, boolean>>({});

  // Akkauntdan chiqilganda oldingi egasining bosishlari qolmasin
  useEffect(() => {
    if (!signedIn) setPressed({});
  }, [signedIn]);

  const mutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      next ? addFavorite(id) : removeFavorite(id),
    onMutate: ({ id, next }) => {
      setPressed((current) => ({ ...current, [id]: next }));
      return { id, previous: !next };
    },
    onError: (_err, _vars, context) => {
      if (context) setPressed((current) => ({ ...current, [context.id]: context.previous }));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const isFavorite = useCallback(
    (productId: string): boolean => pressed[productId] ?? savedIds.has(productId),
    [pressed, savedIds],
  );

  const { mutate } = mutation;
  const toggle = useCallback(
    (productId: string): void => {
      if (!signedIn) {
        router.push('/(auth)/sign-in');
        return;
      }
      mutate({ id: productId, next: !isFavorite(productId) });
    },
    [signedIn, router, mutate, isFavorite],
  );

  return { isFavorite, toggle };
}
