import { Maximize2, Palette, RotateCw, Ruler } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Reveal } from '@/components/Reveal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { LazyAvatarScene } from '@/three/Lazy';
import {
  groupBySlot,
  SLOT_LABEL,
  useManifest,
  type Garment,
  type Outfit,
  type Slot,
} from '@/three/manifest';

/**
 * Deckning 5-slaydi: `Virtual Try-On Flow`.
 *
 * Bu bo'lim endi rasm emas — ilovadagi kiyintirish ekranining o'zi.
 * Mehmon avatarni kiyintiradi, aylantiradi, rangni almashtiradi. Ilovaga
 * o'tishdan oldin mahsulot nima ekanini shu yerda tushunadi.
 */

/** Sahifa ochilganda avatar shu kiyimda turadi. */
const DEFAULT_KEYS: Partial<Record<Slot, string>> = {
  top: 'tshirt-white',
  bottom: 'pants-beige',
  feet: 'sneakers-white',
};

const CONTROLS = [
  {
    icon: RotateCw,
    label: 'Rotate',
    body: 'Drag to turn the avatar. The back of a jacket matters as much as the front.',
  },
  {
    icon: Maximize2,
    label: 'Fit',
    body: 'The garment is fitted to your measurements — not pasted over a photo.',
  },
  {
    icon: Palette,
    label: 'Colour',
    body: 'Switch colourways on the body instead of imagining them from a swatch.',
  },
  {
    icon: Ruler,
    label: 'Size',
    body: 'Change size and watch the fit change — only sizes in stock are offered.',
  },
];

export function TryOn(): JSX.Element {
  const { status, manifest } = useManifest();
  const garments = manifest?.garments ?? [];

  const grouped = useMemo(() => groupBySlot(garments), [garments]);
  const slots = [...grouped.keys()];

  const [chosen, setChosen] = useState<Partial<Record<Slot, string>>>(DEFAULT_KEYS);
  const [tab, setTab] = useState<string>('');
  const currentTab = tab || slots[0] || '';

  const outfit: Outfit = useMemo(
    () =>
      Object.values(chosen)
        .map((key) => garments.find((garment) => garment.key === key))
        .filter((garment): garment is Garment => Boolean(garment))
        .map((garment) => ({ file: garment.file, hideBodyParts: garment.hideBodyParts })),
    [chosen, garments],
  );

  /** Bosilgan buyum allaqachon kiyilgan bo'lsa — yechiladi. */
  const toggle = (slot: Slot, key: string): void =>
    setChosen((previous) => ({ ...previous, [slot]: previous[slot] === key ? undefined : key }));

  return (
    <section id="tryon" className="relative overflow-hidden border-t border-border py-24 sm:py-32">
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[140px]"
      />

      <div className="shell relative">
        <Reveal>
          <p className="eyebrow">Virtual try-on</p>
          <h2 className="headline mt-4 max-w-2xl text-3xl sm:text-4xl">
            See it on you, before you buy
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Dress the avatar below the way a shopper would in the app. Turn it, change the piece,
            change the colour — and judge the fit the way you would in a mirror.
          </p>
        </Reveal>

        <Reveal delay={100}>
          <div className="mt-12 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Card className="overflow-hidden border-border bg-surface p-0 shadow-card">
              <LazyAvatarScene
                className="aspect-[4/5] w-full bg-[#08070D]"
                outfit={outfit}
                autoRotate={false}
              />

              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-dim">
                <span className="flex items-center gap-2">
                  <RotateCw className="size-3.5" />
                  Drag to rotate
                </span>
                <span className="tabular-nums">
                  {outfit.length} {outfit.length === 1 ? 'piece' : 'pieces'} on
                </span>
              </div>
            </Card>

            <div className="flex flex-col gap-6">
              <Card className="border-border bg-surface">
                <CardContent className="p-4 sm:p-5">
                  {status !== 'ready' || slots.length === 0 ? (
                    <div className="space-y-4">
                      <Skeleton className="h-10 w-full rounded-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : (
                    <Tabs value={currentTab} onValueChange={setTab}>
                      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-background p-1">
                        {slots.map((slot) => (
                          <TabsTrigger
                            key={slot}
                            value={slot}
                            className="rounded-full px-3.5 py-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-brand"
                          >
                            {SLOT_LABEL[slot]}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {slots.map((slot) => (
                        <TabsContent key={slot} value={slot} className="mt-5">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {(grouped.get(slot) ?? []).map((garment) => (
                              <GarmentButton
                                key={garment.key}
                                garment={garment}
                                selected={chosen[slot] === garment.key}
                                onSelect={() => toggle(slot, garment.key)}
                              />
                            ))}
                          </div>

                          <p className="mt-4 text-xs text-dim">
                            Tap a selected piece again to take it off.
                          </p>
                        </TabsContent>
                      ))}
                    </Tabs>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border bg-surface">
                <CardContent className="grid gap-x-8 gap-y-6 p-5 sm:grid-cols-2">
                  {CONTROLS.map((control) => (
                    <div key={control.label}>
                      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-label text-brand">
                        <control.icon className="size-4" />
                        {control.label}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {control.body}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="rounded-full shadow-glow">
                  <a href="#waitlist">Try it on your own avatar</a>
                </Button>
                <Separator orientation="vertical" className="hidden h-6 sm:block" />
                <p className="text-sm text-dim">Your face, your measurements — in the app.</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function GarmentButton({
  garment,
  selected,
  onSelect,
}: {
  garment: Garment;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className={cn(
            'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition',
            selected
              ? 'border-primary/60 bg-primary/10'
              : 'border-border bg-background hover:border-borderStrong',
          )}
        >
          <span
            aria-hidden
            className="size-6 shrink-0 rounded-full border border-borderStrong"
            style={{ backgroundColor: garment.colorHex }}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{garment.title}</span>
            <span className="block truncate text-xs text-dim">{garment.colorName}</span>
          </span>
          {selected ? (
            <Badge variant="secondary" className="shrink-0 bg-primary/15 text-brand">
              On
            </Badge>
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {garment.title} — {garment.colorName}
      </TooltipContent>
    </Tooltip>
  );
}
