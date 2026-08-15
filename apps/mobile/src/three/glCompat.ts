import type * as THREE from 'three';

/**
 * `GLTFLoader` ni React Native'da ishlashga majburlaydi.
 *
 * MUAMMO: `GLTFParser` konstruktori tekstura yuklash usulini tanlash uchun
 * brauzerni aniqlaydi:
 *
 *   const userAgent = navigator.userAgent;
 *   userAgent.match( /Version\/(\d+)/ );
 *
 * React Native `navigator` ni belgilaydi, LEKIN `userAgent` siz. Natijada
 * `TypeError: Cannot read property 'match' of undefined` — va bu HAR BIR
 * GLB parse qilinganda otiladi, ya'ni birorta model umuman yuklanmaydi.
 *
 * Xato chalg'ituvchi: u modelga ham, tarmoqqa ham aloqasi yo'qdek
 * ko'rinadi va `catch` ichida yutilsa "model yuklanmadi" bo'lib qoladi.
 *
 * YECHIM: `userAgent` ga qiymat berish. Qiymatning o'zi ahamiyatsiz —
 * u faqat Safari/Firefox versiyasini aniqlash uchun kerak, ikkalasi ham
 * bu yerda yo'q, shuning uchun `createImageBitmap` bo'lmagani sababli
 * baribir oddiy `TextureLoader` tanlanadi.
 *
 * MODUL YUKLANGANDA CHAQIRILADI (`loader.ts` ning yuqorisida) — parse
 * boshlanishidan oldin bo'lishi shart.
 */
export function patchNavigatorUserAgent(): void {
  const holder = globalThis as { navigator?: { userAgent?: string } };
  const navigator = holder.navigator;

  if (!navigator || typeof navigator.userAgent === 'string') return;

  try {
    navigator.userAgent = 'react-native';
  } catch {
    // Ba'zi muhitlarda `navigator` faqat o'qish uchun — o'sha holda
    // xossani majburan qo'shamiz
    Object.defineProperty(navigator, 'userAgent', {
      value: 'react-native',
      configurable: true,
    });
  }
}

/**
 * `expo-gl` ↔ `three` mosligi.
 *
 * MUAMMO: three r166 shader dasturini birinchi marta ishlatganda
 * (`WebGLProgram.onFirstUse`) diagnostika o'qiydi:
 *
 *   gl.getProgramInfoLog(program).trim()
 *   gl.getShaderInfoLog(shader).trim()
 *
 * `expo-gl` bu ikkalasini yangi arxitektura (bridgeless) rejimida
 * `undefined` qaytaradi — natijada `TypeError: Cannot read property
 * 'trim' of undefined`.
 *
 * NEGA BU OG'RIQLI: xato `onFirstUse` ichida otiladi, ya'ni dastur
 * "tayyor" deb belgilanmaydi. three keyingi kadrda yana urinadi va yana
 * yiqiladi — sahna umuman chizilmaydi, log esa soniyasiga o'nlab marta
 * to'ladi. Tashqaridan bu "3D ishlamayapti" bo'lib ko'rinadi.
 *
 * YECHIM: log o'qish funksiyalarini har doim satr qaytaradigan qilib
 * o'raymiz. Kontekst JSI obyekti bo'lgani uchun o'zgartirish jim rad
 * etilishi mumkin — shuning uchun natija tekshiriladi va muvaffaqiyatsiz
 * bo'lsa three'ning o'z bayrog'i bilan diagnostika o'chiriladi.
 *
 * ⚠️ Har ikki holatda ham shader xato xabarlari bo'sh bo'ladi. Bu yo'qotish
 * emas: `expo-gl` baribir matn bermayapti. `LINK_STATUS` tekshiruvi esa
 * birinchi variantda saqlanib qoladi.
 */
export function patchShaderLogs(renderer: THREE.WebGLRenderer): void {
  const gl = renderer.getContext();

  try {
    const shaderLog = gl.getShaderInfoLog.bind(gl);
    const programLog = gl.getProgramInfoLog.bind(gl);

    const safeShaderLog = (shader: WebGLShader): string => shaderLog(shader) ?? '';
    const safeProgramLog = (program: WebGLProgram): string => programLog(program) ?? '';

    gl.getShaderInfoLog = safeShaderLog;
    gl.getProgramInfoLog = safeProgramLog;

    // JSI host obyekti yozishni jim rad etishi mumkin — shuni tekshiramiz
    if (gl.getShaderInfoLog !== safeShaderLog || gl.getProgramInfoLog !== safeProgramLog) {
      throw new Error('WebGL konteksti o`zgartirishga ruxsat bermadi');
    }
  } catch {
    renderer.debug.checkShaderErrors = false;
  }
}
