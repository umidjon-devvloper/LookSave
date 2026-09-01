import { isLocale } from '@/i18n/locale';

import type { Route } from './+types/terms';

/**
 * Foydalanish shartlari.
 *
 * ⚠️ ASOSIY BAND: LookSave sotuvchi EMAS (00-README K-10). Buyurtma —
 * do'konga yuborilgan so'rov, shartnoma esa xaridor bilan do'kon
 * o'rtasida tuziladi. Bu yozilmasa mas'uliyat chegarasi noaniq qoladi.
 *
 * ⚠️ YURIDIK KO'RIB CHIQISHDAN O'TMAGAN.
 */
export function meta(): Route.MetaDescriptors {
  return [
    { title: 'Foydalanish shartlari — LookSave' },
    { name: 'description', content: "Xizmatdan foydalanish qoidalari va mas'uliyat chegarasi." },
  ];
}

export function loader({ params }: Route.LoaderArgs) {
  return { locale: isLocale(params.locale) ? params.locale : 'en' };
}

export default function Terms(): JSX.Element {
  return (
    <article className="shell max-w-3xl py-12">
      <p className="eyebrow">Huquqiy</p>
      <h1 className="mt-4 text-h1 font-bold">Foydalanish shartlari</h1>
      <p className="mt-3 text-small text-dim">Oxirgi yangilanish: 2026-yil avgust</p>

      <div className="mt-10 flex flex-col gap-8 text-body leading-[1.7] text-muted-foreground">
        <section>
          <h2 className="text-h2 font-semibold text-foreground">LookSave nima qiladi</h2>
          <p className="mt-3">
            LookSave — do'konlar va xaridorlarni bog'laydigan platforma. Biz mahsulot sotmaymiz va
            ombor tutmaymiz: har bir mahsulot ro'yxatdan o'tgan do'konga tegishli.
          </p>
        </section>

        <section>
          <h2 className="text-h2 font-semibold text-foreground">Buyurtma</h2>
          <p className="mt-3">
            Buyurtma berish — do'konga yuborilgan{' '}
            <strong className="text-foreground">so'rov</strong>. Do'kon uni tasdiqlagach shartnoma
            siz bilan do'kon o'rtasida tuziladi. To'lov do'konda yoki yetkazib berilganda amalga
            oshiriladi; platformada onlayn to'lov yo'q.
          </p>
        </section>

        <section>
          <h2 className="text-h2 font-semibold text-foreground">Qaytarish</h2>
          <p className="mt-3">
            Qaytarish va almashtirish shartlari do'kon siyosatiga bo'ysunadi. LookSave nizoda
            vositachi bo'ladi, lekin sotuvchi sifatida javob bermaydi.
          </p>
        </section>

        <section>
          <h2 className="text-h2 font-semibold text-foreground">Kiyintirish natijasi</h2>
          <p className="mt-3">
            3D va AI kiyintirish — taxminiy ko'rinish. U kiyimning haqiqiy o'lchami, rangi va
            matosini to'liq aks ettirmasligi mumkin; xarid qarorida do'konning o'lcham jadvalini ham
            hisobga oling.
          </p>
        </section>

        <section>
          <h2 className="text-h2 font-semibold text-foreground">Hisobingiz</h2>
          <p className="mt-3">
            Telefon raqami haqiqiy bo'lishi kerak — u buyurtmani do'kon bilan bog'laydi. Soxta
            buyurtma yuborilganda hisob cheklanishi mumkin.
          </p>
        </section>
      </div>
    </article>
  );
}
