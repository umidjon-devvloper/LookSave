import { Form, Link, data, redirect, useFetcher } from 'react-router';

import { Button, Card, CartArt, Icon, ImageFrame, QuantityStepper } from '@looksave/ui-web';

import {
  clearCart,
  getCart,
  removeCartItem,
  setCartItemQty,
  type Cart,
  type CartGroup,
  type CartItem,
} from '@/api/endpoints';
import { isLocale, type Locale } from '@/i18n/locale';
import { money } from '@/lib/format';
import { auth, requireAuth } from '@/session.server';

import type { Route } from './+types/cart';

/**
 * Savat — docs/15-sayt-dizayn.md §4.7.
 *
 * ⚠️ DO'KON BO'YICHA GURUHLANADI. Har do'kon alohida buyurtma bo'ladi
 * (ilovadagi mantiq, `app/(tabs)/cart.tsx`), shuning uchun jami ham
 * har guruhda alohida hisoblanadi va rasmiylashtirish ham guruhdan
 * boshlanadi.
 */

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Savat — LookSave' }, { name: 'robots', content: 'noindex' }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await auth(request, locale);

  if (!context.user) {
    /*
     * Mehmon savati hali yo'q (13-sayt.md §9 da rejalashtirilgan).
     * Kirish sahifasiga majburan tashlanmaydi: odam nima yo'qotayotganini
     * ko'rmay turib kirmaydi.
     */
    return data({ locale: locale as Locale, cart: null, signedIn: false });
  }

  const cart = await getCart(context.options).catch((): Cart => ({ stores: [], itemCount: 0 }));

  return data(
    { locale: locale as Locale, cart, signedIn: true },
    context.setCookie ? { headers: { 'Set-Cookie': context.setCookie } } : undefined,
  );
}

export async function action({ params, request }: Route.ActionArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await requireAuth(request, locale);

  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  const itemId = String(form.get('itemId') ?? '');

  try {
    if (intent === 'remove') {
      await removeCartItem(itemId, context.options);
    } else if (intent === 'clear') {
      await clearCart(context.options);
    } else if (intent === 'qty') {
      const qty = Number(form.get('qty') ?? 1);
      // 0 ga tushsa — o'chirish. Alohida tugma kerak emas.
      if (qty <= 0) await removeCartItem(itemId, context.options);
      else await setCartItemQty(itemId, qty, context.options);
    }
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : "Savatni yangilab bo'lmadi" },
      { status: 400 },
    );
  }

  return redirect(`/${locale}/cart`, {
    headers: context.setCookie ? { 'Set-Cookie': context.setCookie } : undefined,
  });
}

export default function CartPage({ loaderData }: Route.ComponentProps): JSX.Element {
  const { locale, cart, signedIn } = loaderData;

  if (!signedIn) {
    return (
      <div className="shell py-24">
        <div className="flex flex-col items-center gap-6 text-center">
          <CartArt size={170} />
          <div>
            <h1 className="text-h2 font-bold">Savatni ko'rish uchun kiring</h1>
            <p className="mx-auto mt-2 max-w-[46ch] text-body text-muted-foreground">
              Savat hisobingizga bog'lanadi — telefonda boshlab, brauzerda davom ettirasiz.
            </p>
          </div>
          <Button asChild className="shadow-glow">
            <Link to={`/${locale}/sign-in?next=/${locale}/cart`}>Kirish</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!cart || cart.stores.length === 0) {
    return (
      <div className="shell py-24">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Ilovadagi bo'sh savat rasmi bilan AYNAN bir xil (§4.7) */}
          <CartArt size={190} />
          <div>
            <h1 className="text-h2 font-bold">Savat bo'sh</h1>
            <p className="mx-auto mt-2 max-w-[46ch] text-body text-muted-foreground">
              Katalogdan boshlang — yoqqan mahsulotni 3D da kiyib ko'rsangiz ham bo'ladi.
            </p>
          </div>
          <Button asChild className="shadow-glow">
            <Link to={`/${locale}/catalog`}>Katalogga o'tish</Link>
          </Button>
        </div>
      </div>
    );
  }

  const grand = cart.stores.reduce((sum, group) => sum + Number(group.total), 0);
  const currency = cart.stores[0]?.store.currency ?? 'UZS';
  const mixedCurrency = new Set(cart.stores.map((group) => group.store.currency)).size > 1;

  return (
    <div className="shell-wide section-y">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold">Savat</h1>
          <p className="mt-1 text-small text-dim">
            {cart.itemCount} ta mahsulot · {cart.stores.length} ta do'kon
          </p>
        </div>

        <Form method="post">
          <input type="hidden" name="intent" value="clear" />
          <button
            type="submit"
            className="text-small text-dim underline-offset-4 transition-colors hover:text-danger hover:underline"
          >
            savatni bo'shatish
          </button>
        </Form>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.5fr_0.5fr] lg:gap-14">
        <div className="flex flex-col gap-10">
          {cart.stores.map((group) => (
            <StoreGroup key={group.store.id} group={group} locale={locale} />
          ))}
        </div>

        {/* ── Hisob-kitob ── */}
        <aside className="lg:sticky lg:top-[6.5rem] lg:self-start">
          <Card className="p-6">
            <h2 className="text-label font-semibold uppercase text-dim">Hisob-kitob</h2>

            <dl className="mt-4 flex flex-col gap-2.5">
              {cart.stores.map((group) => (
                <div key={group.store.id} className="flex justify-between gap-3">
                  <dt className="min-w-0 truncate text-small text-muted-foreground">
                    {group.store.name}
                  </dt>
                  <dd className="shrink-0 text-small tabular-nums text-foreground">
                    {money(group.total, group.store.currency)}
                  </dd>
                </div>
              ))}

              {/*
              ⚠️ UMUMIY JAMI FAQAT VALYUTA BITTA BO'LGANDA. Dubay
              (AED) va Toshkent (UZS) do'konlari bir savatda bo'lsa,
              raqamlarni qo'shish MA'NOSIZ — kurs bizda yo'q va bo'lishi
              ham shart emas (har do'kon alohida buyurtma).
            */}
              {!mixedCurrency ? (
                <div className="mt-2 flex justify-between border-t border-border pt-4">
                  <dt className="text-body font-medium">Jami</dt>
                  <dd className="text-body font-bold tabular-nums">
                    {money(grand.toFixed(2), currency)}
                  </dd>
                </div>
              ) : null}
            </dl>

            {mixedCurrency ? (
              <p className="mt-4 border-t border-border pt-4 text-small text-dim">
                Do'konlar turli valyutada — har biri alohida rasmiylashtiriladi.
              </p>
            ) : null}

            <p className="mt-5 text-small text-dim">
              Har do'kon alohida buyurtma bo'ladi. To'lov do'konda yoki yetkazib berilganda.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function StoreGroup({ group, locale }: { group: CartGroup; locale: Locale }): JSX.Element {
  return (
    <section>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
        <Link
          to={`/${locale}/store/${group.store.id}`}
          className="flex items-center gap-2 text-body font-medium transition-colors hover:text-brand"
        >
          <Icon name="shop" size={16} className="text-brand" />
          {group.store.name}
        </Link>

        <span className="text-small tabular-nums text-dim">
          {money(group.subtotal, group.store.currency)}
        </span>
      </header>

      <ul className="mt-4 flex flex-col gap-3">
        {group.items.map((item) => (
          <li key={item.id}>
            <CartRow item={item} currency={group.store.currency} />
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-end">
        <Button asChild>
          <Link to={`/${locale}/checkout?store=${group.store.id}`}>Rasmiylashtirish</Link>
        </Button>
      </div>
    </section>
  );
}

/**
 * Savat qatori.
 *
 * ⚠️ HAR QATORNING O'Z `fetcher` I BOR. Ilgari son o'zgartirish oddiy
 * forma edi va butun sahifani qayta yuklardi: scroll tepaga sakrardi,
 * rasmlar qaytadan chizilardi. `useFetcher` bilan faqat shu qator
 * yangilanadi va sahifa joyida qoladi (15-sayt-dizayn.md §4.7).
 */
function CartRow({ item, currency }: { item: CartItem; currency: string }): JSX.Element {
  const fetcher = useFetcher();
  const busy = fetcher.state !== 'idle';

  const setQty = (qty: number): void => {
    fetcher.submit(
      { intent: 'qty', itemId: item.id, qty: String(qty) },
      { method: 'post', preventScrollReset: true },
    );
  };

  return (
    <Card
      className={busy ? 'flex items-center gap-4 p-3 opacity-60' : 'flex items-center gap-4 p-3'}
    >
      <ImageFrame
        src={item.image}
        alt={item.title}
        ratio="3/4"
        rounded="md"
        className="w-14 shrink-0"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-body text-foreground">{item.title}</p>
        <p className="text-small text-dim">
          {[item.colorName, item.size].filter(Boolean).join(' · ')}
        </p>

        {!item.available ? (
          <p className="mt-0.5 text-small text-danger">Omborda qolmadi</p>
        ) : item.stock <= 3 ? (
          <p className="mt-0.5 text-small text-warning">{item.stock} ta qoldi</p>
        ) : null}
      </div>

      <QuantityStepper
        value={item.qty}
        busy={busy}
        max={Math.max(1, Math.min(10, item.stock))}
        onDecrement={() => setQty(item.qty - 1)}
        onIncrement={() => setQty(item.qty + 1)}
      />

      <span className="w-28 shrink-0 text-end text-body font-bold tabular-nums">
        {money(item.totalPrice, currency)}
      </span>

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="remove" />
        <input type="hidden" name="itemId" value={item.id} />
        <button
          type="submit"
          aria-label="O'chirish"
          className="inline-flex size-9 items-center justify-center rounded-md text-dim transition-colors hover:bg-accent hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon name="trash" size={16} />
        </button>
      </fetcher.Form>
    </Card>
  );
}
