import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';
import { Vector2 } from 'three';

import { AnimationRig, isAnimationName, type AnimationName } from './animation';
import { FpsMonitor, adjustQuality, type Quality } from './core';
import { patchShaderLogs } from './glCompat';
import {
  applyHiddenParts,
  disposeObject,
  bakeForExpoGl,
  loadClips,
  loadFaceTexture,
  loadModel,
  tagSlot,
} from './loader';
import { createPlaceholderAvatar } from './placeholder';
import { fabricNormal, skinNormal } from './textures';

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
  /**
   * GL holati haqidagi qator.
   *
   * ⚠️ NEGA EKRANGA: loglar ishlab chiquvchining terminalida qoladi va
   * ular har doim ham qo'lда bo'lmaydi. Sahna bo'sh bo'lsa esa ekranda
   * hech qanday belgi qolmaydi — "chizmayapti" va "chizyapti-yu bo'sh"
   * bir xil ko'rinadi. Shuning uchun holat ekranga chiqariladi.
   *
   * Bu chaqiruv UMUMAN BO'LMASLIGI ham javob: demak `onCreated` ishlamagan,
   * ya'ni GL konteksti yaratilmagan.
   */
  onDiagnostics?: (info: string) => void;
  /** Qaysi animatsiya o'ynasin. Berilmasa `idle`. */
  animation?: AnimationName;
}

/**
 * Sahnani chizadi va nechta kadr chizilganini hisoblaydi.
 *
 * ⚠️ `endFrameEXP()` BU YERDA CHAQIRILMAYDI — uni `@react-three/fiber/native`
 * o'zi qiladi: u `gl.render` ni o'rab, har chaqiruvdan keyin kadrni
 * displeyga uzatadi. Qo'shimcha chaqiruv kadrni ikki marta yuborardi.
 *
 * `useFrame` ga 1 berilgani ham ataylab: shunda fiber avtomatik chizishni
 * to'xtatadi va boshqaruv shu yerga o'tadi — aks holda sahna ikki marta
 * chizilardi.
 *
 * KADR SANOG'I nima uchun kerak: kontekst sog'lom, model yuklangan, lekin
 * ekran bo'sh — bunda ikki xil sabab bo'lishi mumkin va ular butunlay
 * boshqa yechim talab qiladi. Sanoq nolda qolsa render tsikli umuman
 * ishlamayapti; o'ssa — chizilyapti, lekin ko'rinmayapti.
 */
function Presenter({ onFrames }: { onFrames: (info: string) => void }): null {
  const frames = useRef(0);
  const pixel = useRef(new Uint8Array(4));

  useFrame(({ gl, scene, camera }) => {
    gl.render(scene, camera);
    frames.current += 1;

    if (frames.current % 60 !== 0) return;

    /*
     * CHIZILGAN KADRDAN PIKSEL O'QIYMIZ.
     *
     * ⚠️ NEGA: "sahna chizilyaptimi" degan savolga ekranga qarab javob
     * berib bo'lmaydi — surat displeyga uzatilmasa, ekran ikkala holatda
     * ham bo'sh ko'rinadi. `readPixels` esa BUFERNING o'zidan o'qiydi,
     * ya'ni chizishni ko'rsatishdan ajratadi.
     *
     * Markazdagi piksel — u yerda sinov kubi turibdi (kamera aynan unga
     * qaraydi). Qizil chiqsa: GL to'g'ri chizyapti, muammo faqat ekranga
     * uzatishda. Fon rangi chiqsa: chizyapti, lekin kub kadrda yo'q.
     *
     * ⚠️ NATIJA EKRANGA CHIQARILADI, LOGGA EMAS. `expo-gl` har kadrda
     * "pixelStorei doesn't support this parameter" deb yozadi — bir necha
     * daqiqada 300 mingdan ortiq qator. Bu oqim log kanalini bo'g'ib
     * qo'yadi va oradagi bitta muhim qator yo'qoladi.
     */
    const context = gl.getContext();
    const width = (context as WebGLRenderingContext).drawingBufferWidth;
    const height = (context as WebGLRenderingContext).drawingBufferHeight;

    let rgb = 'o`qib bo`lmadi';
    try {
      context.readPixels(
        Math.floor(width / 2),
        Math.floor(height / 2),
        1,
        1,
        context.RGBA,
        context.UNSIGNED_BYTE,
        pixel.current,
      );
      const [r, g, b] = pixel.current;
      rgb = `rgb(${r}, ${g}, ${b})`;
    } catch {
      /* readPixels ba'zi qurilmalarda yo'q — qolgan tashxis baribir kerak */
    }

    /*
     * ⚠️ ENG MUHIM RAQAM — `calls`, ya'ni shu kadrda GPU'ga yuborilgan
     * chizish buyruqlari soni. U "ekran bo'sh" ning ikki butunlay boshqa
     * sababini ajratadi va buni boshqa hech narsa qila olmaydi:
     *
     *   calls = 0  → three.js hech narsa chizmayapti. Demak obyektlar
     *                frustumdan tashqarida, ko'rinmas qilingan yoki
     *                kamera matritsasi buzilgan. Muammo SAHNADA.
     *   calls > 0  → chizilyapti va bufer to'ldirilyapti. Agar shunda ham
     *                ekran bo'sh bo'lsa — muammo GL sirtini ekranga
     *                ulashda, ya'ni three.js dan TASHQARIDA.
     *
     * Bu ikkisi bir xil ko'rinadi, lekin yechimlari umuman boshqa. Shuning
     * uchun raqam ekranga chiqariladi: log kanali ishonchsiz — telefon
     * Metro'dan uzilsa loglar butunlay yo'qoladi, ekran esa qoladi.
     */
    const info = gl.info.render;
    onFrames(`kadr ${frames.current} · ${rgb} · chaqiruv ${info.calls} · uch ${info.triangles}`);

    /*
     * TO'LIQ TASHXIS — har 300-kadrda (~5 soniya).
     *
     * ⚠️ NEGA BIR MARTA EMAS: `frames` — `useRef`, va Fast Refresh uni
     * SAQLAB QOLADI. Shart `=== 120` bo'lganda sanoq allaqachon o'sha
     * chegaradan o'tib ketgan bo'ladi va tahrir qurilmaga yetsa ham qator
     * umuman chiqmaydi. Bu bir marta chalg'itdi: kod to'g'ri, log jim.
     *
     * NEGA SHU RAQAMLAR: "ekran bo'sh" bir nechta butunlay boshqa sababdan
     * kelib chiqishi mumkin va ular tashqaridan bir xil ko'rinadi:
     *
     *   calls = 0      → chizish buyrug'i umuman yuborilmayapti (hammasi
     *                    frustumdan tashqarida yoki ko'rinmas holatda)
     *   calls > 0, lekin
     *   piksel = fon   → chiziyapti, ammo kameraga tushmayapti
     *   position NaN   → kamera matritsasi buzilgan, hech narsa proyeksiya
     *                    qilinmaydi
     *
     * Bu farqni faqat shu raqamlar ko'rsatadi — ekranga qarab bo'lmaydi.
     */
    if (frames.current % 300 === 0) {
      const position = camera.position;
      const nan = [position.x, position.y, position.z].some((value) => !Number.isFinite(value));

      console.warn(
        `[TASHXIS] chaqiruv=${info.calls} uchburchak=${info.triangles} ` +
          `piksel=${rgb} kamera=(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ` +
          `${position.z.toFixed(2)})${nan ? ' ⚠️NaN' : ''} ` +
          `bufer=${width}×${height} bola=${scene.children.length}`,
      );
    }
  }, 1);

  return null;
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

  /*
   * ⚠️ CHAQIRUVLAR REF ORQALI. Ular effekt bog'liqliklarida bo'lsa
   * CHEKSIZ HALQA hosil bo'ladi: ekran ularni inline funksiya sifatida
   * beradi (`onBodyReady={() => setBodyReady(true)}`), har renderda yangi
   * funksiya yaratiladi, effekt qayta ishga tushadi, model qaytadan
   * yuklanadi, `setState` chaqiriladi — va aylana yopiladi.
   *
   * Buning belgisi: logda `[avatar] haqiqiy model` o'nlab marta takrorlanadi
   * va birorta kadr chizilmaydi, chunki sahna hech qachon barqarorlashmaydi.
   * Tashqaridan bu "3D umuman ishlamayapti" bo'lib ko'rinadi.
   *
   * Ref bilan chaqiruvlar har renderda yangilanadi, lekin effekt faqat
   * MODEL MANZILI o'zgarganda qayta ishga tushadi.
   */
  const callbacks = useRef({ onBodyReady, onError, onPlaceholder });
  callbacks.current = { onBodyReady, onError, onPlaceholder };

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
        /*
         * Shape key va skinning vertekslarga singdiriladi — `expo-gl` da
         * float tekstura yo'q va skinned mesh chizilmaydi (izohi
         * `loader.ts` da). Shundan keyin `applyMorphs` kerak emas: qiymatlar
         * allaqachon geometriyaga yozilgan.
         */
        bakeForExpoGl(scene, config.morphTargets);

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
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            meshes++;
            /*
             * ⚠️ `frustumCulled = false` — SKINNED MESH UCHUN SHART.
             *
             * three chegara sferasini geometriyaning BIND holatidan
             * hisoblaydi va suyaklar qimirlaganda uni yangilamaydi. Sfera
             * noto'g'ri joyda bo'lsa mesh "kadrdan tashqarida" deb
             * hisoblanadi va umuman chizilmaydi — xato ham, ogohlantirish
             * ham bo'lmaydi, shunchaki ko'rinmaydi.
             *
             * Avatar doim kadr markazida turadi, shuning uchun culling'dan
             * foyda yo'q: u faqat bitta obyektni tekshiradi va uni ba'zan
             * noto'g'ri yashiradi.
             */
            mesh.frustumCulled = false;
          }
          if ((child as THREE.Bone).isBone) bones++;
        });
        // `warn` — loyiha qoidasi bo'yicha `console.log` taqiqlangan
        console.warn(
          `[avatar] ${isPlaceholder ? 'NAMUNA' : 'haqiqiy model'}: ${meshes} mesh, ${bones} suyak`,
        );

        /*
         * Teriga mikro-relyef. Bu bo'lmasa sirt mutlaqo silliq bo'ladi va
         * yorug'lik undan bir tekis qaytadi — model plastmassaga o'xshaydi.
         *
         * Ichki kiyimga mato relyefi beriladi: u tanadan boshqa material
         * bo'lishi kerak, aks holda bir xil sirt bo'lib ko'rinadi.
         */
        if (!isPlaceholder) {
          scene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;

            const isUnderwear = mesh.name.startsWith('underwear_');
            const material = (mesh.material as THREE.MeshStandardMaterial).clone();
            material.normalMap = isUnderwear ? fabricNormal() : skinNormal();
            material.normalScale = new Vector2(isUnderwear ? 0.7 : 0.35, isUnderwear ? 0.7 : 0.35);
            material.roughness = isUnderwear ? 0.92 : 0.62;
            material.needsUpdate = true;
            mesh.material = material;
          });
        }

        breathing.current = isPlaceholder;
        setBody(scene);
        if (isPlaceholder) callbacks.current.onPlaceholder();
        callbacks.current.onBodyReady();
      } catch {
        disposeObject(scene);
        callbacks.current.onError('Avatar yuklanmadi');
      }
    })();

    return () => {
      cancelled = true;
    };
    // Faqat manzil — qolgani ref orqali (yuqoridagi izohga qarang).
    // `morphTargets` ham bu yerda emas: uni alohida effekt qo'llaydi.
  }, [config.bodyGlbUrl]);

  /**
   * Yuz teksturasi — skanerdan kelgan surat boshga tushadi.
   *
   * Tana yuklangandan KEYIN va alohida effektda: surat o'zgarganda butun
   * modelni qayta yuklash shart emas.
   *
   * Xato bo'lsa avatar neytral yuz bilan qolaveradi — bu buzilish emas,
   * shuning uchun foydalanuvchiga ko'rsatilmaydi, faqat logga yoziladi.
   */
  useEffect(() => {
    const url = config.faceTextureUrl;
    if (!body || !url) return;

    let cancelled = false;
    let texture: THREE.Texture | null = null;

    void (async () => {
      try {
        texture = await loadFaceTexture(url);
        if (cancelled) {
          texture.dispose();
          return;
        }

        body.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.name !== 'body_head' || !mesh.isMesh) return;

          // Material qismlar orasida umumiy — nusxa olamiz, aks holda yuz
          // teksturasi butun tanaga yopishadi
          const material = (mesh.material as THREE.MeshStandardMaterial).clone();
          material.map = texture;
          material.needsUpdate = true;
          mesh.material = material;
        });
      } catch (error) {
        console.warn('[avatar] yuz teksturasi yuklanmadi', error);
      }
    })();

    return () => {
      cancelled = true;
      texture?.dispose();
    };
  }, [body, config.faceTextureUrl]);

  /*
   * ⚠️ O'lchamlar o'zgarganda model QAYTA YUKLANADI, joyida o'zgartirilmaydi.
   * Sabab: shape key'lar yuklashda vertekslarga singdirilgan va endi
   * geometriyada mavjud emas. Bu kamdan-kam sodir bo'ladi (foydalanuvchi
   * o'lchamini tahrirlaganda), shuning uchun qayta yuklash maqbul.
   */

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

        /*
         * GL holati logga yoziladi.
         *
         * ⚠️ NEGA KERAK: sahna foni ilova foni bilan bir xil rang, shuning
         * uchun "GL chizmayapti" va "chizyapti-yu obyekt yo'q" ekranда bir
         * xil ko'rinadi. Bu raqamlarsiz ikkalasini ajratib bo'lmaydi —
         * bir necha kun geometriyani tuzatib yurishga sabab bo'lgan edi.
         */
        /*
         * ⚠️ `gl.getSize()` ISHLATILMAYDI: u argument sifatida `Vector2`
         * kutadi va uning `.set()` metodini chaqiradi. Bu fayl `three` ni
         * faqat TIP sifatida import qiladi (`import type`), shuning uchun
         * bu yerda haqiqiy `Vector2` yasab bo'lmaydi — oddiy obyekt berilsa
         * ilova "target.set is not a function" bilan butunlay qulaydi.
         *
         * Chizish buferi o'lchami kontekstning o'zida bor va u aynan
         * kerakli raqam: kanvas nol bo'lsa shu ham nol bo'ladi.
         */
        const context = gl.getContext() as WebGLRenderingContext & {
          drawingBufferWidth: number;
          drawingBufferHeight: number;
          texStorage2D?: unknown;
        };
        const info =
          `bufer ${context.drawingBufferWidth}×${context.drawingBufferHeight} · ` +
          `WebGL2 ${typeof context.texStorage2D === 'function' ? 'ha' : 'yo`q'} · ` +
          `ratio ${gl.getPixelRatio()}`;

        console.warn(`[gl] ${info}`);
        props.onDiagnostics?.(info);
        // Past sifatda piksel zichligi kamaytiriladi — eng arzon optimizatsiya
        gl.setPixelRatio(props.quality === 'low' ? 1 : 2);
      }}
    >
      {/*
        Studiya yorug'ligi — uch nuqtali sxema.

        NEGA O'ZGARTIRILDI: ilgari `ambientLight` 0.7 edi. Ambient hamma
        tomondan bir xil yoritadi, ya'ni soya hosil qilmaydi — natijada
        hajm yo'qoladi va model yassi, plastmassa bo'lib ko'rinadi. Uni
        pasaytirib, o'rniga yo'nalishli chiroqlar kuchaytirildi.

        ⚠️ ORQA CHIROQ (rim) ENG MUHIMI. Fon qora, maneken ham to'q rangda —
        ularsiz siluet fonga singib ketadi. Orqadan tushgan yorug'lik
        gavdaning chekkasida yorug' chiziq hosil qiladi va figurani fondan
        ajratadi. Bu portret suratkashligining asosiy usuli.
      */}
      <ambientLight intensity={0.25} />

      {/* Asosiy — old chapdan, biroz iliq */}
      <directionalLight position={[2.5, 3.5, 3]} intensity={2.2} color="#FFF4E8" />

      {/* To'ldiruvchi — o'ngdan, sovuqroq va zaif: soyani yumshatadi,
          lekin hajmni yo'qotmaydi */}
      <directionalLight position={[-3, 1.5, 2]} intensity={0.7} color="#DCE4FF" />

      {/* Orqa (rim) — siluetni fondan ajratadi */}
      <directionalLight position={[-1.5, 2.5, -3.5]} intensity={1.8} color="#C7B4FF" />

      {/* Pastdan zaif qaytish — iyak va son ostidagi qoraliklarni ochadi */}
      <hemisphereLight args={['#2A2438', '#0A0A0F', 0.4]} />

      <Presenter onFrames={(info) => props.onDiagnostics?.(info)} />

      {/*
        ⏳ VAQTINCHALIK SINOV KUBI — qatlamlarni ajratish uchun.

        `meshBasicMaterial` YORUG'LIKKA BOG'LIQ EMAS. Tana esa
        `MeshStandardMaterial` bilan chiziladi va u yorug'liksiz QOP-QORA
        bo'ladi — qora fonda bu "umuman chizilmayapti" dan farq qilmaydi.

        Kub ko'rinsa: Canvas, GL, kamera va render tsikli — hammasi ishlayapti,
        muammo modelda yoki yorug'likda.
        Kub ko'rinmasa: muammo undan pastda — Canvas umuman chizmayapti.
      */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshBasicMaterial color="#FF3B30" />
      </mesh>
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
