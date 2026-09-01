import { Camera, PersonStanding, Footprints, Sparkles } from 'lucide-react';

import { Reveal } from '@/components/Reveal';
import { SectionBackdrop } from '@/components/SectionBackdrop';
import { Card } from '@/components/ui/card';

/**
 * Deckning 3-slaydi: `Create Your Avatar`.
 *
 * ⚠️ RAQAMLAR SHU YERDA HAQIQIY MA'NO TASHIYDI — bu ketma-ketlik, ya'ni
 * qadamlar tartibi foydalanuvchi uchun muhim. Shuning uchun ular bezak emas
 * va belgichalar bilan almashtirilmaydi, yonma-yon turadi.
 */
const STEPS = [
  {
    icon: Camera,
    title: 'Yuz surati',
    body: 'Yorug‘ joyda olingan bitta surat. Avatar yuzingizni saqlaydi — ekranda manekenni emas, o‘zingizni ko‘rasiz.',
  },
  {
    icon: PersonStanding,
    title: 'Gavda o‘lchovi',
    body: 'Bo‘y, vazn va bir necha o‘lchov. Avatar shakli ham, keyingi har bir o‘lcham maslahati ham shundan chiqadi.',
  },
  {
    icon: Footprints,
    title: 'Oyoq o‘lchami',
    body: 'Poyabzal uchun EU o‘lchami — krossovka oyoqqa o‘tiradi, yonida osilib turmaydi.',
  },
  {
    icon: Sparkles,
    title: 'Tayyor',
    body: 'Avatar bir marta saqlanadi. Shundan keyin katalogdagi har bir kiyimni unda kiyib ko‘rish mumkin.',
  },
];

export function HowItWorks(): JSX.Element {
  return (
    <section id="how" className="section-y relative isolate">
      {/*
        Fon — neon portal (`portal-bg.webp`, 35 KB).

        ⚠️ O'NG CHETDA VA QIRQILGAN (`w-[62%]`, `object-[82%_30%]`).
        Portal to'liq ko'rsatilsa u sarlavha bilan e'tibor uchun
        kurashadi; kadrga faqat o'ng ustuni va tepa chizig'ining bir
        qismi tushishi kerak.

        ⚠️ Chetlari baribir so'nadi — niqob rasm qutisiga o'lchanadi,
        ya'ni qo'shni bo'lim bilan tutashish saqlanadi.
      */}
      <SectionBackdrop
        src="/img/portal-bg.webp"
        position="object-[82%_30%]"
        imageClass="ms-auto h-full w-full lg:w-[62%]"
        sideFade="linear-gradient(to right, hsl(var(--background)) 34%, hsl(var(--background) / 0.55) 58%, transparent 82%)"
      />

      <div className="shell-wide">
        <Reveal>
          <p className="eyebrow">Qanday ishlaydi</p>
          <h2 className="headline mt-4 max-w-2xl text-h1">
            Avatarni bir marta <span className="headline-accent">yasang</span>
          </h2>
          <p className="mt-5 max-w-2xl text-lead text-muted-foreground">
            To‘rt qadam, bir necha daqiqa — va taxmin tugaydi. Bundan keyingi hamma narsa sizning
            gavdangizga o‘xshash tanada bo‘lib o‘tadi.
          </p>
        </Reveal>

        <ol className="mt-14 grid gap-6   sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            /*
              ⚠️ TO'R KATAGI — `li`, `Reveal` EMAS. `Reveal` qo'shimcha
              `div` yasaydi; u katak bilan karta orasida tursa
              `h-full` zanjiri uziladi va bir qatordagi kartalar
              turli balandlikda qoladi. Shuning uchun `li` tashqarida
              va u `flex`: katak cho'ziladi, `Reveal` va karta esa
              `flex-1` bilan uni to'ldiradi.
            */
            <li key={step.title} className="relative flex list-none">
              <Reveal delay={index * 80} className="flex flex-1">
                <Card className="flex flex-1 flex-col gap-5 border-primary/25 bg-[linear-gradient(180deg,hsl(var(--primary)/0.07),hsl(var(--panel)/0.82))] p-6 transition-colors duration-150 hover:border-primary/45">
                  <div className="flex items-center gap-4">
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-primary/45 bg-primary/10 text-brand">
                      <step.icon className="size-6" />
                    </span>
                    <span className="text-h3 font-semibold tabular-nums text-brand">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-2.5">
                    <h3 className="text-h3 font-semibold">{step.title}</h3>
                    <p className="leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>

                  {/*
                    ⚠️ CHIZIQ BEZAK EMAS, O'LCHOV: u «to'rttadan
                    nechanchisi» ni ko'rsatadi. Maketda to'rttasi ham
                    deyarli bir xil to'lgan edi — bunday chiziq hech
                    nima demaydi va shunchaki shovqin bo'lib qoladi.

                    `aria-hidden`: qadam raqami («01») yonida allaqachon
                    matn bo'lib turibdi, ya'ni chiziq ekran o'quvchiga
                    yangi ma'lumot bermaydi.
                  */}
                  <div
                    aria-hidden="true"
                    className="h-[3px] overflow-hidden rounded-full bg-primary/15"
                  >
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-primary to-brand"
                      style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
                    />
                  </div>
                </Card>
              </Reveal>

              {/*
                  ⚠️ NUQTALI BOG'LOVCHI — QADAMLAR KETMA-KETLIGI.
                  Kartalar oddiy to'rda turganda ular MENYU bo'lib
                  o'qiladi: «to'rttasidan birini tanlang». Chiziq esa
                  ularni yo'lga aylantiradi — birinchisidan oxirigacha
                  boriladi. Ma'no faqat to'rt ustun bir qatorda
                  turganda to'g'ri, shuning uchun `lg:` dan pastda
                  chiziq yo'q: u yerda kartalar allaqachon tik ustun.

                  ⚠️ BALANDLIK HISOBLANGAN, TAXMIN EMAS: 1px ramka
                  + 24px (`p-6`) + 28px (56px doiraning yarmi) = 53px,
                  chiziq 2px (`h-0.5`) — ya'ni tepasi 52px. Ilgari bu
                  68px edi va chiziq doira markazidan 15px pastda
                  turardi. Karta chekinishi yoki doira o'lchami
                  o'zgarsa buni qayta hisoblash kerak.
                */}
              {index < STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute -end-6 top-[3.25rem] hidden h-0.5 w-6 lg:block"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle, hsl(var(--primary) / 0.85) 1px, transparent 1.2px)',
                    backgroundSize: '6px 2px',
                  }}
                />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
