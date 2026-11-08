import { Coins, Palette, Ruler, Shirt, SlidersHorizontal, Tag, UserRound } from 'lucide-react';
import { useState } from 'react';
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
  { id: '1', slug: 'outerwear', name: 'Tashqi kiyim' },
  { id: '2', slug: 'tops', name: 'Ko‘ylak va futbolka' },
  { id: '3', slug: 'bottoms', name: 'Pantalon va shorti' },
  { id: '4', slug: 'sportswear', name: 'Sport kiyim' },
  { id: '5', slug: 'knitwear', name: 'Sviter va xudi' },
  { id: '6', slug: 'accessories', name: 'Aksessuarlar' },
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
  const [size, setSize] = useState('M');
  const [color, setColor] = useState('#151318');
  const sizes = ['XS', 'S', 'M', 'L', 'XL'];
  const colors = ['#151318', '#ffffff', '#c5c7cc', '#133d75', '#07835f', '#ef253c', 'multi'];

  return (
    <div
      className={cn(
        'flex flex-col gap-6 rounded-2xl border border-border/70 bg-surface/70 p-5 shadow-xl backdrop-blur-md',
        className,
      )}
    >
      <div className="catalog-filter-title"><SlidersHorizontal className="size-5" /><strong>Filtrlar</strong></div>

      <FilterSection icon={<UserRound className="size-4 text-brand" />} title="Jinsi">
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

      <FilterSection icon={<Shirt className="size-4 text-brand" />} title="Kategoriyalar">
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

      <FilterSection icon={<Tag className="size-4 text-brand" />} title="Brend">
        {displayBrands.map((brand) => (
          <FilterChip
            key={brand.id}
            selected={filters.brand === brand.id}
            onClick={() => onToggle('brand', filters.brand === brand.id ? null : brand.id)}
          >
            {brand.name}
          </FilterChip>
        ))}
        <button type="button" className="catalog-show-all">Barchasini ko‘rsatish⌄</button>
      </FilterSection>

      <FilterSection icon={<Coins className="size-4 text-brand" />} title="Narx">
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
        <input
          type="range"
          min="0"
          max="5000000"
          step="50000"
          value={filters.priceMax ?? 5000000}
          onChange={(event) => onPrice(String(filters.priceMin ?? ''), event.target.value)}
          className="catalog-price-range"
          aria-label="Eng yuqori narx"
        />
      </FilterSection>

      <FilterSection icon={<Ruler className="size-4 text-brand" />} title="O‘lcham">
        <div className="catalog-size-row">
          {sizes.map((item) => <button type="button" key={item} className={size === item ? 'is-selected' : ''} onClick={() => setSize(item)}>{item}</button>)}
        </div>
      </FilterSection>

      <FilterSection icon={<Palette className="size-4 text-brand" />} title="Rang">
        <div className="catalog-color-row">
          {colors.map((item) => <button type="button" key={item} aria-label={item === 'multi' ? 'Barcha ranglar' : item} className={`${color === item ? 'is-selected' : ''} ${item === 'multi' ? 'is-multi' : ''}`} style={item === 'multi' ? undefined : { backgroundColor: item }} onClick={() => setColor(item)} />)}
        </div>
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
      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
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
      data-selected={selected ? 'true' : 'false'}
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
