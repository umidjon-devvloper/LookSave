import { useState } from 'react';
import { Link } from 'react-router';

import { renderKey } from '@looksave/validation';
import { Button, Card, Icon, type IconName } from '@looksave/ui-web';

import { ANGLE_LABEL, type AvatarAngle } from '@/api/endpoints';
import { PhotoStep } from '@/components/tryon/PhotoStep';
import { SizesStep } from '@/components/tryon/SizesStep';
import { StorePicker } from '@/components/tryon/StorePicker';
import { useTryon } from '@/components/tryon/useTryon';
import { isLocale } from '@/i18n/locale';
import { money } from '@/lib/format';

import type { Route } from './+types/try-on';

/**
 * AI kiyintirish — docs/12-tz.md Q-7.
 *
 * ⚠️ BU SAHIFA 3D NAMOYISHINI ALMASHTIRDI. Ilgari bu yerda bitta
 * `three.js` sahnasi turardi: qotirilgan komplektdagi maneken, hech
 * qanday tanlovsiz. U «brauzerda 3D ishlaydi» degan texnik namoyish
 * edi, mahsulot emas — foydalanuvchi undan o'ziga hech narsa kiyintira
 * olmasdi.
 *
 * ⚠️ MANTIQ `useTryon` DA, BU YERDA FAQAT KO'RINISH. Ikkalasi bir
 * faylda bo'lsa har o'zgarishda ikkovini birga o'qishga to'g'ri
 * kelardi; qoidalar esa mobil ilova bilan bir xil bo'lishi kerak va
 * ularni yonma-yon solishtirish oson bo'lsin.
 *
 * ⚠️ SSR YO'Q — VA BU TO'G'RI. Sahifa shaxsiy (surat, o'lchovlar,
 * savat) va `robots: noindex`; SSR undan hech narsa yutmaydi, lekin
 * har ochilishda API ga to'rtta so'rov qo'shardi. Ma'lumot brauzerdan,
 * BFF resurs marshrutlari orqali keladi.
 */

export function meta(): Route.MetaDescriptors {
  return [
    { title: 'AI kiyintirish — LookSave' },
    {
      name: 'description',
      content:
        "O'zingizning suratingizda kiyib ko'ring: AI kiyimni sizga kiydiradi, komplektni qatlab yig'adi va o'lchamingizga mos narsalarni ko'rsatadi.",
    },
    // Shaxsiy sahifa — indekslanmaydi
    { name: 'robots', content: 'noindex' },
  ];
}

export function loader({ params }: Route.LoaderArgs) {
  return { locale: isLocale(params.locale) ? params.locale : 'en' };
}

/**
 * Kategoriya tablari — mobil ilovadagi ro'yxat bilan aynan bir xil.
 *
 * ⚠️ TARTIB — KO'RISH TARTIBI, KIYINISH TARTIBI EMAS. Kiyinish tartibi
 * `@looksave/validation` dagi `LAYER_ORDER` da: shimni kurtkadan keyin
 * kiyib bo'lmaydi.
 */
const TABS: Array<{ category: string; label: string; icon: IconName }> = [
  { category: 'tshirt', label: 'Futbolka', icon: 'slotTop' },
  { category: 'hoodie', label: 'Xudi', icon: 'slotTop' },
  { category: 'jacket', label: 'Kurtka', icon: 'slotOuter' },
  { category: 'shirt', label: "Ko'ylak", icon: 'slotTop' },
  { category: 'trousers', label: 'Shim', icon: 'slotBottom' },
];

const ANGLES: AvatarAngle[] = ['front', 'side', 'back'];

export default function TryOnPage({ loaderData }: Route.ComponentProps): JSX.Element {
  const { locale } = loaderData;
  const controller = useTryon(locale);

  const {
    state,
    loading,
    tab,
    setTab,
    angle,
    setAngle,
    onlyMySize,
    setOnlyMySize,
    store,
    outfit,
    resolved,
    outfitItems,
    wear,
    takeOff,
    items,
    current,
    shown,
    worn,
    wornFront,
    layerBase,
    stripBase,
    renderIndex,
    rendering,
    failed,
    limitReached,
    notice,
    setNotice,
    act,
    refresh,
  } = controller;

  const [storeOpen, setStoreOpen] = useState(false);
  /*
   * ⚠️ SEHRGAR BIR TOMONLAMA EDI. Bosqichlar serverdagi `needs.*` bilan
   * boshqariladi: surat saqlangach `needs.photo` `false` bo'ladi va
   * PhotoStep'ga qaytish yo'li UMUMAN qolmasdi — odam suratini qayta
   * olmoqchi bo'lsa, faqat profilni tozalash qolardi.
   *
   * Bu bayroq o'sha ekranni majburan ochadi; server holati o'zgarmaydi,
   * ya'ni bekor qilinsa hech narsa yo'qolmaydi.
   */
  const [redoPhoto, setRedoPhoto] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [cartBusy, setCartBusy] = useState(false);

  if (loading) {
    return (
      <div className="shell section-y flex justify-center">
        <span className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!state?.signedIn) {
    return (
      <div className="shell section-y">
        <Card className="mx-auto flex max-w-lg flex-col items-center gap-4 p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primarySoft text-brand">
            <Icon name="hanger" size={24} />
          </span>
          <h1 className="text-h2">O‘zingizda kiyib ko‘ring</h1>
          <p className="text-small text-muted-foreground">
            AI kiyimni aynan sizning suratingizga kiydiradi — buning uchun akkaunt kerak.
          </p>
          <Button asChild>
            <Link to={`/${locale}/sign-in?next=/${locale}/try-on`}>Kirish</Link>
          </Button>
        </Card>
      </div>
    );
  }

  /* ── Sozlash sehrgari ── */

  if (state.needs.photo || redoPhoto) {
    return (
      <div className="shell section-y">
        <Header />
        <div className="mx-auto mt-8 max-w-lg">
          <PhotoStep
            controller={controller}
            onDone={() => setRedoPhoto(false)}
            onCancel={redoPhoto ? () => setRedoPhoto(false) : undefined}
          />
        </div>
      </div>
    );
  }

  if (state.needs.sizes) {
    return (
      <div className="shell section-y">
        <Header />
        <div className="mx-auto mt-8 max-w-xl">
          <SizesStep controller={controller} />
        </div>
      </div>
    );
  }

  if (state.needs.store) {
    return (
      <div className="shell section-y">
        <Header />
        <div className="mx-auto mt-8 max-w-lg">
          <StorePicker controller={controller} locale={locale} />
        </div>
      </div>
    );
  }

  /* ── Kiyintirish ── */

  const angles = state.avatar?.angles ?? {};
  const baseImage = angles[angle] ?? state.avatar?.imageUrl ?? state.profile?.bodyPhotoUrl ?? null;

  /*
   * ⚠️ SAHNADA JORIY TANLOV TURADI, komplektning eng tepasi emas.
   * Foydalanuvchi futbolkalar tabida turganda ular KURTKASIZ
   * ko'rsatiladi — u aynan futbolkani tanlayapti.
   *
   * ⚠️ YON/ORQADA `wornFront` ZAXIRA (2026-09-26). Server operator faqat
   * OLD burchakni chizadi (yon/orqa qo'shimcha varaqdan kesiladi); yon
   * renderi hali tayyor bo'lmasa o'sha kiyimning OLD suratini ko'rsatamiz
   * — hech qachon boshqa kiyim (past qatlam) chalg'itmaydi.
   */
  const stageImage =
    (shown?.status === 'ready' ? (shown.imageUrl ?? shown.cutoutUrl) : null) ??
    layerBase?.imageUrl ??
    worn?.imageUrl ??
    wornFront?.imageUrl ??
    baseImage;

  const sizes = current?.sizes ?? [];
  const fitSize = state.fitSize;
  const picked = size ?? (fitSize && sizes.includes(fitSize) ? fitSize : sizes[0]) ?? null;

  const colorOptions = current ? items.filter((item) => item.productId === current.productId) : [];

  const outfitTotal = outfitItems.reduce((sum, item) => sum + Number(item.price), 0);
  const outfitCurrency = outfitItems[0]?.currency ?? 'UZS';

  const addToCart = async (lines: Array<{ variantId: string; chosenSize: string }>) => {
    setCartBusy(true);
    try {
      const result = await act({ op: 'cart', lines });
      setNotice(result.error ?? `${lines.length} ta mahsulot savatga qo‘shildi`);
    } finally {
      setCartBusy(false);
    }
  };

  return (
    <div className="shell section-y">
      <Header storeName={store?.name ?? null} onChangeStore={() => setStoreOpen(true)} />

      {limitReached ? (
        <div className="mt-6 flex items-center gap-3 rounded-md border border-warning bg-warning/10 p-3">
          <Icon name="clock" size={16} className="text-warning" />
          <p className="text-tiny text-muted-foreground">
            Kunlik AI chegarasi tugadi. Tayyor suratlar qoladi, yangilari ertaga.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ── Sahna ── */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-card border border-border bg-[#050509]">
            {/* Oyoq ostidagi binafsha nur — deckdagi «sahna» hissi */}
            <div
              aria-hidden="true"
              className="absolute inset-x-[15%] bottom-0 h-[22%] rounded-full bg-primary/25 blur-2xl"
            />

            {stageImage ? (
              <img
                src={stageImage}
                alt="Kiyintirilgan ko‘rinish"
                className="absolute inset-0 size-full object-contain"
              />
            ) : (
              /*
                ⚠️ AVATARSIZ HOLAT ENDI KO'RINADI.
                
                Sehrgar yuz surati bo'lsa ichkariga qo'yib yuboradi, lekin
                kiyintirish uchun TAYYOR avatar kerak. Ilgari bu yerda hech
                narsa chizilmasdi: sahna bo'sh turardi va har kiyintirish
                serverda «Avval avatar yasang» bilan jimgina yiqilardi —
                foydalanuvchi na sababni, na tugmani ko'rardi.
              */
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                {state.avatar?.status === 'processing' ? (
                  <p className="text-small text-muted-foreground">
                    Avatar tayyorlanmoqda — bu bir daqiqacha vaqt oladi…
                  </p>
                ) : (
                  <>
                    <p className="text-small text-muted-foreground">
                      Kiyintirish uchun avatar kerak
                    </p>
                    {(avatarError ?? state.avatar?.error) ? (
                      <p className="max-w-xs text-tiny text-danger">
                        {avatarError ?? state.avatar?.error}
                      </p>
                    ) : null}
                    <Button
                      disabled={avatarBusy}
                      onClick={() => {
                        setAvatarBusy(true);
                        setAvatarError(null);
                        void act({ op: 'avatar' })
                          .then((result) => {
                            if (result.error) setAvatarError(result.error);
                            return refresh();
                          })
                          .finally(() => setAvatarBusy(false));
                      }}
                    >
                      {avatarBusy ? 'Boshlanmoqda…' : 'Avatar yasash'}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Qatlam ko'rsatkichi — nechta kiyim kiyilgani */}
            {resolved.length > 0 ? (
              <div className="absolute end-3 top-1/3 flex flex-col gap-1.5">
                {resolved.map((layer) => (
                  <span
                    key={layer.category}
                    className={[
                      'rounded-full border',
                      layer.category === tab ? 'h-4 w-2' : 'size-2',
                      layer.render?.status === 'ready'
                        ? 'border-primary bg-primary'
                        : 'border-borderStrong',
                    ].join(' ')}
                  />
                ))}
              </div>
            ) : null}

            {/*
              ⚠️ `stageImage` SHART: avatarsiz kiyintirish umuman
              boshlanmaydi, lekin eski holat qolib ketishi mumkin. Bu
              tekshiruvsiz spinner avatar so'ralayotgan blokning USTIGA
              chizilardi va tugmani bosib bo'lmasdi.
            */}
            {rendering && stageImage ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-center">
                <span className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-bodyMed">AI kiyintirmoqda…</p>
                <p className="text-tiny text-muted-foreground">
                  {stripBase.ready
                    ? 'Har qatlam 10–20 soniya'
                    : 'Avval ostidagi qatlam tayyorlanmoqda'}
                </p>
              </div>
            ) : null}

            {failed && !rendering ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 px-6 text-center">
                <Icon name="close" size={24} className="text-danger" />
                <p className="text-bodyMed">Kiyintirib bo‘lmadi</p>
                <p className="text-tiny text-muted-foreground">
                  {failed.error ?? 'Boshqa kiyim bilan urinib ko‘ring'}
                </p>
              </div>
            ) : null}
          </div>

          {/* Burchak va yechish */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {ANGLES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setAngle(item);
                  /*
                   * ⚠️ HAR BURCHAK ALOHIDA KREDIT — shuning uchun avval
                   * KESHGA qaraladi. Yasalgani bo'lsa bepul ko'rsatiladi.
                   */
                  if (!angles[item]) {
                    void act({ op: 'angle', angle: item }).then(() => void refresh());
                  }
                }}
                className={[
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-tiny transition-colors',
                  angle === item
                    ? 'border-borderAccent bg-primarySoft text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                <Icon name="rotate" size={12} />
                {ANGLE_LABEL[item]}
              </button>
            ))}

            {/*
              ⚠️ QAYTA OLISH — BURCHAKLAR YONIDA, ATAYIN. Avatar yoqmasa
              odam birinchi navbatda shu joyga qaraydi: sahna ostidagi
              qator avatarni boshqaradigan yagona joy. Sozlamalarga
              yashirilsa uni hech kim topmaydi.
            */}
            <button
              type="button"
              onClick={() => setRedoPhoto(true)}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-tiny text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icon name="camera" size={12} />
              Suratni qayta olish
            </button>

            {outfit.some((layer) => layer.category === tab) ? (
              <button
                type="button"
                onClick={() => {
                  takeOff(tab);
                  setSize(null);
                }}
                className="ms-auto flex items-center gap-1.5 rounded-full border border-danger/50 px-3 py-1.5 text-tiny text-danger transition-colors hover:bg-danger/10"
              >
                <Icon name="close" size={12} />
                Yechish
              </button>
            ) : null}
          </div>
        </div>

        {/* ── Tanlov ── */}
        <div className="flex flex-col gap-5">
          {/* Turkum tablari */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((item) => {
              const active = tab === item.category;
              const dressed = outfit.some((layer) => layer.category === item.category);

              return (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => {
                    setTab(item.category);
                    setSize(null);
                  }}
                  className={[
                    'relative flex shrink-0 flex-col items-center gap-1 rounded-md border px-4 py-2.5 transition-colors',
                    active
                      ? 'border-borderAccent bg-primarySoft'
                      : 'border-transparent hover:border-border',
                  ].join(' ')}
                >
                  <Icon name={item.icon} size={18} className={active ? 'text-brand' : 'text-dim'} />
                  <span className={active ? 'text-tiny' : 'text-tiny text-muted-foreground'}>
                    {item.label}
                  </span>
                  {dressed ? (
                    <span className="absolute end-2 top-1.5 size-1.5 rounded-full bg-success" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Kiyim tasmasi */}
          {items.length === 0 ? (
            <Card className="flex flex-col gap-3 p-6 text-center">
              {/*
                ⚠️ XATO BO'SHLIKDAN AJRATILADI.
                
                `try-on.state.tsx` dagi `catch` kiyimlarsiz holat qaytaradi va
                `error` maydonini to'ldiradi. Sahifa esa uni HECH QAYERDA
                ko'rsatmasdi — API yiqilsa ham ekranda «Bu turkumda kiyim
                yo'q» chiqardi. Ikkalasi bir xil ko'ringani uchun sabab
                topilmasdi: baza to'la, endpoint to'g'ri javob beradi, sahifa
                esa bo'sh turadi.
              */}
              {state.error ? (
                <p className="text-small text-danger">{state.error}</p>
              ) : (
                <p className="text-small text-muted-foreground">
                  {onlyMySize && fitSize
                    ? `${store?.name ?? 'Bu do‘kon'}da ${fitSize} o‘lchamdagi kiyim yo‘q`
                    : 'Bu turkumda hozircha kiyim yo‘q'}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                {onlyMySize && fitSize ? (
                  <Button variant="ghost" onClick={() => setOnlyMySize(false)}>
                    Barcha o‘lchamlarni ko‘rsat
                  </Button>
                ) : null}
                <Button onClick={() => setStoreOpen(true)}>Boshqa do‘kon tanlash</Button>
              </div>
            </Card>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {items.map((item) => {
                const render = renderIndex.get(renderKey(item.variantId, stripBase.baseRenderId));
                const ready = render?.status === 'ready';
                const busy = render?.status === 'pending' || render?.status === 'processing';
                const selected = item.variantId === current?.variantId;

                /*
                 * ⚠️ KARTOCHKADA KIYIMNING O'ZI, MODEL EMAS.
                 *
                 * Ilgari tayyor natija (kiyintirilgan odam) ko'rsatilardi —
                 * maketdagi fikr shunday edi. Amalda esa tasma bir xil
                 * odamning takroriy suratlariga to'lib ketardi va kiyimni
                 * ajratib bo'lmasdi: hamma kartochkada bir xil gavda,
                 * farqi faqat mayda kiyim.
                 *
                 * Mijoz qarori (2026-09-10): kartochkada kiyim turadi.
                 * Tayyorligini yashil belgi bildiradi, natijaning o'zi esa
                 * katta sahnada ko'rinadi.
                 */
                const preview = item.image;

                return (
                  <button
                    key={item.variantId}
                    type="button"
                    aria-label={item.title}
                    onClick={() => {
                      /*
                       * ⚠️ BOSISH = KIYINTIRISH. Alohida «kiyintirish»
                       * tugmasi yo'q: natijani ko'rish uchun ikki bosish
                       * kerak bo'lardi.
                       */
                      wear(tab, item.variantId);
                      setSize(null);
                    }}
                    className={[
                      'relative shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                      selected ? 'border-brand' : 'border-transparent hover:border-border',
                    ].join(' ')}
                  >
                    <img
                      src={preview}
                      alt=""
                      className={[
                        'h-28 w-[84px] bg-surface2',
                        ready ? 'bg-[#050509] object-contain' : 'object-cover',
                      ].join(' ')}
                    />

                    {busy ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/55">
                        <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </span>
                    ) : null}

                    {ready ? (
                      <span className="absolute bottom-1 end-1 flex size-4 items-center justify-center rounded-full bg-success">
                        <Icon name="authentic" size={9} className="text-background" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {/* Tanlangan mahsulot */}
          {current ? (
            <Card className="flex flex-col gap-4 p-5">
              <div>
                <h2 className="truncate text-h3">{current.title}</h2>
                <p className="text-tiny text-muted-foreground">{current.store.name}</p>
              </div>

              {colorOptions.length > 1 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-label uppercase text-dim">Rang</p>
                  <div className="flex gap-2">
                    {colorOptions.map((option) => (
                      <button
                        key={option.variantId}
                        type="button"
                        aria-label={`Rang: ${option.colorHex ?? option.title}`}
                        onClick={() => {
                          wear(tab, option.variantId);
                          setSize(null);
                        }}
                        style={{ backgroundColor: option.colorHex ?? undefined }}
                        className={[
                          'size-8 rounded-full border-2',
                          option.variantId === current.variantId
                            ? 'border-brand'
                            : 'border-borderStrong',
                          option.colorHex ? '' : 'bg-surface2',
                        ].join(' ')}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {sizes.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-label uppercase text-dim">
                      O‘lcham
                      {fitSize ? <span className="text-brand"> · sizga {fitSize}</span> : null}
                    </p>

                    {/*
                      Filtr holati ko'rinib tursin: foydalanuvchi ro'yxat
                      nega qisqa ekanini bilishi kerak
                    */}
                    {fitSize ? (
                      <button
                        type="button"
                        onClick={() => setOnlyMySize(!onlyMySize)}
                        className={[
                          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-tiny transition-colors',
                          onlyMySize
                            ? 'border-borderAccent bg-primarySoft text-brand'
                            : 'border-border text-muted-foreground',
                        ].join(' ')}
                      >
                        <Icon name="filter" size={12} />
                        Faqat mening o‘lchamim
                      </button>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {sizes.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setSize(item)}
                        className={[
                          'min-w-[52px] rounded-md border px-3 py-2 text-bodyMed transition-colors',
                          picked === item
                            ? 'border-borderAccent bg-primarySoft text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground',
                        ].join(' ')}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-small text-warning">Bu mahsulot omborda tugagan</p>
              )}

              {/* Komplekt */}
              {outfitItems.length > 0 ? (
                <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-label uppercase text-dim">
                      Komplekt · {outfitItems.length} ta
                    </p>
                    <p className="text-bodyMed text-brand">
                      {money(String(outfitTotal), outfitCurrency)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {resolved.map((layer) => {
                      const item = outfitItems.find((it) => it.variantId === layer.variantId);
                      if (!item) return null;

                      return (
                        <button
                          key={layer.category}
                          type="button"
                          aria-label={`${item.title} — yechish`}
                          onClick={() => takeOff(layer.category)}
                          className="relative"
                        >
                          <img
                            src={item.image}
                            alt=""
                            className="h-14 w-11 rounded-sm bg-surface2 object-cover"
                          />
                          <span className="absolute -end-1 -top-1 flex size-4 items-center justify-center rounded-full border border-borderStrong bg-surface3">
                            <Icon name="close" size={9} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {notice ? <p className="text-small text-brand">{notice}</p> : null}

              <div className="flex flex-col gap-2">
                <Button
                  disabled={!picked || cartBusy}
                  onClick={() =>
                    picked && void addToCart([{ variantId: current.variantId, chosenSize: picked }])
                  }
                >
                  {picked
                    ? `Savatga · ${money(current.price, current.currency)}`
                    : 'O‘lcham tanlang'}
                </Button>

                {/*
                  ⚠️ FAQAT BIRDAN KO'P BO'LSA. Bitta kiyimda u yuqoridagi
                  tugmani takrorlaydi va foydalanuvchi qaysi biri nima
                  qilishini o'ylab qolardi.
                */}
                {outfitItems.length > 1 ? (
                  <Button
                    variant="ghost"
                    disabled={cartBusy}
                    onClick={() => {
                      /*
                       * ⚠️ HAR MAHSULOTGA O'ZINING O'LCHAMI. Ustki va
                       * pastki kiyimning razmeri har xil hisoblanadi
                       * (ko'krak / bel) — birini ikkinchisiga qo'llasak,
                       * shim noto'g'ri o'lchamda savatga tushardi.
                       *
                       * Ro'yxat serverdan `sizes` bilan keladi va u
                       * faqat OMBORDA borlarini o'z ichiga oladi,
                       * shuning uchun birinchisi xavfsiz zaxira.
                       */
                      const lines = outfitItems
                        .map((item) => {
                          const chosen =
                            fitSize && item.sizes.includes(fitSize) ? fitSize : item.sizes[0];
                          return chosen ? { variantId: item.variantId, chosenSize: chosen } : null;
                        })
                        .filter(
                          (line): line is { variantId: string; chosenSize: string } =>
                            line !== null,
                        );

                      if (lines.length === 0) {
                        setNotice('Komplektdagi mahsulotlar omborda tugagan');
                        return;
                      }

                      void addToCart(lines);
                    }}
                  >
                    Butun komplektni savatga · {money(String(outfitTotal), outfitCurrency)}
                  </Button>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {storeOpen ? (
        <StorePicker
          controller={controller}
          locale={locale}
          asPanel
          onClose={() => setStoreOpen(false)}
        />
      ) : null}
    </div>
  );
}

/** Sarlavha va do'kon chipi — sozlash qadamlarida ham, kiyintirishda ham */
function Header({
  storeName,
  onChangeStore,
}: {
  storeName?: string | null;
  onChangeStore?: () => void;
} = {}): JSX.Element {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow">AI kiyintirish</p>
        <h1 className="headline mt-2 text-h1">O‘zingizda kiyib ko‘ring</h1>
      </div>

      {onChangeStore ? (
        <button
          type="button"
          onClick={onChangeStore}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-tiny text-muted-foreground transition-colors hover:border-borderStrong hover:text-foreground"
        >
          <Icon name="shop" size={14} className="text-brand" />
          <span className="max-w-[180px] truncate">{storeName ?? 'Do‘kon tanlang'}</span>
          <Icon name="next" size={14} />
        </button>
      ) : null}
    </div>
  );
}
