import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#wardrobe', label: '3D wardrobe' },
  { href: '#tryon', label: 'Try-on' },
  { href: '#market', label: 'Marketplace' },
  { href: '#stores', label: 'For stores' },
];

export function Nav(): JSX.Element {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Sahifa tepasida shaffof, pastga tushganda fonli — hero ustida chiziq bo'lmasin
    const onScroll = (): void => setSolid(window.scrollY > 24);
    onScroll();

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300',
        solid ? 'border-border bg-background/85 backdrop-blur-xl' : 'border-transparent',
      )}
    >
      <nav className="shell flex h-16 items-center justify-between">
        <a href="#top" className="text-sm font-semibold tracking-wordmark">
          LOOKSAVE
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="rounded-full shadow-glow">
            <a href="#waitlist">Get early access</a>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                <Menu />
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-72 border-border bg-surface">
              <SheetTitle className="text-sm font-semibold tracking-wordmark">LOOKSAVE</SheetTitle>
              <Separator className="my-5" />

              <div className="flex flex-col gap-1">
                {LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-base text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
