import Constants from 'expo-constants';
import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { Button } from '../src/components/ui';
/*
 * ⚠️ `loader` MODULINI IMPORT QILISH KERAK, faqat `download` uchun emas.
 * U yuklanganda `patchNavigatorUserAgent()` chaqiriladi va busiz HAR
 * QANDAY GLB parse'i "Cannot read property 'match' of undefined" bilan
 * yiqiladi (`glCompat.ts`). Ya'ni sinov siqishni emas, o'sha xatoni
 * o'lchardi.
 */
import { download } from '../src/three/loader';
import { colors, radius, spacing, text } from '../src/theme/tokens';

/**
 * 3D siqish sinovi — `04-3d-pipeline.md §0` jadvalini to'ldirish uchun.
 *
 * ⚠️ NEGA BU EKRAN BOR VA NEGA SHOSHILINCH. Hujjat §0 ni **birinchi
 * haftada** talab qilgan, `10-roadmap.md §7` esa uni **1-raqamli kritik
 * yo'l** deb belgilagan. Sabab: Draco va KTX2 `WebAssembly` dekoderiga
 * tayanadi, Hermes'da esa WASM cheklangan. Agar ular ishlamasa butun
 * siqish strategiyasi o'zgaradi — poligonni ko'proq kamaytirish va WebP
 * tekstura kerak bo'ladi.
 *
 * Buni 100 ta model yasab bo'lgandan keyin bilib qolish — hammasini
 * qayta qilish. Shuning uchun sinov ATAYLAB eng arzon shaklda: uch
 * variant, bir xil geometriya, faqat siqish farq qiladi.
 *
 * ⚠️ MODELLAR CDN DAN OLINADI, TO'PLAMDAN EMAS. Maqsad — ishlab
 * chiqarishdagi yo'lni sinash: tarmoq → xom bayt → `loader.parse` →
 * dekoder. To'plamdan olsak tarmoq qadamini o'tkazib yuborardik.
 *
 * ⚠️ FAQAT `__DEV__`. Bu tashxis vositasi, mahsulot ekrani emas.
 */

const CDN = 'https://pub-24eaa9d31e324e0aadf692d761e8dc54.r2.dev/test';

interface Variant {
  key: string;
  label: string;
  url: string;
  /** Nima sinaladi — natija tushunarli bo'lishi uchun */
  needs: string;
}

const VARIANTS: Variant[] = [
  { key: 'plain', label: 'Siqishsiz', url: `${CDN}/plain.glb`, needs: 'hech narsa — asos o`lchov' },
  { key: 'draco', label: 'Draco', url: `${CDN}/draco.glb`, needs: 'Draco dekoderi (WASM yoki JS)' },
  { key: 'meshopt', label: 'Meshopt', url: `${CDN}/meshopt.glb`, needs: 'WASM (JS zaxirasi YO`Q)' },
];

type Status = 'idle' | 'running' | 'ok' | 'fail';

interface Result {
  status: Status;
  ms?: number;
  kb?: number;
  triangles?: number;
  error?: string;
}

/** Sahnadagi uchburchaklarni sanaydi — model haqiqatan ochilganini isbotlaydi. */
function countTriangles(scene: THREE.Object3D): number {
  let total = 0;
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const index = mesh.geometry.getIndex();
    const position = mesh.geometry.getAttribute('position');
    total += index ? index.count / 3 : (position?.count ?? 0) / 3;
  });
  return Math.round(total);
}

export default function CompressionTest(): JSX.Element {
  const insets = useSafeAreaInsets();
  const [results, setResults] = useState<Record<string, Result>>({});
  const [busy, setBusy] = useState(false);

  /*
   * ⚠️ ENG MUHIM QATOR. Qolgan hamma natija shundan kelib chiqadi:
   * `WebAssembly` bo'lmasa meshopt umuman ishlamaydi (uning JS zaxirasi
   * yo'q), Draco esa 703 KB'lik JS dekoderiga tushishi kerak.
   */
  const wasm =
    typeof WebAssembly === 'undefined'
      ? 'YO`Q'
      : typeof WebAssembly.instantiate === 'function'
        ? 'bor (instantiate ham)'
        : 'obyekt bor, instantiate yo`q';

  /*
   * Hermes o'zini `global.HermesInternal` bilan bildiradi. Tip
   * e'lonlarida u yo'q, shuning uchun `globalThis` orqali o'qiladi —
   * `@ts-expect-error` esa ishlatilmaydi (u kod o'zgarganda "ortiqcha
   * direktiva" xatosini beradi va nima uchun qo'yilgani esdan chiqadi).
   */
  const engine =
    (globalThis as { HermesInternal?: unknown }).HermesInternal != null
      ? 'Hermes'
      : 'JSC yoki boshqa';

  const runOne = useCallback(async (variant: Variant): Promise<Result> => {
    const started = Date.now();
    try {
      const bytes = await download(variant.url);
      const kb = Math.round(bytes.byteLength / 1024);

      /*
       * ⚠️ HAR VARIANT UCHUN YANGI LOADER. Bitta `GLTFLoader` ni
       * qayta ishlatsak, birinchi variantda o'rnatilgan dekoder
       * keyingisiga ta'sir qilardi va natija chalkashardi.
       *
       * ⚠️ DEKODER ULANMAYDI — ATAYLAB. Savol shu: siqilgan model
       * QO'SHIMCHA SOZLAMASIZ ochiladimi. Yiqilsa, xato matni aynan
       * nima yetishmayotganini aytadi va biz shuni hujjatga yozamiz.
       */
      const loader = new GLTFLoader();

      const scene = await new Promise<THREE.Object3D>((resolve, reject) => {
        loader.parse(
          bytes,
          '',
          (result) => resolve(result.scene),
          (error) => reject(error instanceof Error ? error : new Error(String(error))),
        );
      });

      return {
        status: 'ok',
        ms: Date.now() - started,
        kb,
        triangles: countTriangles(scene),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Sabab EKRANGA chiqadi: log telefon Metro'dan uzilsa yo'qoladi
      console.warn(`[compression] ${variant.key} yiqildi`, message);
      return { status: 'fail', ms: Date.now() - started, error: message.slice(0, 200) };
    }
  }, []);

  const runAll = useCallback(async () => {
    setBusy(true);
    setResults({});

    for (const variant of VARIANTS) {
      setResults((current) => ({ ...current, [variant.key]: { status: 'running' } }));
      const result = await runOne(variant);
      setResults((current) => ({ ...current, [variant.key]: result }));
    }

    setBusy(false);
  }, [runOne]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      <Text style={styles.title}>3D siqish sinovi</Text>
      <Text style={styles.lead}>
        04-3d-pipeline §0 · roadmapning 1-raqamli kritik yo‘li. Natijalarni hujjatga yozing.
      </Text>

      {/* Muhit — qolgan hamma natijaning sababi shu yerda */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Muhit</Text>
        <Row label="Platforma" value={`${Platform.OS} ${Platform.Version}`} />
        <Row label="JS dvigateli" value={engine} />
        <Row label="WebAssembly" value={wasm} strong />
        <Row label="Expo" value={Constants.expoConfig?.sdkVersion ?? 'noma`lum'} />
      </View>

      <Button
        title={busy ? 'Sinalmoqda…' : 'Sinovni boshlash'}
        onPress={() => void runAll()}
        loading={busy}
      />

      {VARIANTS.map((variant) => {
        const result = results[variant.key];
        return (
          <View key={variant.key} style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.cardTitle}>{variant.label}</Text>
              <Text
                style={[
                  styles.badge,
                  result?.status === 'ok' && styles.badgeOk,
                  result?.status === 'fail' && styles.badgeFail,
                ]}
              >
                {result?.status === 'ok'
                  ? 'OCHILDI'
                  : result?.status === 'fail'
                    ? 'YIQILDI'
                    : result?.status === 'running'
                      ? '…'
                      : '—'}
              </Text>
            </View>

            <Text style={styles.needs}>Talab: {variant.needs}</Text>

            {result?.status === 'ok' ? (
              <>
                <Row label="Hajm" value={`${result.kb} KB`} />
                <Row label="Uchburchak" value={String(result.triangles)} />
                <Row label="Yuklash + parse" value={`${result.ms} ms`} />
              </>
            ) : null}

            {result?.status === 'fail' ? <Text style={styles.error}>{result.error}</Text> : null}
          </View>
        );
      })}

      <Text style={styles.footer}>
        ⚠️ Dekoderlar ATAYLAB ulanmagan: savol — siqilgan model qo‘shimcha sozlamasiz ochiladimi.
        Yiqilish matni nima yetishmayotganini aytadi.
      </Text>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}): JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  title: { ...text.h2, color: colors.text },
  lead: { ...text.small, color: colors.textMuted },

  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  cardTitle: { ...text.h3, color: colors.text },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  needs: { ...text.tiny, color: colors.textDim, marginBottom: spacing.xs },

  badge: {
    ...text.tiny,
    color: colors.textDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  badgeOk: { color: colors.success, backgroundColor: 'rgba(34,197,94,0.14)' },
  badgeFail: { color: colors.danger, backgroundColor: 'rgba(239,68,68,0.14)' },

  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  rowLabel: { ...text.small, color: colors.textMuted },
  rowValue: { ...text.small, color: colors.text, flexShrink: 1, textAlign: 'right' },
  rowValueStrong: { color: colors.accent, fontWeight: '700' },

  error: { ...text.tiny, color: colors.danger, marginTop: spacing.xs },
  footer: { ...text.tiny, color: colors.textDim },
});
