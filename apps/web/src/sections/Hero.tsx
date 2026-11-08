import { Link } from 'react-router';
import { Button, Icon, type IconName } from '@looksave/ui-web';
import { Reveal } from '@/components/Reveal';
import type { Locale } from '@/i18n/locale';

const STATS: Array<{ value: string; label: string; icon: IconName }> = [
  { value: '1 000+', label: 'Premium mahsulotlar', icon: 'orders' },
  { value: '360°', label: "3D ko'rish va aylantirish", icon: 'rotate' },
  { value: '100%', label: 'Xavfsiz va ishonchli', icon: 'authentic' },
];

export function Hero({ locale }: { locale: Locale }): JSX.Element {
  return (
    <section id="top" className="landing-hero">
      <div className="shell-wide landing-hero-layout">
        <div className="landing-hero-copy">
          <Reveal><p className="landing-location"><Icon name="logo" size={15} />AI fashion marketplace · Dubay va Toshkent</p></Reveal>
          <Reveal delay={80}><h1 className="landing-hero-title">Ko'ring. Kiying. <span>Oling.</span></h1></Reveal>
          <Reveal delay={140}><p className="landing-hero-description">Bitta surat — shaxsiy avataringiz. Kiyimni unda 3D da kiyib ko'ring, aylantiring va o'z o'lchovingizga solishtiring.</p></Reveal>
          <Reveal delay={200}>
            <div className="landing-hero-actions">
              <Button asChild><Link to={`/${locale}/catalog`}><Icon name="cart" size={18} /> Katalogni ochish <Icon name="next" size={17} /></Link></Button>
              <Button asChild variant="ghost"><Link to={`/${locale}/try-on`}><Icon name="tryon" size={18} /> Qanday ishlaydi?</Link></Button>
            </div>
          </Reveal>
          <Reveal delay={260} className="landing-stats-wrap">
            <dl className="landing-stats">
              {STATS.map((stat) => <div key={stat.value}><span className="landing-stat-icon"><Icon name={stat.icon} size={24} /></span><span><dt>{stat.value}</dt><dd>{stat.label}</dd></span></div>)}
            </dl>
          </Reveal>
        </div>
        <Reveal delay={120} className="landing-hero-visual">
          <span className="landing-shape landing-shape-one" /><span className="landing-shape landing-shape-two" /><span className="landing-shape landing-shape-three" />
          <img src="/img/web-hero-jacket.png" alt="Binafsha-qora kapyushonli kurtka" />
          <div className="landing-avatar-chip"><span><Icon name="profile" size={23} /></span><strong>Shaxsiy 3D avatar</strong></div>
          <div className="landing-tryon-chip"><Icon name="hanger" size={23} /> Virtual kiyib ko'rish</div>
          <div className="landing-rotate-chip"><Icon name="rotate" size={25} /><span><strong>360°</strong>Aylantirish</span></div>
          <div className="landing-carousel"><button aria-label="Oldingi"><Icon name="back" size={17} /></button><i /><i className="active" /><i /><button aria-label="Keyingi"><Icon name="next" size={17} /></button></div>
        </Reveal>
      </div>
    </section>
  );
}
