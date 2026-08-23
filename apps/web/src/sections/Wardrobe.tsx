import { Boxes } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Reveal } from '@/components/Reveal';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { LazyGarmentScene } from '@/three/Lazy';
import { groupBySlot, SLOT_LABEL, useManifest, type Garment, type Slot } from '@/three/manifest';

/**
 * 3D kiyimlar ko'rgazmasi — katalogdagi har bir buyum aynan o'sha GLB bilan.
 *
 * ⚠️ NEGA TAB LAR: har bir model alohida WebGL konteksti oladi, brauzer esa
 * ularni ~8-16 ta bilan cheklaydi. Tab lar bir vaqtda ko'rinadigan modellar
 * sonini 2-3 taga tushiradi — bu bezak emas, texnik chegara.
 */

/** Bir xil buyumning ranglari bitta kartada — 12 ta kanvas o'rniga 6 ta. */
type Piece = { title: string; slot: Slot; colors: Garment[] };

function toPieces(garments: Garment[]): Piece[] {
  const byTitle = new Map<string, Piece>();

  for (const garment of garments) {
    const existing = byTitle.get(garment.title);
    if (existing) existing.colors.push(garment);
    else
      byTitle.set(garment.title, { title: garment.title, slot: garment.slot, colors: [garment] });
  }

  return [...byTitle.values()];
}

export function Wardrobe(): JSX.Element {
  const { status, manifest } = useManifest();

  const grouped = useMemo(() => groupBySlot(manifest?.garments ?? []), [manifest]);

  const slots = [...grouped.keys()];
  const [active, setActive] = useState<string>('');
  const current = active || slots[0] || '';

  return (
    <section id="wardrobe" className="border-t border-border py-24 sm:py-32">
      <div className="shell">
        <Reveal>
          <p className="eyebrow">The 3D wardrobe</p>
          <h2 className="headline mt-4 max-w-2xl text-3xl sm:text-4xl">
            Every piece, modelled — not photographed
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            These are the actual assets the app dresses your avatar with. Spin one, look at the
            back, switch the colourway — the same file you would be wearing.
          </p>
        </Reveal>

        {status === 'loading' ? <WardrobeSkeleton /> : null}

        {status === 'error' ? (
          <Card className="mt-14 border-dashed">
            <CardContent className="flex items-center gap-3 py-10 text-muted-foreground">
              <Boxes className="size-5 shrink-0 text-dim" />
              The 3D catalogue could not be loaded. The rest of the page works as usual.
            </CardContent>
          </Card>
        ) : null}

        {status === 'ready' && slots.length > 0 ? (
          <Reveal delay={80}>
            <Tabs value={current} onValueChange={setActive} className="mt-12">
              <TabsList className="h-auto flex-wrap justify-start gap-1 bg-surface p-1">
                {slots.map((slot) => (
                  <TabsTrigger
                    key={slot}
                    value={slot}
                    className="rounded-full px-4 py-2 data-[state=active]:bg-primary/15 data-[state=active]:text-brand"
                  >
                    {SLOT_LABEL[slot]}
                    <span className="ml-2 tabular-nums text-dim">
                      {grouped.get(slot)?.length ?? 0}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {slots.map((slot) => (
                <TabsContent key={slot} value={slot} className="mt-8">
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {toPieces(grouped.get(slot) ?? []).map((piece) => (
                      <PieceCard key={piece.title} piece={piece} />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

function PieceCard({ piece }: { piece: Piece }): JSX.Element {
  const [index, setIndex] = useState(0);
  const garment = piece.colors[index] ?? piece.colors[0];

  if (!garment) return <Skeleton className="h-80 w-full" />;

  return (
    <Card className="group overflow-hidden border-border bg-surface transition-colors hover:border-borderStrong">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">{piece.title}</CardTitle>
          <p className="mt-1 text-sm text-dim">{garment.colorName}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-dim">
          {SLOT_LABEL[piece.slot]}
        </Badge>
      </CardHeader>

      <CardContent className="p-0">
        <LazyGarmentScene className="aspect-square w-full bg-[#08070D]" file={garment.file} />
      </CardContent>

      {piece.colors.length > 1 ? (
        <div className="flex items-center gap-2 border-t border-border p-4">
          {piece.colors.map((colour, position) => (
            <button
              key={colour.key}
              type="button"
              onClick={() => setIndex(position)}
              aria-label={colour.colorName}
              aria-pressed={position === index}
              className={cn(
                'size-7 rounded-full border-2 transition',
                position === index ? 'border-brand' : 'border-border hover:border-borderStrong',
              )}
              style={{ backgroundColor: colour.colorHex }}
            />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function WardrobeSkeleton(): JSX.Element {
  return (
    <div className="mt-12">
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-10 w-28 rounded-full" />
        ))}
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-[26rem] w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
