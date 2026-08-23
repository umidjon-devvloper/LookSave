import { Reveal } from '@/components/Reveal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Deckning 7- va 8-slaydlari: `MEN / WOMEN / LIMITED` va brendlar. */
const LANES = [
  {
    name: 'Men',
    body: 'Everyday essentials through to tailoring, sized against your own measurements.',
    glow: 'from-primary/25',
  },
  {
    name: 'Women',
    body: 'The same fit data, applied to a catalogue where sizing varies most between brands.',
    glow: 'from-brand/25',
  },
  {
    name: 'Limited',
    body: 'Drops with a fixed run. Try the piece on before it sells out, not after it arrives.',
    glow: 'from-limited/25',
  },
];

export function Marketplace(): JSX.Element {
  return (
    <section id="market" className="border-t border-border py-24 sm:py-32">
      <div className="shell">
        <Reveal>
          <p className="eyebrow">Marketplace</p>
          <h2 className="headline mt-4 max-w-2xl text-3xl sm:text-4xl">
            Premium brands and limited drops
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Curated stores rather than an endless feed. Every listing carries real stock, real
            sizes, and — for selected pieces — a 3D model you can put on your avatar.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {LANES.map((lane, index) => (
            <Reveal key={lane.name} delay={index * 90}>
              <Card className="relative h-full overflow-hidden border-border bg-surface">
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b ${lane.glow} to-transparent`}
                />
                <CardHeader className="relative">
                  <CardTitle className="text-2xl uppercase tracking-label">{lane.name}</CardTitle>
                </CardHeader>
                <CardContent className="relative leading-relaxed text-muted-foreground">
                  {lane.body}
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal delay={180}>
          <Card className="mt-6 border-limited/30 bg-limited/[0.06]">
            <CardContent className="p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div>
                <Badge
                  variant="outline"
                  className="rounded-full border-limited/40 bg-limited/10 text-limited"
                >
                  Limited drops
                </Badge>
                <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                  Fixed-run releases from partner brands, announced in the app first. Fit is checked
                  on your avatar before the drop opens.
                </p>
              </div>

              <Button
                asChild
                variant="outline"
                className="mt-5 shrink-0 rounded-full border-limited/50 text-limited hover:bg-limited/10 hover:text-limited sm:mt-0"
              >
                <a href="#waitlist">Get notified</a>
              </Button>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}
