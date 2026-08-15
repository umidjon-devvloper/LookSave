import type { VariantInput } from '../../api/products';
import { ImageUploader } from './ImageUploader';

interface Props {
  variants: VariantInput[];
  onChange: (variants: VariantInput[]) => void;
}

const PRESET_SIZES: Record<string, string[]> = {
  kiyim: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  oyoq: ['38', '39', '40', '41', '42', '43', '44', '45'],
  bitta: ['ONE'],
};

function emptyVariant(): VariantInput {
  return { colorHex: '#1a1a1a', colorName: { uz: '' }, images: [], priceDelta: '0.00', sizes: [] };
}

export function VariantEditor({ variants, onChange }: Props): JSX.Element {
  const update = (index: number, patch: Partial<VariantInput>): void => {
    onChange(variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)));
  };

  const toggleSize = (index: number, size: string): void => {
    const variant = variants[index];
    if (!variant) return;

    const exists = variant.sizes.some((item) => item.size === size);
    update(index, {
      sizes: exists
        ? variant.sizes.filter((item) => item.size !== size)
        : [...variant.sizes, { size, stock: 1 }],
    });
  };

  const setStock = (index: number, size: string, stock: number): void => {
    const variant = variants[index];
    if (!variant) return;
    update(index, {
      sizes: variant.sizes.map((item) => (item.size === size ? { ...item, stock } : item)),
    });
  };

  return (
    <div className="space-y-4">
      {variants.map((variant, index) => (
        <div key={index} className="rounded-xl border border-border bg-surface2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-end gap-3">
              <label className="block">
                <span className="label">Rang</span>
                <input
                  type="color"
                  className="mt-2 h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent"
                  value={variant.colorHex ?? '#1a1a1a'}
                  onChange={(event) => update(index, { colorHex: event.target.value })}
                />
              </label>

              <label className="block flex-1">
                <span className="label">Rang nomi</span>
                <input
                  className="field mt-2"
                  placeholder="Qora"
                  value={variant.colorName?.['uz'] ?? ''}
                  onChange={(event) => update(index, { colorName: { uz: event.target.value } })}
                />
              </label>

              <label className="block w-40">
                <span className="label">Narx farqi</span>
                <input
                  className="field mt-2 tabular-nums"
                  inputMode="decimal"
                  value={variant.priceDelta}
                  onChange={(event) => update(index, { priceDelta: event.target.value })}
                />
              </label>
            </div>

            {variants.length > 1 ? (
              <button
                type="button"
                className="text-sm text-dim hover:text-danger"
                onClick={() => onChange(variants.filter((_, i) => i !== index))}
              >
                O'chirish
              </button>
            ) : null}
          </div>

          <div className="mt-4">
            <p className="label mb-2">O'lchamlar va ombor</p>
            <div className="flex flex-wrap gap-2">
              {Object.values(PRESET_SIZES)
                .flat()
                .filter((size, i, all) => all.indexOf(size) === i)
                .map((size) => {
                  const selected = variant.sizes.find((item) => item.size === size);
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => toggleSize(index, size)}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                        selected
                          ? 'border-primary bg-primary/15 text-white'
                          : 'border-border bg-surface text-dim hover:border-borderStrong'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
            </div>

            {variant.sizes.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {variant.sizes.map((item) => (
                  <label key={item.size} className="flex items-center gap-2 text-sm">
                    <span className="w-10 text-muted">{item.size}</span>
                    <input
                      type="number"
                      min={0}
                      max={9999}
                      className="field py-2 tabular-nums"
                      value={item.stock}
                      onChange={(event) =>
                        setStock(index, item.size, Math.max(0, Number(event.target.value)))
                      }
                    />
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-warning">Kamida bitta o'lcham tanlang.</p>
            )}
          </div>

          <div className="mt-4">
            <p className="label mb-2">Shu rangning rasmlari (ixtiyoriy)</p>
            <ImageUploader
              images={variant.images}
              max={5}
              onChange={(images) => update(index, { images })}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        className="btn-ghost w-full"
        onClick={() => onChange([...variants, emptyVariant()])}
      >
        + Yana rang qo'shish
      </button>
    </div>
  );
}

export { emptyVariant };
