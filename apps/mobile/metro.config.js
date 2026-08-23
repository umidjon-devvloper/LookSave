// Monorepo uchun Metro sozlamalari.
//
// ⚠️ Bularsiz `@looksave/validation` va `@looksave/shared-types` topilmaydi:
// ular repo ildizida turadi, Metro esa standart holatda faqat ilova
// papkasini kuzatadi.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Workspace paketlari o'zgarganda ham qayta yig'ilsin
config.watchFolders = [workspaceRoot];

// 2. 3D modellar RESURS, manba emas.
//
//    ⚠️ Busiz `require('....glb')` Metro tomonidan JavaScript deb o'qiladi va
//    "Unexpected token" bilan yiqiladi. Xato fayl nomini ko'rsatmaydi,
//    shuning uchun sababi umuman boshqa joyda deb o'ylash oson.
config.resolver.assetExts = [...config.resolver.assetExts, 'glb', 'gltf', 'bin'];

// 3. Modullarni ikkala `node_modules` dan izlash
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 4. Bitta React nusxasi bo'lishi shart — ikkitasi bo'lsa hook'lar buziladi.
//
//    ⚠️ Bu yerda avval `disableHierarchicalLookup = true` turgan edi. U React
//    muammosini hal qilardi, lekin YONMA-YON ZARAR keltirdi: ichma-ich
//    o'rnatilgan paketlar umuman ko'rinmay qoldi. Eng og'rig'i —
//    `@react-three/fiber` o'zining `zustand@3` nusxasini
//    (`@react-three/fiber/node_modules/zustand`) topa olmay, ildizdagi
//    `zustand@5` ni olardi. v5 da standart eksport olib tashlangan, natijada
//    Try-On ekrani ochilganda:
//        TypeError: create__default["default"] is not a function
//
//    Shuning uchun ierarxik qidiruv qaytarildi va React nuqtali ravishda
//    bittaga qadaldi — `expo-three` o'zining React nusxasi bilan keladi.
const REACT_ROOT = path.resolve(workspaceRoot, 'node_modules/react');

// 5. `three` ham bittaga qadaladi — ILOVA O'ZINIKIGA.
//
//    ⚠️ NEGA: `drei`, `fiber`, `three-stdlib` ildizdagi `node_modules` da
//    turadi va ular `three` ni so'raganda ierarxik qidiruv ILDIZDAGI nusxani
//    topadi. Ildizda esa web ilovasi uchun keltirilgan yangi versiya turishi
//    mumkin. Ikki oqibati bor va ikkalasi ham 3D bilan bog'liqdek
//    ko'rinmaydi:
//
//      · 0.167+ da sinf ichida `static {}` bloki bor, `babel-preset-expo`
//        uni o'girmaydi — bundle "Static class blocks are not enabled" bilan
//        yiqiladi va xato `three.cjs` ni ko'rsatadi, ilova kodini emas;
//      · ikkita nusxa bundlega tushsa `instanceof` tekshiruvlari buziladi
//        (masalan `mesh.isSkinnedMesh` boshqa sinfdan bo'lib qoladi).
//
//    `expo-three` ham `^0.166.0` kutadi, shuning uchun ilova nusxasi
//    yagona to'g'ri manba.
const THREE_ROOT = path.resolve(projectRoot, 'node_modules/three');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const subPath = moduleName === 'react' ? '' : moduleName.slice('react'.length);
    return context.resolveRequest(context, path.join(REACT_ROOT, subPath), platform);
  }

  if (moduleName === 'three' || moduleName.startsWith('three/')) {
    const subPath = moduleName === 'three' ? '' : moduleName.slice('three'.length);
    return context.resolveRequest(context, path.join(THREE_ROOT, subPath), platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
