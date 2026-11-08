import { Link } from 'react-router';
import { Icon, type IconName } from '@looksave/ui-web';
import { Reveal } from '@/components/Reveal';
import type { Locale } from '@/i18n/locale';

interface Category { label: string; icon: IconName; image: string; query: string }
const CATEGORIES: Category[] = [
  { label: 'Tashqi kiyim', icon: 'slotOuter', image: '/img/web-hero-jacket.png', query: 'outerwear' },
  { label: 'Ustki kiyim', icon: 'slotTop', image: '/img/web-category-shirt.png', query: 'tops' },
  { label: 'Pastki kiyim', icon: 'slotBottom', image: '/img/web-category-pants.png', query: 'bottoms' },
  { label: 'Poyabzal', icon: 'slotFeet', image: '/img/web-category-shoe.png', query: 'shoes' },
  { label: 'Aksessuarlar', icon: 'slotHead', image: '/img/web-category-cap.png', query: 'accessories' },
];

export function Categories({ locale }: { locale: Locale }): JSX.Element {
  return (
    <section className="shell-wide landing-categories">
      <Reveal>
        <div className="landing-section-heading"><h2>Kategoriyalar</h2><Link to={`/${locale}/catalog`}>Barcha kategoriyalar <Icon name="next" size={18} /></Link></div>
        <div className="landing-category-grid">
          {CATEGORIES.map((category) => (
            <Link key={category.label} to={`/${locale}/catalog?category=${category.query}`} className="landing-category-card">
              <span className="landing-category-copy"><Icon name={category.icon} size={30} /><strong>{category.label}</strong><Icon name="openOut" size={20} /></span>
              <img src={category.image} alt="" loading="lazy" decoding="async" />
            </Link>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
