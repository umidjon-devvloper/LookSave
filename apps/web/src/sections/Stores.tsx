import { Reveal } from '@/components/Reveal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const BENEFITS = [
  {
    title: 'Fewer returns',
    body: 'Shoppers who checked the fit on their own avatar order one size, not three.',
  },
  {
    title: 'Your own panel',
    body: 'Products, stock, orders and payouts in one place. Register in the app and start selling the same day.',
  },
  {
    title: 'Photos are enough',
    body: 'Upload product photos as you already do. AI try-on handles the rest — no 3D work on your side.',
  },
];

export function Stores(): JSX.Element {
  return (
    <section id="stores" className="border-t border-border py-24 sm:py-32">
      <div className="shell grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <div>
            <p className="eyebrow">For stores</p>
            <h2 className="headline mt-4 text-3xl sm:text-4xl">
              Sell to people who already know it fits
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              LookSave is a marketplace, not a storefront builder. You bring the stock; we bring
              buyers who have seen the piece on themselves.
            </p>

            <Button asChild size="lg" className="mt-8 rounded-full shadow-glow">
              <a href="#waitlist">Apply as a store</a>
            </Button>
          </div>
        </Reveal>

        <div className="grid gap-5">
          {BENEFITS.map((benefit, index) => (
            <Reveal key={benefit.title} delay={index * 90}>
              <Card className="border-border bg-surface">
                <CardContent className="flex gap-5 p-6">
                  <div
                    aria-hidden
                    className="mt-1 h-10 w-1 shrink-0 rounded-full bg-gradient-to-b from-primary to-transparent"
                  />
                  <div>
                    <h3 className="text-lg font-semibold">{benefit.title}</h3>
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
