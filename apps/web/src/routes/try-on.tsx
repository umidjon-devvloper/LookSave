import { Link } from 'react-router';

import { Button } from '@looksave/ui-web';

import { Reveal } from '@/components/Reveal';
import { isLocale } from '@/i18n/locale';
import { LazyAvatarScene } from '@/three/Lazy';
import type { Outfit } from '@/three/manifest';

import type { Route } from './+types/try-on';

/**
 * Kiyintirish studiyasi — docs/15-sayt-dizayn.md §4.6.
 *
 * ⚠️ HOZIRCHA NAMOYISH. To'liq studiya (slotlar, o'lchov, AI render)
 * WEB-07 da: unga `SlotRail` komponenti va `/tryon/*` endpointlari
 * kerak. Bu sahifa 3D ning brauzerda ishlashini ko'rsatadi va
 * mahsulot sahifasidan havola shu yerga keladi.
 */

const DEMO_OUTFIT: Outfit = [
  { file: 'tshirt-violet-v1.glb', hideBodyParts: [] },
  { file: 'pants-graphite-v1.glb', hideBodyParts: ['underwear_briefs'] },
  { file: 'sneakers-white-v1.glb', hideBodyParts: [] },
];

export function meta(): Route.MetaDescriptors {
  return [
    { title: 'Kiyintirish — LookSave' },
    {
      name: 'description',
      content:
        "3D avatarda kiyim kiyib ko'ring: aylantiring, yaqinlashtiring, o'lchamni tekshiring.",
    },
  ];
}

export function loader({ params }: Route.LoaderArgs) {
  return { locale: isLocale(params.locale) ? params.locale : 'en' };
}

export default function TryOnPage({ loaderData }: Route.ComponentProps): JSX.Element {
  const { locale } = loaderData;

  return (
    <div className="shell section-y">
      <Reveal>
        <p className="eyebrow">Kiyintirish</p>
        <h1 className="headline mt-4 text-h1">3D da kiyib ko'ring</h1>
        <p className="mt-5 max-w-2xl text-lead text-muted-foreground">
          Avatarni sichqoncha bilan aylantiring, g'ildirak bilan yaqinlashtiring. Kiyim almashtirish
          va o'lcham moslash — ilovada, va tez orada shu yerda ham.
        </p>
      </Reveal>

      <Reveal delay={120}>
        <div className="relative mx-auto mt-10 aspect-[3/4] w-full max-w-lg overflow-hidden rounded-card border border-border bg-[#050509]">
          {/* Oyoq ostidagi binafsha nur — deckdagi «sahna» hissi */}
          <div
            aria-hidden="true"
            className="absolute inset-x-[15%] bottom-0 h-[22%] rounded-full bg-primary/25 blur-2xl"
          />

          <LazyAvatarScene className="absolute inset-0" outfit={DEMO_OUTFIT} />
        </div>
      </Reveal>

      <Reveal delay={200}>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild className="shadow-glow">
            <Link to={`/${locale}/catalog?onlyTryon=1`}>Kiyib ko'riladigan mahsulotlar</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to={`/${locale}/catalog`}>Butun katalog</Link>
          </Button>
        </div>
      </Reveal>
    </div>
  );
}
