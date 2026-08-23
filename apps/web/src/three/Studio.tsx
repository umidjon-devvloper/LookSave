import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei';
import { memo } from 'react';
import * as THREE from 'three';

/**
 * Sahnaning yorug'lik va muhiti — "suratxona".
 *
 * NEGA `RoomEnvironment` TASHLANDI: u three ichidagi tayyor sahna, oq
 * xonani taqlid qiladi. Natijada model har tomondan bir tekis yoritiladi:
 * soya yo'q, siluet yo'q, chuqurlik yo'q. Katalog uchun yaraydi, lekin
 * sahifaning birinchi ekrani uchun juda "yassi".
 *
 * O'RNIGA: qorong'i suratxona va bir nechta yorug'lik paneli
 * (`Lightformer`). Ular muhit xaritasiga (PMREM) pishiriladi va materialga
 * AKS bo'lib tushadi — aynan shu narsa matoda cho'zilgan yaltiroq chiziq,
 * krossovkada esa aniq nur dog'ini beradi. HDR fayl kerak emas: hammasi
 * kod bilan quriladi, tarmoqqa nol so'rov, offline'da ham bir xil.
 *
 * ⚠️ `frames={1}` — muhit BIR MARTA pishiriladi. Olib tashlansa har kadrda
 * kub xarita qayta chiziladi va sahifadagi har bir kanvas 6× ortiqcha ish
 * qiladi.
 */

/** Sahna qanchalik "qimmat" chiziladi. */
export type Quality = 'showcase' | 'card';

/** Brend rangi — orqadan tushadigan nurda ishlatiladi. */
const VIOLET = '#8B5CF6';
const LILAC = '#C084FC';

function StudioEnvironmentBase({ quality }: { quality: Quality }): JSX.Element {
  return (
    <Environment resolution={quality === 'showcase' ? 256 : 128} frames={1}>
      {/*
        Fon qora sfera. Muhit xaritasining "bo'sh" joyi qora bo'lgani uchun
        aks aniq va kontrast chiqadi — oq xonada esa hamma narsa yuviladi.
      */}
      <mesh scale={40}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#07060c" side={THREE.BackSide} />
      </mesh>

      {/* ASOSIY NUR — o'ngdan, tepadan, katta va yumshoq (softbox) */}
      <Lightformer
        form="rect"
        intensity={3.4}
        color="#fff4ec"
        position={[3.2, 3.4, 3.6]}
        rotation={[0, -0.7, 0]}
        scale={[7, 9, 1]}
      />

      {/* TO'LDIRUVCHI — chapdan, sovuqroq va ancha kuchsiz: soya o'lmasin,
          lekin qorayib ham ketmasin */}
      <Lightformer
        form="rect"
        intensity={0.9}
        color="#cfd7ff"
        position={[-4.2, 2.2, 2.6]}
        rotation={[0, 0.9, 0]}
        scale={[6, 8, 1]}
      />

      {/* SILUET NURI — orqadan chapdan, brend binafshasi. Bu qatlam
          modelning chetini yoritadi va uni fondan ajratadi */}
      <Lightformer
        form="rect"
        intensity={6.5}
        color={VIOLET}
        position={[-3.4, 2.8, -4.2]}
        rotation={[0, -2.4, 0]}
        scale={[4.5, 8, 1]}
      />

      {/* Ikkinchi siluet nuri — o'ng orqadan, ochroq siyoh */}
      <Lightformer
        form="rect"
        intensity={4.2}
        color={LILAC}
        position={[3.8, 2.2, -3.6]}
        rotation={[0, 2.4, 0]}
        scale={[3, 7, 1]}
      />

      {/* TEPA CHIZIG'I — yelka va bosh ustidagi nozik yorug'lik */}
      <Lightformer
        form="rect"
        intensity={1.7}
        color="#ffffff"
        position={[0, 5.5, 0.5]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[8, 5, 1]}
      />

      {/* POLDAN QAYTGAN NUR — oyoq va shim pastini butunlay qora
          qoldirmaydi, sovuq binafsha tusda */}
      <Lightformer
        form="rect"
        intensity={0.55}
        color="#3a2f5e"
        position={[0, -1.6, 2.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[7, 5, 1]}
      />
    </Environment>
  );
}

export const StudioEnvironment = memo(StudioEnvironmentBase);

/**
 * Haqiqiy soya beradigan yagona chiroq.
 *
 * Muhit xaritasi soya bermaydi — u faqat aks va umumiy yoritish. Shakl
 * o'qilishi uchun bitta yo'naltirilgan chiroq kerak; ikkitasi qo'yilsa
 * ikkita soya tushadi va sahna "arzon o'yin" ko'rinishiga o'tadi.
 */
export function KeyLight({ quality }: { quality: Quality }): JSX.Element {
  const map = quality === 'showcase' ? 2048 : 1024;

  return (
    <directionalLight
      castShadow
      position={[3.4, 5.6, 3.2]}
      intensity={1.15}
      color="#fff6ee"
      shadow-mapSize={[map, map]}
      shadow-bias={-0.0012}
      shadow-normalBias={0.022}
      // Soya kamerasi model atrofiga qisiladi: keng bo'lsa piksel katta
      // bo'lib ketadi va soya chekkasi zinapoyaga aylanadi
      shadow-camera-near={0.5}
      shadow-camera-far={14}
      shadow-camera-top={2.4}
      shadow-camera-bottom={-0.6}
      shadow-camera-left={-1.8}
      shadow-camera-right={1.8}
    />
  );
}

/**
 * Poldagi aks — modelni "biror joyda turgan"ga aylantiradi.
 *
 * ⚠️ QIMMAT: sahnani ikkinchi marta chizadi. Shuning uchun faqat
 * `showcase` sifatida va kichik `resolution` bilan ishlatiladi.
 */
export function ReflectiveFloor({ radius = 2.6 }: { radius?: number }): JSX.Element {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <circleGeometry args={[radius, 64]} />
      <MeshReflectorMaterial
        resolution={512}
        mixBlur={1}
        mixStrength={7}
        blur={[300, 90]}
        /* Aks juda aniq bo'lsa oyna bo'lib qoladi — mato aksi xira bo'lishi kerak */
        roughness={0.9}
        depthScale={1.1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.35}
        color="#08070e"
        metalness={0.6}
        mirror={0}
      />
    </mesh>
  );
}

/**
 * Oyoq ostidagi tegish soyasi.
 *
 * Yo'naltirilgan chiroqning soyasi uzoqqa cho'ziladi va oyoq ostini
 * qorong'ilashtirmaydi. Odam esa aynan shu qorong'ilikdan "yerda turibdi"
 * degan xulosa chiqaradi — u bo'lmasa model havoda suzayotgandek.
 */
export function GroundContact({
  quality,
  scale = 4.2,
}: {
  quality: Quality;
  scale?: number;
}): JSX.Element {
  return (
    <ContactShadows
      position={[0, 0.002, 0]}
      scale={scale}
      far={2.4}
      blur={2.4}
      opacity={quality === 'showcase' ? 0.9 : 0.75}
      resolution={quality === 'showcase' ? 512 : 256}
      color="#000000"
    />
  );
}
