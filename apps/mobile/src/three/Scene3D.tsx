import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as THREE from 'three';

import { FpsMonitor } from './core';

/**
 * three.js sahnasi uchun qobiq (spetsifikatsiya §4.2, §4.4, §4.5).
 *
 * ⚠️ NEGA `react-three-fiber` EMAS — bu eng muhim izoh.
 *
 * Spetsifikatsiya §4.1 `@react-three/fiber` ni talab qiladi va oldingi 3D
 * kodi ham shunga qurilgan edi. Lekin u BU STACKDA UMUMAN CHIZMAYDI. To'liq
 * qayta ishga tushirish bilan o'lchandi:
 *
 *     xom expo-gl (faqat `clear`)          → chizdi
 *     three.js, r3f siz                    → chizdi
 *     three.js + react-three-fiber         → 0/8 ishga tushirish, qora ekran
 *
 * r3f ning `Canvas` i kontekstni to'g'ri oladi (bufer o'lchami to'g'ri
 * qaytadi) va `endFrameEXP` ni ham chaqiradi — shunga qaramay birorta piksel
 * chiqmaydi. Aynan shu sabab "3D ishlamayapti" muammosini uzoq vaqt
 * chalg'itgan: xato yo'q, log toza, kadrlar sanaladi, ekran esa qora.
 *
 * Shuning uchun bu yerda `WebGLRenderer` to'g'ridan-to'g'ri boshqariladi.
 * Spetsifikatsiyaning qolgan hamma qarorlari (kamera, yoritish, boshqaruv
 * chegaralari) o'zgarishsiz bajarilgan — faqat qobiq boshqacha.
 *
 * ⚠️ SIMULYATORDA BEQAROR. O'sha o'lchovda simulyator 10 ta ishga
 * tushirishning 4 tasida chizdi, haqiqiy qurilmada esa barqaror ishladi.
 * Simulyator OpenGL ni Metal ustida taqlid qiladi. Qora ekran ko'rsangiz —
 * avval qurilmada tekshiring, kodni tuzatishga oshiqmang.
 */

/** Kamera boshlang'ich holati (§4.2 va §4.5). */
const START_RADIUS = 2.6;
const START_PHI = Math.PI / 2.1;
const START_THETA = 0;

/** Boshqaruv chegaralari (§4.5) — bulardan tashqarida sahna buziladi. */
const MIN_RADIUS = 1.6;
const MAX_RADIUS = 4.0;
const MIN_PHI = 0.6;
const MAX_PHI = 2.2;

/** Kamera qaraydigan nuqta — ko'krak balandligi, bosh emas. */
const TARGET = new THREE.Vector3(0, 1.0, 0);

/*
 * Barmoq harakatini burchakka aylantirish koeffitsientlari.
 * Ekran bo'ylab to'liq surish ≈ 180° aylanish beradi — maketdagi
 * "aylantirib ko'rish" hissi uchun shu qulay chiqdi.
 */
const ROTATE_SPEED = 0.008;
const TILT_SPEED = 0.005;

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** Kadr buferi o'lchami — 2D overlay proyeksiyasi uchun (§4.6). */
  size: { width: number; height: number };
}

export interface Scene3DHandle {
  /** Kamerani boshlang'ich holatga qaytaradi (§4.5 dagi Reset). */
  reset(): void;
}

export interface Scene3DProps {
  /**
   * Sahna tayyor bo'lganda bir marta chaqiriladi. Model shu yerda
   * qo'shiladi. Qaytarilgan funksiya sahna yopilganda bajariladi.
   */
  onReady: (context: SceneContext) => void | (() => void) | Promise<void | (() => void)>;
  /** Har kadrda — animatsiya va overlay yangilash uchun. */
  onFrame?: (delta: number, context: SceneContext) => void;
  /** O'rtacha FPS (60 kadr oynasi). Sifatni pasaytirish qaroriga asos. */
  onFps?: (fps: number) => void;
  onError?: (error: Error) => void;
  style?: StyleProp<ViewStyle>;
  /** Sahna ustidagi qatlam — tugmalar, o'lchovlar. */
  children?: ReactNode;
}

export const Scene3D = forwardRef<Scene3DHandle, Scene3DProps>(function Scene3D(
  { onReady, onFrame, onFps, onError, style, children },
  ref,
) {
  /*
   * Kamera holati sferik koordinatada saqlanadi (§4.5). `useRef` — chunki
   * u har kadrda o'qiladi va barmoq harakatida o'zgaradi; `useState`
   * bo'lsa har surishda butun daraxt qayta chizilardi.
   */
  /*
   * Sahna resurslarini bo'shatish. `expo-gl` kontekst yopilganini bildirmaydi,
   * shuning uchun uni React tomondan — komponent o'chganda — bajaramiz.
   */
  const cleanupRef = useRef<(() => void) | null>(null);

  const spherical = useRef(new THREE.Spherical(START_RADIUS, START_PHI, START_THETA));
  const gestureStart = useRef({ theta: START_THETA, phi: START_PHI, radius: START_RADIUS });
  const pinchStart = useRef<{ distance: number; radius: number } | null>(null);

  const reset = useCallback(() => {
    spherical.current.set(START_RADIUS, START_PHI, START_THETA);
  }, []);

  useImperativeHandle(ref, () => ({ reset }), [reset]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        /*
         * ⚠️ `react-native-gesture-handler` EMAS. Spetsifikatsiya §4.5 uni
         * tavsiya qiladi, lekin u butun daraxtni `GestureHandlerRootView`
         * bilan o'rashni talab qiladi. `PanResponder` React Native ichida
         * va bu ikki ishorani (surish, chimdish) to'liq qoplaydi.
         */
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: () => {
          gestureStart.current = {
            theta: spherical.current.theta,
            phi: spherical.current.phi,
            radius: spherical.current.radius,
          };
          pinchStart.current = null;
        },

        onPanResponderMove: (event: GestureResponderEvent, gesture) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            // Ikki barmoq — zoom (§4.5: Pinch → radius)
            const a = touches[0];
            const b = touches[1];
            if (!a || !b) return;

            const distance = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            if (distance <= 0) return;

            if (pinchStart.current === null) {
              pinchStart.current = { distance, radius: spherical.current.radius };
              return;
            }

            // Barmoqlar uzoqlashsa masofa kattalashadi, kamera esa yaqinlashadi
            const next = (pinchStart.current.radius * pinchStart.current.distance) / distance;
            spherical.current.radius = THREE.MathUtils.clamp(next, MIN_RADIUS, MAX_RADIUS);
            return;
          }

          /*
           * Bir barmoq — aylantirish. Chimdishdan keyin barmoq bittaga
           * tushsa, aylanish sakrab ketmasligi uchun boshlang'ich qayta
           * olinadi.
           */
          if (pinchStart.current !== null) {
            pinchStart.current = null;
            gestureStart.current = {
              theta: spherical.current.theta,
              phi: spherical.current.phi,
              radius: spherical.current.radius,
            };
            return;
          }

          spherical.current.theta = gestureStart.current.theta - gesture.dx * ROTATE_SPEED;
          spherical.current.phi = THREE.MathUtils.clamp(
            gestureStart.current.phi + gesture.dy * TILT_SPEED,
            MIN_PHI,
            MAX_PHI,
          );
        },

        onPanResponderRelease: () => {
          pinchStart.current = null;
        },
      }),
    [],
  );

  const onContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      let disposed = false;
      let frame = 0;
      let cleanup: (() => void) | void;

      try {
        const width = gl.drawingBufferWidth;
        const height = gl.drawingBufferHeight;

        /*
         * three.js `canvas` dan o'lcham va hodisa metodlarini so'raydi.
         * expo-gl da haqiqiy canvas yo'q — eng kichik mos qobiq beriladi.
         */
        const canvas = {
          width,
          height,
          style: {},
          addEventListener: () => {},
          removeEventListener: () => {},
          clientWidth: width,
          clientHeight: height,
          getContext: () => gl,
        };

        const renderer = new THREE.WebGLRenderer({
          context: gl as unknown as WebGLRenderingContext,
          canvas: canvas as unknown as HTMLCanvasElement,
          antialias: false,
          powerPreference: 'high-performance',
        });

        /*
         * ⚠️ `dpr` ni cheklab bo'lmaydi. Spetsifikatsiya §4.2
         * `Math.min(PixelRatio.get(), 2)` ni tavsiya qiladi, lekin expo-gl
         * kadr buferini QURILMA o'lchamida beradi va uni kichraytirish
         * imkoni yo'q — kichikroq viewport tasvirni burchakka siqadi.
         * Shuning uchun to'liq buferga chiziladi; agar FPS §7 dagi 30 dan
         * tushsa, yechim render target orqali kichikroq chizib kattalashtirish.
         */
        renderer.setSize(width, height, false);
        renderer.shadowMap.enabled = false; // §10: real soya yo'q

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#0A0A0F'); // §4.2

        const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 20);

        // §4.4 — qora fon, oq asosiy nur, binafsha rim light
        scene.add(new THREE.AmbientLight(0xffffff, 0.35));

        const key = new THREE.DirectionalLight(0xffffff, 1.1);
        key.position.set(2, 4, 3);
        scene.add(key);

        const rim = new THREE.DirectionalLight(0x8b5cf6, 2.2);
        rim.position.set(-3, 2, -2);
        scene.add(rim);

        const fill = new THREE.PointLight(0xa855f7, 1.5, 3);
        fill.position.set(0, 0.1, 1.2);
        scene.add(fill);

        const context: SceneContext = { scene, camera, renderer, size: { width, height } };

        const fps = new FpsMonitor();
        let last = 0;

        const loop = (time: number): void => {
          if (disposed) return;
          frame = requestAnimationFrame(loop);

          const delta = last === 0 ? 0 : (time - last) / 1000;
          last = time;

          if (delta > 0) {
            fps.push(delta);
            const average = fps.average();
            if (average !== null) onFps?.(average);
            onFrame?.(delta, context);
          }

          // §4.5 — kamera har kadrda sferik holatdan qayta hisoblanadi
          camera.position.setFromSpherical(spherical.current);
          camera.lookAt(TARGET);

          renderer.render(scene, camera);
          gl.endFrameEXP();
        };

        frame = requestAnimationFrame(loop);

        Promise.resolve(onReady(context))
          .then((result) => {
            if (disposed) {
              result?.();
              return;
            }
            cleanup = result;
          })
          .catch((error: unknown) => {
            onError?.(error instanceof Error ? error : new Error(String(error)));
          });

        // Komponent o'chganda `useEffect` shu funksiyani chaqiradi
        cleanupRef.current = () => {
          disposed = true;
          cancelAnimationFrame(frame);
          cleanup?.();
          renderer.dispose();
        };
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    },
    [onError, onFps, onFrame, onReady],
  );

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    [],
  );

  return (
    <View style={[styles.root, style]} {...responder.panHandlers}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0F', overflow: 'hidden' },
});
