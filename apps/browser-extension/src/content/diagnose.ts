import type { Adapter } from './adapters/types';
import { REMOVE_LABEL_RE, attachFiles, signalSummary, submit, typeInto } from './dom';

/**
 * Sahifa tekshiruvi — «nima ishlayapti, nima yo'q».
 *
 * ⚠️ HECH NARSA YUBORILMAYDI. Tekshiruv matnni yozadi va suratni
 * biriktiradi, lekin «Yuborish» ni BOSMAYDI va oxirida hammasini
 * tozalashga urinadi. Maqsad — AI'dan javob olish emas, mexanikaning
 * qaysi bo'g'ini uzilganini ko'rsatish.
 *
 * ⚠️ NEGA KERAK. Sayt tuzilishi hisobga va yig'ilishga qarab farq
 * qiladi; tashqaridan qarab uni bilib bo'lmaydi. Busiz har tuzatish
 * taxmin bo'lardi va operator har safar butun navbatni qurbon qilib
 * sinardi.
 */
export async function diagnose(adapter: Adapter | null): Promise<string[]> {
  const lines: string[] = [];
  const add = (text: string): number => lines.push(text);

  add(`sahifa: ${location.hostname}`);

  if (!adapter) {
    add('✗ adapter yo`q — bu sahifa qo`llab-quvvatlanmaydi');
    return lines;
  }

  add(`adapter: ${adapter.id}`);

  const composer = adapter.composer();
  if (!composer) {
    add('✗ MATN MAYDONI TOPILMADI — asosiy to`siq shu');
    return lines;
  }

  add(`✓ matn maydoni: <${composer.tagName.toLowerCase()}> ${describe(composer)}`);

  const inputs = adapter.fileInputs();
  add(
    inputs.length > 0 ? `✓ fayl maydoni: ${describe(inputs[0] as Element)}` : '✗ fayl maydoni yo`q',
  );

  add(`biriktirma sanogi (bosh holatda): ${adapter.attachmentCount()}`);
  add(`· signallar: ${signalSummary()}`);

  /*
   * ⚠️ TAFSILOT (2026-11-18): bugungi UI'da `attachmentCount()` manfiy
   * raqam qaytargan paytda tashqaridan taxmin qilmasdan, DOM da
   * aslida nima borligini ko'rish uchun.
   */
  const scopes: [string, number][] = [
    ['form', document.querySelectorAll('form').length],
    ['document img[blob]', document.querySelectorAll('img[src^="blob:"]').length],
    ['document [style*=blob]', document.querySelectorAll('[style*="blob:"]').length],
    ['input[type=file]', document.querySelectorAll('input[type="file"]').length],
    [
      'button[aria-label ~ REMOVE]',
      [...document.querySelectorAll<HTMLButtonElement>('button[aria-label], button[title]')].filter(
        (b) =>
          REMOVE_LABEL_RE.test(
            `${b.getAttribute('aria-label') ?? ''} ${b.getAttribute('title') ?? ''}`,
          ),
      ).length,
    ],
    [
      '[data-testid ~ composer]',
      document.querySelectorAll('[data-testid*="composer" i], [id*="composer" i]').length,
    ],
    [
      '[data-testid ~ attachment]',
      document.querySelectorAll('[data-testid*="attachment" i]').length,
    ],
    ['img[src^=data:]', document.querySelectorAll('img[src^="data:"]').length],
  ];
  for (const [name, count] of scopes) add(`· ${name}: ${count}`);
  add(
    adapter.sendButton()
      ? '· yuborish tugmasi bo`sh matnda ham FAOL'
      : '✓ yuborish tugmasi bo`sh matnda o`chiq',
  );

  // ── Surat biriktirish ──
  try {
    const file = await testImage();
    const how = await attachFiles(
      composer,
      [file],
      () => adapter.attachmentCount(),
      inputs,
      () => adapter.sendButton(),
    );
    add(`✓ SURAT BIRIKTIRILDI — usul: ${how}`);
  } catch (error) {
    add(`✗ surat biriktirilmadi: ${error instanceof Error ? error.message : 'xato'}`);
  }

  // ── Matn yozish ──
  const probe = 'LookSave sinov matni';
  try {
    typeInto(composer, probe);
    add('✓ PROMPT YOZILDI');
  } catch (error) {
    add(`✗ prompt yozilmadi: ${error instanceof Error ? error.message : 'xato'}`);
  }

  add(adapter.sendButton() ? '✓ yuborish tugmasi FAOLLASHDI' : '✗ yuborish tugmasi o`chiq qoldi');

  /*
   * ⚠️ TEKSHIRUV HECH NARSA YUBORMAYDI, shuning uchun bu yerda faqat
   * matn maydoni KO'RINADIGANI aytiladi. Ko'rinmaydiganiga yozish —
   * eng aldamchi nosozlik: hammasi «ishlagandek» bo'ladi, ekranda esa
   * hech narsa o'zgarmaydi.
   */
  add(`ko\`rinadigan matn maydoni: ${composer.getBoundingClientRect().width | 0}px kenglik`);
  add(`javobdagi suratlar: ${adapter.resultImages().length}`);
  add(`javob yozilyaptimi (busy): ${adapter.busy()}`);

  cleanup(composer);
  add('— tekshiruv tugadi, hech narsa yuborilmadi');

  return lines;
}

function describe(element: Element): string {
  const id = element.id ? `#${element.id}` : '';
  const label = element.getAttribute('aria-label');
  return `${id}${label ? ` [${label}]` : ''}` || '(id yo`q)';
}

/**
 * Sinov surati — 64x64 kvadrat.
 *
 * ⚠️ HAQIQIY SURAT KERAK, 1x1 EMAS. Saytlar juda kichik rasmni
 * biriktirishni rad etishi mumkin va tekshiruv yolg'on «ishlamaydi»
 * berardi.
 */
async function testImage(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;

  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#7C3AED';
    context.fillRect(0, 0, 64, 64);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('sinov surati yasalmadi');

  return new File([blob], 'looksave-test.png', { type: 'image/png' });
}

/** Ortidan iz qoldirmaslikka urinish — matnni tozalab, biriktirmani olib tashlaydi. */
function cleanup(composer: HTMLElement): void {
  try {
    typeInto(composer, '');
  } catch {
    /* tozalash yiqilsa tekshiruv natijasi baribir qimmatli */
  }

  /*
   * ⚠️ Faqat kirish paneli atrofidagi tugmalarni bosamiz — `clearAttachments`
   * dagi hudud cheklovi bilan mos. Sahifaning boshqa joyidagi «Delete»
   * tugmasini tekshiruv tasodifan bosmasin.
   */
  const form = composer.closest('form, [data-testid*="composer" i], [id*="composer" i]');
  const scope = form ?? composer.parentElement?.parentElement?.parentElement ?? document;
  for (const button of scope.querySelectorAll<HTMLButtonElement>(
    'button[aria-label], button[title]',
  )) {
    const label = `${button.getAttribute('aria-label') ?? ''} ${button.getAttribute('title') ?? ''}`;
    if (REMOVE_LABEL_RE.test(label)) button.click();
  }
}

/**
 * Yuborishni sinaydi — qisqa matn yozib, HAQIQATAN yuboradi.
 *
 * ⚠️ SURATSIZ VA TEZ. To'liq kiyintirish uch daqiqa oladi (surat
 * yuklash, javob chizilishi), yuborish esa uning ichida bir soniyalik
 * qadam. Uni alohida sinamasa, har tekshiruv uchun butun navbat
 * qurbon bo'lardi.
 *
 * ⚠️ BU SUHBATGA HAQIQIY XABAR YOZADI — boshqa yo'li yo'q: «yubordimi»
 * degan savolga faqat haqiqatan yuborib javob berish mumkin.
 */
export async function testSend(adapter: Adapter | null): Promise<string[]> {
  const lines: string[] = [];
  const add = (text: string): number => lines.push(text);

  if (!adapter) {
    add('✗ adapter yo`q — bu sahifa qo`llab-quvvatlanmaydi');
    return lines;
  }

  const composer = adapter.composer();
  if (!composer) {
    add('✗ MATN MAYDONI TOPILMADI');
    return lines;
  }

  const box = composer.getBoundingClientRect();
  add(`matn maydoni: <${composer.tagName.toLowerCase()}> ${Math.round(box.width)}px kenglik`);

  const probe = 'salom';

  try {
    typeInto(composer, probe);
    add('✓ matn yozildi');
  } catch (error) {
    add(`✗ matn yozilmadi: ${error instanceof Error ? error.message : 'xato'}`);
    return lines;
  }

  add(adapter.sendButton() ? '✓ yuborish tugmasi faol' : '· yuborish tugmasi topilmadi/o`chiq');

  try {
    const how = await submit(composer, probe, () => adapter.sendButton());
    add(`✓ YUBORILDI — usul: ${how}`);
    add('— ChatGPT ekranida «salom» xabari ko`rindimi? Ko`rinsa yo`l ochiq.');
  } catch (error) {
    add(`✗ YUBORILMADI: ${error instanceof Error ? error.message : 'xato'}`);
  }

  return lines;
}
