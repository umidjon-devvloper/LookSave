import { AdvancedMarker, APIProvider, Map, type MapMouseEvent } from '@vis.gl/react-google-maps';
import { useState } from 'react';

import { formatCoordinates, mapsApiKey, parseCoordinates, type Coordinates } from '../lib/coords';

/**
 * Do'kon nuqtasini xaritadan tanlash.
 *
 * NEGA MUHIM: yetkazib berish radiusi shu nuqtadan o'lchanadi. Koordinata
 * bir necha yuz metr xato bo'lsa, yaqin mijozlar "hududdan tashqarida"
 * xatosini oladi va do'kon buni bilmaydi ham.
 *
 * ⚠️ KALITSIZ ISHLAYDI. `VITE_GOOGLE_MAPS_KEY` berilmasa xarita
 * ko'rsatilmaydi, o'rniga qo'lda kiritish maydoni qoladi. Panel ochilishi
 * xarita kalitiga bog'liq bo'lib qolmasligi kerak — do'kon egasi
 * buyurtmalarni ko'ra olishi shart, kalit muammosi bundan muhimroq emas.
 *
 * Web kaliti mobil kalitlaridan ALOHIDA: "Maps JavaScript API" yoqiladi
 * va HTTP referrer bo'yicha cheklanadi. Places API yoqilmaydi (K-05).
 */

interface Props {
  value: Coordinates;
  onChange: (coords: Coordinates) => void;
  /** Kalitsiz holatda ham foydalanuvchi nima qilishini bilishi uchun. */
  hint?: string;
}

export function LocationPicker({ value, onChange, hint }: Props): JSX.Element {
  const apiKey = mapsApiKey();
  const [text, setText] = useState(() => formatCoordinates(value));
  const [error, setError] = useState<string | null>(null);

  function applyText(next: string): void {
    setText(next);
    const parsed = parseCoordinates(next);

    if (parsed === null) {
      setError('Namuna: 41.311081, 69.279737');
      return;
    }

    setError(null);
    onChange(parsed);
  }

  function applyMap(coords: Coordinates): void {
    setText(formatCoordinates(coords));
    setError(null);
    onChange(coords);
  }

  return (
    <div className="space-y-2">
      {apiKey === null ? (
        <div className="rounded-lg border border-border bg-surface p-3 text-sm text-dim">
          Xarita sozlanmagan. Google Maps`da do`konni toping, nuqtani bosing va koordinatani
          nusxalab quyiga qo`ying.
        </div>
      ) : (
        <div className="h-64 overflow-hidden rounded-lg border border-border">
          <APIProvider apiKey={apiKey}>
            <Map
              // `mapId` AdvancedMarker uchun majburiy. `DEMO_MAP_ID` —
              // Google'ning ochiq sinov identifikatori; o'z uslubingiz
              // kerak bo'lsa Cloud Console'da yarating
              mapId="DEMO_MAP_ID"
              defaultCenter={{ lat: value.lat, lng: value.lng }}
              defaultZoom={15}
              gestureHandling="greedy"
              disableDefaultUI
              zoomControl
              // POI'lar bosilmasin — Places API yoqilmagan
              clickableIcons={false}
              onClick={(event: MapMouseEvent) => {
                const position = event.detail.latLng;
                if (position) applyMap({ lat: position.lat, lng: position.lng });
              }}
            >
              <AdvancedMarker
                position={{ lat: value.lat, lng: value.lng }}
                draggable
                onDragEnd={(event) => {
                  const position = event.latLng;
                  if (position) applyMap({ lat: position.lat(), lng: position.lng() });
                }}
              />
            </Map>
          </APIProvider>
        </div>
      )}

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-dim">Koordinata</span>
        <input
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 tabular-nums text-white"
          inputMode="decimal"
          value={text}
          onChange={(event) => applyText(event.target.value)}
        />
      </label>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {hint && error === null ? <p className="text-xs text-dim">{hint}</p> : null}
    </div>
  );
}
