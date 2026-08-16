import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';

import { AnimationRig, isAnimationName, type AnimationName } from './animation';
import { FpsMonitor, adjustQuality, type Quality } from './core';
import { patchShaderLogs } from './glCompat';
import {
  applyHiddenParts,
  applyMorphs,
  disposeObject,
  loadClips,
  loadModel,
  tagSlot,
} from './loader';
import { createPlaceholderAvatar } from './placeholder';

/**
 * 3D sahna (05-mobile §7).
 *
 * ⚠️ Bu kod QURILMADA SOZLANADI. Kamera burchagi, yorug'lik kuchi,
 * avatar o'lchami — hammasi haqiqiy model bilan ko'rib to'g'rilanadi.
 * Hozirgi qiymatlar boshlang'ich nuqta, o'lchov emas.
 */

/** Tana qismlari va slotlar bog'lanishi — raycast shu orqali ishlaydi. */
const BODY_SLOT: Record<string, string> = {
  body_head: 'head',
  body_torso: 'top',
  body_legs: 'bottom',
  body_foot_L: 'feet',
  body_foot_R: 'feet',
  body_hand_L: 'wrist',
  body_hand_R: 'wrist',
};

export interface AvatarConfig {
  bodyGlbUrl: string;
  morphTargets: Record<string, number>;
  faceTextureUrl: string | null;
  /** Animatsiya nomi → GLB manzili. `GET /avatar/config` qaytaradi. */
  animations?: Record<string, string>;
}

interface SceneProps {
  config: AvatarConfig;
  /** Slot → kiyim modeli. `null` — slot bo'sh. */
  equipped: Map<string, THREE.Group | null>;
  hiddenParts: string[];
  rotation: number;
  zoom: number;
  quality: Quality;
  onQualityChange: (quality: Quality) => void;
  onBodyReady: () => void;
  onError: (message: string) => void;
  /** Haqiqiy GLB o'rniga namuna avatar ishlatildi — ekran buni aytishi kerak */
  onPlaceholder: () => void;
  /** Qaysi animatsiya o'ynasin. Berilmasa `idle`. */
  animation?: AnimationName;
}

/** FPS o'lchash va sifatni tuzatish (05-mobile §7.7). */
function PerformanceWatcher({
  quality,
  onQualityChange,
}: {
  quality: Quality;
  onQualityChange: (quality: Quality) => void;
}): null {
  const monitor = useMemo(() => new FpsMonitor(60), []);
  const lastChange = useRef(0);

  useFrame((_, delta) => {
    monitor.push(delta);

    const fps = monitor.average();
    if (fps === null) return;

    const next = adjustQuality(quality, fps);
    if (next === quality) return;

    // Sifat tez-tez o'zgarmasin — kamida 10 soniya oralik
    const now = Date.now();
    if (now - lastChange.current < 10_000) return;

    lastChange.current = now;
    monitor.reset();
    onQualityChange(next);
  });

  return null;
}

function Avatar({
  config,
  equipped,
  hiddenParts,
  rotation,
  animation,
  onBodyReady,
  onError,
  onPlaceholder,
}: Omit<SceneProps, 'zoom' | 'quality' | 'onQualityChange'>): JSX.Element {
  const group = useRef<THREE.Group>(null);
  const [body, setBody] = useState<THREE.Group | null>(null);
  const rig = useRef<AnimationRig | null>(null);
  /** Namuna avatar jonli ko'rinsin — sekin nafas olish harakati */
  const breathing = useRef(false);

  // Tana bir marta yuklanadi va butun sessiya davomida qoladi
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let scene: THREE.Group;
      let isPlaceholder = false;

      try {
        scene = (await loadModel('avatar:body', config.bodyGlbUrl, 4_000_000)).scene;
      } catch (error) {
        /*
         * GLB yo'q yoki ochilmadi. Bu holda ekranni butunlay o'ldirgandan
         * ko'ra namuna shakl ko'rsatgan ma'qul: aylantirish, zoom, slot va
         * xotira mantiqi sinalaveradi.
         *
         * ⚠️ Sabab LOGGA yoziladi. Aks holda haqiqiy model yuklanmayotgani
         * "namuna avatar" belgisidan boshqa hech qanday iz qoldirmaydi va
         * tarmoq xatosini modelning yo'qligidan ajratib bo'lmaydi.
         */
        console.warn('[avatar] tana yuklanmadi, namuna ishlatiladi', config.bodyGlbUrl, error);
        if (cancelled) return;
        scene = createPlaceholderAvatar();
        isPlaceholder = true;
      }

      if (cancelled) {
        disposeObject(scene);
        return;
      }

      try {
        applyMorphs(scene, config.morphTargets);

        // Tana qismlariga slot yoziladi: bo'sh joyni bosganda qaysi
        // slot ekanini bilish uchun
        scene.traverse((child) => {
          const slot = BODY_SLOT[child.name];
          if (slot) child.userData['slot'] = slot;
        });

        /*
         * Muvaffaqiyatli yuklanganda ham yozamiz. Sababi: model yuklanib,
         * lekin EKRANDA KO'RINMASLIGI mumkin (skinning, kadr, material).
         * Log bo'lmasa "yuklanmadi" bilan "yuklandi-yu chizilmadi" ni
         * ajratib bo'lmaydi — ikkalasi ham bo'sh ekran bo'lib ko'rinadi.
         */
        let meshes = 0;
        let bones = 0;
        scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) meshes++;
          if ((child as THREE.Bone).isBone) bones++;
        });
        // `warn` — loyiha qoidasi bo'yicha `console.log` taqiqlangan
        console.warn(
          `[avatar] ${isPlaceholder ? 'NAMUNA' : 'haqiqiy model'}: ${meshes} mesh, ${bones} suyak`,
        );

        breathing.current = isPlaceholder;
        setBody(scene);
        if (isPlaceholder) onPlaceholder();
        onBodyReady();
      } catch {
        disposeObject(scene);
        onError('Avatar yuklanmadi');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [config.bodyGlbUrl, config.morphTargets, onBodyReady, onError, onPlaceholder]);

  // Morph qiymatlari o'zgarganda (o'lchamlar tahrirlangan) qayta qo'llanadi
  useEffect(() => {
    if (body) applyMorphs(body, config.morphTargets);
  }, [body, config.morphTargets]);

  useEffect(() => {
    if (body) applyHiddenParts(body, hiddenParts);
  }, [body, hiddenParts]);

  /**
   * Animatsiya kliplari — tana yuklangandan keyin, fonda.
   *
   * Klip yuklanmasa yoki skeletga mos kelmasa ekran baribir ishlaydi:
   * avatar shunchaki qimirlamaydi. Shuning uchun xato ko'rsatilmaydi,
   * faqat log'ga yoziladi — foydalanuvchi uchun bu buzilish emas.
   */
  useEffect(() => {
    const urls = config.animations;
    if (!body || !urls) return;

    let cancelled = false;
    const created = new AnimationRig(body);

    void (async () => {
      for (const [name, url] of Object.entries(urls)) {
        if (cancelled || !isAnimationName(name)) continue;

        try {
          const clips = await loadClips(url);
          const clip = clips[0];
          if (cancelled || clip === undefined) continue;

          if (!created.add(name, clip)) {
            // Eng ehtimolli sabab: suyak nomlari mos kelmayapti
            console.warn(`[animation] "${name}" skeletga mos kelmadi`);
          }
        } catch {
          console.warn(`[animation] "${name}" yuklanmadi`);
        }
      }

      if (cancelled) {
        created.dispose();
        return;
      }

      rig.current = created;
      created.play('idle');
    })();

    return () => {
      cancelled = true;
      rig.current?.dispose();
      rig.current = null;
    };
  }, [body, config.animations]);

  // Tashqaridan kelgan buyruq
  useEffect(() => {
    if (animation) rig.current?.play(animation);
  }, [animation]);

  useFrame((state, delta) => {
    if (group.current) {
      group.current.rotation.y = rotation;
      // Namunada skelet yo'q, ya'ni animatsiya ham yo'q — mayda tebranish
      // bo'lmasa shakl muzlab qolgandek ko'rinadi
      if (breathing.current) {
        group.current.position.y = Math.sin(state.clock.elapsedTime * 1.1) * 0.011;
      }
    }
    rig.current?.update(delta);
  });

  return (
    <group ref={group}>
      {body ? <primitive object={body} /> : null}
      {[...equipped.entries()].map(([slot, model]) =>
        model ? <primitive key={slot} object={model} /> : null,
      )}
    </group>
  );
}

/** Kamera zoom'ni kuzatadi — `Canvas` propslari orqali o'zgartirib bo'lmaydi. */
function CameraRig({ zoom }: { zoom: number }): null {
  const { camera } = useThree();

  useFrame(() => {
    const target = 2.6 / zoom;
    // Silliq harakat — to'g'ridan-to'g'ri qo'yilsa sakraydi
    camera.position.z += (target - camera.position.z) * 0.15;
    camera.lookAt(0, 0.9, 0);
  });

  return null;
}

export function AvatarScene(props: SceneProps): JSX.Element {
  return (
    <Canvas
      camera={{ position: [0, 0.9, 2.6], fov: 35, near: 0.1, far: 20 }}
      gl={{ antialias: props.quality !== 'low' }}
      onCreated={({ gl }) => {
        // Birinchi kadr chizilishidan oldin bo'lishi shart — shader dasturi
        // shundan keyin tuziladi
        patchShaderLogs(gl);
        gl.setClearColor('#0A0A0F');
        // Past sifatda piksel zichligi kamaytiriladi — eng arzon optimizatsiya
        gl.setPixelRatio(props.quality === 'low' ? 1 : 2);
      }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 4, 3]} intensity={1.1} />
      <directionalLight position={[-2, 2, -2]} intensity={0.4} />

      <CameraRig zoom={props.zoom} />
      <PerformanceWatcher quality={props.quality} onQualityChange={props.onQualityChange} />

      <Avatar
        config={props.config}
        equipped={props.equipped}
        hiddenParts={props.hiddenParts}
        rotation={props.rotation}
        animation={props.animation}
        onBodyReady={props.onBodyReady}
        onError={props.onError}
        onPlaceholder={props.onPlaceholder}
      />
    </Canvas>
  );
}

export { BODY_SLOT, tagSlot };
