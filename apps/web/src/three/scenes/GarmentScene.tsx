import { GarmentModel, ModelStage } from '@/three/Stage';

/**
 * Bitta kiyimning sahnasi — ko'rgazma kartalari uchun, `React.lazy` bilan.
 *
 * `quality="card"`: sahifada bir vaqtda oltitagacha shunday blok bo'ladi,
 * shuning uchun aks etuvchi pol ham, post-ishlov ham yo'q. Buyum havoda
 * "suzadi" — katalogda odatiy usul, va shu bilan avatar bloklaridan
 * ko'rinishi bo'yicha ham ajralib turadi.
 */
export default function GarmentScene({
  file,
  className,
  size = 1.35,
}: {
  file: string;
  className?: string;
  size?: number;
}): JSX.Element {
  return (
    <ModelStage
      className={className}
      quality="card"
      cameraPosition={[0, 0.55, 3.5]}
      target={[0, 0.62, 0]}
      fov={30}
      contactScale={3}
      autoRotate
    >
      <GarmentModel file={file} size={size} />
    </ModelStage>
  );
}
