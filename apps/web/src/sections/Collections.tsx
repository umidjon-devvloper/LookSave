import { Link } from 'react-router';
import { Icon } from '@looksave/ui-web';
import { Reveal } from '@/components/Reveal';
import type { Locale } from '@/i18n/locale';

const COLLECTIONS = [
  { key: 'men', title: 'MEN', subtitle: 'Erkaklar kolleksiyasi', image: '/img/collection-men-web-v1.png', query: 'gender=male' },
  { key: 'women', title: 'WOMEN', subtitle: 'Ayollar kolleksiyasi', image: '/img/collection-women-web-v1.png', query: 'gender=female' },
  { key: 'limited', title: 'LIMITED', subtitle: 'Cheklangan seriya', image: '/img/collection-limited-web-v1.png', query: 'limited=1' },
] as const;

export function Collections({ locale }: { locale: Locale }): JSX.Element {
  return (
    <section className="shell-wide landing-collections" id="collections">
      <Reveal>
        <div className="landing-collections-heading">
          <div><Icon name="looks" size={38} /><span><h2>Kolleksiyalar</h2><p>Siz uchun maxsus tanlangan kiyim kolleksiyalari</p></span></div>
          <Link to={`/${locale}/catalog`}>Barchasini ko'rish <Icon name="next" size={22} /></Link>
        </div>
        <div className="landing-collections-grid">
          {COLLECTIONS.map((collection) => (
            <Link key={collection.key} to={`/${locale}/catalog?${collection.query}`} className={`landing-collection-card ${collection.key === 'limited' ? 'is-limited' : ''}`}>
              <img src={collection.image} alt="" loading="lazy" decoding="async" />
              <span className="landing-collection-shade" />
              <span className="landing-collection-copy"><strong>{collection.title}</strong><small>{collection.subtitle}</small></span>
              <span className="landing-collection-arrow"><Icon name="next" size={24} /></span>
            </Link>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
