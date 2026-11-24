import { useRouter } from 'expo-router';

import { hasItem, type TrayItem } from '../ai/lookTray';
import type { ProductCard } from '../api/endpoints';
import { useLookStore } from '../store/lookStore';

/**
 * Mahsulot kartasidagi «Look» tugmasi: kiyimni kiyintirish savatiga
 * qo'shadi yoki undan olib tashlaydi.
 *
 * ⚠️ BOSH SAHIFA BILAN BIR XIL QOIDA (`app/(tabs)/index.tsx`, «TRENDING NOW»
 * kartalari — u yerda shu mantiq hali joyida yozilgan). Qoidani
 * o'zgartirsangiz ikkalasini ham o'zgartiring:
 *
 *  - Kiyib ko'rib bo'lmaydigan mahsulot (sumka, bosh kiyim — `canTryOn:
 *    false`) savatga tushmaydi: tugma mahsulot sahifasini ochadi.
 *  - Hamma bosilgani saqlanadi. Bir turdan bir nechtasi qo'shilsa,
 *    kiyiladigani oxirgisi — qolganlari primerkada nomzod bo'lib turadi.
 *  - Karta faqat MAHSULOTNI biladi. Rangi (variant) primerka ekranida
 *    serverdan aniqlanadi; surat va narx esa hoziroq beriladi — savat
 *    darhol to'g'ri ko'rinsin.
 */
export function useLookToggle(): {
  /** Savatdagi kiyimlar — `FlatList` ga `extraData` qilib bering, aks holda kartalar yangilanmaydi */
  items: readonly TrayItem[];
  inLook: (productId: string) => boolean;
  toggle: (product: ProductCard) => void;
} {
  const router = useRouter();
  const items = useLookStore((state) => state.items);
  const add = useLookStore((state) => state.add);
  const remove = useLookStore((state) => state.remove);

  return {
    items,
    inLook: (productId) => hasItem(items, productId),
    toggle: (product) => {
      if (!product.canTryOn) {
        router.push(`/product/${product.id}`);
        return;
      }
      if (hasItem(items, product.id)) {
        remove(product.id);
        return;
      }
      add({
        productId: product.id,
        variantId: null,
        slot: product.slot,
        title: product.title,
        image: product.image,
        price: product.price,
        currency: product.currency,
      });
    },
  };
}
