import type { Dictionary } from './dictionaries';

/**
 * Do'kon buyurtmani rad etgan sababni xaridorga o'qiladigan matn qiladi.
 *
 * ⚠️ SERVER SABABNI KOD BILAN SAQLAYDI (`apps/api/src/store/store.ts`):
 * `out_of_stock`, `size_unavailable`, `price_changed`, `fake_order`, `other`
 * — sotuvchi izoh qo'shgan bo'lsa `kod: izoh`. Buyurtma sahifasi uni
 * o'zgarishsiz chiqarardi va xaridor «Rad etildi» ostida `out_of_stock`
 * degan xom kodni ko'rardi.
 *
 * `fake_order` xaridorga aytilmaydi — «boshqa sabab» deb ko'rsatiladi.
 * Notanish qiymat o'z holicha qaytadi: eski buyurtmalarda erkin matn bo'lishi
 * mumkin.
 */
export function rejectReasonText(t: Dictionary, raw: string): string {
  const [code = '', ...rest] = raw.split(': ');
  const comment = rest.join(': ').trim();

  let label: string;
  switch (code.trim()) {
    case 'out_of_stock':
      label = t.seller.rejectOutOfStock;
      break;
    case 'size_unavailable':
      label = t.seller.rejectNoSize;
      break;
    case 'price_changed':
      label = t.order.rejectPriceChanged;
      break;
    case 'other':
    case 'fake_order':
      label = t.seller.rejectOther;
      break;
    default:
      return raw;
  }

  return comment ? `${label}: ${comment}` : label;
}
