# 09 — Integratsiyalar

**Bog'liq:** [03-api-spec.md](./03-api-spec.md) · [08-deployment.md](./08-deployment.md)

---

## 1. Umumiy ko'rinish

| Servis | Vazifa | Muhimlik | Narx (boshida) |
|---|---|---|---|
| **Telegram Bot** | Sotuvchiga buyurtma xabari | 🔴 Kritik | $0 |
| **SMS (Eskiz / Twilio)** | OTP, eslatma | 🔴 Kritik | ~$5/oy |
| **Cloudflare R2** | GLB, rasm, backup | 🔴 Kritik | $0 |
| **Google Maps** | Xarita, geocoding | 🟡 Muhim | $0 |
| **Expo Push** | Mijozga bildirishnoma | 🟡 Muhim | $0 |
| **Gemini API** | AI Designer (Faza 3) | 🟢 Ixtiyoriy | $0 |
| **Sentry** | Xato kuzatuvi | 🟡 Muhim | $0 |

**Qoida:** kritik servis ishlamay qolsa, ilova **butunlay to'xtamasligi** kerak. Har biri uchun zaxira yo'l bor (9-bo'lim).

---

## 2. Telegram bot 🔴

Tizimning eng muhim integratsiyasi (K-11). Do'kon egasi web panel oldida o'tirmaydi, lekin Telegram telefonida doim ochiq.

### 2.1 Botni yaratish

```
1. @BotFather → /newbot
2. Nom: LookSave
3. Username: LookSaveBot
4. Token olinadi → TELEGRAM_BOT_TOKEN
5. /setdescription, /setuserpic, /setcommands
```

Buyruqlar:
```
start - Do'konni ulash
orders - Yangi buyurtmalar
help - Yordam
unlink - Ulanishni uzish
```

### 2.2 Webhook

```bash
curl -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.looksave.app/v1/telegram/webhook",
    "secret_token": "'"${TELEGRAM_WEBHOOK_SECRET}"'",
    "allowed_updates": ["message","callback_query"],
    "drop_pending_updates": true
  }'
```

Serverda **birinchi navbatda** sirni tekshiring:

```ts
app.post('/v1/telegram/webhook', (req, res) => {
  if (req.header('X-Telegram-Bot-Api-Secret-Token') !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.sendStatus(403);
  }
  res.sendStatus(200);              // darhol javob — Telegram 5 s kutadi
  handleUpdate(req.body).catch(err => logger.error({ err }, 'telegram'));
});
```

**Darhol `200` qaytaring**, ishlov keyin. Telegram javobni 5 soniya kutadi, kechiksa qayta yuboradi va bir xil xabar ikki marta kelib qoladi.

### 2.3 Do'konni ulash

```
Panelda: GET /store/telegram/link
   → linkCode = "LS-A3F8K2", QR kod
        ↓
Do'kon egasi bosadi: t.me/LookSaveBot?start=LS-A3F8K2
        ↓
Bot /start LS-A3F8K2 oladi
        ↓
stores.telegram_link_code bo'yicha do'kon topiladi
        ↓
telegram_chat_id = message.chat.id saqlanadi
telegram_link_code = NULL (bir martalik)
        ↓
"✅ Chilonzor Fashion ulandi"
```

```ts
async function handleStart(msg: TgMessage, payload?: string) {
  if (!payload) {
    return send(msg.chat.id,
      'Salom! Do\'konni ulash uchun panelda "Telegram" bo\'limiga kiring.');
  }

  const store = await db.oneOrNone(
    `UPDATE stores SET telegram_chat_id = $1, telegram_link_code = NULL
     WHERE telegram_link_code = $2 RETURNING id, name`,
    [msg.chat.id, payload]
  );

  if (!store) {
    return send(msg.chat.id, '❌ Kod eskirgan yoki noto\'g\'ri. Paneldan yangisini oling.');
  }

  await send(msg.chat.id,
    `✅ <b>${store.name}</b> ulandi.\n\nEndi yangi buyurtmalar shu yerga keladi.`);
}
```

**Guruh chatlari ham qo'llab-quvvatlanadi** — do'konda bir necha xodim bo'lsa, ular guruh yaratib botni qo'shishadi. `chat.id` manfiy bo'ladi, qolgani bir xil ishlaydi.

### 2.4 Buyurtma xabari

```ts
async function notifyNewOrder(order: Order) {
  const store = await getStore(order.storeId);
  if (!store.telegramChatId) return;             // ulanmagan — jim o'tkaziladi

  const items = order.items
    .map(i => `• ${i.title} — ${i.size} × ${i.qty}`)
    .join('\n');

  const text =
`🔔 <b>Yangi buyurtma</b>
<code>${order.orderNumber}</code>

👤 ${order.contactName}
📞 ${order.contactPhone}
${order.customerTrust.completed > 0
  ? `✅ ${order.customerTrust.completed} ta yakunlangan buyurtma`
  : `🆕 Birinchi buyurtma`}

${items}

💰 <b>${fmt(order.total, order.currency)}</b>
${order.deliveryType === 'delivery' ? '🚚 Yetkazib berish' : '🏪 Do\'kondan olib ketadi'}
${order.address ? `📍 ${order.address.text}` : ''}
${order.note ? `\n💬 <i>${order.note}</i>` : ''}

⏱ Javob berish uchun 24 soat`;

  await tg('sendMessage', {
    chat_id: store.telegramChatId,
    text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Tasdiqlash', callback_data: `o:c:${order.id}` },
          { text: '❌ Rad etish',  callback_data: `o:r:${order.id}` },
        ],
        [
          { text: '📞 Qo\'ng\'iroq', url: `tel:${order.contactPhone}` },
          { text: '📋 Panel',      url: `https://store.looksave.app/orders/${order.id}` },
        ],
        ...(order.address ? [[
          { text: '🗺 Xaritada',
            url: `https://maps.google.com/?q=${order.address.lat},${order.address.lng}` },
        ]] : []),
      ],
    },
  });
}
```

**`callback_data` 64 baytdan oshmasin.** Shuning uchun `o:c:<uuid>` (40 bayt), `order:confirm:<uuid>` emas.

### 2.5 Tugma bosilishi

```ts
async function handleCallback(cb: TgCallbackQuery) {
  const [, action, orderId] = cb.data.split(':');

  const store = await db.oneOrNone(
    'SELECT id FROM stores WHERE telegram_chat_id = $1', [cb.from.id]
  );
  const order = await getOrder(orderId);

  if (!store || !order || order.storeId !== store.id) {
    return tg('answerCallbackQuery', {
      callback_query_id: cb.id, text: 'Ruxsat yo\'q', show_alert: true,
    });
  }

  if (!['new', 'seen'].includes(order.status)) {
    return tg('answerCallbackQuery', {
      callback_query_id: cb.id,
      text: `Buyurtma allaqachon: ${statusLabel(order.status)}`,
      show_alert: true,
    });
  }

  if (action === 'c') {
    await db.tx(async t => {
      await t.none(`SET LOCAL app.actor_type='store';
                    SET LOCAL app.channel='telegram'`);
      await t.none(`UPDATE orders SET status='confirmed' WHERE id=$1`, [orderId]);
    });

    await tg('editMessageText', {
      chat_id: cb.message.chat.id,
      message_id: cb.message.message_id,
      text: cb.message.text + '\n\n✅ <b>Tasdiqlandi</b>',
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[
        { text: '📦 Tayyor', callback_data: `o:d:${orderId}` },
      ]]},
    });

    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '✅ Tasdiqlandi' });
    await pushToCustomer(order.userId, 'Do\'kon buyurtmangizni tasdiqladi');
  }

  if (action === 'r') {
    // Rad etish sababini so'raymiz
    await tg('editMessageReplyMarkup', {
      chat_id: cb.message.chat.id,
      message_id: cb.message.message_id,
      reply_markup: { inline_keyboard: [
        [{ text: 'Mahsulot tugagan', callback_data: `r:oos:${orderId}` }],
        [{ text: 'Bu o\'lcham yo\'q', callback_data: `r:siz:${orderId}` }],
        [{ text: 'Soxta buyurtma',   callback_data: `r:fak:${orderId}` }],
        [{ text: '← Orqaga',         callback_data: `o:b:${orderId}` }],
      ]},
    });
  }
}
```

Sabab **majburiy** — Telegramda ham, panelda ham. `fak` (soxta) tanlanganda raqam avtomatik bloklanadi.

### 2.6 Chekka holatlar

| Holat | Xatti-harakat |
|---|---|
| Do'kon botni bloklagan (`403`) | `telegram_chat_id = NULL`, panelda ogohlantirish, SMS zaxira |
| Chat topilmadi (`400`) | Bir xil |
| Xabar ikki marta keldi | `callback_query.id` ni Redis'da 60 s saqlash |
| Ikki xodim bir vaqtda bosdi | Status tekshiruvi — ikkinchisiga "allaqachon tasdiqlangan" |
| Telegram ishlamayapti | Buyurtma baribir yaratiladi, panelda ko'rinadi |
| Rate limit (30 msg/s) | Navbat (Redis) + eksponensial kutish |

---

## 3. SMS 🔴

Ikki bozor — ikki provayder.

| Bozor | Provayder | Narx |
|---|---|---|
| O'zbekiston | **Eskiz.uz** | ~55 so'm/SMS |
| BAA | **Twilio** | ~$0.03/SMS |

### 3.1 Abstraksiya

```ts
// src/integrations/sms/index.ts
export interface SmsProvider {
  send(to: string, text: string): Promise<{ id: string }>;
}

export function getProvider(phone: string): SmsProvider {
  if (phone.startsWith('+998')) return eskiz;
  if (phone.startsWith('+971')) return twilio;
  return twilio;
}
```

### 3.2 Eskiz.uz

```ts
class EskizProvider implements SmsProvider {
  private token?: string;
  private expiresAt = 0;

  private async auth() {
    if (this.token && Date.now() < this.expiresAt) return this.token;

    const res = await fetch('https://notify.eskiz.uz/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.ESKIZ_EMAIL,
        password: process.env.ESKIZ_PASSWORD,
      }),
    });
    const json = await res.json();
    this.token = json.data.token;
    this.expiresAt = Date.now() + 25 * 24 * 3600 * 1000;   // token 30 kun
    return this.token;
  }

  async send(to: string, text: string) {
    const token = await this.auth();
    const form = new FormData();
    form.append('mobile_phone', to.replace('+', ''));
    form.append('message', text);
    form.append('from', process.env.ESKIZ_FROM ?? '4546');

    const res = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Eskiz ${res.status}`);
    return { id: (await res.json()).id };
  }
}
```

### ⚠️ Shablonlar oldindan tasdiqlanadi

O'zbekistonda SMS matnlari operator tomonidan **oldindan ro'yxatdan o'tkazilishi shart**. Tasdiqlanmagan matn yuborilmaydi.

Shablonlarni loyiha boshida topshiring (tasdiqlash 1-3 kun):

| Maqsad | Matn |
|---|---|
| OTP | `LookSave tasdiqlash kodi: {code}. Hech kimga aytmang.` |
| Buyurtma eslatmasi | `LookSave: {number} raqamli yangi buyurtma javob kutmoqda.` |
| Tasdiqlandi | `LookSave: {number} buyurtmangiz tasdiqlandi.` |

`{code}` va `{number}` — o'zgaruvchan qism, qolgani aynan mos kelishi kerak.

### 3.3 Twilio (BAA)

```ts
class TwilioProvider implements SmsProvider {
  async send(to: string, text: string) {
    const auth = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString('base64');

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM!, Body: text }),
      }
    );
    if (!res.ok) throw new Error(`Twilio ${res.status}`);
    return { id: (await res.json()).sid };
  }
}
```

> BAA'da Sender ID ro'yxatdan o'tkazilishi kerak. Buni oldindan boshlang — jarayon bir necha hafta olishi mumkin.

### 3.4 Xarajatni nazorat qilish

SMS — eng oson pul yeydigan joy. Himoya:

```
Bir raqamga: 1 SMS / 60 soniya, 5 / soat, 10 / kun
Bir IP dan:  20 / soat
Kunlik umumiy limit: 500 SMS → oshsa admin'ga ogohlantirish
```

Va eng muhimi: **tasdiqlangan raqam qayta so'ralmaydi** (03-api-spec.md, 7-bo'lim). Foydalanuvchi bir marta OTP kiritadi, keyingi buyurtmalarda SMS ketmaydi.

---

## 4. Cloudflare R2 🔴

### 4.1 Sozlash

```
Cloudflare → R2 → Create bucket
  • looksave-assets    (ommaviy, custom domain: cdn.looksave.app)
  • looksave-backups   (yopiq)

R2 → Manage API Tokens → Create
  • Ruxsat: Object Read & Write
  • Faqat shu ikki bucket
```

Custom domen ulash: `cdn.looksave.app` → R2 bucket. Cloudflare CDN avtomatik oldiga qo'shiladi.

### 4.2 Presign (rasm yuklash)

```ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function presignUpload(opts: {
  fileName: string; contentType: string; purpose: 'product' | 'store' | 'face';
}) {
  const allowed = ['image/webp', 'image/jpeg', 'image/png'];
  if (!allowed.includes(opts.contentType)) throw new BadRequest('INVALID_TYPE');

  const key = `${opts.purpose}/${randomUUID()}${extname(opts.fileName)}`;

  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_ASSETS,
      Key: key,
      ContentType: opts.contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
    { expiresIn: 900 }
  );

  return { uploadUrl, publicUrl: `${process.env.CDN_BASE_URL}/${key}` };
}
```

### 4.3 CORS

```json
[
  {
    "AllowedOrigins": [
      "https://store.looksave.app",
      "https://admin.looksave.app"
    ],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Mobil ilova CORS'ga bo'ysunmaydi — faqat web panellar uchun.

### 4.4 Kesh sarlavhalari

| Fayl turi | Cache-Control |
|---|---|
| GLB modellar | `public, max-age=31536000, immutable` |
| Mahsulot rasmlari | `public, max-age=31536000, immutable` |
| Do'kon logolari | `public, max-age=86400` |
| Yuz teksturasi | `private, max-age=3600` |

**`immutable` muhim:** GLB va rasmlar hech qachon o'zgarmaydi (o'zgarsa — yangi UUID). Brauzer va CDN ularni bir yil keshlaydi, R2 trafigi keskin kamayadi.

### 4.5 Egress bepul

Bu R2 tanlashning asosiy sababi (K-03). 3D modellar og'ir va doim yuklanadi. S3 yoki UploadThing'da trafik hisobi tez o'sadi, R2 da esa nol.

---

## 5. Google Maps 🟡

Server tomonda **faqat geocoding** ishlatiladi. Xarita chizish — mobil SDK (bepul, cheksiz).

```ts
export async function geocode(address: string, region: 'uz' | 'ae') {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('region', region);
  url.searchParams.set('key', process.env.GOOGLE_MAPS_SERVER_KEY!);

  const json = await (await fetch(url)).json();
  if (json.status !== 'OK') return null;

  const loc = json.results[0].geometry.location;
  return { lat: loc.lat, lng: loc.lng, formatted: json.results[0].formatted_address };
}
```

**Oyiga ~200 chaqiruv** — do'kon ro'yxatdan o'tganda. 10 000 bepul kvotadan juda uzoq.

### Kalitlarni cheklash

| Kalit | Cheklov | Yoqilgan API |
|---|---|---|
| iOS | Bundle ID `app.looksave.mobile` | Maps SDK for iOS |
| Android | Package + SHA-1 | Maps SDK for Android |
| Server | IP (VPS) | Geocoding API |
| Web | Referrer `*.looksave.app` | Maps JavaScript API |

**Places API hech qaysi kalitda yoqilmaydi** (K-05). Do'konlar bizning bazamizda.

Google Cloud'da budget alert: **$10** va **$50**. Standart holatda qattiq chegara yo'q.

---

## 6. Expo Push 🟡

```ts
export async function sendPush(userId: string, title: string, body: string, data = {}) {
  const tokens = await db.manyOrNone(
    'SELECT push_token FROM devices WHERE user_id = $1 AND push_token IS NOT NULL',
    [userId]
  );
  if (!tokens.length) return;

  const messages = tokens.map(t => ({
    to: t.push_token, title, body, data, sound: 'default', priority: 'high',
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(messages),
  });

  const { data: tickets } = await res.json();

  // Yaroqsiz tokenlarni tozalash
  for (let i = 0; i < tickets.length; i++) {
    if (tickets[i].details?.error === 'DeviceNotRegistered') {
      await db.none('UPDATE devices SET push_token = NULL WHERE push_token = $1',
        [tokens[i].push_token]);
    }
  }
}
```

Bir so'rovda 100 tagacha xabar. Ko'proq bo'lsa — bo'lib yuboring.

---

## 7. Gemini — AI Designer 🟢 (Faza 3)

### 7.1 So'rov

```ts
const SYSTEM = `Sen fashion stilistsan. Berilgan mahsulotlar ro'yxatidan
tadbir, kayfiyat va byudjetga mos 3 ta to'liq komplekt yig'.

QOIDALAR:
- Faqat ro'yxatdagi mahsulotlardan foydalan
- Har komplektda: top, bottom, feet (majburiy); outer, head, wrist (ixtiyoriy)
- Ranglar bir-biriga mos bo'lsin
- Umumiy narx byudjetdan oshmasin
- FAQAT JSON qaytar, boshqa hech narsa yozma`;

export async function designLooks(input: DesignInput) {
  const products = await getCandidates(input);      // SQL filtr

  const prompt = `${SYSTEM}

Tadbir: ${input.occasion}
Kayfiyat: ${input.mood}
Byudjet: ${input.budget} ${input.currency}

Mahsulotlar:
${products.map(p => `${p.variantId} | ${p.slot} | ${p.title} | ${p.color} | ${p.price}`).join('\n')}

Format:
{"looks":[{"name":"...","reason":"...","items":[{"slot":"top","variantId":"..."}]}]}`;

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1500,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!res.ok) throw new LlmError(res.status);
  const json = await res.json();
  const parsed = JSON.parse(json.candidates[0].content.parts[0].text);

  return validateLooks(parsed, products);   // haqiqiy variantId larni tekshirish
}
```

**`validateLooks` majburiy.** LLM mavjud bo'lmagan `variantId` o'ylab topishi mumkin. Har bir id ro'yxatda borligini tekshiring, bo'lmasa o'sha element tashlab yuboriladi.

### 7.2 Zaxira zanjiri

```ts
export async function getLooks(input: DesignInput) {
  try {
    return await designLooks(input);                    // Gemini
  } catch (e) {
    logger.warn({ e }, 'gemini failed');
    try {
      return await designLooksGroq(input);              // Groq
    } catch (e2) {
      logger.warn({ e2 }, 'groq failed');
      return ruleBasedLooks(input);                     // LLM'siz
    }
  }
}
```

`ruleBasedLooks` — oddiy mantiq: byudjetni slotlarga bo'lish, rang mosligi jadvali, ommaboplik bo'yicha tanlash. Sifat pastroq, lekin **hech qachon bo'sh ekran ko'rsatilmaydi**.

### 7.3 ⚠️ Maxfiylik qoidasi

Bepul tarifdagi so'rovlar model o'qitishda ishlatilishi mumkin.

**LLM'ga hech qachon yuborilmaydi:** ism, telefon, manzil, tana o'lchamlari, fotosurat, buyurtma tarixi.

**Yuborilishi mumkin:** tadbir turi, kayfiyat, byudjet, mahsulot id/nom/kategoriya/narx.

Bu qoida kodda tekshiruv bilan mustahkamlansin — prompt qurishda faqat ruxsat etilgan maydonlar ishlatiladi.

### 7.4 Limitlar

Bepul tarif limitlari o'zgarib turadi (Flash modellarida kuniga bir necha yuzdan 1500 gacha so'rov). Aniq raqamni AI Studio'dan tekshiring.

Tejash uchun:
- Natijani **24 soat keshlash** (bir xil tadbir + byudjet + do'kon)
- Bir foydalanuvchiga kuniga 10 ta so'rov
- Nomzod mahsulotlar ro'yxatini 40 ta bilan cheklash (token tejaladi)

---

## 8. Sentry 🟡

```ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // PII tozalash
    if (event.request?.data) {
      const d = event.request.data as any;
      for (const k of ['contactPhone', 'phone', 'address', 'code', 'measurements']) {
        if (d[k]) d[k] = '[redacted]';
      }
    }
    if (event.user) event.user = { id: event.user.id };
    return event;
  },
});
```

Uch alohida loyiha: `looksave-api`, `looksave-panels`, `looksave-mobile`.

---

## 9. Nosozlik matritsasi

Har bir servis ishlamay qolsa nima bo'ladi:

| Servis o'chdi | Ta'sir | Zaxira |
|---|---|---|
| **Telegram** | Sotuvchi xabar olmaydi | Panel + SMS eslatma 15 daq da |
| **SMS** | Kirish ishlamaydi 🔴 | Apple/Google kirish; mavjud sessiyalar ishlaydi |
| **R2** | Rasm/GLB ko'rinmaydi | CDN keshi ~1 yil; yangi yuklash ishlamaydi |
| **Google Maps** | Xarita bo'sh | Ro'yxat rejimi; geocoding → qo'lda pin |
| **Expo Push** | Bildirishnoma yo'q | Ilova ichida holat ko'rinadi |
| **Gemini** | AI Designer ishlamaydi | Groq → qoidaga asoslangan |
| **Sentry** | Xatolar ko'rinmaydi | Lokal loglar |

**SMS — yagona haqiqiy kritik nuqta.** U o'chsa yangi foydalanuvchi kira olmaydi. Shuning uchun ikkinchi provayderni oldindan ulab qo'ying (Eskiz o'chsa — Play Mobile yoki Twilio).

### Circuit breaker

```ts
class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;

  async run<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
    if (Date.now() < this.openUntil) return fallback();
    try {
      const r = await fn();
      this.failures = 0;
      return r;
    } catch (e) {
      if (++this.failures >= 5) {
        this.openUntil = Date.now() + 60_000;      // 1 daqiqa yopiq
        logger.error('circuit opened');
      }
      return fallback();
    }
  }
}
```

Tashqi servis o'chganda har so'rovda 30 soniya kutmaslik uchun. Bu bo'lmasa, bitta o'chgan servis butun API'ni sekinlashtiradi.

---

## 10. Kalitlar ro'yxati

| Kalit | Qayerdan | Aylantirish |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather | Sizib chiqsa |
| `TELEGRAM_WEBHOOK_SECRET` | `openssl rand -hex 32` | 6 oyda |
| `ESKIZ_EMAIL/PASSWORD` | eskiz.uz kabinet | Yiliga |
| `TWILIO_*` | Twilio Console | Yiliga |
| `R2_ACCESS_KEY_ID/SECRET` | Cloudflare R2 | 6 oyda |
| `GOOGLE_MAPS_SERVER_KEY` | Google Cloud | Yiliga |
| `GEMINI_API_KEY` | AI Studio | Yiliga |
| `EXPO_ACCESS_TOKEN` | expo.dev | Yiliga |
| `SENTRY_DSN` | Sentry | — |
| `JWT_*_SECRET` | `openssl rand -base64 48` | Aylantirilmaydi* |

\* JWT sirini o'zgartirsangiz barcha foydalanuvchilar tizimdan chiqib ketadi. Faqat sizib chiqsa.

---

## 11. Yodda tutish

**Telegram webhook'da darhol `200` qaytaring.** Kechiksangiz Telegram xabarni qayta yuboradi va buyurtma ikki marta ishlanadi.

**SMS shablonlarini loyiha boshida topshiring.** O'zbekistonda tasdiqlash 1-3 kun oladi va bu deploy'ni kutdirishi mumkin.

**`immutable` kesh sarlavhasi R2 xarajatini keskin kamaytiradi.**

**Places API hech qachon yoqilmasin.** Google xarajatining asosiy manbai aynan shu.

**LLM javobini har doim tekshiring.** O'ylab topilgan `variantId` bilan komplekt yasashga urinish ilovani yiqitadi.

**Circuit breaker yozing.** Bitta o'chgan tashqi servis butun API'ni sekinlashtirmasligi kerak.
