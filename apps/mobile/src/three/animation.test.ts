import { describe, expect, it } from 'vitest';

import {
  ANIMATIONS,
  crossfadeTo,
  isAnimationName,
  isLooping,
  nextAfter,
  normalizeBoneName,
  remapTrackNames,
} from './animation';

/**
 * `three.js` obyektlariga tegmaydigan qism. `AnimationRig` uchun
 * haqiqiy skelet kerak — u qurilmada, model kelgandan keyin sinaladi.
 */

describe('animatsiya nomlari', () => {
  it('hujjatdagi to`rtta (01-arxitektura §3.5)', () => {
    expect([...ANIMATIONS]).toEqual(['idle', 'turn', 'walk', 'sit']);
  });

  it('begona nom rad etiladi', () => {
    expect(isAnimationName('idle')).toBe(true);
    expect(isAnimationName('dance')).toBe(false);
  });

  it('takrorlanish to`g`ri belgilangan', () => {
    expect(isLooping('idle')).toBe(true);
    expect(isLooping('walk')).toBe(true);
    expect(isLooping('turn')).toBe(false);
    expect(isLooping('sit')).toBe(false);
  });

  it('takrorlanmaydigani `idle` ga qaytadi', () => {
    expect(nextAfter('turn')).toBe('idle');
    expect(nextAfter('sit')).toBe('idle');
    // Takrorlanadiganida qaytish yo'q — o'zi davom etadi
    expect(nextAfter('idle')).toBeNull();
    expect(nextAfter('walk')).toBeNull();
  });

  it('o`tish vaqti oqilona chegarada', () => {
    for (const name of ANIMATIONS) {
      const duration = crossfadeTo(name);
      expect(duration).toBeGreaterThan(0);
      // Yarim soniyadan uzun o'tish sekin ko'rinadi
      expect(duration).toBeLessThanOrEqual(0.5);
    }
  });

  it('`turn` eng tez o`tadi — tugma bosilishiga javob', () => {
    expect(crossfadeTo('turn')).toBeLessThan(crossfadeTo('idle'));
  });
});

describe('normalizeBoneName', () => {
  it('Mixamo prefiksining barcha ko`rinishlari bir xil natija beradi', () => {
    const expected = 'leftarm';
    expect(normalizeBoneName('mixamorig:LeftArm')).toBe(expected);
    expect(normalizeBoneName('mixamorigLeftArm')).toBe(expected);
    expect(normalizeBoneName('mixamorig_LeftArm')).toBe(expected);
    // Blender bir necha rig bo'lganda raqamlaydi
    expect(normalizeBoneName('mixamorig1LeftArm')).toBe(expected);
    expect(normalizeBoneName('Armature_mixamorig:LeftArm')).toBe(expected);
  });

  it('nusxa qo`shimchasi tushiriladi', () => {
    expect(normalizeBoneName('mixamorig:Hips.001')).toBe('hips');
  });

  it('turli suyaklar chalkashmaydi', () => {
    expect(normalizeBoneName('mixamorig:LeftArm')).not.toBe(
      normalizeBoneName('mixamorig:LeftForeArm'),
    );
    expect(normalizeBoneName('mixamorig:LeftFoot')).not.toBe(
      normalizeBoneName('mixamorig:RightFoot'),
    );
  });
});

describe('remapTrackNames', () => {
  const bones = ['mixamorigHips', 'mixamorigSpine', 'mixamorigLeftArm'];

  it('Blender tozalagan nomga moslaydi', () => {
    // Aynan shu holat: Mixamo klipi `:` bilan, GLB suyaklari `:` siz
    const mapping = remapTrackNames(
      ['mixamorig:Hips.position', 'mixamorig:LeftArm.quaternion'],
      bones,
    );

    expect(mapping.get('mixamorig:Hips.position')).toBe('mixamorigHips.position');
    expect(mapping.get('mixamorig:LeftArm.quaternion')).toBe('mixamorigLeftArm.quaternion');
  });

  it('aynan mos kelgan trek tegilmaydi', () => {
    const mapping = remapTrackNames(['mixamorigSpine.scale'], bones);
    expect(mapping.get('mixamorigSpine.scale')).toBe('mixamorigSpine.scale');
  });

  it('mos suyak topilmasa null', () => {
    // Klipda bor, lekin modelda yo'q suyak — trek olib tashlanadi
    const mapping = remapTrackNames(['mixamorig:RightHand.position'], bones);
    expect(mapping.get('mixamorig:RightHand.position')).toBeNull();
  });

  it('xususiyatsiz trek rad etiladi', () => {
    const mapping = remapTrackNames(['mixamorig:Hips'], bones);
    expect(mapping.get('mixamorig:Hips')).toBeNull();
  });

  it('morph trekiga tegmaydi — mos suyak yo`q', () => {
    const mapping = remapTrackNames(['Head.morphTargetInfluences'], bones);
    expect(mapping.get('Head.morphTargetInfluences')).toBeNull();
  });

  it('bo`sh skeletda hamma trek yo`qoladi', () => {
    const mapping = remapTrackNames(['mixamorig:Hips.position'], []);
    expect(mapping.get('mixamorig:Hips.position')).toBeNull();
  });

  it('har bir trek uchun yozuv bo`ladi', () => {
    const tracks = ['mixamorig:Hips.position', 'mixamorig:Toes.position', 'buzuq'];
    const mapping = remapTrackNames(tracks, bones);
    expect(mapping.size).toBe(tracks.length);
  });
});
