import { Icon, type IconName } from '@looksave/ui-web';

import { Reveal } from '@/components/Reveal';

/**
 * Ishonch qatori — hero ostidagi alohida shisha panel.
 *
 * ⚠️ HERO'DAGI PANELDAN FARQI BOR VA U ATAYIN:
 *   hero paneli — O'LCHOV (`1 000+`, `360°`, `100%`), ya'ni xizmat
 *   nimani va'da qilayotgani;
 *   bu qator — SABAB (original, yetkazish, tanlangan), ya'ni nega
 *   ishonish mumkinligi.
 * Ikkalasi bir xil ko'rinishda bo'lsa takrorlanayotgandek tuyulardi,
 * shuning uchun bu yerda raqam yo'q va ajratgich vertikal chiziq.
 *
 * Ilova bilan bir xil uchlik (`components/home/Hero.tsx` dagi `badges`).
 */

const ITEMS: Array<{ icon: IconName; title: string; hint: string }> = [
  { icon: 'authentic', title: 'Original', hint: "Tekshirilgan do'konlar" },
  { icon: 'delivery', title: 'Yetkazish', hint: 'Shahar ichida bir kunda' },
  { icon: 'premium', title: 'Tanlangan', hint: 'Brend va mahalliy ishlab chiqaruvchi' },
];

export function TrustBar(): JSX.Element {
  return (
    <div className="shell-wide">
      <Reveal>
        {/*
          ⚠️ AJRATGICH `gap-px` EMAS, CHIZIQ.
          Ilgari kataklar orasi `gap-px bg-border` bilan ajratilgandi —
          u to'liq balandlikda ketardi va panelni uchta alohida
          qutiga bo'lib tashlardi. Maketdagi chiziq esa kalta va
          uchlari so'nadi: panel yaxlit qoladi, kataklar shunchaki
          bir-biridan ajraladi.
        */}
        <div className="edge-beam rounded-card border border-borderStrong bg-panel/75 shadow-[0_0_44px_hsl(var(--primary)/0.14),inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-xl">
          <div className="grid sm:grid-cols-3">
            {ITEMS.map((item, index) => (
              <div key={item.title} className="relative flex items-center gap-5 px-8 py-6">
                {index > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-6 start-0 hidden w-px sm:block"
                    style={{
                      background:
                        'linear-gradient(to bottom, transparent, hsl(var(--border-strong)) 26%, hsl(var(--border-strong)) 74%, transparent)',
                    }}
                  />
                ) : null}

                <span className="flex size-[54px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-primary/50 bg-primarySoft text-brand shadow-[0_0_20px_hsl(var(--primary)/0.28),inset_0_0_16px_hsl(var(--primary)/0.14)]">
                  <Icon name={item.icon} size={23} />
                </span>

                <span className="min-w-0">
                  <span className="block text-h3 font-semibold leading-snug text-foreground">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-body leading-snug text-muted-foreground">
                    {item.hint}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
