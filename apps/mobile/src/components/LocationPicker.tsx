import Constants from 'expo-constants';
import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type MapPressEvent, type Region } from 'react-native-maps';

import { Icon } from './Icon';
import { colors, radius, spacing, text } from '../theme/tokens';

/**
 * Mijoz uchun xarita tanlash — checkout ichida inline ko'rinadi.
 *
 * ⚠️ NEGA INLINE, MODAL EMAS: alohida ekran ochish mijozni formadan uzib
 * qo'yardi va u qaytganda qaysi maydonlar to'ldirilganini unutib
 * qolardi. Inline ko'rinishda u shu yerda ko'radi: pinni surdi — manzil
 * ostida darhol koordinata o'zgaradi.
 *
 * Xaritaga bosilsa pin shu yerga tushadi; markerning o'zini sudrab
 * ko'chirish ham mumkin. `initialCoords` birinchi marta bir marta
 * markazlashtiradi — keyingi tahrirlar ichki holatda.
 */

function mapProvider(): typeof PROVIDER_GOOGLE | undefined {
  if (Platform.OS === 'android') return PROVIDER_GOOGLE;
  const key = Constants.expoConfig?.ios?.config?.googleMapsApiKey;
  return typeof key === 'string' && key.length > 0 ? PROVIDER_GOOGLE : undefined;
}

const PROVIDER = mapProvider();

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

interface Props {
  coords: { lat: number; lng: number };
  onChange: (coords: { lat: number; lng: number }) => void;
  /** Kompakt holat (checkout ichida), yoki to'liq ekran (modal). */
  height?: number;
}

export function LocationPicker({ coords, onChange, height = 200 }: Props): JSX.Element {
  const mapRef = useRef<MapView | null>(null);
  // Birinchi region faqat MOUNT'da hisoblanadi: aks holda pin har safar
  // koordinata o'zgarganda markazga qaytib ketardi va foydalanuvchi
  // ko'rayotgan joy ostidan surilib qolardi.
  const [initialRegion] = useState<Region>(() => ({
    latitude: coords.lat,
    longitude: coords.lng,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  }));

  const handlePress = useCallback(
    (event: MapPressEvent): void => {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      onChange({ lat: latitude, lng: longitude });
    },
    [onChange],
  );

  const centerOnPin = useCallback(() => {
    mapRef.current?.animateToRegion(
      {
        latitude: coords.lat,
        longitude: coords.lng,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      300,
    );
  }, [coords.lat, coords.lng]);

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        customMapStyle={PROVIDER === PROVIDER_GOOGLE ? DARK_STYLE : undefined}
        userInterfaceStyle="dark"
        showsUserLocation
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        toolbarEnabled={false}
        onPress={handlePress}
      >
        <Marker
          coordinate={{ latitude: coords.lat, longitude: coords.lng }}
          draggable
          onDragEnd={(event) => {
            const { latitude, longitude } = event.nativeEvent.coordinate;
            onChange({ lat: latitude, lng: longitude });
          }}
          tracksViewChanges={false}
        >
          <View style={styles.pin}>
            <View style={styles.pinInner} />
          </View>
        </Marker>
      </MapView>

      <View style={styles.hintBar} pointerEvents="none">
        <Text style={styles.hintText}>Pin'ni bosib yoki sudrab aniq joyni belgilang</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pinga qaytish"
        style={styles.locate}
        onPress={centerOnPin}
      >
        <Icon name="locate" size={18} color={colors.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  pinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text,
  },
  hintBar: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm + 44 + spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10,10,15,0.8)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  hintText: { ...text.tiny, color: colors.textMuted, textAlign: 'center' },
  locate: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
