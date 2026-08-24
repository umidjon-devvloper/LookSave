import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';

import { AnimationRig, isAnimationName, type AnimationName } from './animation';
import { adjustQuality, type Quality } from './core';
import { mountGarment, unmountGarment } from './garment';
import { applyHiddenParts, bakeForExpoGl, disposeObject, loadClips, loadModel } from './loader';
import { createPlaceholderAvatar } from './placeholder';
import { Scene3D, type Scene3DHandle, type SceneContext } from './Scene3D';
import { fabricNormal, skinNormal } from './textures';

/**
 * Avatar sahnasi — tana, kiyimlar, yuz teksturasi, animatsiya.
 *
 * ⚠️ NEGA BU FAYL BOR (eski `AvatarScene.tsx` o'rniga).
 *
 * Oldingi versiya `@react-three/fiber` ga qurilgan edi va u BU STACKDA
 * UMUMAN CHIZMAYDI — o'lchov `Scene3D.tsx` sarlavhasida. Ya'ni ekran
 * ishlagandek ko'rinardi (xato yo'q, kadrlar sanalardi), lekin birorta
 * piksel chiqmasdi. Shu sabab `(tabs)/tryon.tsx` AI oqimiga
 * yo'naltirilgan va 1341 qator kod ilovaga umuman tushmay qolgan edi.
 *
 * Bu versiya `Scene3D` ustiga qurilgan — u xom `WebGLRenderer` bilan
 * ishlaydi va qurilmada chizadi. Butun avatar mantiqi (namuna avatar,
 * teri relyefi, yuz teksturasi, animatsiya, `hide_body_parts`) eskisidan
 * o'zgarishsiz ko'chirilgan; faqat qobiq boshqacha.
 *
 * ⚠️ KAMERA BOSHQARUVI ENDI PROP EMAS, REF. Eski versiya `rotation` va
 * `zoom` ni prop sifatida olardi va ekran har barmoq harakatida
 * `setState` chaqirardi — ya'ni butun daraxt qayta chizilardi. Endi
 * aylantirish va zoom `Scene3D` ichidagi `PanResponder` da, tugmalar
 * uchun esa `Scene3DHandle` (`rotateBy`, `zoomBy`, `reset`).
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

/** Tana GLB uchun kesh byudjeti — o'lchov emas, taxminiy yuqori chegara. */
const BODY_BYTES = 4_000_000;

/** Sifat o'zgarishi orasidagi eng kam vaqt — u tez-tez sakramasin. */
const QUALITY_COOLDOWN_MS = 10_000;

export interface AvatarConfig {
  bodyGlbUrl: string;
  morphTargets: Record<string, number>;
  /**
   * ⚠️ 3D DA ISHLATILMAYDI (D-41). Server uni `/avatar/config` da
   * qaytaraveradi, chunki AI oqimi shu maydonga tayanadi. Bu qatlam esa
   * unga tegmaydi: yuz UV joylashuvi yo'q va natija dog' bo'lardi —
   * batafsil izoh pastda, effekt o'rnida.
   */
  faceTextureUrl: string | null;
  /** Animatsiya nomi → GLB manzili. `GET /avatar/config` qaytaradi. */
  animations?: Record<string, string>;
}

export interface AvatarViewProps {
  config: AvatarConfig;
  /**
   * Slot → kiyim modeli. `null` — slot bo'sh.
   *
   * ⚠️ MODELLAR EGASI — CHAQIRUVCHI. Bu komponent ularni faqat sahnaga
   * qo'shadi va olib tashlaydi, `dispose` QILMAYDI: ekran ularni keshda
   * saqlab, qayta ishlatishi mumkin.
   */
  equipped: Map<string, THREE.Group | null>;
  hiddenParts: string[];
  quality: Quality;
  onQualityChange: (quality: Quality) => void;
  onBodyReady: () => void;
  onError: (message: string) => void;
  /** Haqiqiy GLB o'rniga namuna avatar ishlatildi — ekran buni aytishi kerak */
  onPlaceholder: () => void;
  /** Keskin gorizontal svayp — mahsulotni almashtirish. */
  onSwipe?: (direction: 1 | -1) => void;
  /**
   * O'rtacha FPS. Sifat tanlash ICHKARIDA bo'ladi — bu faqat ekranda
   * ko'rsatish uchun. Qurilmada "30 FPS dan yuqorimi" degan savolga
   * javob beradigan yagona joy (12-tz.md IP-01 qabul mezoni).
   */
  onFps?: (fps: number) => void;
  /**
   * GL holati haqidagi qator — sahna bo'sh bo'lganda sababni EKRANDA
   * ko'rsatish uchun.
   *
   * ⚠️ NEGA KERAK VA NEGA EKRANGA. Sahna foni ilova foni bilan bir xil
   * rang, shuning uchun «GL chizmayapti» va «chizyapti-yu obyekt yo'q»
   * ekranda BIR XIL ko'rinadi. Ularni faqat raqamlar ajratadi:
   *
   *   bufer 0×0        → View balandligi nol, GLView'ga joy yo'q
   *   chaqiruv 0        → three hech narsa chizmayapti (obyekt frustumdan
   *                       tashqarida, ko'rinmas qilingan yoki kamera buzuq)
   *   chaqiruv > 0      → chizilyapti; ekran bo'sh bo'lsa muammo GL
   *                       sirtini ekranga ulashda, three'dan TASHQARIDA
   *
   * Bu chaqiruv UMUMAN bo'lmasligi ham javob: `onReady` ishlamagan,
   * ya'ni GL konteksti yaratilmagan.
   */
  onDiagnostics?: (info: string) => void;
  /** Qaysi animatsiya o'ynasin. Berilmasa `idle`. */
  animation?: AnimationName;
  children?: ReactNode;
}

/** Sahnadagi jonli holat — React holatidan alohida yashaydi. */
interface World {
  context: SceneContext;
  /** Aylanadigan ildiz — tana ham, kiyimlar ham shu ichida */
  root: THREE.Group;
  body: THREE.Group;
  isPlaceholder: boolean;
}

export const AvatarView = forwardRef<Scene3DHandle, AvatarViewProps>(function AvatarView(
  {
    config,
    equipped,
    hiddenParts,
    quality,
    onQualityChange,
    onBodyReady,
    onError,
    onPlaceholder,
    onSwipe,
    onFps,
    onDiagnostics,
    animation,
    children,
  },
  ref,
) {
  const world = useRef<World | null>(null);
  const rig = useRef<AnimationRig | null>(null);
  /** Sahnaga qo'yilgan kiyimlar — `equipped` bilan solishtirish uchun */
  const mounted = useRef(new Map<string, THREE.Group>());
  const [ready, setReady] = useState(false);

  /*
   * ⚠️ CHAQIRUVLAR REF ORQALI. Ular effekt bog'liqliklarida bo'lsa
   * CHEKSIZ HALQA hosil bo'ladi: ekran ularni inline funksiya sifatida
   * beradi, har renderda yangi funksiya yaratiladi, effekt qayta ishga
   * tushadi, model qaytadan yuklanadi, `setState` chaqiriladi — aylana
   * yopiladi. Belgisi: logda "[avatar] haqiqiy model" o'nlab marta
   * takrorlanadi va birorta kadr chizilmaydi.
   */
  const callbacks = useRef({
    onBodyReady,
    onError,
    onPlaceholder,
    onQualityChange,
    onFps,
    onDiagnostics,
  });
  callbacks.current = {
    onBodyReady,
    onError,
    onPlaceholder,
    onQualityChange,
    onFps,
    onDiagnostics,
  };

  /*
   * `config` ham ref orqali: `onReady` BARQAROR bo'lishi kerak, aks holda
   * `Scene3D` GL kontekstini qayta qurishga urinadi. Tana manzili
   * o'zgarganda qayta yuklash pastdagi alohida effektda.
   */
  const configRef = useRef(config);
  configRef.current = config;

  // ── Sahna qurilishi ────────────────────────────────────────────────────
  const onReady = useCallback(async (context: SceneContext) => {
    const current = configRef.current;
    let scene: THREE.Group;
    let isPlaceholder = false;

    try {
      scene = (await loadModel('avatar:body', current.bodyGlbUrl, BODY_BYTES)).scene;
    } catch (error) {
      /*
       * GLB yo'q yoki ochilmadi. Ekranni butunlay o'ldirgandan ko'ra
       * namuna shakl ko'rsatgan ma'qul: aylantirish, zoom, slot va xotira
       * mantiqi sinalaveradi.
       *
       * ⚠️ Sabab LOGGA yoziladi — aks holda haqiqiy model yuklanmayotgani
       * "namuna avatar" belgisidan boshqa iz qoldirmaydi va tarmoq
       * xatosini modelning yo'qligidan ajratib bo'lmaydi.
       */
      console.warn('[avatar] tana yuklanmadi, namuna ishlatiladi', current.bodyGlbUrl, error);
      scene = createPlaceholderAvatar();
      isPlaceholder = true;
    }

    try {
      /*
       * Shape key va skinning vertekslarga singdiriladi — `expo-gl` da
       * float tekstura yo'q va skinned mesh chizilmaydi (izohi
       * `loader.ts` da). Shundan keyin `applyMorphs` kerak emas.
       */
      bakeForExpoGl(scene, current.morphTargets);

      let meshes = 0;
      let bones = 0;
      scene.traverse((child) => {
        // Tana qismiga slot yoziladi: bo'sh joyni bosganda qaysi slot
        // ekanini bilish uchun
        const slot = BODY_SLOT[child.name];
        if (slot) child.userData['slot'] = slot;

        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          meshes++;
          /*
           * ⚠️ `frustumCulled = false` — SKINNED MESH UCHUN SHART.
           * three chegara sferasini geometriyaning BIND holatidan
           * hisoblaydi va suyaklar qimirlaganda yangilamaydi. Sfera
           * noto'g'ri joyda bo'lsa mesh "kadrdan tashqarida" deb
           * hisoblanadi va umuman chizilmaydi — xato ham, ogohlantirish
           * ham bo'lmaydi, shunchaki ko'rinmaydi.
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
       * Teriga mikro-relyef. Busiz sirt mutlaqo silliq bo'ladi va
       * yorug'lik undan bir tekis qaytadi — model plastmassaga o'xshaydi.
       * Ichki kiyimga mato relyefi: u tanadan boshqa material bo'lishi
       * kerak, aks holda ikkalasi bir xil sirt bo'lib ko'rinadi.
       */
      if (!isPlaceholder) {
        scene.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;

          const isUnderwear = mesh.name.startsWith('underwear_');
          const material = (mesh.material as THREE.MeshStandardMaterial).clone();
          material.normalMap = isUnderwear ? fabricNormal() : skinNormal();
          material.normalScale = new THREE.Vector2(
            isUnderwear ? 0.7 : 0.35,
            isUnderwear ? 0.7 : 0.35,
          );
          material.roughness = isUnderwear ? 0.92 : 0.62;
          material.needsUpdate = true;
          mesh.material = material;
        });
      }

      const root = new THREE.Group();
      root.add(scene);
      context.scene.add(root);

      world.current = { context, root, body: scene, isPlaceholder };
      setReady(true);

      if (isPlaceholder) callbacks.current.onPlaceholder();
      callbacks.current.onBodyReady();
    } catch (error) {
      console.warn('[avatar] sahna qurilmadi', error);
      disposeObject(scene);
      callbacks.current.onError('Avatar yuklanmadi');
      return;
    }

    // Sahna yopilganda
    return () => {
      const live = world.current;
      world.current = null;
      setReady(false);

      rig.current?.dispose();
      rig.current = null;

      /*
       * Kiyimlar faqat sahnadan olinadi, `dispose` QILINMAYDI — ular
       * ekranga tegishli va u kesh bilan o'zi hisoblashadi.
       */
      for (const model of mounted.current.values()) unmountGarment(model);
      mounted.current.clear();

      if (live) {
        live.context.scene.remove(live.root);
        disposeObject(live.body);
      }
    };
  }, []);

  // ── Kiyimlarni sahnaga moslash ─────────────────────────────────────────
  useEffect(() => {
    const live = world.current;
    if (!live || !ready) return;

    // 1. Olib tashlanganlar
    for (const [slot, model] of [...mounted.current.entries()]) {
      if (equipped.get(slot) === model) continue;
      unmountGarment(model);
      mounted.current.delete(slot);
    }

    // 2. Yangilar
    for (const [slot, model] of equipped.entries()) {
      if (!model || mounted.current.get(slot) === model) continue;
      mountGarment(live.body, model);
      mounted.current.set(slot, model);
    }
    // `equipped` — `Map` va u joyida o'zgaradi, ya'ni havolasi bir xil
    // qoladi. Shuning uchun ekran uni o'zgartirgach qayta chizishga
    // majbur qiladi va bu effekt shunda ishga tushadi.
  });

  // ── Kiyim ostidagi tana qismlari ───────────────────────────────────────
  useEffect(() => {
    const live = world.current;
    if (live && ready) applyHiddenParts(live.body, hiddenParts);
  }, [hiddenParts, ready]);

  /*
   * ── YUZ TEKSTURASI OLIB TASHLANDI (D-41, 2026-08-24) ──────────────────
   *
   * Bu yerda selfi `body_head` mesh'iga `material.map` bo'lib tushardi.
   * Natija yuz emas, DOG' edi: bosh mesh'ida yuz UV joylashuvi yo'q —
   * generator butun tanaga umumiy qobiq UV'sini beradi
   * (`assets-3d/generator/lib/bodyShell.mjs`). To'rtburchak surat shu
   * UV bo'ylab cho'ziladi va odam qiyofasi umuman chiqmaydi.
   *
   * Kod ishlagandek ko'rinardi — xato yo'q, tekstura yuklanardi — lekin
   * ko'rinishi buzuq edi. Va 3D ekran qaytarilgach (IP-01) bu jonli
   * muammoga aylandi.
   *
   * ⚠️ QAYTARISH UCHUN NIMA KERAK (12-tz.md D-41, B/C variantlari):
   *   1. Boshda HAQIQIY yuz UV joylashuvi — Blender'da qo'lda yasaladi,
   *      protsedural qobiq bunga yaramaydi
   *   2. Suratni o'sha UV ga moslash: yuz nuqtalarini aniqlash
   *      (MediaPipe / ARKit) va proyeksiya bilan tekstura pishirish.
   *      Xom selfini qo'yish yetarli emas
   *   3. Model yuz UV'siga ega ekanini BILDIRISHI kerak — aks holda
   *      eski modelda yana dog' chiqadi. Ya'ni `/avatar/config` ga
   *      bayroq qo'shiladi, kod esa unga qarab qaror qiladi
   *
   * ⚠️ SAQLANGAN BILIM: teksturada `flipY = false` SHART bo'lgan. glTF
   * UV koordinatalari yuqoridan pastga hisoblanadi, three esa sukut
   * bo'yicha rasmni ag'daradi — ag'darilsa yuz teskari tushadi va buni
   * faqat ko'z bilan sezish mumkin. Bu qator o'chirilgan
   * `loadFaceTexture` da bor edi; qayta yozilganda takrorlanmasin.
   *
   * Foydalanuvchi yuzi HOZIR HAM ISHLATILADI — lekin AI oqimida
   * (`api/src/tryon/avatar.ts` → `face_reference`), 3D da emas. Q-1
   * qarori bo'yicha 3D ning vazifasi tez svayp va o'lcham, fotorealistik
   * yuz emas (K-09 ham «uncanny valley» dan ogohlantiradi).
   */

  // ── Animatsiya kliplari ────────────────────────────────────────────────
  /*
   * Klip yuklanmasa yoki skeletga mos kelmasa ekran baribir ishlaydi:
   * avatar shunchaki qimirlamaydi. Shuning uchun xato ko'rsatilmaydi.
   */
  useEffect(() => {
    const urls = config.animations;
    const live = world.current;
    if (!live || !ready || !urls) return;

    let cancelled = false;
    const created = new AnimationRig(live.body);

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
  }, [config.animations, ready]);

  // Tashqaridan kelgan buyruq
  useEffect(() => {
    if (animation) rig.current?.play(animation);
  }, [animation]);

  // ── Kadr ───────────────────────────────────────────────────────────────
  const frames = useRef(0);

  const onFrame = useCallback((delta: number, context: SceneContext) => {
    rig.current?.update(delta);

    /*
     * Har 60-kadrda tashxis. Har kadrda hisoblash `renderer.info` ni
     * o'qishni talab qiladi va bu bepul emas; sekundda bir marta yetarli.
     */
    frames.current += 1;
    if (frames.current % 60 === 0) {
      const info = context.renderer.info.render;
      const size = context.size;
      const children = context.scene.children.length;
      callbacks.current.onDiagnostics?.(
        `bufer ${size.width}×${size.height} · chaqiruv ${info.calls} · uch ${info.triangles} · bola ${children}`,
      );
    }

    /*
     * Namunada skelet yo'q, ya'ni animatsiya ham yo'q — mayda tebranish
     * bo'lmasa shakl muzlab qolgandek ko'rinadi.
     */
    const live = world.current;
    if (live?.isPlaceholder) {
      live.root.position.y = Math.sin(Date.now() / 900) * 0.011;
    }
  }, []);

  // ── FPS → sifat ────────────────────────────────────────────────────────
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const lastQualityChange = useRef(0);

  const handleFps = useCallback((fps: number) => {
    callbacks.current.onFps?.(fps);

    const next = adjustQuality(qualityRef.current, fps);
    if (next === qualityRef.current) return;

    // Sifat tez-tez o'zgarmasin — kamida 10 soniya oralik
    const now = Date.now();
    if (now - lastQualityChange.current < QUALITY_COOLDOWN_MS) return;

    lastQualityChange.current = now;
    callbacks.current.onQualityChange(next);
  }, []);

  const handleError = useCallback((error: Error) => {
    console.warn('[avatar] sahna xatosi', error);
    callbacks.current.onError(error.message);
  }, []);

  return (
    <Scene3D
      ref={ref}
      onReady={onReady}
      onFrame={onFrame}
      onFps={handleFps}
      onError={handleError}
      onSwipe={onSwipe}
    >
      {children}
    </Scene3D>
  );
});

export { BODY_SLOT };
