import { ArrowRight, RotateCw } from 'lucide-react';

import { Grid } from '@/components/Grid';
import { Reveal } from '@/components/Reveal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LazyAvatarScene } from '@/three/Lazy';
import type { Outfit } from '@/three/manifest';

/**
 * Deckning 1-slaydi: `EXPLORE. SHOP. ELEVATE.` va brend nomi.
 *
 * O'ng tomonda — ilovaning haqiqiy avatari, `assets-3d/export` dagi o'sha
 * GLB fayllar. Ilgari bu yerda CSS bilan chizilgan siluet turardi; endi
 * mehmon saytdayoq mahsulotning o'zini ko'radi.
 */

/** Boshlang'ich kiyim — manifestni kutmaymiz, hero darrov chizilishi kerak. */
const HERO_OUTFIT: Outfit = [
  { file: 'tshirt-violet-v1.glb', hideBodyParts: [] },
  { file: 'pants-graphite-v1.glb', hideBodyParts: ['underwear_briefs'] },
  { file: 'sneakers-white-v1.glb', hideBodyParts: [] },
];

const STATS = [
  { value: '1 photo', label: 'to build your avatar' },
  { value: '360°', label: 'rotate and zoom the fit' },
  { value: '0 guesswork', label: 'on size and length' },
];

export function Hero(): JSX.Element {
  return (
    <section id="top" className="relative overflow-hidden pb-24 pt-32 sm:pb-32 sm:pt-40">
      <Grid />

      <div className="shell relative grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Reveal>
            <Badge
              variant="outline"
              className="rounded-full border-primary/40 bg-primary/10 px-3 py-1 text-brand"
            >
              AI fashion marketplace · Dubai
            </Badge>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="headline mt-5 text-5xl sm:text-6xl lg:text-7xl">
              Explore. Shop.
              <br />
              <span className="text-primary">Elevate.</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              One photo becomes your personal avatar. Try any garment on it in 3D, rotate it, check
              the fit against your own measurements — then buy the size you already know works.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-full shadow-glow">
                <a href="#waitlist">
                  Get early access
                  <ArrowRight />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <a href="#how">See how it works</a>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-12">
              <Separator />
              <dl className="mt-8 grid max-w-lg grid-cols-3 gap-6">
                {STATS.map((stat) => (
                  <div key={stat.value}>
                    <dt className="text-xl font-semibold">{stat.value}</dt>
                    <dd className="mt-1 text-sm leading-snug text-dim">{stat.label}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <AvatarStage />
        </Reveal>
      </div>
    </section>
  );
}

/** Deckdagi 4-slayd: avatar va uning yonidagi o'lchov yozuvlari. */
function AvatarStage(): JSX.Element {
  return (
    <Card className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden border-border bg-[#050509] p-0 shadow-card">
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Oyoq ostidagi binafsha nur — deckdagi "sahna" hissi */}
      <div
        aria-hidden
        className="absolute inset-x-[15%] bottom-0 h-[22%] rounded-full bg-primary/25 blur-2xl"
      />

      <LazyAvatarScene className="absolute inset-0" outfit={HERO_OUTFIT} />

      {/* O'lchovlar — deckdagi 180cm / 82kg / 42EU */}
      {[
        { value: '180', unit: 'cm', pos: 'left-5 top-[10%]' },
        { value: '82', unit: 'kg', pos: 'right-5 top-[46%]' },
        { value: '42', unit: 'EU', pos: 'right-5 top-[78%]' },
      ].map((item) => (
        <div key={item.unit} className={`pointer-events-none absolute ${item.pos}`}>
          <p className="text-2xl font-semibold tabular-nums">{item.value}</p>
          <p className="-mt-1 text-xs text-dim">{item.unit}</p>
        </div>
      ))}

      <p className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-2 text-xs text-dim">
        <RotateCw className="size-3.5" />
        Drag to rotate
      </p>
    </Card>
  );
}
