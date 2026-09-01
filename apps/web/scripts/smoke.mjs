/**
 * Sahifalar haqiqatan CHIZILGANINI tekshiradi.
 *
 * ⚠️ NEGA STATUS YETARLI EMAS: React render paytidagi xatoni ushlaydi va
 * marshrut xato chegarasini chizadi — javob esa baribir HTTP 200 bo'lib
 * qoladi. `TooltipProvider` yo'qolgani aynan shu tarzda bir necha
 * tekshiruvdan o'tib ketgan edi.
 *
 * Shuning uchun har sahifa uchun: (1) status, (2) xato chegarasi YO'Q,
 * (3) o'sha sahifaga xos matn BOR.
 *
 *   node scripts/smoke.mjs [http://localhost:5175]
 */

const BASE = process.argv[2] ?? 'http://localhost:5175';

/** Xato chegarasi chizilganini bildiruvchi matnlar */
const ERROR_MARKERS = ['Nimadir noto', 'Bunday sahifa yo'];

/*
 * ⚠️ Qidiruv matnida APOSTROF BO'LMASIN. HTML da u `&#x27;` ga aylanadi
 * va oddiy `includes` topa olmaydi — sahifa aslida joyida bo'lsa ham
 * tekshiruv «yiqildi» deb ko'rsatadi.
 */
const PAGES = [
  /*
   * ⚠️ TEKSHIRUV MA'LUMOTGA BOG'LANMAYDI. Ilgari bu yerda «TRENDING NOW»
   * turardi — lekin u blok bo'sh katalogda ATAYLAB chizilmaydi
   * (15-sayt-dizayn.md §4.1: bosh sahifada bo'sh holat ko'rsatilmaydi).
   * Natijada baza qayta ekilganda test sayt buzilgandek ko'rsatardi.
   *
   * Shuning uchun faqat ma'lumotsiz ham doim bo'ladigan narsa
   * tekshiriladi: qobiq va hero sarlavhasi.
   */
  { path: '/uz', must: ['LookSave', 'Katalogni ochish'] },
  { path: '/uz/catalog', must: ['Katalog', 'Ommabop'] },
  { path: '/uz/catalog?onlyTryon=1&sort=priceAsc', must: ['Katalog'] },
  { path: '/uz/stores', must: ['konlar', 'Chilonzor'] },
  { path: '/uz/try-on', must: ['Kiyintirish'] },
  { path: '/uz/sign-in', must: ['Kirish', 'Parol'] },
  { path: '/uz/sign-up', must: ['yxatdan', 'Parol'] },
  { path: '/uz/cart', must: ['Savat'] },
  { path: '/uz/privacy', must: ['Maxfiylik siyosati', 'FASHN'] },
  { path: '/uz/terms', must: ['Foydalanish shartlari'] },
  { path: '/ar', must: ['dir="rtl"'] },
];

let failed = 0;

for (const page of PAGES) {
  const url = `${BASE}${page.path}`;
  let status = 0;
  let html = '';

  try {
    const response = await fetch(url, { headers: { 'Accept-Language': 'uz' } });
    status = response.status;
    html = await response.text();
  } catch (error) {
    console.error(`✘ ${page.path} — so'rov yiqildi: ${String(error)}`);
    failed++;
    continue;
  }

  const problems = [];
  if (status !== 200) problems.push(`status ${status}`);

  const boundary = ERROR_MARKERS.find((marker) => html.includes(marker));
  if (boundary) problems.push(`xato chegarasi chizildi («${boundary}…»)`);

  for (const needle of page.must) {
    if (!html.includes(needle)) problems.push(`«${needle}» topilmadi`);
  }

  if (problems.length > 0) {
    console.error(`✘ ${page.path} — ${problems.join('; ')}`);
    failed++;
  } else {
    console.log(`✓ ${page.path}`);
  }
}

// Yo'naltirish: `/` tilni tanlashi kerak
const redirect = await fetch(`${BASE}/`, {
  headers: { 'Accept-Language': 'ru;q=0.2, ar;q=0.9' },
  redirect: 'manual',
});
const location = redirect.headers.get('location') ?? '';

if (!location.endsWith('/ar')) {
  console.error(`✘ / — arabcha kutilgandi, «${location}» keldi`);
  failed++;
} else {
  console.log('✓ / → /ar (Accept-Language og`irliklari bilan)');
}

console.log(failed === 0 ? '\nHammasi joyida ✅' : `\n${failed} ta muammo ✘`);
process.exit(failed === 0 ? 0 : 1);
