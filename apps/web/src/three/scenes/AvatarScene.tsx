import { AvatarModel, ModelStage, type Morphs, type Quality } from '@/three/Stage';
import type { Outfit } from '@/three/manifest';

/**
 * Avatar sahnasi — `React.lazy` uchun alohida modul.
 *
 * Bu fayl `three` va `@react-three/*` ni olib keladi (~700 KB). U asosiy
 * to'plamga tushmasligi kerak: sayt matni 3D yuklanishini kutmaydi.
 */
export default function AvatarScene({
  outfit,
  className,
  quality = 'showcase',
  cameraPosition,
  target,
  fov,
  autoRotate = true,
  floor = true,
  morphs,
}: {
  outfit: Outfit;
  className?: string;
  quality?: Quality;
  cameraPosition?: [number, number, number];
  target?: [number, number, number];
  fov?: number;
  autoRotate?: boolean;
  floor?: boolean;
  morphs?: Morphs;
}): JSX.Element {
  return (
    <ModelStage
      className={className}
      quality={quality}
      cameraPosition={cameraPosition}
      target={target}
      fov={fov}
      autoRotate={autoRotate}
      floor={floor}
      contactScale={3.2}
    >
      <AvatarModel bodyFile="male-base-v1.glb" outfit={outfit} morphs={morphs} />
    </ModelStage>
  );
}
