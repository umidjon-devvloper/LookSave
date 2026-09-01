import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';

import type { StoreCard } from '@/api/endpoints';

/**
 * Do'konlar xaritasi — docs/15-sayt-dizayn.md §4.5.
 *
 * ⚠️ QORONG'I USLUB MAJBURIY. Google'ning standart och xaritasi qora
 * sahifada yorqin to'rtburchak bo'lib turadi va butun sahifani buzadi.
 * Uslub `styles` JSON bilan beriladi — bu `mapId` talab qilmaydi, ya'ni
 * Cloud Console'da alohida uslub yaratish ham shart emas.
 *
 * ⚠️ SHUNING UCHUN `Marker` (klassik), `AdvancedMarker` EMAS:
 * AdvancedMarker `mapId` siz ishlamaydi, `mapId` berilsa esa `styles`
 * JSON e'tiborsiz qoladi va xarita och rangda ochiladi. Klassik marker
 * SVG ikonka bilan brendga bo'yaladi.
 *
 * ⚠️ Bu fayl FAQAT `lazy()` orqali yuklanadi (`routes/stores.tsx`):
 * Google Maps brauzer kutubxonasi, SSR bundle'ga tushmasligi kerak.
 */

/** LookSave fon qatlamlariga moslangan qorong'i uslub (06-dizayn.md §2) */
const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#14121C' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9B96AE' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0F' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1C1928' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#241F33' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#252036' }] },
  { featureType: 'water', stylers: [{ color: '#0F0D16' }] },
  { featureType: 'landscape', stylers: [{ color: '#0A0A0F' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#332B4A' }] },
];

/** Binafsha nuqta — tanlanganda kattaroq va yorqinroq */
function pin(selected: boolean): google.maps.Icon {
  const size = selected ? 44 : 32;
  const fill = selected ? '#C084FC' : '#8B5CF6';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="${fill}" stroke="#0A0A0F" stroke-width="3"/><circle cx="16" cy="16" r="3.5" fill="#0A0A0F"/></svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

export default function StoreMap({
  apiKey,
  stores,
  center,
  selectedId,
  onSelect,
}: {
  apiKey: string;
  stores: StoreCard[];
  center: { lat: number; lng: number };
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={center}
        defaultZoom={12}
        styles={DARK_STYLE}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        // POI'lar bosilmasin — Places API yoqilmagan (K-05)
        clickableIcons={false}
        backgroundColor="#0A0A0F"
      >
        {stores.map((store) =>
          store.location ? (
            <Marker
              key={store.id}
              position={store.location}
              title={store.name}
              icon={pin(store.id === selectedId)}
              // Tanlangani boshqalar ustida tursin
              zIndex={store.id === selectedId ? 2 : 1}
              onClick={() => onSelect(store.id)}
            />
          ) : null,
        )}
      </Map>
    </APIProvider>
  );
}
