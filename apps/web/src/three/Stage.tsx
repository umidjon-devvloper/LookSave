import { useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { cn } from '@/lib/utils';
import { applyMorphs, inflate } from '@/three/geometry';
import { dressMaterials, fabricFor } from '@/three/materials';
import type { Outfit } from '@/three/manifest';
import {
  GroundContact,
  KeyLight,
  ReflectiveFloor,
  StudioEnvironment,
  type Quality,
} from '@/three/Studio';

/**
 * Saytdagi barcha 3D bloklar shu fayldan chiqadi.
 *
 * ⚠️ HAR BIR `<Canvas>` — alohida WebGL konteksti. Brauzerlar ularni ~8-16 ta
 * bilan cheklaydi, undan keyin eng eskisi jimgina o'ladi. Shuning uchun:
 *   1) ko'rgazma bo'limlarga (Tabs) bo'lingan — bir vaqtda 3 tadan ortiq
 *      model ko'rinmaydi;
 *   2) `<ModelStage>` ekranga kirmaguncha `<Canvas>` umuman yaratilmaydi.
 *
 * Sifat ikki darajali (`Quality`):
 *   `showcase` — hero va kiyintirish bloki. Muhit 256px, aks etuvchi pol,
 *                bloom va vinyetka.
 *   `card`     — ko'rgazma kartalari. Yengilroq: polsiz, post-ishlovsiz.
 * Bitta sahifada 6 ta karta bo'lishi mumkin, ular `showcase` sifatida
 * chizilsa brauzer sekinlashadi.
 */

export type { Quality };

/** O'lchov morflari — 0…1. `mt_` prefiksi `applyMorphs` da qo'shiladi. */
export type Morphs = Partial<Record<'height' | 'weight' | 'chest' | 'waist' | 'hips', number>>;

/** Modelning o'lchamini bilmaymiz — kamerani emas, modelni "ramkaga" solamiz. */
type FitMode = 'height' | 'box';

function useFitted(
  object: THREE.Object3D,
  mode: FitMode,
  size: number,
): { scale: number; position: [number, number, number] } {
  return useMemo(() => {
    const box = new THREE.Box3().setFromObject(object);
    const extent = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(extent);
    box.getCenter(center);

    const source = mode === 'height' ? extent.y : Math.max(extent.x, extent.y, extent.z);
    const scale = size / Math.max(source, 0.001);

    return {
      scale,
      // Gorizontal bo'yicha markaz, vertikal bo'yicha poldan turadi
      position: [-center.x * scale, -box.min.y * scale, -center.z * scale],
    };
  }, [object, mode, size]);
}

/**
 * Kiyimni teridan ajratuvchi masofa, metrda.
 *
 * O'lchangan: futbolka gavdadan atigi ~7 mm kengroq, past poligonli
 * sirtlarda esa bu yetmaydi va teri "arra tishi" bo'lib chiqib turadi.
 * 6 mm — kesishishni butunlay yo'q qiladi, ayni paytda kiyim bo'rtib
 * ketmaydi (aksincha, mato tabiiyroq "turadi").
 */
const CLOTH_OFFSET = 0.006;

/** `primitive` bitta obyektni ikki joyda ko'rsata olmaydi — nusxa olamiz. */
function useModel(url: string, fabric: 'skin' | 'garment', offset = 0): THREE.Group {
  const { scene } = useGLTF(url);

  return useMemo(() => {
    /*
     * Shishirish keshdagi ASL geometriyada bajariladi (`inflateGeometry`
     * ichida takrorlanishdan himoya bor). Nusxada qilinsa har kiyim
     * ko'rinishida geometriya qaytadan hisoblanardi, va bir necha nusxa
     * bo'lganda kiyim har safar yana bir bor kengayib ketardi.
     */
    if (offset > 0) inflate(scene, offset);

    const copy = cloneSkinned(scene) as THREE.Group;
    const file = url.slice(url.lastIndexOf('/') + 1);
    dressMaterials(copy, fabric === 'skin' ? 'skin' : fabricFor(file));

    return copy;
  }, [scene, url, fabric, offset]);
}

export function GarmentModel({
  file,
  size = 1.6,
  morphs,
}: {
  file: string;
  size?: number;
  morphs?: Morphs;
}): JSX.Element {
  const object = useModel(`/models/${file}`, 'garment');
  const fit = useFitted(object, 'box', size);

  useLayoutEffect(() => {
    if (morphs) applyMorphs(object, morphs);
  }, [object, morphs]);

  return (
    <group position={fit.position} scale={fit.scale}>
      <primitive object={object} />
    </group>
  );
}

export function AvatarModel({
  bodyFile,
  outfit,
  height = 1.75,
  morphs,
}: {
  bodyFile: string;
  outfit: Outfit;
  height?: number;
  morphs?: Morphs;
}): JSX.Element {
  const body = useModel(`/models/${bodyFile}`, 'skin');
  const fit = useFitted(body, 'height', height);

  /*
   * Manifestdagi `hideBodyParts` — kiyim ostida qolib teri bilan
   * kesishadigan qismlar ro'yxati. Endi kesishish geometriya darajasida
   * hal qilingan (`CLOTH_OFFSET`), lekin ro'yxat baribir hurmat qilinadi:
   * mobil ilova bilan bitta manba, va ba'zi buyum (masalan uzun etik)
   * qismni butunlay yopib, uni chizishdan ozod qilishi mumkin.
   */
  const hidden = useMemo(() => new Set(outfit.flatMap((piece) => piece.hideBodyParts)), [outfit]);

  useLayoutEffect(() => {
    body.traverse((child) => {
      /*
       * ⚠️ FAQAT BOSHQARILADIGAN QISMLAR. Nom aynan mos kelishi kerak va
       * faqat `body_*` / `underwear_*` ga tegiladi — mobil ilovadagi
       * `applyHiddenParts` bilan bir xil qoida. Aks holda `visible` butun
       * daraxtga yoziladi va suyaklar, socket'lar ham o'chib qoladi.
       */
      if (!MANAGED_PART.test(child.name)) return;
      child.visible = !hidden.has(child.name);
    });
  }, [body, hidden]);

  useLayoutEffect(() => {
    if (morphs) applyMorphs(body, morphs);
  }, [body, morphs]);

  return (
    <group position={fit.position} scale={fit.scale}>
      <primitive object={body} />
      {outfit.map((piece) => (
        <Piece key={piece.file} file={piece.file} morphs={morphs} />
      ))}
    </group>
  );
}

/** Ko'rinishi kiyimga qarab boshqariladigan qismlar — `loader.ts` dagi bilan bir xil. */
const MANAGED_PART = /^(body_|underwear_)/;

/** Kiyim gavda bilan bir fazoda eksport qilingan — joyi o'zgartirilmaydi. */
function Piece({ file, morphs }: { file: string; morphs?: Morphs }): JSX.Element {
  const object = useModel(`/models/${file}`, 'garment', CLOTH_OFFSET);

  useLayoutEffect(() => {
    if (morphs) applyMorphs(object, morphs);
  }, [object, morphs]);

  return <primitive object={object} />;
}

/**
 * Aylanuvchi maydon — sudrab burash, inersiya va bo'sh turganda o'zi aylanish.
 *
 * NEGA `OrbitControls` EMAS: u KAMERANI aylantiradi. Kamera qimirlaganda
 * muhitdagi aks ham u bilan birga siljiydi va mato ustidagi yaltiroq
 * chiziq "muzlab" qoladi — ya'ni sirt jonsiz ko'rinadi. Modelni aylantirish
 * esa aksni sirt bo'ylab yurgizadi, aynan shu narsa materialni ko'rsatadi.
 * Ustiga, `OrbitControls` sichqonchaning butun harakatini o'ziga oladi va
 * telefonda sahifani aylantirib bo'lmay qoladi.
 */
function Turntable({
  children,
  autoRotate,
  interactive,
  initialAngle = 0,
  speed = 0.3,
}: {
  children: ReactNode;
  autoRotate: boolean;
  interactive: boolean;
  initialAngle?: number;
  speed?: number;
}): JSX.Element {
  const spin = useRef<THREE.Group>(null);
  const parallax = useRef<THREE.Group>(null);

  const gl = useThree((state) => state.gl);
  const pointer = useThree((state) => state.pointer);
  const width = useThree((state) => state.size.width);

  // `useRef` — bu qiymatlar har kadrda o'zgaradi, `useState` qayta
  // chizishga olib kelardi va 60 fps da butun daraxt qayta hisoblanardi
  const target = useRef(initialAngle);
  const current = useRef(initialAngle);
  const lean = useRef(0);
  const idleFor = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    if (!interactive) return;

    const element = gl.domElement;
    const start = { x: 0, y: 0 };

    element.style.cursor = 'grab';
    // Vertikal svayp sahifani aylantiradi, gorizontali modelni buradi
    element.style.touchAction = 'pan-y';

    const onDown = (event: PointerEvent): void => {
      dragging.current = true;
      idleFor.current = 0;
      start.x = event.clientX;
      start.y = event.clientY;
      element.setPointerCapture(event.pointerId);
      element.style.cursor = 'grabbing';
    };

    const onMove = (event: PointerEvent): void => {
      if (!dragging.current) return;

      // Burchak kanvas KENGLIGIGA nisbatan: tor kartada ham, keng
      // ekranda ham bir xil masofa bir xil burilish beradi
      target.current += ((event.clientX - start.x) / width) * Math.PI * 2.4;
      lean.current = THREE.MathUtils.clamp(
        lean.current + (event.clientY - start.y) * 0.0025,
        -0.16,
        0.16,
      );

      start.x = event.clientX;
      start.y = event.clientY;
      idleFor.current = 0;
    };

    const onUp = (event: PointerEvent): void => {
      dragging.current = false;
      element.style.cursor = 'grab';
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    };

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onUp);

    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      element.style.cursor = '';
    };
  }, [gl, interactive, width]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1);

    if (!dragging.current) idleFor.current += step;

    /*
     * O'zi aylanish sudrashdan keyin darrov qaytmaydi: odam modelni
     * ataylab burgan bo'lsa, uni zo'rlab qaytarish bezovta qiladi.
     * 1.6 soniya kutiladi, so'ng tezlik asta-sekin tiklanadi.
     */
    if (autoRotate && !dragging.current && idleFor.current > 1.6) {
      const ramp = Math.min((idleFor.current - 1.6) / 1.2, 1);
      target.current += speed * ramp * step;
    }

    // Kechikish bilan quvish — sudraganda og'irlik hissi shundan
    current.current = THREE.MathUtils.damp(current.current, target.current, 9, step);
    if (spin.current) spin.current.rotation.y = current.current;

    if (!parallax.current) return;

    /*
     * Sichqoncha ortidan mayda egilish. Burchak ataylab kichik: 3-4
     * darajadan oshsa model "suzayotgandek" bo'lib, mahsulot surati
     * emas, o'yin obyektiga o'xshab qoladi.
     */
    const wantX = dragging.current ? lean.current : lean.current + pointer.y * -0.05;
    const wantY = dragging.current ? 0 : pointer.x * 0.06;

    parallax.current.rotation.x = THREE.MathUtils.damp(parallax.current.rotation.x, wantX, 4, step);
    parallax.current.rotation.y = THREE.MathUtils.damp(parallax.current.rotation.y, wantY, 4, step);
  });

  return (
    <group ref={parallax}>
      <group ref={spin}>{children}</group>
    </group>
  );
}

/** Suspense tugaganini tashqariga aytadi — skelet o'sha payt olib tashlanadi. */
function SignalReady({ onReady }: { onReady: () => void }): null {
  useLayoutEffect(onReady, [onReady]);
  return null;
}

/** Brauzerda WebGL bormi — bir marta tekshiriladi, natija saqlanadi. */
let webglSupport: boolean | null = null;

function hasWebgl(): boolean {
  if (webglSupport !== null) return webglSupport;

  try {
    const canvas = document.createElement('canvas');
    webglSupport = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    webglSupport = false;
  }

  return webglSupport;
}

export function ModelStage({
  children,
  className,
  quality = 'card',
  cameraPosition = [0, 1.02, 4.3],
  fov = 26,
  target = [0, 0.92, 0],
  autoRotate = true,
  interactive = true,
  initialAngle = -0.3,
  floor = false,
  contactScale,
  fallback,
}: {
  children: ReactNode;
  className?: string;
  quality?: Quality;
  cameraPosition?: [number, number, number];
  /** Uzunroq linza (kichik `fov`) perspektivani yassilaydi — moda suratlarida shunday. */
  fov?: number;
  target?: [number, number, number];
  autoRotate?: boolean;
  /** `false` bo'lsa sichqoncha sahnaga tegmaydi — sahifa aylanishi buzilmaydi. */
  interactive?: boolean;
  initialAngle?: number;
  /** Aks etuvchi pol — qimmat, faqat katta bloklarda. */
  floor?: boolean;
  contactScale?: number;
  /** WebGL yo'q bo'lsa nima ko'rsatiladi. */
  fallback?: ReactNode;
}): JSX.Element {
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  const supported = hasWebgl();
  const showcase = quality === 'showcase';

  if (!supported) {
    return (
      <div className={cn('relative isolate overflow-hidden', className)}>{fallback ?? null}</div>
    );
  }

  return (
    <div className={cn('relative isolate overflow-hidden', className)}>
      <Canvas
        dpr={showcase ? [1, 2] : [1, 1.6]}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        camera={{ position: cameraPosition, fov, near: 0.4, far: 40 }}
        gl={{ antialias: !showcase, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, camera }) => {
          /*
           * ⚠️ TON XARITASI VA EKSPOZITSIYA. Ilgari bu sozlanmagan edi va
           * teri butunlay oqarib ketardi: gavdaning asosiy rangi
           * (0.7 0.56 0.45) yorug'likka ko'paytirilib 1 dan oshib ketar,
           * ekranda esa oq plastmassa chiqardi. ACES egri chizig'i yuqori
           * qiymatlarni yumshoq siqadi — teri teri bo'lib qoladi.
           */
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = showcase ? 1.15 : 1.05;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          camera.lookAt(target[0], target[1], target[2]);
        }}
      >
        <StudioEnvironment quality={quality} />
        <KeyLight quality={quality} />

        <Suspense fallback={null}>
          <Turntable
            autoRotate={autoRotate}
            interactive={interactive}
            initialAngle={initialAngle}
          >
            {children}
          </Turntable>
          <SignalReady onReady={markReady} />
        </Suspense>

        <GroundContact quality={quality} scale={contactScale ?? (floor ? 3.6 : 4.2)} />
        {floor ? <ReflectiveFloor /> : null}

        {showcase ? (
          <EffectComposer multisampling={4}>
            {/*
              Bloom faqat ENG YORQIN joylarga tegadi (`luminanceThreshold`):
              siluetdagi binafsha nur va krossovkadagi aks. Chegara
              pasaytirilsa butun sahna tumanga botadi.
            */}
            <Bloom
              mipmapBlur
              intensity={0.62}
              luminanceThreshold={0.72}
              luminanceSmoothing={0.28}
              radius={0.72}
            />
            <Vignette offset={0.26} darkness={0.42} />
          </EffectComposer>
        ) : null}
      </Canvas>

      {/* Model kelguncha — o'rnida binafsha "nafas olayotgan" dog' turadi */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-700',
          ready ? 'opacity-0' : 'opacity-100',
        )}
      >
        <div className="absolute inset-x-[22%] bottom-[12%] top-[14%] animate-breathe rounded-full bg-primary/20 blur-3xl" />
      </div>
    </div>
  );
}

/** Sahifa ochilishi bilan asosiy modellarni oldindan yuklab qo'yamiz. */
export function preloadModels(files: string[]): void {
  for (const file of files) useGLTF.preload(`/models/${file}`);
}
