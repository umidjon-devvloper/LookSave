import { attachmentSignals, firstOf, firstOfHidden } from '../dom';
import { looksLikeResult, type Adapter } from './types';

/**
 * ChatGPT (chatgpt.com).
 *
 * ⚠️ IKKI XIL QURILMA BOR VA IKKALASI HAM QO'LLAB-QUVVATLANADI.
 *
 *   eski  — matn maydoni `contenteditable` (`#prompt-textarea`),
 *           tugmalarda `data-testid` bor.
 *   yangi — «octane» qurilmasi: matn maydoni haqiqiy `<textarea>`
 *           (`#mobile-composer-prompt` — nomida «mobile» bo'lsa ham
 *           keng oynada ham shu ishlatiladi), `data-testid` umuman
 *           yo'q, sinf nomlari chalkashtirilgan (`xlpm8z4`).
 *
 * ⚠️ FAQAT ESKISIGA YOZILGAN EDI VA KENGAYTMA JIM QOTARDI: `composer()`
 * `null` qaytarardi, kutish esa 30 soniya davom etardi. Shuning uchun
 * har selektor ikkala qurilma uchun ham beriladi.
 *
 * ⚠️ SINF NOMLARI SELEKTOR SIFATIDA ISHLATILMAYDI. Yangi qurilmada
 * ular hosil qilingan (`x1cpjm7i`) va har yig'ilishda o'zgaradi.
 */
/*
 * ⚠️ TUGMALAR TILDAN QAT'I NAZAR TOPILADI (2026-09-25).
 *
 * Yangi qurilmada `data-testid` yo'q, `aria-label` esa interfeys TILIDA:
 * ruscha ChatGPT'da «Отправить запрос». Faqat inglizcha selektor
 * qidirilganda tugma topilmasdi va kengaytma «suratlar yuklanishini»
 * 2 daqiqa kutib, promptgacha umuman yetib bormasdi — jurnalda
 * «suratlar biriktirildi» dan keyin jimjitlik.
 */
const SEND_LABEL = /send|отправ|yubor|jo'nat|إرسال/i;
const VOICE_LABEL = /voice|dictat|microphone|голос|диктов|микрофон|ovoz|صوت/i;

function composerForm(): HTMLElement | null {
  return chatgpt.composer()?.closest('form') ?? null;
}

/**
 * Kirish maydoni atrofidagi mantiqiy «idish».
 *
 * ⚠️ NEGA SHART (2026-11-18). ChatGPT 2026-noyabr tahririyatida
 * biriktirmalar va fayl kiritish maydoni endi `<form>` ICHIDA emas,
 * uning yonidagi `<div>` ichida chiziladi (yangi «octane» komponenti).
 * Hamma qidiruvlarni `form` ga bog'lab qo'ygan edik — natijada
 * `attachmentCount()` `-1` qaytarardi, `fileInputs()` bo'sh massiv.
 * Biriktirish uchala usul bilan ham ishlamagandek ko'rinardi, aslida
 * esa suratlar maydoniga TUSHIRILMASDI.
 *
 * Yangi «idish» — kirish maydonining eng yaqin tag-belgisiz ajdodi,
 * yo `form`, yoki uni o'z ichiga oluvchi katta `<div>` (sahifaning pastki
 * panel qismi). Ikkisi ham bo'lmasa `document` ishlatiladi.
 */
function composerArea(): ParentNode {
  const el = chatgpt.composer();
  if (!el) return document;

  const form = el.closest('form');
  if (form) return form;

  /*
   * Zaxira: kirish maydonining uch darajadagi ajdodi yetadi — ChatGPT'da
   * bu `#composer-background` yoki shunga o'xshash idish bo'ladi.
   */
  return (
    el.closest('[data-testid*="composer" i]') ??
    el.closest('[id*="composer" i]') ??
    el.parentElement?.parentElement?.parentElement ??
    document
  );
}

/** Forma ichidagi, yorlig'i `pattern` ga mos tugma. */
function labelled(pattern: RegExp): HTMLButtonElement | null {
  const scope = composerForm() ?? document;
  for (const button of scope.querySelectorAll<HTMLButtonElement>('button')) {
    const label = `${button.getAttribute('aria-label') ?? ''} ${button.title}`;
    if (pattern.test(label) && !VOICE_LABEL.test(label)) return button;
  }
  return null;
}

function findSendButton(): HTMLButtonElement | null {
  return (
    firstOf<HTMLButtonElement>([
      'button[data-testid="send-button"]',
      'button#composer-submit-button',
      'button[aria-label="Send message"]',
    ]) ??
    labelled(SEND_LABEL) ??
    // Oxirgi zaxira: formaning submit tugmasi (ovoz tugmasi emas)
    [...(composerForm()?.querySelectorAll<HTMLButtonElement>('button[type="submit"]') ?? [])].find(
      (button) => !VOICE_LABEL.test(button.getAttribute('aria-label') ?? ''),
    ) ??
    null
  );
}

export const chatgpt: Adapter = {
  id: 'chatgpt',

  matches() {
    return /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/.test(location.hostname);
  },

  composer() {
    return firstOf<HTMLElement>([
      '#prompt-textarea',
      'textarea#mobile-composer-prompt',
      'form textarea[placeholder]',
      'form div[contenteditable="true"]',
    ]);
  },

  sendButton() {
    const button = findSendButton();
    if (!button) return null;

    /*
     * ⚠️ `aria-disabled` HAM TEKSHIRILADI. Yangi qurilmada tugma
     * `disabled` xossasisiz, faqat `aria-disabled="true"` bilan
     * o'chiriladi — ya'ni `button.disabled` `false` qaytaradi va
     * kengaytma bo'sh xabarni yuborishga urinardi.
     */
    const off = button.disabled || button.getAttribute('aria-disabled') === 'true';
    return off ? null : button;
  },

  busy() {
    return Boolean(
      firstOf([
        'button[data-testid="stop-button"]',
        'button[aria-label*="Stop streaming"]',
        'button[aria-label="Stop generating"]',
        'form button[aria-label*="Stop"]',
      ]) ?? labelled(/stop|останов|прерв|to'xtat|إيقاف/i),
    );
  },

  uploading() {
    /*
     * ⚠️ PROMPT ENDI YUKLANISHDAN OLDIN YOZILADI — tugma matn tufayli erta
     * faollashishi mumkin. Shuning uchun biriktirma ustidagi yuklash
     * belgisi alohida kutiladi, aks holda xabar suratsiz ketardi.
     */
    const area = composerArea();
    return Boolean(
      area.querySelector(
        '[role="progressbar"], [aria-busy="true"], .animate-spin, circle[stroke-dasharray]',
      ),
    );
  },

  fileInputs() {
    /*
     * ⚠️ AVVAL KIRISH MAYDONI ATROFI. Sahifada bir nechta qurilma bor
     * va ularning har birida o'z fayl maydoni turadi; boshqasiniki
     * olinsa surat ko'rinmaydigan oynaga tushardi.
     *
     * ⚠️ `<form>` ICHIDA SHART EMAS (2026-11-18). ChatGPT yangi tahririda
     * fayl maydoni endi yonidagi `<div>` ichida chiziladi.
     *
     * ⚠️ «files» MAYDONI, «photos» YOKI «camera» EMAS. Uchalasiga ham
     * yozilsa surat uch marta biriktirilardi.
     */
    const area = composerArea();
    const scoped =
      (area as Element).querySelector?.<HTMLInputElement>(
        'input[type="file"][accept*="image"]',
      ) ?? (area as Element).querySelector?.<HTMLInputElement>('input[type="file"]');
    if (scoped) return [scoped];

    const any = firstOfHidden<HTMLInputElement>([
      '#octane-mobile-composer-files-input',
      'form input[type="file"][accept*="image"]',
      'input[type="file"][accept*="image"]',
      'form input[type="file"]',
      'input[type="file"]',
    ]);
    return any ? [any] : [];
  },

  attachmentCount() {
    /*
     * ⚠️ KO'P-SIGNAL (2026-11-18). ChatGPT biriktirma plitkasini sayt
     * versiyasiga bog'liq ravishda `<img>`, `background-image: url(blob:…)`
     * li `<span>`, yoki `[data-testid*="attachment"]` orqali chizadi.
     * Bitta belgiga bog'lanish «ko'r» bo'lib qoladi: 2026-11-18 tahririda
     * plitka `<img>` emas edi va eski kodimiz biriktirmani UMUMAN
     * ko'rmasdi, keyingi strategiya yana fayllar qo'shib yuborardi.
     *
     * `attachmentSignals` beshta belgini sanaydi va eng kattasini oladi.
     * Hech bir belgi 0 bo'lmasa `-1` — «bilmayman».
     */
    const max = attachmentSignals().max;
    return max > 0 ? max : -1;
  },

  lastReplyText() {
    const turns = document.querySelectorAll<HTMLElement>(
      'div[data-message-author-role="assistant"], article[data-testid^="conversation-turn"]',
    );

    const last = turns[turns.length - 1];
    if (last) return (last.textContent ?? '').trim();

    /*
     * ⚠️ ZAXIRA: yangi qurilmada javob o'ramida `data-message-author-role`
     * bo'lmasligi mumkin. U holda asosiy ustundagi oxirgi uzun matn
     * olinadi — matn maydonidagi yozuv chiqarib tashlanadi.
     */
    const blocks = [...document.querySelectorAll<HTMLElement>('main p, main div')]
      .filter((node) => !node.closest('form') && (node.textContent ?? '').trim().length > 40)
      .map((node) => (node.textContent ?? '').trim());

    return blocks[blocks.length - 1] ?? '';
  },

  resultImages() {
    const turns = document.querySelectorAll<HTMLElement>(
      'div[data-message-author-role="assistant"], article[data-testid^="conversation-turn"]',
    );

    const images: HTMLImageElement[] = [];

    for (const turn of turns) {
      for (const image of turn.querySelectorAll<HTMLImageElement>('img')) {
        if (looksLikeResult(image)) images.push(image);
      }
    }

    if (images.length > 0) return images;

    /*
     * ⚠️ ZAXIRA — VA `blob:` NI CHIQARIB TASHLAMAYDI.
     *
     * Ilgari shu yerda `!src.startsWith('blob:')` sharti turardi:
     * niyat biriktirmalarni chiqarib tashlash edi. Lekin ChatGPT
     * YASAGAN rasmni ham aynan `blob:` havola bilan ko'rsatadi —
     * ya'ni shart natijani ham birga o'chirardi. 2026-09-23 da
     * ChatGPT avatarni muvaffaqiyatli yasadi, kengaytma esa uch
     * daqiqa kutib «rasm qaytarmadi» dedi.
     *
     * Biriktirmalar boshqacha ajratiladi: ular matn maydonining
     * formasi ichida turadi.
     */
    return [...document.querySelectorAll<HTMLImageElement>('img')].filter(
      (image) =>
        looksLikeResult(image) && !image.closest('form') && !image.closest('nav, aside, header'),
    );
  },
};
