import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { uploadAvatar } from '../../api/endpoints';
import { colors, radius, text } from '../../theme/tokens';
import { Icon } from '../Icon';

/**
 * Profil surati — bosilganda galereya ochiladi, tanlangan rasm R2 ga yuklanadi.
 *
 * Surat yo'q bo'lsa ism bosh harflari chiziladi: bo'sh kulrang doiradan ko'ra
 * shaxsiyroq va deckdagi qorong'i uslubga mos tushadi.
 */
function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

export function AvatarPicker({
  url,
  name,
  onChange,
  labels,
}: {
  url: string | null;
  name: string | null;
  onChange: (url: string) => Promise<void>;
  labels: { change: string; permission: string; failed: string };
}): JSX.Element {
  const [busy, setBusy] = useState(false);

  const pick = async (): Promise<void> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(labels.permission);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Kvadrat kesish — avatar doira ichida ko'rsatiladi
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setBusy(true);
    try {
      await onChange(await uploadAvatar(result.assets[0].uri));
    } catch {
      Alert.alert(labels.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable style={styles.wrap} onPress={() => void pick()} disabled={busy}>
      {url ? (
        <Image source={{ uri: url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.initials}>{initials(name)}</Text>
        </View>
      )}

      <View style={styles.badge}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <Icon name="camera" size={14} color={colors.textOnPrimary} />
        )}
      </View>
    </Pressable>
  );
}

const SIZE = 84;

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE },
  image: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.borderAccent,
    backgroundColor: colors.surface2,
  },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initials: { ...text.h1, color: colors.accent },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
