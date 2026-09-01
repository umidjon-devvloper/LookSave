import { isLocale } from '@/i18n/locale';

import type { Route } from './+types/privacy';

/**
 * Maxfiylik siyosati — docs/13-sayt.md §14, 10-roadmap §4 bo'yicha
 * 18-haftaga MAJBURIY (App Store talabi).
 *
 * ⚠️ YUZ SURATI BANDI ENG MUHIMI (K-08a, 12-tz.md D-42): surat
 * qurilmadan chiqadi va tashqi provayderga ketadi. Buni yashirish —
 * ham huquqiy xavf, ham ishonchni yo'qotish.
 *
 * ⚠️ BU MATN YURIDIK KO'RIB CHIQISHDAN O'TMAGAN. Ishga tushirishdan
 * oldin yurist tekshirishi shart — bu yerda faqat texnik haqiqat
 * yozilgan.
 */
export function meta(): Route.MetaDescriptors {
  return [
    { title: 'Maxfiylik siyosati — LookSave' },
    { name: 'description', content: "Qanday ma'lumot yig'amiz, nima uchun va qanday o'chiriladi." },
  ];
}

export function loader({ params }: Route.LoaderArgs) {
  return { locale: isLocale(params.locale) ? params.locale : 'en' };
}

export default function Privacy(): JSX.Element {
  return (
    <article className="shell max-w-3xl py-12">
      <p className="eyebrow">Huquqiy</p>
      <h1 className="mt-4 text-h1 font-bold">Maxfiylik siyosati</h1>
      <p className="mt-3 text-small text-dim">Oxirgi yangilanish: 2026-yil avgust</p>

      <div className="mt-10 flex flex-col gap-8 text-body leading-[1.7] text-muted-foreground">
        <section>
          <h2 className="text-h2 font-semibold text-foreground">Qanday ma'lumot yig'amiz</h2>
          <p className="mt-3">
            Ro'yxatdan o'tganda telefon raqami va ism. Buyurtma berganda yetkazish manzili va aloqa
            raqami. Ilovada joylashuv — faqat siz ruxsat bersangiz va faqat yaqin do'konlarni
            ko'rsatish uchun.
          </p>
        </section>

        <section>
          <h2 className="text-h2 font-semibold text-foreground">Yuz va gavda surati</h2>
          <p className="mt-3">
            Kiyintirish uchun yuklagan suratingiz{' '}
            <strong className="text-foreground">qurilmangizdan chiqadi</strong>: u bizning
            serverimizga yuboriladi va u yerdan kiyintirish provayderiga (FASHN) uzatiladi — avatar
            yasash va kiyim kiydirish aynan o'sha yerda bajariladi.
          </p>
          <p className="mt-3">
            Surat shaxsiy ma'lumot sifatida saqlanadi: yopiq kesh, ochiq havola yo'q. Uni istalgan
            vaqtda profil sozlamalaridan o'chirishingiz mumkin — o'chirilgach yangi kiyintirish
            uchun qayta yuklash kerak bo'ladi.
          </p>
          <p className="mt-3">
            Rozilik <strong className="text-foreground">so'raladi va oldindan belgilanmaydi</strong>
            : surat yuklashdan oldin siz uni o'zingiz tasdiqlaysiz.
          </p>
        </section>

        <section>
          <h2 className="text-h2 font-semibold text-foreground">Ma'lumot kim bilan bo'lishiladi</h2>
          <p className="mt-3">
            Buyurtma bergan do'kon sizning ismingiz, telefoningiz va manzilingizni ko'radi — busiz
            buyurtmani bajarib bo'lmaydi. Kiyintirish provayderi faqat suratni oladi. Boshqa hech
            kimga sotilmaydi va berilmaydi.
          </p>
        </section>

        <section>
          <h2 className="text-h2 font-semibold text-foreground">Hisobni o'chirish</h2>
          <p className="mt-3">
            Hisobni sozlamalardan o'chirishingiz mumkin. O'chirilgach shaxsiy ma'lumot va suratlar
            olib tashlanadi; buyurtma tarixi do'konning hisob-kitobi uchun shaxssizlantirilgan holda
            qoladi.
          </p>
        </section>

        <section>
          <h2 className="text-h2 font-semibold text-foreground">Cookie</h2>
          <p className="mt-3">
            Faqat zarur cookie ishlatiladi: sessiya (kirgan holatingiz), savat va til tanlovi.
            Analitika roziligingizsiz yuklanmaydi.
          </p>
        </section>

        <section>
          <h2 className="text-h2 font-semibold text-foreground">Bog'lanish</h2>
          <p className="mt-3">
            Savol yoki so'rov bo'lsa: <span className="text-foreground">privacy@looksave.app</span>
          </p>
        </section>
      </div>
    </article>
  );
}
