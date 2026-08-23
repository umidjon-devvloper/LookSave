import { Asset } from 'expo-asset';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Scene3D, type Scene3DHandle, type SceneContext } from '../src/three/Scene3D';
import { bakeForExpoGl, disposeObject, loadModel } from '../src/three/loader';

/**
 * Spetsifikatsiyaning 1-BOSQICHI: "Expo'da three.js sahnasi ishga tushsin.
 * Statik demo avatar GLB yuklanadi, aylantiriladi, zoom bo'ladi. Hech qanday
 * backend yo'q."
 *
 * Shu sababli model ilova ichiga joylashtirilgan — tarmoq ham, server ham
 * ishtirok etmaydi. Keyingi bosqichda u CDN dan keladi.
 *
 * ⚠️ Bu ekran vaqtincha: 2-bosqichda uning o'rnini kiyim tanlash bilan
 * to'liq sahna egallaydi. Hozircha u 1-bosqich mezonini isbotlaydi.
 */

/** Namoyish avatari — 16 mesh, 22 suyak, teksturasiz (3.2 MB). */
const DEMO_MODEL = require('../assets/models/male-base-v1.glb') as number;
const DEMO_MODEL_BYTES = 3.2 * 1024 * 1024;

export default function GlModel(): JSX.Element {
  const stage = useRef<Scene3DHandle>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [fps, setFps] = useState<number | null>(null);

  const onReady = useCallback(async (context: SceneContext) => {
    const asset = Asset.fromModule(DEMO_MODEL);
    await asset.downloadAsync();

    const uri = asset.localUri ?? asset.uri;
    const { scene: model } = await loadModel('demo-avatar', uri, DEMO_MODEL_BYTES);

    /*
     * Morflar expo-gl da to'g'ridan-to'g'ri ishlamaydi — mavjud yordamchi
     * ularni geometriyaga "pishirib" beradi. Namoyish modelida morf yo'q,
     * shuning uchun ro'yxat bo'sh, lekin chaqiruv o'z joyida qoladi.
     */
    bakeForExpoGl(model, {});

    context.scene.add(model);
    setStatus('ready');

    return () => {
      context.scene.remove(model);
      disposeObject(model);
    };
  }, []);

  const onError = useCallback((error: Error) => {
    setStatus('error');
    setMessage(error.message);
  }, []);

  return (
    <View style={styles.root}>
      <Scene3D ref={stage} onReady={onReady} onError={onError} onFps={setFps}>
        {status === 'loading' ? (
          <View style={styles.center} pointerEvents="none">
            <ActivityIndicator color="#A855F7" />
            <Text style={styles.hint}>model yuklanmoqda…</Text>
          </View>
        ) : null}

        {status === 'error' ? (
          <View style={styles.center} pointerEvents="none">
            <Text style={styles.error}>{message}</Text>
          </View>
        ) : null}
      </Scene3D>

      <View style={styles.bar}>
        <Text style={styles.fps}>{fps === null ? 'FPS —' : `FPS ${Math.round(fps)}`}</Text>
        <Pressable style={styles.button} onPress={() => stage.current?.reset()}>
          <Text style={styles.buttonText}>Boshlang'ich holat</Text>
        </Pressable>
      </View>

      <Text style={styles.help}>Bir barmoq — aylantirish · Ikki barmoq — yaqinlashtirish</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0F' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  hint: { color: '#8E8E93', fontSize: 13, marginTop: 10 },
  error: { color: '#FF453A', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },

  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fps: { color: '#8E8E93', fontSize: 12, fontVariant: ['tabular-nums'] },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.5)',
    backgroundColor: 'rgba(168,85,247,0.12)',
  },
  buttonText: { color: '#C084FC', fontSize: 13, fontWeight: '600' },

  help: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 22,
    color: '#5A5A62',
    fontSize: 11,
    textAlign: 'center',
  },
});
