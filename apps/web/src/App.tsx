import { Nav } from '@/components/Nav';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Footer } from '@/sections/Footer';
import { Hero } from '@/sections/Hero';
import { HowItWorks } from '@/sections/HowItWorks';
import { Marketplace } from '@/sections/Marketplace';
import { Problem } from '@/sections/Problem';
import { Stores } from '@/sections/Stores';
import { TryOn } from '@/sections/TryOn';
import { Waitlist } from '@/sections/Waitlist';
import { Wardrobe } from '@/sections/Wardrobe';

/**
 * Tanishtiruv sayti. Bo'limlar deckning slaydlariga mos keladi
 * (`docs/11-deck-audit.md` §2):
 *
 *   Hero        ← 01 EXPLORE. SHOP. ELEVATE.
 *   Problem     ← 02 The Problem
 *   HowItWorks  ← 03 Create Your Avatar
 *   Wardrobe    ← 06 3D katalog (haqiqiy GLB modellar)
 *   TryOn       ← 04–05 Avatar & Fit Data, Virtual Try-On Flow
 *   Marketplace ← 07–08 MEN / WOMEN / LIMITED, Premium Brands
 *   Stores      ← 10 Business Model (sotuvchi tomoni)
 *
 * Yo'riqnoma (router) qo'yilmadi: bitta sahifa, ichki havolalar bilan.
 * Katalog qo'shilganda o'shanda kiritiladi.
 *
 * Interfeys shadcn/ui ustiga qurilgan, tokenlar `@looksave/design-system` da —
 * panellar bilan bir xil manba.
 */
export function App(): JSX.Element {
  return (
    <TooltipProvider delayDuration={200}>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Wardrobe />
        <TryOn />
        <Marketplace />
        <Stores />
        <Waitlist />
      </main>
      <Footer />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
