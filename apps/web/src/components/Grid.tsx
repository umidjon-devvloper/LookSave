import { edgeMaskStyle } from '@/lib/edgeMask';

/**
 * Orqa fondagi to'r va nur — deckdagi "hologramma sahnasi" hissi.
 *
 * Ilovadagi `AvatarStage` bilan bir xil til: past kontrastli to'r chiziqlari
 * va pastda binafsha nur. `pointer-events: none` — sichqoncha bu qatlamni
 * sezmaydi.
 *
 * ⚠️ BUTUN QATLAM CHETLARIDA SO'NADI (`edgeMaskStyle`) — VA BU ZARUR.
 * Pastdagi nur `top-0 -translate-y-1/2` bilan bo'lim chetiga o'rnashgan,
 * ya'ni yarmi `overflow-hidden` bilan QIRQILADI. Qirqim chizig'i aynan
 * bo'limlar tutashgan joyda o'tadi va yorqin binafsha dog' birdan
 * uzilib, ko'ndalang chiziq bo'lib ko'rinardi — foydalanuvchi ko'rgan
 * chok fon rasmidan emas, shu nurdan edi.
 */
export function Grid({ className = '' }: { className?: string }): JSX.Element {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={edgeMaskStyle}
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          // Chetlarga borgan sari to'r so'nadi — ramka bo'lib ko'rinmasin
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 50% 40%, black 40%, transparent 100%)',
        }}
      />
      <div className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-[120px]" />
    </div>
  );
}
