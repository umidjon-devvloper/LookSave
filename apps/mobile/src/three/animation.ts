import * as THREE from 'three';

/**
 * Avatar animatsiyalari (01-arxitektura §3.5, 05-mobile §7).
 *
 * Klip fayllari Mixamo'dan keladi va `GET /avatar/config` javobidagi
 * `animations` xaritasida turadi. Ular alohida GLB: ichida geometriya
 * yo'q, faqat trek ma'lumoti — shuning uchun kichik (~50-150 KB).
 *
 * ⚠️ MODEL BO'LMASA ISHLAMAYDI. Namuna avatarda skelet yo'q, demak
 * animatsiya ham yo'q — bu kod jim o'tkazib yuboriladi. Haqiqiy rigli
 * GLB paydo bo'lganda o'zi ishlay boshlaydi.
 */

export const ANIMATIONS = ['idle', 'turn', 'walk', 'sit'] as const;

export type AnimationName = (typeof ANIMATIONS)[number];

export function isAnimationName(value: string): value is AnimationName {
  return (ANIMATIONS as readonly string[]).includes(value);
}

/** Takrorlanadiganlar. Qolganlari bir marta o'ynab, `idle` ga qaytadi. */
const LOOPING: Record<AnimationName, boolean> = {
  idle: true,
  walk: true,
  turn: false,
  sit: false,
};

export function isLooping(name: AnimationName): boolean {
  return LOOPING[name];
}

/**
 * Bir animatsiyadan ikkinchisiga o'tish vaqti (soniya).
 *
 * `idle → turn` tez bo'lishi kerak: foydalanuvchi tugmani bosgan,
 * javob darhol ko'rinsin. `walk → idle` sekinroq — to'satdan to'xtash
 * g'alati ko'rinadi.
 */
const CROSSFADE: Record<AnimationName, number> = {
  idle: 0.35,
  turn: 0.15,
  walk: 0.25,
  sit: 0.4,
};

export function crossfadeTo(name: AnimationName): number {
  return CROSSFADE[name];
}

/** Takrorlanmaydigan animatsiya tugagach nimaga qaytiladi. */
export function nextAfter(name: AnimationName): AnimationName | null {
  return isLooping(name) ? null : 'idle';
}

// ── Trek nomlarini moslash ──────────────────────────────────────────────

/**
 * Klip treklarini skelet suyaklariga moslash.
 *
 * ⚠️ ENG EHTIMOLLI XATO. Mixamo klipida trek nomi
 * `mixamorig:Hips.position` bo'ladi. Blender GLB eksportida esa suyak
 * nomi ko'pincha `mixamorigHips` yoki `mixamorig_Hips` ga aylanadi —
 * ikki nuqta glTF nomlarida muammo tug'diradi va eksportyor uni
 * tozalaydi.
 *
 * Nomlar mos kelmasa `AnimationMixer` **jim ishlaydi**: xato bermaydi,
 * shunchaki hech narsa harakatlanmaydi. Shuning uchun bu yerda nom
 * oxirgi qismi bo'yicha moslanadi.
 *
 * Qaytadi: eski nom → yangi nom. Mos suyak topilmasa qiymat `null`,
 * bunday trek olib tashlanadi (aks holda `AnimationMixer` ogohlantirish
 * yozib to'ldiradi).
 */
export function remapTrackNames(
  trackNames: readonly string[],
  boneNames: readonly string[],
): Map<string, string | null> {
  const result = new Map<string, string | null>();

  // Suyak nomining "sof" ko'rinishi → haqiqiy nomi
  const byNormalized = new Map<string, string>();
  for (const bone of boneNames) {
    byNormalized.set(normalizeBoneName(bone), bone);
  }

  for (const track of trackNames) {
    const separator = track.lastIndexOf('.');
    if (separator <= 0) {
      result.set(track, null);
      continue;
    }

    const target = track.slice(0, separator);
    const property = track.slice(separator);

    if (boneNames.includes(target)) {
      // Aynan mos keldi — tegilmaydi
      result.set(track, track);
      continue;
    }

    const match = byNormalized.get(normalizeBoneName(target));
    result.set(track, match === undefined ? null : `${match}${property}`);
  }

  return result;
}

/**
 * `mixamorig:LeftArm` · `mixamorigLeftArm` · `mixamorig_LeftArm` ·
 * `Armature_mixamorig1LeftArm` — hammasi `leftarm` ga tushadi.
 *
 * Prefiks butunlay olib tashlanadi: Mixamo ba'zan `mixamorig1`,
 * `mixamorig2` deb raqamlaydi (bir sahnada bir necha rig bo'lganda).
 */
export function normalizeBoneName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.\d+$/, '')
    .replace(/^armature[:_]?/, '')
    .replace(/mixamorig\d*[:_]?/, '')
    .replace(/[^a-z0-9]/g, '');
}

// ── three.js qismi ──────────────────────────────────────────────────────

/**
 * Klipni skeletga moslab tozalaydi. Mos kelmagan treklar olib tashlanadi.
 * Bironta trek qolmasa `null` — chaqiruvchi buni ogohlantirish sifatida
 * ko'rsatadi, chunki animatsiya jim ishlamay qo'yishi eng chalkash holat.
 */
export function retargetClip(
  clip: THREE.AnimationClip,
  boneNames: readonly string[],
): THREE.AnimationClip | null {
  const mapping = remapTrackNames(
    clip.tracks.map((track) => track.name),
    boneNames,
  );

  const tracks: THREE.KeyframeTrack[] = [];

  for (const track of clip.tracks) {
    const next = mapping.get(track.name);
    if (next === null || next === undefined) continue;

    if (next !== track.name) track.name = next;
    tracks.push(track);
  }

  if (tracks.length === 0) return null;

  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

/**
 * Animatsiya boshqaruvchisi.
 *
 * `AnimationMixer` ni o'raydi va uchta narsani hal qiladi: klipni
 * skeletga moslash, silliq o'tish, takrorlanmaydigan animatsiya
 * tugagach `idle` ga qaytish.
 */
export class AnimationRig {
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<AnimationName, THREE.AnimationAction>();
  private current: AnimationName | null = null;
  private readonly onFinished: (event: { action: THREE.AnimationAction }) => void;

  constructor(private readonly root: THREE.Object3D) {
    this.mixer = new THREE.AnimationMixer(root);

    this.onFinished = ({ action }) => {
      const name = this.nameOf(action);
      if (name === null) return;

      const next = nextAfter(name);
      if (next !== null && this.actions.has(next)) this.play(next);
    };

    this.mixer.addEventListener('finished', this.onFinished);
  }

  /** Skeletdagi suyak nomlari — klipni moslash uchun. */
  private boneNames(): string[] {
    const names: string[] = [];
    this.root.traverse((child) => {
      if (child instanceof THREE.Bone) names.push(child.name);
    });
    return names;
  }

  /**
   * Klip qo'shish. Skeletga mos kelmasa `false` qaytadi — chaqiruvchi
   * log yozadi. Xato otilmaydi: bitta animatsiya yo'qligi Try-On
   * ekranini yopishga sabab emas.
   */
  add(name: AnimationName, clip: THREE.AnimationClip): boolean {
    const retargeted = retargetClip(clip, this.boneNames());
    if (retargeted === null) return false;

    const action = this.mixer.clipAction(retargeted);

    if (isLooping(name)) {
      action.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      // Oxirgi kadrda qolsin, sakrab boshiga qaytmasin
      action.clampWhenFinished = true;
    }

    this.actions.set(name, action);
    return true;
  }

  has(name: AnimationName): boolean {
    return this.actions.has(name);
  }

  playing(): AnimationName | null {
    return this.current;
  }

  play(name: AnimationName): void {
    const next = this.actions.get(name);
    if (!next || this.current === name) return;

    const previous = this.current === null ? null : this.actions.get(this.current);

    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);

    if (previous) {
      next.crossFadeFrom(previous, crossfadeTo(name), false);
    }

    next.play();
    this.current = name;
  }

  /** Har kadrda chaqiriladi. `delta` — soniyalarda. */
  update(delta: number): void {
    this.mixer.update(delta);
  }

  /**
   * Tozalash. `uncacheRoot` majburiy: `AnimationMixer` ichki keshda
   * obyektga havola saqlaydi va u tozalanmasa sahna almashganda
   * xotirada qolib ketadi.
   */
  dispose(): void {
    this.mixer.removeEventListener('finished', this.onFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.actions.clear();
    this.current = null;
  }

  private nameOf(action: THREE.AnimationAction): AnimationName | null {
    for (const [name, candidate] of this.actions) {
      if (candidate === action) return name;
    }
    return null;
  }
}
