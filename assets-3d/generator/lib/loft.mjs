import * as THREE from 'three';

/**
 * Kesimlardan sirt qurish (loft).
 *
 * NEGA PRIMITIVLAR EMAS: kapsula va shar bilan tana yasalganda qismlar
 * bir-biriga ulanmaydi — yelkada, tizzada, belda ko'rinadigan chok qoladi
 * va silueti odamnikiga o'xshamaydi. Loft esa berilgan balandliklardagi
 * kesimlarni ketma-ket ulaydi, ya'ni shakl profil jadvali bilan boshqariladi:
 * yelka keng, bel tor, son yana keng.
 *
 * Har bir halqa (`ring`) — fazodagi ellips:
 *   center — markaz nuqtasi
 *   axis   — halqa qaysi yo'nalishga perpendikulyar turishi
 *   rx, rz — ellips yarim o'qlari (rx — yon, rz — old-orqa)
 *
 * ⚠️ Halqalar TARTIB bilan berilishi shart va qo'shni halqalar orasida
 * o'tish silliq bo'lishi kerak — aks holda sirtda burma paydo bo'ladi.
 */

const EPSILON = 1e-6;

/** Berilgan o'qqa perpendikulyar ikkita birlik vektor */
function frameFor(axis) {
  const forward = axis.clone().normalize();

  // O'q vertikalga yaqin bo'lsa `up` sifatida Z olamiz, aks holda Y —
  // aks holda ko'paytma nolga aylanadi va freym buziladi
  const reference =
    Math.abs(forward.y) > 0.99 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);

  const side = new THREE.Vector3().crossVectors(reference, forward).normalize();
  const depth = new THREE.Vector3().crossVectors(forward, side).normalize();

  return { side, depth };
}

/**
 * Halqalardan `BufferGeometry` yasaydi.
 *
 * `capStart` / `capEnd` — uchlarini yopish. Ochiq qoldirilsa ichkarisi
 * ko'rinadi, shuning uchun faqat boshqa qism bilan tutashadigan joyda
 * ochiq qoldiriladi.
 */
export function loft(rings, { radialSegments = 20, capStart = true, capEnd = true } = {}) {
  if (rings.length < 2) throw new Error('Loft uchun kamida ikkita halqa kerak');

  const positions = [];
  const indices = [];

  // ── Halqa nuqtalari ──
  for (const ring of rings) {
    const center = new THREE.Vector3(...ring.center);
    const axis = new THREE.Vector3(...(ring.axis ?? [0, 1, 0]));
    const { side, depth } = frameFor(axis);

    for (let i = 0; i < radialSegments; i++) {
      const angle = (i / radialSegments) * Math.PI * 2;
      const x = Math.cos(angle) * ring.rx;
      const z = Math.sin(angle) * ring.rz;

      positions.push(
        center.x + side.x * x + depth.x * z,
        center.y + side.y * x + depth.y * z,
        center.z + side.z * x + depth.z * z,
      );
    }
  }

  // ── Yon sirt ──
  for (let r = 0; r < rings.length - 1; r++) {
    const a = r * radialSegments;
    const b = (r + 1) * radialSegments;

    for (let i = 0; i < radialSegments; i++) {
      const next = (i + 1) % radialSegments;
      indices.push(a + i, b + i, a + next);
      indices.push(a + next, b + i, b + next);
    }
  }

  // ── Uchlarini yopish ──
  const addCap = (ringIndex, flip) => {
    const ring = rings[ringIndex];
    const center = new THREE.Vector3(...ring.center);
    const centerIndex = positions.length / 3;
    positions.push(center.x, center.y, center.z);

    const offset = ringIndex * radialSegments;
    for (let i = 0; i < radialSegments; i++) {
      const next = (i + 1) % radialSegments;
      if (flip) indices.push(centerIndex, offset + next, offset + i);
      else indices.push(centerIndex, offset + i, offset + next);
    }
  };

  if (capStart) addCap(0, true);
  if (capEnd) addCap(rings.length - 1, false);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Ikki nuqta orasida qalinligi o'zgaruvchan a'zo (qo'l, oyoq).
 *
 * `profile` — `t` (0…1) bo'yicha qalinlik: `[[t, rx, rz], …]`. Oraliq
 * qiymatlar chiziqli interpolyatsiya bilan olinadi, shuning uchun bir
 * necha nuqta bilan mushak shaklini berish mumkin (bicepsda yo'g'on,
 * tirsakda ingichka).
 */
export function limb(from, to, profile, { radialSegments = 14, capStart, capEnd } = {}) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const axis = new THREE.Vector3().subVectors(b, a);

  const rings = profile.map(([t, rx, rz]) => ({
    center: a.clone().lerp(b, t).toArray(),
    axis: axis.toArray(),
    rx,
    rz,
  }));

  return loft(rings, { radialSegments, capStart, capEnd });
}

/** Ikki profil qiymati orasidagi silliq o'tish — `smoothstep` */
export function ease(t) {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Balandlik bo'yicha berilgan tayanch nuqtalardan halqalar qatorini
 * yasaydi va oraliqlarni silliq to'ldiradi.
 *
 * `keys` — `[y, rx, rz, cz?]`. `cz` — markazning old-orqa siljishi
 * (masalan dumba orqaga chiqadi).
 */
export function verticalRings(keys, steps) {
  const rings = [];

  for (let i = 0; i < keys.length - 1; i++) {
    const [y0, rx0, rz0, cz0 = 0] = keys[i];
    const [y1, rx1, rz1, cz1 = 0] = keys[i + 1];

    // Oxirgi bo'lakdan tashqari yakuniy nuqta takrorlanmasin
    const last = i === keys.length - 2 ? steps : steps - 1;

    for (let s = 0; s <= last; s++) {
      const t = ease(s / steps);
      rings.push({
        center: [0, y0 + (y1 - y0) * (s / steps), cz0 + (cz1 - cz0) * t],
        axis: [0, 1, 0],
        rx: rx0 + (rx1 - rx0) * t,
        rz: rz0 + (rz1 - rz0) * t,
      });
    }
  }

  return rings;
}
