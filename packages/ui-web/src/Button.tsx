import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from './cn';

/**
 * Tugma — `apps/mobile/src/components/ui.tsx` dagi `Button` ning aynan
 * o'zi (docs/13-sayt.md §6.2, P-01…P-04).
 *
 * Ilovadagi qiymatlar va ular qayerdan:
 *
 *   balandlik  52px      `h-control`      (shadcn'da 36/40 edi — P-03)
 *   burchak    12px      `rounded-md`     (pill edi — P-02)
 *   gradient   135°      `bg-primary-grad`(yassi rang edi — P-01)
 *   bosish     0.97      `active:scale-97`(javob yo'q edi — P-04)
 *   matn       15/500    `text-body font-medium`
 *
 * ⚠️ NEGA GRADIENT: yassi bir rang «veb-sahifa tugmasi» bo'lib ko'rinadi,
 * ikki tomonlama o'tish esa hajm beradi va brendning binafsha shkalasini
 * ishlatadi. Deckdagi tuyg'u aynan shundan keladi.
 *
 * ⚠️ NEGA SHAFFOFLIK EMAS, KICHRAYISH: `opacity` tugmani xiralashtiradi,
 * ya'ni uni O'CHIQ ko'rsatadi — bosilgan emas. Kichrayish esa jismoniy
 * javob. Farq kichik, lekin sifat hissi shunday tafsilotlardan yig'iladi.
 *
 * ⚠️ WEB'GA XOS QO'SHIMCHA: `hover` va `:focus-visible`. Telefonda ular
 * yo'q, brauzerda esa ularsiz tugma «o'lik» tuyuladi va klaviatura bilan
 * yurgan odam qayerda turganini bilmaydi (13-sayt.md §6.5).
 */

type Variant = 'primary' | 'ghost' | 'danger';

const BASE =
  'inline-flex h-control select-none items-center justify-center gap-2 overflow-hidden ' +
  'rounded-md px-6 text-body font-medium text-foreground ' +
  'transition-[transform,filter,background-color,border-color] duration-150 ease-spring ' +
  'active:scale-97 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'disabled:pointer-events-none disabled:opacity-45 ' +
  '[&_svg]:size-[18px] [&_svg]:shrink-0';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary-grad hover:brightness-110',
  ghost: 'border border-borderStrong bg-transparent hover:bg-surface3',
  danger: 'border border-danger bg-transparent text-danger hover:bg-danger/10',
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  title?: string;
  children?: ReactNode;
  variant?: Variant;
  loading?: boolean;
  /**
   * Havolaga aylantiradi: `<Button asChild><a href="…">…</a></Button>`.
   * Sinflar bolaga o'tadi, ya'ni `<a>` ham xuddi tugmadek ko'rinadi.
   */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    title,
    children,
    variant = 'primary',
    loading = false,
    disabled = false,
    asChild = false,
    className,
    type,
    ...props
  },
  ref,
): JSX.Element {
  const classes = cn(BASE, VARIANTS[variant], className);

  /*
   * `asChild` da bola o'zi elementni chizadi — ichiga spinner qo'yib
   * bo'lmaydi (bola bitta React elementi bo'lishi shart). Havola
   * yuklanmaydi ham, shuning uchun bu cheklov emas.
   */
  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      // Formadan tashqarida `type` berilmasa brauzer `submit` deb hisoblaydi
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading}
      className={classes}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : (children ?? title)}
    </button>
  );
});
