import { Reveal } from '@/components/Reveal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Deckning 2-slaydi: muammo. */
const POINTS = [
  {
    stat: '≈ 40%',
    title: 'of online fashion comes back',
    body: 'Almost always for the same reason — it did not fit. The photo showed a model, not the person buying.',
  },
  {
    stat: '3 sizes',
    title: 'ordered to keep one',
    body: 'Shoppers hedge. Stores pay for the shipping, the handling and the item that returns unsellable.',
  },
  {
    stat: 'No signal',
    title: 'on how it will sit on you',
    body: 'Height, shoulders, waist, shoe size — none of it reaches the product page. Everyone guesses.',
  },
];

export function Problem(): JSX.Element {
  return (
    <section id="problem" className="border-t border-border py-24 sm:py-32">
      <div className="shell">
        <Reveal>
          <p className="eyebrow">The problem</p>
          <h2 className="headline mt-4 max-w-2xl text-3xl sm:text-4xl">
            Buying clothes online is still a guess
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {POINTS.map((point, index) => (
            <Reveal key={point.stat} delay={index * 90}>
              <Card className="h-full border-border bg-surface">
                <CardHeader className="pb-3">
                  <p className="text-3xl font-semibold text-primary">{point.stat}</p>
                  <CardTitle className="pt-2 text-lg">{point.title}</CardTitle>
                </CardHeader>
                <CardContent className="leading-relaxed text-muted-foreground">
                  {point.body}
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
