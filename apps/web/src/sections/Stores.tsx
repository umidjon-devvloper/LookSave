import { Button, Icon, type IconName } from '@looksave/ui-web';

import { Reveal } from '@/components/Reveal';
import { SectionBackdrop } from '@/components/SectionBackdrop';
import { Card, CardContent } from '@/components/ui/card';

/*
 * ⚠️ IKONKA MA'NOGA BOG'LANGAN, BEZAK EMAS. Maketda uchinchi kartada
 * diagramma turibdi, lekin karta «surat yetarli» haqida — diagramma
 * sarlavhaga zid keladi va o'qiyotgan odamni adashtiradi. Shuning
 * uchun u yerda fotoapparat.
 */
const BENEFITS: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: 'authentic',
    title: 'Qaytarish kamayadi',
    body: 'O‘z avatarida o‘lchamni tekshirgan xaridor uchta emas, bitta o‘lcham buyurtma qiladi.',
  },
  {
    icon: 'shop',
    title: 'O‘z kabinetingiz',
    body: 'Mahsulot, qoldiq, buyurtma va hisob-kitob bitta joyda. Ariza bergan kuningizdayoq sotishni boshlaysiz.',
  },
  {
    icon: 'camera',
    title: 'Surat yetarli',
    body: 'Mahsulot suratini odatdagidek yuklaysiz. Qolganini AI kiyintirish bajaradi — sizdan 3D ish talab qilinmaydi.',
  },
];

export function Stores(): JSX.Element {
  return (
    <section id="stores" className="section-y relative isolate">
      {/* Fon rasmi — chetlari fonga singiydi, qo'shni bo'limga tutashadi */}
      <SectionBackdrop
        src="/img/bg-store.webp"
        position="object-left"
        sideFade="linear-gradient(to left, hsl(var(--background)) 8%, transparent 58%)"
      />

      <div className="shell-wide grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <div>
            <p className="eyebrow">Do‘konlar uchun</p>
            <h2 className="headline mt-4 text-h1">
              O‘lchamiga ishongan xaridorga <span className="headline-accent">soting</span>
            </h2>
            <p className="mt-5 text-lead text-muted-foreground">
              LookSave — bozor maydoni, sayt yasovchi emas. Mahsulot sizdan, xaridor bizdan — va u
              kiyimni o‘zida ko‘rib bo‘lgan holda keladi.
            </p>

            <Button asChild className="mt-8 shadow-glow">
              <a href="#waitlist">Do‘kon ochish</a>
            </Button>
          </div>
        </Reveal>

        <div className="grid gap-5">
          {BENEFITS.map((benefit, index) => (
            <Reveal key={benefit.title} delay={index * 90}>
              <Card className="border-border bg-surface">
                <CardContent className="flex items-start gap-5 p-6">
                  {/* Chapdagi urg'u chizig'i — kartani bo'lim ritmiga bog'laydi */}
                  <div
                    aria-hidden
                    className="mt-1 h-10 w-1 shrink-0 rounded-full bg-gradient-to-b from-primary to-transparent"
                  />

                  <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-primary/45 bg-primarySoft text-brand">
                    <Icon name={benefit.icon} size={24} />
                  </span>

                  <div>
                    <h3 className="text-h3 font-semibold">{benefit.title}</h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">{benefit.body}</p>
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
