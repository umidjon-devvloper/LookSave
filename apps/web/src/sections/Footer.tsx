import { Separator } from '@/components/ui/separator';

const GROUPS = [
  {
    title: 'Product',
    links: [
      { href: '#how', label: 'How it works' },
      { href: '#wardrobe', label: '3D wardrobe' },
      { href: '#tryon', label: 'Try-on' },
      { href: '#market', label: 'Marketplace' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '#stores', label: 'For stores' },
      { href: '#waitlist', label: 'Early access' },
    ],
  },
];

export function Footer(): JSX.Element {
  return (
    <footer className="border-t border-border py-14">
      <div className="shell flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wordmark">LOOKSAVE</p>
          <p className="mt-3 max-w-xs leading-relaxed text-dim">
            AI fashion marketplace with a personal 3D avatar. Headquartered in Dubai.
          </p>
        </div>

        <div className="flex gap-14">
          {GROUPS.map((group) => (
            <nav key={group.title} className="flex flex-col gap-2.5">
              <p className="text-xs font-semibold uppercase tracking-label text-muted-foreground">
                {group.title}
              </p>
              {group.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-dim transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          ))}
        </div>
      </div>

      <div className="shell mt-12">
        <Separator />
        <p className="mt-6 text-sm text-dim">© {new Date().getFullYear()} LookSave</p>
      </div>
    </footer>
  );
}
