import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';

import { cn } from './cn';

/**
 * Rasm ramkasi — **har bir rasm shu orqali o'tadi**
 * (docs/15-sayt-dizayn.md §1.3, §5).
 *
 * ⚠️ NEGA MAJBURIY: `width`/`height` siz qo'yilgan bitta rasm ham CLS
 * byudjetini buzadi (13-sayt.md §12: CLS < 0.05). Nisbat ramkada
 * qotirilgani uchun brauzer joyni oldindan biladi va rasm kelganda
 * sahifa sakramaydi.
 *
 * ⚠️ FON `bg-surface`, kulrang emas. Bo'sh joy kartaning o'zi bilan bir
 * xil rangda bo'lsa, yuklanish paytida to'r yaxlit ko'rinadi.
 */
export interface ImageFrameProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'className' | 'src'
> {
  /** `null` — API rasm bermagan; bunday holat katalogda odatiy */
  src: string | null | undefined;
  alt: string;
  /** `3/4` mahsulot, `16/9` do'kon — 15-sayt-dizayn.md §1.3 */
  ratio?: '3/4' | '4/5' | '1/1' | '16/9';
  className?: string;
  imgClassName?: string;
  /** Sichqoncha ostida rasm kattalashadi — KARTA emas (§1.6) */
  zoomOnHover?: boolean;
  /** Oq studiya foni qorong'i sahifada ko'zni urmasin (pastda izoh) */
  calmWhite?: boolean;
  rounded?: 'card' | 'md' | 'none';
}

const RATIO: Record<NonNullable<ImageFrameProps['ratio']>, string> = {
  '3/4': 'aspect-[3/4]',
  '4/5': 'aspect-[4/5]',
  '1/1': 'aspect-square',
  '16/9': 'aspect-video',
};

const ROUNDED = { card: 'rounded-card', md: 'rounded-md', none: '' } as const;

export function ImageFrame({
  src,
  alt,
  ratio = '3/4',
  className,
  imgClassName,
  zoomOnHover = false,
  calmWhite = false,
  rounded = 'card',
  loading = 'lazy',
  ...props
}: ImageFrameProps): JSX.Element {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  /*
   * ⚠️ SSR DA `onLoad` NI KUTIB BO'LMAYDI.
   *
   * Sahifa serverda chizilgani uchun `<img>` HTML bilan birga keladi va
   * brauzer uni yuklashni React gidratatsiyasidan OLDIN boshlaydi.
   * Ikki holat ham `onLoad` ni o'tkazib yuboradi:
   *
   *   1) rasm gidratatsiyagacha yuklanib bo'ladi — hodisa o'tib ketgan;
   *   2) rasm gidratatsiya bilan effekt orasida yuklanadi — React
   *      tinglovchisi hali ulanmagan, `complete` esa tekshirilib
   *      bo'lingan.
   *
   * Natijada `loaded` `false` bo'lib qoladi va rasm `opacity-0` da
   * ko'rinmay turadi: katalog bo'sh ko'rinadi, lekin `naturalWidth`
   * 1000 bo'ladi. Aynan shu xato bosh sahifada ham, mahsulot
   * sahifasida ham chiqdi.
   *
   * Yechim: holatni tekshirish VA tinglovchini ulash bitta tikda
   * bajariladi — orada tirqish qolmaydi.
   */
  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (node.complete) {
      if (node.naturalWidth > 0) setLoaded(true);
      else setFailed(true);
      return;
    }

    const onLoad = (): void => setLoaded(true);
    const onError = (): void => setFailed(true);

    node.addEventListener('load', onLoad);
    node.addEventListener('error', onError);

    return () => {
      node.removeEventListener('load', onLoad);
      node.removeEventListener('error', onError);
    };
  }, [src]);

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-surface',
        RATIO[ratio],
        ROUNDED[rounded],
        className,
      )}
    >
      {src && !failed ? (
        <img
          {...props}
          ref={ref}
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          className={cn(
            'absolute inset-0 size-full object-cover transition-[opacity,transform,filter] duration-200',
            loaded ? 'opacity-100' : 'opacity-0',
            zoomOnHover && 'duration-300 group-hover:scale-105',
            /*
             * ⚠️ OQ FONLI SURATLAR UCHUN. Do'konlar mahsulotni ko'pincha
             * oq fonda suratga oladi (studiya odati) va qorong'i saytda
             * bunday karta ko'zni uradigan yorqin to'rtburchak bo'lib
             * turadi — 15-sayt-dizayn.md §1.8 dagi «oq fon yo'q»
             * qoidasiga zid.
             *
             * Suratni o'zgartira olmaymiz (u do'konniki), lekin uni
             * TINCHLANTIRA olamiz: tinch holatda biroz qoraytiriladi va
             * kontrasti pasaytiriladi, sichqoncha ostida esa to'liq
             * ochiladi. Natijada to'r yaxlit ko'rinadi, mahsulotni
             * ko'rmoqchi bo'lgan odam esa uni to'liq ko'radi.
             */
            calmWhite &&
              'brightness-[0.92] contrast-[0.96] group-hover:brightness-100 group-hover:contrast-100',
            imgClassName,
          )}
        />
      ) : null}

      {/*
        Rasm yo'q yoki ochilmadi — chegara bilan bo'sh ramka. Buzilgan
        rasm belgisi (brauzernikini) hech qachon ko'rinmasligi kerak.
      */}
      {(!src || failed) && (
        <div className="absolute inset-0 border border-border" aria-hidden="true" />
      )}

      {src && !failed && !loaded ? (
        <div className="absolute inset-0 animate-pulse-soft bg-surface2" aria-hidden="true" />
      ) : null}
    </div>
  );
}
