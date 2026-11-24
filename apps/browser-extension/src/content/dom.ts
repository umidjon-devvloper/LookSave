/**
 * Sahifa bilan ishlashning umumiy qismi — ikkala adapter ham shuni ishlatadi.
 *
 * ⚠️ BU FAYL «BEGONA SAHIFA» BILAN GAPLASHADI. Sayt bizniki emas: uning
 * DOM'i istalgan yangilanishda o'zgaradi. Shuning uchun har funksiya
 * MUVAFFAQIYATSIZLIKNI OCHIQ AYTADI — jim `false` qaytarish o'rniga xato
 * tashlaydi. Aks holda kengaytma «ishladim» deb, aslida bo'sh xabar
 * yuborgan bo'lardi va operator buni faqat mijozning shikoyatidan bilardi.
 */

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * «O'chirish» / «Delete» tugmasini topish uchun mahalliylashtirilgan qidiruv.
 *
 * ⚠️ TILI ISHLATUVCHISINIKI (2026-11-18). Oldin faqat inglizcha qidirardik,
 * natijada ChatGPT'ning ruscha interfeysida («Удалить вложение») biror
 * biriktirmani ko'rmaganmiz va «qolib ketdi» deb o'ylaganmiz. Keyingi
 * ishlar esa ularning ustiga qo'shavergan.
 */
export const REMOVE_LABEL_RE =
  /remove|delete|dismiss|убрать|удал|o'chir|o`chir|o‘chir|حذف|إزالة|supprim|entfern|elimin/i;

function notInResult(element: Element): boolean {
  return !element.closest(
    '[data-message-author-role], article[data-testid^="conversation-turn"]',
  );
}

/**
 * Kirish paneli atrofidagi mantiqiy to'rtburchak.
 *
 * ⚠️ NEGA SHART (2026-11-18). Sahifada biriktirmaga aloqasi yo'q
 * «Удалить»/«Delete» yorliqli tugmalar bo'lishi mumkin (yon panel, dialog,
 * menyu, loyiha/fayl kartochkalari). Agar `clearAttachments` ularning ham
 * hammasini bossa — foydalanuvchining haqiqiy akkaunt ma'lumotini o'chirib
 * yuborishi mumkin. Shuning uchun BOSHIDAN qidirishni kirish paneli
 * hududi bilan cheklaymiz.
 */
function findComposerElement(): HTMLElement | null {
  const selectors = [
    '#prompt-textarea',
    'textarea#mobile-composer-prompt',
    'form textarea[placeholder]',
    'form div[contenteditable="true"]',
    'textarea[placeholder]',
    'div[contenteditable="true"]',
  ];
  for (const selector of selectors) {
    const node = document.querySelector<HTMLElement>(selector);
    if (node) return node;
  }
  return null;
}

function composerRegion(): HTMLElement | null {
  const composer = findComposerElement();
  if (!composer) return null;

  const wrap = composer.closest<HTMLElement>(
    'form, [data-testid*="composer" i], [id*="composer" i]',
  );
  if (wrap) return wrap;

  let node: HTMLElement | null = composer;
  for (let i = 0; i < 4 && node.parentElement; i += 1) node = node.parentElement;
  return node;
}

const FORBIDDEN_ANCESTORS =
  'nav, aside, header, [role="dialog"], [role="menu"], [role="menuitem"], [role="listbox"], [data-message-author-role], article[data-testid^="conversation-turn"]';

function inForbidden(element: Element): boolean {
  return Boolean(element.closest(FORBIDDEN_ANCESTORS));
}

/**
 * Element kirish paneli hududida (yoki uning atrofida ±150 px da) joylashganmi.
 * `nav/aside/header/dialog/menu` ichidagi hech narsa hudud deb hisoblanmaydi.
 */
function inComposerRegion(element: Element): boolean {
  if (inForbidden(element)) return false;

  const region = composerRegion();
  if (!region) return false;

  if (region.contains(element)) return true;

  /* Geometriya zaxirasi — plitka ba'zan hudud tashqarisida chiziladi. */
  const rr = region.getBoundingClientRect();
  const er = element.getBoundingClientRect();
  if (er.width === 0 && er.height === 0) return false;

  const pad = 150;
  return (
    er.top >= rr.top - pad &&
    er.bottom <= rr.bottom + pad &&
    er.left >= rr.left - pad &&
    er.right <= rr.right + pad
  );
}

/*
 * ⚠️ Yuborish, ovoz, «+», model/attach tugmalarining yorliqlari.
 * Biriktirma tozalashda ularga TEGMASLIGI shart — ba'zan ularning
 * `aria-label` ida ham «Delete»/«Remove» uchraydi (masalan, «Delete draft»
 * tugmasi) va shundagina shu istisnolar kerak bo'ladi.
 */
const SEND_VOICE_RE = /send|отправ|yubor|jo'nat|إرسال|voice|dictat|microphone|голос|диктов|микрофон|ovoz|صوت|attach|skrepk/i;

/**
 * Biriktirmaning TURLI BELGILARINI sanaydi va eng kattasini qaytaradi.
 *
 * ⚠️ NEGA (2026-11-18). ChatGPT biriktirma plitkasini saytga bog'liq
 * ravishda `<img src="blob:…">`, `<span style="background-image: url(blob:…)">`,
 * `[data-testid*="attachment"]` yoki mahalliylashtirilgan yorlig'i bo'lgan
 * tugma bilan chizadi. Bitta belgiga bog'lanish «ko'r» bo'lib qoladi: 2026-11-18
 * tahririyatida plitka `<img>` emas, `<span>` edi va eski kodimiz biriktirmani
 * KO'RMADI, keyingi usul esa yana suratlar qo'shaverdi — kirish maydonida 12
 * ta surat yig'ildi.
 *
 * Qo'shimcha: `fileNames` berilsa, DOM'dagi `aria-label/title/alt` ichida
 * aynan o'sha nom (`face-1.jpg` kabi) bor elementlar ham sanaladi — bu
 * tildan va chizish usulidan mustaqil belgi.
 */
export function attachmentSignals(fileNames: string[] = []): {
  blobImg: number;
  bgBlob: number;
  testIdAttachment: number;
  removeButton: number;
  fileNameLabel: number;
  max: number;
} {
  const blobImg = [...document.querySelectorAll<HTMLImageElement>('img[src^="blob:"]')].filter(
    notInResult,
  ).length;

  const bgBlob = [...document.querySelectorAll<HTMLElement>('[style*="blob:"]')].filter(
    notInResult,
  ).length;

  const testIdAttachment = [
    ...document.querySelectorAll<HTMLElement>('[data-testid*="attachment" i]'),
  ].filter(notInResult).length;

  const removeButton = [
    ...document.querySelectorAll<HTMLElement>('button[aria-label], button[title]'),
  ].filter((button) => {
    const label = `${button.getAttribute('aria-label') ?? ''} ${button.getAttribute('title') ?? ''}`;
    if (!REMOVE_LABEL_RE.test(label)) return false;
    if (SEND_VOICE_RE.test(label)) return false;
    /*
     * ⚠️ FAQAT KIRISH PANELI HUDUDIDA (2026-11-18). Sahifaning boshqa
     * joyidagi «Удалить»/«Delete» tugmasi (fayl kartochkasi, loyiha,
     * dialog) biriktirma emas — sanalmasin.
     */
    return inComposerRegion(button);
  }).length;

  let fileNameLabel = 0;
  if (fileNames.length > 0) {
    const needle = new RegExp(
      fileNames
        .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|'),
      'i',
    );
    fileNameLabel = [
      ...document.querySelectorAll<HTMLElement>('[aria-label], [title], [alt]'),
    ].filter((element) => {
      if (!notInResult(element)) return false;
      const text = `${element.getAttribute('aria-label') ?? ''} ${element.getAttribute('title') ?? ''} ${element.getAttribute('alt') ?? ''}`;
      return needle.test(text);
    }).length;
  }

  return {
    blobImg,
    bgBlob,
    testIdAttachment,
    removeButton,
    fileNameLabel,
    max: Math.max(blobImg, bgBlob, testIdAttachment, removeButton, fileNameLabel),
  };
}

/** Xulosa qatori — jurnalga chiqadi, «qaysi belgi ko'rdi» ni aytadi. */
export function signalSummary(fileNames: string[] = []): string {
  const s = attachmentSignals(fileNames);
  return `blob-img:${s.blobImg}, bg-blob:${s.bgBlob}, testid:${s.testIdAttachment}, remove-btn:${s.removeButton}, fayl-nomi:${s.fileNameLabel}`;
}

/** Shart bajarilguncha kutadi. Bajarilmasa — sababi bilan xato. */
export async function waitFor<T>(
  probe: () => T | null | undefined | false,
  options: { timeoutMs: number; what: string; intervalMs?: number },
): Promise<T> {
  const deadline = Date.now() + options.timeoutMs;
  const interval = options.intervalMs ?? 300;

  for (;;) {
    const value = probe();
    if (value) return value;

    if (Date.now() > deadline) {
      throw new Error(`${options.what} — kutish vaqti tugadi (${options.timeoutMs / 1000}s)`);
    }

    await sleep(interval);
  }
}

/**
 * Ko'rinadigan element bormi.
 *
 * ⚠️ SAHIFADA BIR NECHTA MATN MAYDONI BO'LADI. ChatGPT bir vaqtda ham
 * keng oyna, ham tor oyna uchun qurilma chizadi va ULARNING BIRI
 * YASHIRIN turadi (CSS bilan). Yashiriniga yozilsa hammasi «ishlagandek»
 * ko'rinadi — surat biriktiriladi, matn yoziladi, tugma bosiladi — lekin
 * ekranda hech narsa o'zgarmaydi va xabar yuborilmaydi.
 *
 * 2026-09-23 da aynan shu bo'lgan: jurnalda «yuborildi» yozilgan,
 * ChatGPT esa bo'sh turgan.
 */
function visible(element: Element): boolean {
  const box = element.getBoundingClientRect();
  if (box.width < 2 || box.height < 2) return false;

  const style = getComputedStyle(element);
  return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
}

/**
 * Selektorlar bo'yicha KO'RINADIGAN birinchi elementni qaytaradi.
 *
 * ⚠️ HAR SELEKTOR BO'YICHA HAMMASI KO'RIB CHIQILADI, `querySelector`
 * EMAS. Birinchi mos kelgan element yashirin bo'lsa, `querySelector`
 * aynan o'shani qaytarardi va ko'rinadigani umuman sinalmasdi.
 */
export function firstOf<T extends Element>(selectors: string[]): T | null {
  for (const selector of selectors) {
    for (const found of document.querySelectorAll<T>(selector)) {
      if (visible(found)) return found;
    }
  }
  return null;
}

/**
 * Ko'rinishiga qaramaydigan variant.
 *
 * ⚠️ FAYL MAYDONI UCHUN SHART. `input[type=file]` bu saytlarda HAR DOIM
 * yashirin bo'ladi — uni ko'rinish bo'yicha filtrlasak, hech qachon
 * topilmasdi.
 */
export function firstOfHidden<T extends Element>(selectors: string[]): T | null {
  for (const selector of selectors) {
    const found = document.querySelector<T>(selector);
    if (found) return found;
  }
  return null;
}

/**
 * Matnni contenteditable ichiga yozadi — ikki usulni sinab.
 *
 * ⚠️ HAR IKKALASIDAN KEYIN MATN JOYLASHGANI TEKSHIRILADI. Bu yerdagi
 * eng aldamchi nosozlik — matn ekranda ko'rinadi, lekin freymvorkning
 * holatiga yetmaydi: «Yuborish» BO'SH xabar yuboradi va model «rasm
 * ko'rmayapman» deb javob beradi. Xato hech qayerda chiqmaydi.
 */
export function typeInto(element: HTMLElement, text: string): string {
  /*
   * ⚠️ `<textarea>` BUTUNLAY BOSHQACHA ISHLAYDI. Yangi ChatGPT
   * qurilmasida matn maydoni haqiqiy `<textarea>`, eskisida esa
   * `contenteditable` div. Birinchisiga `execCommand` ham,
   * `textContent` ham yaramaydi — qiymat `value` da turadi.
   */
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    if (setNativeValue(element, text)) return 'value';
    throw new Error('Promptni yozib bo`lmadi — matn maydoni qiymatni qabul qilmadi');
  }

  /*
   * ⚠️ `contenteditable` DA QATOR BO'SHLIQLARI BO'SHLIQQA AYLANADI.
   * Varaq prompti bandlarga bo'lingan (`\n\n`); ProseMirror/Quill ichiga
   * `insertText` bilan yangi qator tashlansa, sayt uni Enter deb o'qib
   * xabarni yarim yo'lda yuborishi mumkin. Model uchun bandlar shart emas.
   */
  text = text.replace(/\s*\n+\s*/g, ' ');

  /*
   * ⚠️ AVVAL PASTE (2026-09-25). Yangi ChatGPT'da maydon ProseMirror:
   * `execCommand` sahifa fokusda bo'lmasa ishlamaydi (fokus popupda yoki
   * fayl maydonida qoladi), `textContent` ga yozilganini esa ProseMirror
   * o'z holatidan qaytarib o'chiradi. Sun'iy `paste` hodisasini esa u
   * fokussiz ham qabul qiladi — suratlar ham aynan shu yo'l bilan
   * biriktiriladi. Bo'sh matn (tozalash) paste bilan qilinmaydi.
   */
  if (text && insertByPaste(element, text)) return 'paste';

  if (insertByCommand(element, text)) return 'execCommand';

  /*
   * ⚠️ ZAXIRA YO'L SHART, CHUNKI POPUP OCHIQ TURSA BIRINCHISI ISHLAMAYDI.
   * `execCommand` fokusdagi HUJJATNI talab qiladi; kengaytma popupi
   * ochilganda fokus unda bo'ladi va sahifada emas. Operator esa aynan
   * popupga qarab o'tiradi — ya'ni eng ko'p uchraydigan hol.
   *
   * To'g'ridan-to'g'ri DOM'ga yozish ham yetadi: ChatGPT (ProseMirror) va
   * Gemini (Quill) ikkalasi ham matn maydonini `MutationObserver` bilan
   * kuzatadi, ya'ni qo'shilgan tugunni o'z holatiga oladi.
   */
  if (insertByDom(element, text)) return 'dom';

  throw new Error('Promptni yozib bo`lmadi — sahifa matn maydonini qabul qilmadi');
}

function insertByPaste(element: HTMLElement, text: string): boolean {
  try {
    element.focus();
    const data = new DataTransfer();
    data.setData('text/plain', text);
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  } catch {
    return false;
  }
  return contains(element, text);
}

/**
 * React boshqaradigan maydonga qiymat yozish.
 *
 * ⚠️ `el.value = matn` YETMAYDI. React qiymatni o'zi kuzatadi va
 * to'g'ridan-to'g'ri yozilganini «o'zgarmadi» deb hisoblaydi: ekranda
 * matn turadi, holatda esa bo'sh qoladi va «Yuborish» o'chiq qolaveradi.
 * Prototipdagi ASL setter chaqirilsa React uni o'z o'zgarishi deb
 * qabul qiladi.
 */
function setNativeValue(element: HTMLTextAreaElement | HTMLInputElement, text: string): boolean {
  const prototype = Object.getPrototypeOf(element) as object;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  try {
    element.focus();

    if (setter) setter.call(element, text);
    else element.value = text;

    element.dispatchEvent(new Event('input', { bubbles: true }));
  } catch {
    return false;
  }

  return element.value.includes(text.slice(0, 40));
}

/** Matn haqiqatan joylashdimi — YAGONA ishonchli tekshiruv. */
function contains(element: HTMLElement, text: string): boolean {
  const probe = text.slice(0, 40);
  return (element.textContent ?? '').includes(probe);
}

function insertByCommand(element: HTMLElement, text: string): boolean {
  try {
    element.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);

    document.execCommand('insertText', false, text);
  } catch {
    return false;
  }

  /*
   * ⚠️ `execCommand` NING QAYTARGAN QIYMATIGA ISHONMAYMIZ. U fokussiz
   * hujjatda ham ba'zan `true` qaytaradi, matn esa joylashmaydi.
   */
  return contains(element, text);
}

function insertByDom(element: HTMLElement, text: string): boolean {
  try {
    element.textContent = text;

    element.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
    );
  } catch {
    return false;
  }

  return contains(element, text);
}

function transferOf(files: File[]): DataTransfer {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  return transfer;
}

/**
 * Suratlarni suhbatga biriktiradi — UCHTA USULNI KETMA-KET SINAB.
 *
 * ⚠️ BITTA USULGA ISHONIB BO'LMAYDI. Sayt fayllarni qanday qabul qilishi
 * (paste / drop / yashirin fayl maydoni) versiyadan versiyaga o'zgaradi,
 * va qaysi biri ishlayotganini OLDINDAN bilish imkoni yo'q.
 *
 * ⚠️ HODISANING «BEKOR QILINDIMI» BELGISIGA QARAB XULOSA QILMAYMIZ.
 * Ilgari `paste` dan qaytgan `false` «qabul qilindi» deb o'qilardi —
 * lekin sayt hodisani ushlab, `preventDefault()` ni CHAQIRMASLIGI ham
 * mumkin. Natijada kengaytma suratlar biriktirildi deb o'ylab, bo'sh
 * so'rov yuborardi. Endi yagona o'lchov — EKRANDA biriktirma
 * paydo bo'ldimi (`probe`).
 */
/**
 * Zaxira muvaffaqiyat belgisi: kirish maydoni BO'SH turganda yuborish
 * tugmasi faollashganmi.
 *
 * ⚠️ BU TILDAN MUSTAQIL BELGI. Matn yozilmagan bo'lsa, yuborish tugmasini
 * yoqadigan yagona narsa — biriktirma. Agar `probe()` biror sababdan
 * biriktirmani ko'rmasa ham, bu belgi ularning saytga joylashganini
 * aytadi.
 */
function emptyComposerWithSend(
  composer: HTMLElement,
  sendButton: () => HTMLElement | null,
): boolean {
  const text =
    composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement
      ? composer.value
      : (composer.textContent ?? '');
  return text.trim().length === 0 && Boolean(sendButton());
}

export async function attachFiles(
  target: HTMLElement,
  files: File[],
  probe: () => number,
  inputs: HTMLInputElement[],
  sendButton?: () => HTMLElement | null,
): Promise<string> {
  /*
   * ⚠️ `<form>` TOPILMASA KIRISH MAYDONINING O'ZIGA (2026-11-18). Yangi
   * ChatGPT tahririda `<form>` yo'q, `main` esa suhbat ro'yxatini ham
   * o'z ichiga oladi — drop undagi suhbat yozuviga tushsa biriktirma
   * bo'lmaydi. Kirish maydonining uch darajadagi ajdodi (odatda kirish
   * paneli idishi) eng aniq nishon.
   */
  const dropTarget =
    firstOf<HTMLElement>(['form']) ??
    (target.closest('[data-testid*="composer" i]') as HTMLElement | null) ??
    (target.closest('[id*="composer" i]') as HTMLElement | null) ??
    target.parentElement?.parentElement?.parentElement ??
    firstOf<HTMLElement>(['main']) ??
    target;

  const strategies: [string, () => void][] = [
    [
      'paste',
      () => {
        target.focus();
        target.dispatchEvent(
          new ClipboardEvent('paste', {
            clipboardData: transferOf(files),
            bubbles: true,
            cancelable: true,
          }),
        );
      },
    ],
    [
      'drop',
      () => {
        const transfer = transferOf(files);
        for (const type of ['dragenter', 'dragover', 'drop']) {
          dropTarget.dispatchEvent(
            new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true }),
          );
        }
      },
    ],
    [
      'fayl maydoni',
      () => {
        /*
         * ⚠️ OXIRGI CHORA. `input.files` ga yozish mumkin, lekin sayt
         * uni faqat `change` hodisasi bilan ko'radi. React uchun bu
         * yetarli: u native `change` ni tinglaydi va `isTrusted` ni
         * tekshirmaydi.
         */
        for (const input of inputs) {
          input.files = transferOf(files).files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      },
    ],
  ];

  /*
   * ⚠️ SANOQLAR XATO MATNIGA QO'SHILADI. «Biriktirilmadi» o'zi hech
   * narsa aytmaydi: usul umuman ishlamadimi, yuklash sekinmi, yoki
   * tekshiruv biriktirmani tanimayaptimi — uchalasi bir xil ko'rinadi.
   */
  const tried: string[] = [];
  const fileNames = files.map((file) => file.name);

  /*
   * ⚠️ UCHTA MUVAFFAQIYAT BELGISI (2026-11-18). Oldingi tahrir faqat
   * `probe()` ga ishonardi va u «ko'r» bo'lsa, keyingi strategiya yana
   * fayllar qo'shib yuborardi — kirish maydonida fayllar 2–3 barobar
   * bo'lib qolardi.
   *
   *   1. Adapterning o'z `probe()` sanashi files.length ga oshdimi.
   *   2. Signal yig'indisi (blob-img + bg-blob + testid + remove-btn +
   *      fayl-nomi) biror belgi files.length ga ko'tarildimi.
   *   3. Kirish maydoni BO'SH turganda `sendButton()` yoqildimi (faqat
   *      biriktirma yoqishi mumkin).
   */
  const anyAttached = (expected: number): boolean => {
    if (probe() >= expected) return true;
    if (attachmentSignals(fileNames).max >= expected) return true;
    if (sendButton && emptyComposerWithSend(target, sendButton)) return true;
    return false;
  };

  for (const [name, run] of strategies) {
    const seenProbe = Math.max(probe(), 0);
    const seenSignals = attachmentSignals(fileNames).max;
    const seen = Math.max(seenProbe, seenSignals);

    run();

    const want = seen + files.length;
    const ok = await waitFor(() => anyAttached(want), {
      timeoutMs: 20_000,
      what: name,
      intervalMs: 400,
    }).catch(() => false);

    const signalsAfter = signalSummary(fileNames);

    if (ok) return `${name} (${signalsAfter})`;

    tried.push(`${name}: probe ${seenProbe}→${probe()}, signals: ${signalsAfter}`);

    /*
     * ⚠️ ORALIQ TEKSHIRUV: `probe()` ko'r bo'lsa ham, bu urinish fayl
     * biriktirgan bo'lishi mumkin. Keyingi strategiyani ishga tushirmasdan
     * oldin umumiy holatni tekshiramiz — aks holda qayta-qayta biriktirib,
     * suratlarni 2–3 barobar qilib yuboramiz.
     */
    if (anyAttached(seen + files.length)) {
      return `${name} (oraliq, ${signalsAfter})`;
    }
  }

  throw new Error(`Suratlar biriktirilmadi (${files.length} ta kutildi; ${tried.join(' · ')})`);
}

/**
 * Yon paneldagi «Yangi suhbat» tugmasini topadi (ChatGPT uchun).
 *
 * ⚠️ OXIRGI CHORA. Agar biriktirmalar shuncha «o'chirish» urinishiga ham
 * yo'q bo'lmasa — SPA ularni DB'dan qayta chizib turgan bo'ladi. Bu
 * tugma bosilganda ChatGPT yangi bo'sh suhbat ochadi va butun kirish
 * maydoni holati tozalanadi.
 */
function findNewChatButton(): HTMLElement | null {
  const selectors = [
    'a[data-testid="create-new-chat-button"]',
    'button[data-testid="create-new-chat-button"]',
    'a[aria-label*="New chat" i]',
    'button[aria-label*="New chat" i]',
    'a[aria-label*="Новый чат" i]',
    'button[aria-label*="Новый чат" i]',
    'a[aria-label*="Yangi suhbat" i]',
  ];
  for (const selector of selectors) {
    const found = document.querySelector<HTMLElement>(selector);
    if (found) return found;
  }
  return null;
}

/**
 * Kirish maydonidagi avvalgi biriktirmalarni (agar bo'lsa) tozalaydi.
 *
 * ⚠️ NEGA SHART (2026-11-18). ChatGPT suhbat qoralamasini IndexedDB'da
 * saqlaydi — sahifa qayta yuklangandan keyin SPA biriktirmalarni DB'dan
 * tiklaydi. `freshChat` sahifani qayta yuklasa ham bu holat qoladi.
 *
 * Strategiya:
 *   1. Kutamiz, SPA tiklash imkonini bersin (hali bo'sh bo'lsa ortiqcha
 *      kutmaymiz).
 *   2. «O'chirish» tugmalarini halqa bilan bosamiz (har bosgach SPA
 *      yangisini chizishi mumkin).
 *   3. Agar baribir qolsa — yon paneldagi «Yangi suhbat» tugmasini
 *      bosamiz (SPA ichki navigatsiya qiladi, kirish maydoni butunlay
 *      yangi bo'ladi).
 */
export async function clearAttachments(probe: () => number): Promise<number> {
  /*
   * Biriktirma ustidagi «o'chirish» tugmasini topamiz. Ikkala qurilma
   * uchun ham `aria-label`da «Remove» yoki forma ichidagi `blob:` surat
   * yonidagi tugma turadi.
   */
  const removeButtons = (): HTMLButtonElement[] => {
    /*
     * ⚠️ MAHALLIYLASHTIRILGAN va FAQAT KIRISH PANELI HUDUDIDA (2026-11-18).
     * Oldin butun hujjatda qidirardik — ruscha interfeysdagi
     * «Удалить файл» tugmasini topardi, LEKIN shu bilan birga sahifaning
     * boshqa joyidagi «Удалить»/«Delete» tugmasini ham (fayl kartochkasi,
     * dialog) bosib yuborishi mumkin edi. Endi faqat kirish paneli
     * atrofidagi tugmalar olinadi, yuborish/ovoz/biriktirish tugmalari
     * esa istisno.
     */
    const direct = [
      ...document.querySelectorAll<HTMLButtonElement>('button[aria-label], button[title]'),
    ].filter((button) => {
      const label = `${button.getAttribute('aria-label') ?? ''} ${button.getAttribute('title') ?? ''}`;
      if (!REMOVE_LABEL_RE.test(label)) return false;
      if (SEND_VOICE_RE.test(label)) return false;
      return inComposerRegion(button);
    });
    if (direct.length > 0) return direct;

    /*
     * Zaxira: plitkaning eng yaqin tugma-ajdodi — lekin shu plitka
     * kirish paneli hududida bo'lsin va topilgan tugma plitkaning
     * o'zi bo'lmasin (plitka bosilsa rasm ochiladi, biriktirma
     * o'chirilmaydi).
     */
    const tiles = [
      ...document.querySelectorAll<HTMLElement>('img[src^="blob:"], [style*="blob:"]'),
    ].filter((tile) => notInResult(tile) && inComposerRegion(tile));

    const near: HTMLButtonElement[] = [];
    const seen = new Set<HTMLButtonElement>();
    for (const tile of tiles) {
      const container = tile.closest('[role="group"], li, div');
      if (!container) continue;
      for (const button of container.querySelectorAll<HTMLButtonElement>('button')) {
        if (seen.has(button)) continue;
        if (!inComposerRegion(button)) continue;
        const label = `${button.getAttribute('aria-label') ?? ''} ${button.getAttribute('title') ?? ''}`;
        if (SEND_VOICE_RE.test(label)) continue;
        /* Plitkaning o'zi tugma bo'lsa — bosmaymiz (rasm ochiladi). */
        if (button.contains(tile) || tile.contains(button)) continue;
        seen.add(button);
        near.push(button);
      }
    }
    return near;
  };

  /*
   * ⚠️ SPA biriktirmalarni DB'dan tiklaguncha kutamiz — lekin faqat
   * bo'sh bo'lsa, ya'ni «hali kelmagan» bo'lsa. Agar allaqachon chizilgan
   * bo'lsa, darhol o'chirishni boshlaymiz.
   */
  if (probe() <= 0) {
    for (let i = 0; i < 20; i += 1) {
      await sleep(150);
      if (probe() > 0) break;
    }
  }

  let removed = 0;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const buttons = removeButtons();
    if (buttons.length === 0) {
      /* Sanoq hali ham > 0 bo'lsa — tugmalar yashirin ro'yxatda */
      if (probe() <= 0) break;

      /* Oxirgi chora: yon paneldagi «Yangi suhbat» tugmasini bosamiz */
      const newChat = findNewChatButton();
      if (newChat) {
        newChat.click();
        await sleep(1_500);
        if (probe() <= 0) break;
      }
      /* Hali ham qolsa — tashqi chaqiruvchi bilib tursin */
      break;
    }

    for (const button of buttons) {
      try {
        button.click();
        removed += 1;
      } catch {
        /* keyingisiga o'tamiz */
      }
    }

    await sleep(250);

    if (probe() <= 0) break;
  }

  return removed;
}

export function base64ToFile(base64: string, mime: string, name: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());

  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buffer.length; i += CHUNK) {
    binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK));
  }

  return btoa(binary);
}

/**
 * Natija suratini o'qishga urinadi.
 *
 * ⚠️ YIQILSA XATO EMAS, `null`. Surat ko'pincha boshqa domenda turadi
 * (`*.oaiusercontent.com`) va content script uni CORS tufayli o'qiy
 * olmaydi. Bu kutilgan hol: chaqiruvchi shunda havolaning o'zini
 * workerga beradi.
 */
export async function readImage(url: string): Promise<{ mime: string; base64: string } | null> {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return null;

    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;

    return { mime: blob.type, base64: await blobToBase64(blob) };
  } catch {
    return null;
  }
}

/**
 * Prompt SAHIFADAGI matn maydonida turibdimi.
 *
 * ⚠️ `isConnected` SHART. ChatGPT surat biriktirilgach matn maydonini
 * qaytadan chizadi — oldin topilgan element sahifadan uziladi, lekin
 * ichidagi matn saqlanadi. Faqat matnga qaralsa, uzilgan elementga
 * yozilgan prompt «yozildi» bo'lib ko'rinardi, xabar esa promptsiz ketardi.
 */
export function hasPrompt(element: HTMLElement, prompt: string): boolean {
  return element.isConnected && composerText(element).includes(prompt.slice(0, 40));
}

/** Matn maydonidagi hozirgi matn — `<textarea>` da `value`, aks holda `textContent`. */
function composerText(element: HTMLElement): string {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return element.value;
  }
  return element.textContent ?? '';
}

function firePointer(element: HTMLElement): void {
  const options = { bubbles: true, cancelable: true, composed: true };

  element.dispatchEvent(new PointerEvent('pointerdown', options));
  element.dispatchEvent(new MouseEvent('mousedown', options));
  element.dispatchEvent(new PointerEvent('pointerup', options));
  element.dispatchEvent(new MouseEvent('mouseup', options));
  element.dispatchEvent(new MouseEvent('click', options));
}

function fireEnter(element: HTMLElement): void {
  element.focus();

  const options = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  };

  element.dispatchEvent(new KeyboardEvent('keydown', options));
  element.dispatchEvent(new KeyboardEvent('keypress', options));
  element.dispatchEvent(new KeyboardEvent('keyup', options));
}

/**
 * Xabarni yuboradi — UCHTA USULNI KETMA-KET SINAB.
 *
 * ⚠️ `button.click()` YETMASLIGI MUMKIN. Sayt tugmani `pointerdown`
 * orqali boshqarsa, sun'iy `click` unga umuman yetmaydi — hech narsa
 * bo'lmaydi va xato ham chiqmaydi.
 *
 * ⚠️ TEKSHIRUV — MATN MAYDONI TOZALANDIMI. Bu yagona ishonchli belgi:
 * ChatGPT ham, Gemini ham xabar ketgach maydonni bo'shatadi. Tugma
 * bosilganini sanash aldaydi — bosiladi, lekin hech narsa yuborilmaydi.
 * Aynan shu 2026-09-23 da bo'lgan: jurnalda «yuborildi» yozilgan,
 * suhbat esa bo'sh qolgan.
 */
export async function submit(
  composer: HTMLElement,
  prompt: string,
  button: () => HTMLElement | null,
): Promise<string> {
  const probe = prompt.slice(0, 40);
  const pending = (): boolean => composerText(composer).includes(probe);

  if (!pending()) throw new Error('Prompt matn maydonida yo`q — yuborishdan oldin yo`qolgan');

  const strategies: [string, () => void][] = [
    ['click', () => button()?.click()],
    [
      'pointer',
      () => {
        const target = button();
        if (target) firePointer(target);
      },
    ],
    ['Enter', () => fireEnter(composer)],
  ];

  for (const [name, run] of strategies) {
    run();

    const sent = await waitFor(() => !pending(), {
      timeoutMs: 6_000,
      what: name,
      intervalMs: 250,
    }).catch(() => false);

    if (sent) return name;
  }

  throw new Error('Yuborilmadi — click, pointer va Enter ishlamadi');
}
