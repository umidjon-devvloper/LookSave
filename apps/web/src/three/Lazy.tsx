import { lazy, Suspense, type ComponentProps } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useInView } from '@/three/useInView';

/**
 * 3D bo'limlarining kirish nuqtasi.
 *
 * Ikki qavat kechikish:
 *   1) `lazy` — `three` bo'lagi asosiy to'plamdan ajratilgan;
 *   2) `useInView` — bo'lak faqat blok ekranga yaqinlashganda so'raladi.
 *
 * Natijada sahifaning matn qismi 3D ni umuman kutmaydi, pastdagi
 * ko'rgazma esa unga scroll qilinmaguncha tarmoqqa tegmaydi.
 */

const AvatarScene = lazy(() => import('@/three/scenes/AvatarScene'));
const GarmentScene = lazy(() => import('@/three/scenes/GarmentScene'));

type AvatarProps = ComponentProps<typeof AvatarScene>;
type GarmentProps = ComponentProps<typeof GarmentScene>;

function Placeholder({ className }: { className?: string }): JSX.Element {
  return <Skeleton className={cn('rounded-none bg-surface2/60', className)} />;
}

export function LazyAvatarScene({ className, ...props }: AvatarProps): JSX.Element {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <div ref={ref} className={cn('relative', className)}>
      {inView ? (
        <Suspense fallback={<Placeholder className="absolute inset-0 h-full w-full" />}>
          <AvatarScene {...props} className="absolute inset-0 h-full w-full" />
        </Suspense>
      ) : (
        <Placeholder className="absolute inset-0 h-full w-full" />
      )}
    </div>
  );
}

export function LazyGarmentScene({ className, ...props }: GarmentProps): JSX.Element {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <div ref={ref} className={cn('relative', className)}>
      {inView ? (
        <Suspense fallback={<Placeholder className="absolute inset-0 h-full w-full" />}>
          <GarmentScene {...props} className="absolute inset-0 h-full w-full" />
        </Suspense>
      ) : (
        <Placeholder className="absolute inset-0 h-full w-full" />
      )}
    </div>
  );
}
