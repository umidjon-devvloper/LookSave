import { Camera, PersonStanding, Footprints, Sparkles } from 'lucide-react';

import { Reveal } from '@/components/Reveal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    title: 'Face scan',
    body: 'One well-lit photo. The avatar keeps your face, so what you see on screen reads as you — not a mannequin.',
  },
  {
    icon: PersonStanding,
    title: 'Body type',
    body: 'Height, weight and a few measurements. They drive the shape of the avatar and every size recommendation after it.',
  },
  {
    icon: Footprints,
    title: 'Shoe size',
    body: 'EU sizing for footwear, so sneakers and boots sit on the foot instead of floating near it.',
  },
  {
    icon: Sparkles,
    title: 'Ready to wear',
    body: 'Your avatar is saved once. Every garment in the catalogue can be tried on it from then on.',
  },
];

export function HowItWorks(): JSX.Element {
  return (
    <section id="how" className="border-t border-border py-24 sm:py-32">
      <div className="shell">
        <Reveal>
          <p className="eyebrow">The solution</p>
          <h2 className="headline mt-4 max-w-2xl text-3xl sm:text-4xl">Create your avatar once</h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Four steps, a few minutes, and the guessing stops. Everything after this happens on a
            body that matches yours.
          </p>
        </Reveal>

        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <Reveal key={step.title} delay={index * 80}>
              <li className="list-none">
                <Card className="h-full border-border bg-surface">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full border border-primary/45 bg-primary/10 text-brand">
                        <step.icon className="size-4" />
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-dim">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <CardTitle className="pt-4 text-lg">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="leading-relaxed text-muted-foreground">
                    {step.body}
                  </CardContent>
                </Card>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
