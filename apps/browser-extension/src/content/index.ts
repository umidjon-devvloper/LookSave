import type { ContentRequest, ContentResponse, ProgressMessage } from '../shared/messages';
import { chatgpt } from './adapters/chatgpt';
import { gemini } from './adapters/gemini';
import type { Adapter } from './adapters/types';
import { diagnose, testSend } from './diagnose';
import {
  attachFiles,
  base64ToFile,
  clearAttachments,
  hasPrompt,
  readImage,
  sleep,
  submit,
  typeInto,
  waitFor,
} from './dom';

/**
 * AI sahifasidagi qo'l.
 *
 * Worker «mana avatar, mana kiyim, mana matn» deydi — bu yerda esa
 * odam qiladigan harakatlar takrorlanadi: suratlarni tashlash, matnni
 * yozish, yuborish va javobni kutish.
 *
 * ⚠️ QADAMLAR IKKALA SAYT UCHUN BIR XIL. Farq faqat selektorlarda
 * (`adapters/`). Mantiqni har sayt uchun takrorlash ikki barobar xato
 * degani — sayt yangilanganda bittasi tuzatilib, ikkinchisi unutilardi.
 */

const ADAPTERS: Adapter[] = [chatgpt, gemini];

const adapter = ADAPTERS.find((candidate) => candidate.matches()) ?? null;

/** Sahifa ochilganda matn maydoni darhol bo'lmaydi — ilova yuklanishi kerak. */
const COMPOSER_TIMEOUT_MS = 30_000;

/**
 * Javob boshlanishini kutish.
 *
 * ⚠️ BOSHLANMASA HAM DAVOM ETAMIZ. Ba'zan model shu qadar tez javob
 * beradiki, «to'xtatish» tugmasi so'rov davrasi orasida umuman
 * ko'rinmaydi. Buni xato deb hisoblash tayyor natijani tashlab
 * yuborardi — shuning uchun bu kutish yumshoq.
 */
const START_TIMEOUT_MS = 25_000;

/**
 * Yuborilgandan keyin o'z suratlarimiz chizilishiga beriladigan vaqt.
 *
 * ⚠️ RASM YASALISHIDAN QISQA BO'LISHI SHART. Bu kutish tugagach mavjud
 * suratlar ro'yxati olinadi; natija shundan keyin paydo bo'lishi kerak.
 * Rasm yasash kamida yarim daqiqa oladi, ya'ni sakkiz soniya xavfsiz.
 */
const SETTLE_MS = 8_000;

/**
 * Suratlar serverga yuklanishiga beriladigan vaqt.
 *
 * ⚠️ UZUN BO'LISHI SHART. Gavda surati bir necha megabayt bo'ladi va
 * sekin aloqada yuklash yarim daqiqadan oshadi. Qisqa bo'lsa kengaytma
 * yuklanmagan suratlar bilan yuborardi.
 */
const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Har qadam jurnalga chiqadi.
 *
 * ⚠️ JAVOB KUTILMAYDI (`void`). Progress xabari — bir tomonlama; unga
 * javob kutilsa kiyintirish worker'ning band bo'lishiga bog'lanib
 * qolardi.
 */
/**
 * ⚠️ CONTENT SCRIPT ALOHIDA YANGILANADI. U sahifaga YUKLANISH paytida
 * qo'yiladi: kengaytma yangilansa ham, ochiq turgan tabda ESKISI
 * ishlayveradi. Shuning uchun versiyani u ham o'zi aytadi.
 */
function scriptVersion(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return '?';
  }
}

function step(text: string): void {
  void chrome.runtime
    .sendMessage({ type: 'PROGRESS', text } satisfies ProgressMessage)
    .catch(() => undefined);
}

/**
 * Promptni SAHIFADAGI matn maydoniga yozadi va u yerda turganini tekshiradi.
 * Sayt maydonni qayta chizsa (surat biriktirilgach) — yangisini topib qayta
 * yozadi. Uch urinishda ham ko'rinmasa yubormaydi: promptsiz xabar kredit
 * yeydi va yaroqsiz natija beradi.
 */
/** Jurnal uchun element tavsifi: `div#prompt-textarea.ProseMirror` */
function describe(element: HTMLElement): string {
  const id = element.id ? `#${element.id}` : '';
  const cls = typeof element.className === 'string' && element.className.includes('ProseMirror')
    ? '.ProseMirror'
    : '';
  const editable = element.isContentEditable ? ' [contenteditable]' : '';
  return `${element.tagName.toLowerCase()}${id}${cls}${editable}${element.isConnected ? '' : ' (uzilgan)'}`;
}

async function typePrompt(prompt: string, initial: HTMLElement): Promise<HTMLElement> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const current = adapter?.composer() ?? null;
    const element = current && current.isConnected ? current : initial;
    if (!element.isConnected) {
      await sleep(700);
      continue;
    }

    let how: string;
    try {
      how = typeInto(element, prompt);
    } catch (error) {
      how = `xato: ${error instanceof Error ? error.message : String(error)}`;
    }
    await sleep(400);

    // Yozilgandan keyin ham maydon almashgan bo'lishi mumkin — oxirgisini tekshiramiz
    const settled = adapter?.composer() ?? element;
    if (hasPrompt(settled, prompt)) {
      step(`prompt yozildi (${how})`);
      return settled;
    }

    // Jurnalda aniq sabab: qaysi element va qaysi usul — tashqaridan taxmin qilinmasin
    step(
      `prompt ko'rinmadi (${attempt}/3) — usul: ${how}, maydon: ${describe(settled)}`,
    );
    await sleep(700);
  }

  throw new Error('Prompt matn maydoniga yozilmadi — sahifani yangilab, qayta urinib ko`ring');
}

async function dress(
  request: Extract<ContentRequest, { type: 'DRESS' }>,
): Promise<ContentResponse> {
  if (!adapter) return { ok: false, error: 'Bu sahifa qo`llab-quvvatlanmaydi' };

  const composer = await waitFor(() => adapter.composer(), {
    timeoutMs: COMPOSER_TIMEOUT_MS,
    what: 'Matn maydoni topilmadi',
  });

  const files = request.images.map((image) => base64ToFile(image.base64, image.mime, image.name));

  /*
   * ⚠️ IKKINCHI HIMOYA (2026-11-18). `freshChat` sahifani qayta yukladi,
   * lekin ChatGPT yubroilmagan biriktirmalarni ichki holatidan tiklab
   * yuborishi mumkin — natijada kirish maydonida avvalgi ishdan qolgan
   * suratlar paydo bo'ladi va yangilari ularning ustiga qo'shiladi.
   * Yangi biriktirishdan oldin eskilari o'chiriladi.
   */
  const leftover = Math.max(adapter.attachmentCount(), 0);
  if (leftover > 0) {
    const removed = await clearAttachments(() => adapter.attachmentCount());
    step(`avvalgi ${leftover} biriktirma tozalandi (${removed} tugma bosildi)`);
  }

  step(`${files.length} surat biriktirilmoqda… (sahifa skripti v${scriptVersion()})`);
  const how = await attachFiles(
    composer,
    files,
    () => adapter.attachmentCount(),
    adapter.fileInputs(),
    () => adapter.sendButton(),
  );
  step(`suratlar biriktirildi (${how})`);

  /*
   * ⚠️ MATN MAYDONI QAYTADAN OLINADI. Yuqoridagi `composer` surat
   * biriktirishdan OLDIN topilgan; ChatGPT biriktirishdan keyin maydonni
   * qayta chizadi va u element sahifadan uziladi. Unga yozilgan prompt
   * hech qayerda ko'rinmasdi — xabar faqat suratlar bilan ketardi.
   */
  const target = await typePrompt(request.prompt, composer);

  /*
   * ⚠️ PROMPT YUKLANISHNI KUTMAYDI. Ilgari u suratlar serverga yuklanib,
   * yuborish tugmasi faollashgandan KEYIN yozilardi — tugma topilmasa
   * (masalan, boshqa tildagi interfeys) prompt umuman yozilmasdi.
   */
  step('suratlar serverga yuklanishi kutilmoqda…');

  // Sayt biriktirmani ro'yxatga olib, yuklash belgisini chizishiga fursat
  await sleep(1_500);
  await waitFor(() => !adapter.uploading?.(), {
    timeoutMs: UPLOAD_TIMEOUT_MS,
    what: 'Suratlar serverga yuklanmadi (yuklash belgisi yo`qolmadi)',
    intervalMs: 500,
  });

  /*
   * ⚠️ BIRIKTIRISH ≠ YUKLANISH, VA BU FARQ HAMMASINI HAL QILADI.
   *
   * Sayt tanlangan suratning ko'rinishini DARHOL chizadi (`blob:`),
   * serverga yuklash esa bir necha soniya ketadi. Ko'rinishga qarab
   * yuborilsa, xabar suratlarsiz ketadi va model javob beradi:
   * «I can't access the reference images» — ya'ni nosozlik emas,
   * BO'SH natija, va uni faqat javobni o'qib bilish mumkin.
   *
   * Yuklash tugaganining ishonchli belgisi — YUBORISH TUGMASI
   * FAOLLASHISHI. Sayt yuklash davomida uni o'chirib turadi, tugagach
   * esa (matn bo'lmasa ham, faqat surat bilan) yoqadi.
   */
  await waitFor(() => adapter.sendButton(), {
    timeoutMs: UPLOAD_TIMEOUT_MS,
    what: 'Suratlar serverga yuklanmadi',
    intervalMs: 500,
  });
  step('suratlar yuklandi');

  /* Yuklash ro'yxatga olinishiga qo'shimcha kafolat */
  await sleep(2_000);


  /*
   * ⚠️ TUGMA FAOL BO'LMASA UMUMAN YUBORMAYMIZ.
   *
   * Ilgari bu kutish `catch` bilan yutilardi va `submit` baribir
   * chaqirilardi. Tugma o'chiq bo'lsa `click` hech narsa qilmasdi,
   * `Enter` esa MATNNI SURATSIZ yuborib yborardi — eng yomon holat:
   * ChatGPT javob beradi, kredit sarflanadi, natija esa yaroqsiz.
   */
  await waitFor(() => adapter.sendButton(), {
    timeoutMs: 30_000,
    what: 'Yuborish tugmasi faollashmadi — suratlar yuklanmagan bo`lishi mumkin',
    intervalMs: 500,
  });

  const sentBy = await submit(target, request.prompt, () => adapter.sendButton());
  step(`yuborildi (${sentBy}) — javob kutilmoqda`);

  /*
   * ⚠️ MAVJUD SURATLAR RO'YXATI YUBORISHDAN KEYIN OLINADI — VA BU SHART.
   *
   * Xabar ketgach BIZ TASHLAGAN uchta surat suhbatda foydalanuvchi
   * xabari bo'lib paydo bo'ladi. Ro'yxat yuborishdan OLDIN olinsa,
   * ular ham «yangi rasm» bo'lib chiqadi va kengaytma o'zi yuborgan
   * kiyim suratini natija deb mijozga yuborardi.
   *
   * Kutish shu suratlar chizilishiga yetadi, lekin rasm yasalishidan
   * ancha qisqa (u kamida yarim daqiqa oladi).
   */
  await sleep(SETTLE_MS);
  const before = new Set(adapter.resultImages().map((image) => image.src));

  /*
   * ⚠️ JAVOB BOSHLANMASA HAM DAVOM ETAMIZ. Ba'zan model shu qadar tez
   * javob beradiki, «to'xtatish» tugmasi so'rov davrasi orasida umuman
   * ko'rinmaydi. Buni xato deb hisoblash tayyor natijani tashlardi.
   */
  const started = await waitFor(() => adapter.busy(), {
    timeoutMs: START_TIMEOUT_MS,
    what: 'Javob boshlanmadi',
  })
    .then(() => true)
    .catch(() => false);

  if (started) {
    await waitFor(() => !adapter.busy(), {
      timeoutMs: request.timeoutMs,
      what: 'Javob tugamadi',
      intervalMs: 1_000,
    });
  }

  step(started ? 'javob tugadi — rasm kutilmoqda' : 'holat bilinmadi — rasm kutilmoqda');

  /*
   * ⚠️ HOLAT BILINMASA RASMNI UZOQROQ KUTAMIZ.
   *
   * `busy()` «to'xtatish» tugmasidan bilinadi, uning selektori esa
   * saytning yangi qurilmasida boshqacha bo'lishi mumkin. Agar u hech
   * qachon `true` bo'lmasa, yuqoridagi kutish DARHOL o'tib ketadi va
   * rasm kutish yagona chegara bo'lib qoladi — qisqa bo'lsa, hali
   * chizilayotgan natija tashlab yuborilardi.
   *
   * Ya'ni bu qator `busy()` ni aniqlay olmaslikni NOSOZLIKDAN sekinroq
   * ishlashga aylantiradi.
   */
  const imageTimeout = started ? 60_000 : request.timeoutMs;

  /*
   * ⚠️ RASM JAVOB TUGAGANDAN KEYIN HAM BIR NECHA SONIYA KECHIKADI —
   * u alohida yuklanadi. `naturalWidth` esa rasm TO'LIQ kelganini
   * bildiradi; usiz yarim yuklangan surat o'qilib, buzuq fayl
   * mijozga ketardi.
   */
  const fresh = await waitFor(
    () => {
      const candidates = adapter.resultImages().filter((image) => !before.has(image.src));
      const last = candidates[candidates.length - 1];
      return last && last.complete && last.naturalWidth > 0 ? last : null;
    },
    { timeoutMs: imageTimeout, what: 'AI rasm qaytarmadi', intervalMs: 500 },
  ).catch(() => {
    /*
     * ⚠️ JAVOB MATNI XATOGA QO'SHILADI — BU ENG MUHIM TASHXIS.
     * «Rasm qaytarmadi» o'zi hech narsa aytmaydi: model rad etganmi,
     * savol berganmi, yoki rasm chizilib selektor topmaganmi — uchalasi
     * bir xil ko'rinadi. Birinchi ikkitasini kod bilan tuzatib bo'lmaydi
     * (prompt yoki butun yondashuv o'zgarishi kerak), uchinchisini esa
     * bo'ladi — lekin faqat javobni o'qib.
     */
    const reply = adapter.lastReplyText().replace(/\s+/g, ' ').slice(0, 200);
    throw new Error(reply ? `AI rasm o'rniga matn qaytardi: «${reply}»` : 'AI rasm qaytarmadi');
  });

  const read = await readImage(fresh.src);
  if (read) return { ok: true, type: 'IMAGE', mime: read.mime, base64: read.base64 };

  // CORS to'sdi — havolani workerga beramiz, unda ruxsat bor
  return { ok: true, type: 'IMAGE_URL', url: fresh.src };
}

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  const request = message as ContentRequest;

  if (request.type === 'PING') {
    respond(
      adapter
        ? ({ ok: true, type: 'PONG', adapter: adapter.id } satisfies ContentResponse)
        : ({ ok: false, error: 'Bu sahifa qo`llab-quvvatlanmaydi' } satisfies ContentResponse),
    );
    return true;
  }

  if (request.type === 'DIAGNOSE') {
    diagnose(adapter)
      .then((lines) => respond({ ok: true, type: 'REPORT', lines } satisfies ContentResponse))
      .catch((error: unknown) => {
        respond({
          ok: false,
          error: error instanceof Error ? error.message : 'Tekshiruv yiqildi',
        } satisfies ContentResponse);
      });
    return true;
  }

  if (request.type === 'TEST_SEND') {
    testSend(adapter)
      .then((lines) => respond({ ok: true, type: 'REPORT', lines } satisfies ContentResponse))
      .catch((error: unknown) => {
        respond({
          ok: false,
          error: error instanceof Error ? error.message : 'Sinov yiqildi',
        } satisfies ContentResponse);
      });
    return true;
  }

  if (request.type === 'DRESS') {
    dress(request)
      .then(respond)
      .catch((error: unknown) => {
        respond({
          ok: false,
          error: error instanceof Error ? error.message : 'Noma`lum xato',
        } satisfies ContentResponse);
      });
    return true;
  }

  return false;
});
