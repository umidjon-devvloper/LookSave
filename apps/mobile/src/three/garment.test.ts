import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { normalizeBoneName, remapSkinIndex } from './garment';

/**
 * ⚠️ NEGA AYNAN BU FUNKSIYA TESTLANADI.
 *
 * `skinIndex` — suyaklar MASSIVIDAGI o'rin, nom emas. Kiyim skeletining
 * tartibi tana skeletidan farq qilsa, kiyim noto'g'ri suyakka bog'lanadi
 * va **hech qanday xato chiqmaydi** — mesh shunchaki boshqa joyda paydo
 * bo'ladi. LookSave'da tartiblar butunlay boshqa (2026-08-24 o'lchovi):
 *
 *   tana (Blender):  52 suyak — Hips, LeftUpLeg, LeftLeg…
 *   generator:       23 suyak — Hips, Spine, Spine1…
 *
 * Ya'ni 1-indeks kiyim uchun `Spine`, tana uchun `LeftUpLeg` — futbolka
 * gavdasi chap oyoqqa bog'lanardi. Bunday xatoni qurilmada topish uzoq
 * va qiynoqli, testda esa bir zumda ko'rinadi (12-tz.md D-05).
 */

function skeletonOf(names: string[]): THREE.Skeleton {
  return new THREE.Skeleton(
    names.map((name) => {
      const bone = new THREE.Bone();
      bone.name = name;
      return bone;
    }),
  );
}

/** Ikki verteksli mesh — har biri bitta suyakka to'liq og'irlik bilan. */
function meshWith(boneNames: string[], indices: number[]): THREE.SkinnedMesh {
  const geometry = new THREE.BufferGeometry();
  const count = indices.length;

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3),
  );

  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  indices.forEach((index, i) => {
    skinIndex[i * 4] = index;
    skinWeight[i * 4] = 1;
  });

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));

  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  mesh.bind(skeletonOf(boneNames));
  return mesh;
}

describe('normalizeBoneName', () => {
  /*
   * `GLTFLoader` `mixamorig:Hips` ni `mixamorigHips` ga aylantiradi —
   * `:` animatsiya yo'llari sintaksisida band. Ikki skelet turli yo'l
   * bilan yuklangan bo'lsa nomlar shu bilan farq qiladi.
   */
  it('ajratgichlarni olib tashlaydi', () => {
    expect(normalizeBoneName('mixamorig:Hips')).toBe('mixamorigHips');
    expect(normalizeBoneName('mixamorig_Hips')).toBe('mixamorigHips');
    expect(normalizeBoneName('mixamorigHips')).toBe('mixamorigHips');
    expect(normalizeBoneName('mixamorig.Hips')).toBe('mixamorigHips');
  });
});

describe('remapSkinIndex', () => {
  it('tartib boshqa bo`lsa indeksni nom bo`yicha to`g`rilaydi', () => {
    // Kiyim: 0=Hips, 1=Spine
    const mesh = meshWith(['mixamorig:Hips', 'mixamorig:Spine'], [1, 1]);
    // Tana: 0=Hips, 1=LeftUpLeg, 2=Spine — Spine 1 da EMAS, 2 da
    const body = skeletonOf(['mixamorigHips', 'mixamorigLeftUpLeg', 'mixamorigSpine']);

    const { remapped, missing } = remapSkinIndex(mesh, body);

    expect(missing).toEqual([]);
    expect(remapped).toBe(2);

    const attribute = mesh.geometry.getAttribute('skinIndex');
    expect(attribute.getComponent(0, 0)).toBe(2);
    expect(attribute.getComponent(1, 0)).toBe(2);
  });

  it('tartib bir xil bo`lsa hech narsa o`zgarmaydi', () => {
    const names = ['mixamorigHips', 'mixamorigSpine'];
    const mesh = meshWith(names, [1, 0]);
    const { remapped, missing } = remapSkinIndex(mesh, skeletonOf(names));

    expect(missing).toEqual([]);
    expect(remapped).toBe(0);
  });

  /*
   * ⚠️ ENG MUHIM HOLAT. Yetishmagan suyakni jimgina 0 ga qoldirish
   * kiyimning bir qismini ILDIZGA bog'lardi va u tanadan ajralib
   * qolardi. Og'irlikni nolga chiqarish esa uni qimirlamas qiladi —
   * noto'g'ri joyda turgandan ko'ra yaxshiroq.
   */
  it('tana skeletida yo`q suyak — og`irlik nolga chiqadi', () => {
    const mesh = meshWith(['mixamorig:Hips', 'mixamorig:Tail'], [1, 0]);
    const body = skeletonOf(['mixamorigHips']);

    const { missing } = remapSkinIndex(mesh, body);
    expect(missing).toEqual(['mixamorig:Tail']);

    const weights = mesh.geometry.getAttribute('skinWeight');
    // 0-vertex `Tail` ga tegishli edi → og'irligi nolga tushdi
    expect(weights.getComponent(0, 0)).toBe(0);
    // 1-vertex `Hips` da qoldi
    expect(weights.getComponent(1, 0)).toBe(1);
  });

  it('skinIndex bo`lmasa jimgina o`tadi', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3), 3));
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
    mesh.bind(skeletonOf(['mixamorigHips']));

    expect(remapSkinIndex(mesh, skeletonOf(['mixamorigHips']))).toEqual({
      remapped: 0,
      missing: [],
    });
  });
});
