import Constants from 'expo-constants';
import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { colors, radius, spacing, text } from '../theme/tokens';
import {
  initialRegion,
  regionToBounds,
  shouldRefetch,
  zoomIntoCluster,
  type Bounds,
  type Region,
} from '../map/region';

/**
 * Do'konlar xaritasi (05-mobile §6.5).
 *
 * Google Maps mobil SDK ishlatiladi, **Places API yoqilmagan** (K-05):
 * qidiruv, avtoto'ldirish, joy tafsilotlari — hech biri chaqirilmaydi.
 * Faqat xarita chizish va o'z markerlarimiz. Shuning uchun hisob nolda
 * qoladi.
 *
 * ⚠️ Kalitsiz Android'da xarita KO'K/BO'SH ko'rinadi, xato bermaydi —
 * eng chalkashtiradigan holat. `app.config.ts` va RUNBOOK'ga qarang.
 */

/**
 * Provayder KALIT BORLIGIGA QARAB tanlanadi.
 *
 * ⚠️ NEGA MAJBURAN GOOGLE BO'LMAYDI: `app.config.ts` Google Maps kalitini
 * faqat u mavjud bo'lganda `ios.config.googleMapsApiKey` ga yozadi. Kalit
 * bo'lmasa SDK ilovaga umuman ulanmaydi va `AIRGoogleMap` yerli komponenti
 * ro'yxatdan o'tmaydi. Shunda `provider={PROVIDER_GOOGLE}` berilsa ilova
 * qulaydi:
 *
 *     Cannot read property 'bubblingEventTypes' of null
 *
 * Xato chalg'ituvchi — u xarita haqida hech narsa aytmaydi va React'ning
 * ichki qatlamiga ishora qiladi.
 *
 * iOS'da yechim oddiy: standart provayder — Apple Maps, u kalitsiz
 * ishlaydi. Android'da esa Google yagona variant, shuning uchun u yerda
 * kalitsiz xarita bo'sh qoladi (lekin qulamaydi).
 */
function mapProvider(): typeof PROVIDER_GOOGLE | undefined {
  if (Platform.OS === 'android') return PROVIDER_GOOGLE;

  const key = Constants.expoConfig?.ios?.config?.googleMapsApiKey;
  return typeof key === 'string' && key.length > 0 ? PROVIDER_GOOGLE : undefined;
}

const PROVIDER = mapProvider();

/**
 * Qorong'i uslub — ilova fonidan (#0A0A0F) ajralib turmasligi uchun.
 * Google'ning standart "night" uslubidan olingan, ranglar dizayn
 * tokenlariga moslangan.
 */
const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#14141c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0f' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e1e2a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0a0f' }] },
];

export interface MapMarker {
  id: string;
  name: string;
  logoUrl: string | null;
  lat: number;
  lng: number;
}

export interface MapCluster {
  lat: number;
  lng: number;
  count: number;
}

interface Props {
  coords: { lat: number; lng: number };
  markers: MapMarker[];
  clusters: MapCluster[];
  onBoundsChange: (bounds: Bounds) => void;
  onSelectStore: (id: string) => void;
}

export function StoreMap({
  coords,
  markers,
  clusters,
  onBoundsChange,
  onSelectStore,
}: Props): JSX.Element {
  const mapRef = useRef<MapView | null>(null);
  const lastRegion = useRef<Region | null>(null);
  const [region, setRegion] = useState<Region>(() => initialRegion(coords));

  const onRegionChangeComplete = useCallback(
    (next: Region) => {
      setRegion(next);
      if (!shouldRefetch(lastRegion.current, next)) return;

      lastRegion.current = next;
      onBoundsChange(regionToBounds(next));
    },
    [onBoundsChange],
  );

  const openCluster = useCallback(
    (cluster: MapCluster) => {
      const next = zoomIntoCluster(region, cluster.lat, cluster.lng);
      mapRef.current?.animateToRegion(next, 350);
    },
    [region],
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        /*
         * `customMapStyle` faqat Google'da ishlaydi. Apple Maps uni
         * e'tiborsiz qoldiradi, shuning uchun u yerda qorong'i ko'rinish
         * `userInterfaceStyle` orqali beriladi — aks holda oq xarita
         * qorong'i ilovada ko'zni qamashtiradi.
         */
        customMapStyle={PROVIDER === PROVIDER_GOOGLE ? DARK_STYLE : undefined}
        userInterfaceStyle="dark"
        showsUserLocation
        showsMyLocationButton={false}
        // Places API yoqilmagani uchun POI'lar bosilmaydi ham
        showsPointsOfInterest={false}
        toolbarEnabled={false}
        onRegionChangeComplete={onRegionChangeComplete}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.lat, longitude: marker.lng }}
            title={marker.name}
            // `tracksViewChanges` o'chirilmasa har kadrda marker qayta
            // chiziladi va xarita sekinlashadi — 20+ markerda seziladi
            tracksViewChanges={false}
            onPress={() => {
              onSelectStore(marker.id);
            }}
          >
            <View style={styles.pin}>
              <Text style={styles.pinText} numberOfLines={1}>
                {marker.name}
              </Text>
            </View>
          </Marker>
        ))}

        {clusters.map((cluster) => (
          <Marker
            key={`c-${cluster.lat.toFixed(5)}-${cluster.lng.toFixed(5)}`}
            coordinate={{ latitude: cluster.lat, longitude: cluster.lng }}
            tracksViewChanges={false}
            onPress={() => {
              openCluster(cluster);
            }}
          >
            <View style={styles.cluster}>
              <Text style={styles.clusterText}>{cluster.count}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <Pressable
        accessibilityRole="button"
        style={styles.locate}
        onPress={() => {
          mapRef.current?.animateToRegion(initialRegion(coords), 350);
        }}
      >
        <Text style={styles.locateText}>◎</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  pin: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    maxWidth: 140,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  pinText: { ...text.tiny, color: colors.text },

  cluster: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterText: { ...text.bodyMed, color: colors.text },

  locate: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locateText: { ...text.h3, color: colors.accent },
});
