import { Crown, LayoutGrid, Star, Tag, User } from 'lucide-react';
import type { Brand, Category } from '@/api/endpoints';
import { cn } from '@/lib/utils';

export interface FilterState {
  category?: string | undefined;
  brand?: string | undefined;
  gender?: string | undefined;
  onlyTryon?: boolean | undefined;
  limited?: boolean | undefined;
  priceMin?: number | undefined;
  priceMax?: number | undefined;
}

const GENDERS = [
  { value: 'male', label: 'Erkaklar' },
  { value: 'female', label: 'Ayollar' },
  { value: 'unisex', label: 'Uniseks' },
];

const DEFAULT_CATEGORIES = [
  { id: '1', slug: 'tops', name: 'Tops' },
  { id: '2', slug: 'bottoms', name: 'Bottoms' },
  { id: '3', slug: 'shoes', name: 'Shoes' },
  { id: '4', slug: 'headwear', name: 'Headwear' },
  { id: '5', slug: 'accessories', name: 'Accessories' },
];

const DEFAULT_BRANDS = [
  { id: 'nike', name: 'Nike' },
  { id: 'adidas', name: 'Adidas' },
  { id: 'zara', name: 'Zara' },
  { id: 'puma', name: 'Puma' },
  { id: 'new-balance', name: 'New Balance' },
  { id: 'uniqlo', name: 'Uniqlo' },
  { id: 'local-brand', name: 'Local Brand' },
];

export function CatalogFilters({
  categories,
  brands,
  filters,
  onToggle,
  onPrice,
  className,
}: {
  categories: Category[];
  brands: Brand[];
  filters: FilterState;
  /** Tanlanganini qayta bosish — bekor qilish (`null` yuboriladi) */
  onToggle: (key: keyof FilterState, value: string | null) => void;
  onPrice: (min: string, max: string) => void;
  className?: string;
}): JSX.Element {
  const displayCategories = categories.length > 0 ? categories : (DEFAULT_CATEGORIES as Category[]);
  const displayBrands = brands.length > 0 ? brands : (DEFAULT_BRANDS as Brand[]);

  return (
    <div
      className={cn(
        'flex flex-col gap-6 rounded-2xl border border-border/70 bg-surface/70 p-5 shadow-xl backdrop-blur-md',
        className,
      )}
    >
      {/* ── KIMGA ── */}
      <FilterSection icon={<User className="size-4 text-brand" />} title="KIMGA">
        {GENDERS.map((item) => (
          <FilterChip
            key={item.value}
            selected={filters.gender === item.value}
            onClick={() => onToggle('gender', filters.gender === item.value ? null : item.value)}
          >
            {item.label}
          </FilterChip>
        ))}
      </FilterSection>

      {/* ── KATEGORIYA ── */}
      <FilterSection icon={<LayoutGrid className="size-4 text-brand" />} title="KATEGORIYA">
        {displayCategories.map((category) => (
          <FilterChip
            key={category.id}
            selected={filters.category === category.slug}
            onClick={() =>
              onToggle('category', filters.category === category.slug ? null : category.slug)
            }
          >
            {category.name}
          </FilterChip>
        ))}
      </FilterSection>

      {/* ── BREND ── */}
      <FilterSection icon={<Crown className="size-4 text-brand" />} title="BREND">
        {displayBrands.map((brand) => (
          <FilterChip
            key={brand.id}
            selected={filters.brand === brand.id}
            onClick={() => onToggle('brand', filters.brand === brand.id ? null : brand.id)}
          >
            {brand.name}
          </FilterChip>
        ))}
      </FilterSection>

      {/* ── NARX ── */}
      <FilterSection icon={<Tag className="size-4 text-brand" />} title="NARX">
        <div className="flex items-center gap-2">
          <input
            name="priceMin"
            inputMode="numeric"
            defaultValue={filters.priceMin ?? ''}
            placeholder="dan"
            aria-label="Eng past narx"
            onBlur={(event) => onPrice(event.target.value, String(filters.priceMax ?? ''))}
            className="h-10 w-full rounded-xl border border-border/80 bg-surface2/90 px-3 text-center text-xs text-foreground placeholder:text-dim transition-colors focus:border-borderAccent focus:bg-surface3 focus:outline-none"
          />
          <span className="text-dim text-sm select-none" aria-hidden="true">
            —
          </span>
          <input
            name="priceMax"
            inputMode="numeric"
            defaultValue={filters.priceMax ?? ''}
            placeholder="gacha"
            aria-label="Eng yuqori narx"
            onBlur={(event) => onPrice(String(filters.priceMin ?? ''), event.target.value)}
            className="h-10 w-full rounded-xl border border-border/80 bg-surface2/90 px-3 text-center text-xs text-foreground placeholder:text-dim transition-colors focus:border-borderAccent focus:bg-surface3 focus:outline-none"
          />
        </div>
      </FilterSection>

      {/* ── QO'SHIMCHA ── */}
      <FilterSection icon={<Star className="size-4 text-brand" />} title="QO'SHIMCHA">
        <FilterChip
          selected={filters.onlyTryon === true}
          onClick={() => onToggle('onlyTryon', filters.onlyTryon ? null : '1')}
        >
          Kiyib ko'rish mumkin
        </FilterChip>
        <FilterChip
          selected={filters.limited === true}
          onClick={() => onToggle('limited', filters.limited ? null : '1')}
        >
          Limited
        </FilterChip>
      </FilterSection>
    </div>
  );
}

function FilterSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex select-none items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95',
        selected
          ? 'border-primary bg-primarySoft font-semibold text-brand shadow-[0_0_12px_hsl(var(--primary)/0.35)]'
          : 'border-border/70 bg-surface2/80 text-muted-foreground hover:border-primary/50 hover:bg-surface3 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
