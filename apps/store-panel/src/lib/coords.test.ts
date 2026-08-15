import { describe, expect, it } from 'vitest';

import {
  defaultCenter,
  DUBAI,
  formatCoordinates,
  isValid,
  parseCoordinates,
  TASHKENT,
} from './coords';

describe('parseCoordinates', () => {
  it('Google Maps ko`chirmasini o`qiydi', () => {
    expect(parseCoordinates('41.311081, 69.279737')).toEqual({
      lat: 41.311081,
      lng: 69.279737,
    });
  });

  it('bo`shliqlarga chidamli', () => {
    expect(parseCoordinates('  41.31,69.28  ')).toEqual({ lat: 41.31, lng: 69.28 });
  });

  it('manfiy koordinatalar ishlaydi', () => {
    expect(parseCoordinates('-33.8688, 151.2093')).toEqual({ lat: -33.8688, lng: 151.2093 });
  });

  it('butun son ham qabul qilinadi', () => {
    expect(parseCoordinates('25, 55')).toEqual({ lat: 25, lng: 55 });
  });

  it('chegaradan chiqqan qiymat rad etiladi', () => {
    expect(parseCoordinates('91, 69')).toBeNull();
    expect(parseCoordinates('41, 181')).toBeNull();
  });

  it('nol nuqta rad etiladi', () => {
    // Gvineya ko'rfazi — "to'ldirilmagan" degani
    expect(parseCoordinates('0, 0')).toBeNull();
  });

  it('noto`g`ri format rad etiladi', () => {
    expect(parseCoordinates('41.31')).toBeNull();
    expect(parseCoordinates('41.31 69.28')).toBeNull();
    expect(parseCoordinates('lat: 41, lng: 69')).toBeNull();
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates('https://maps.google.com/@41.31,69.28,15z')).toBeNull();
  });
});

describe('isValid', () => {
  it('haqiqiy nuqtalarni qabul qiladi', () => {
    expect(isValid(TASHKENT)).toBe(true);
    expect(isValid(DUBAI)).toBe(true);
  });

  it('NaN rad etiladi', () => {
    // `Number('')` NaN beradi — bo'sh maydonda aynan shu holat
    expect(isValid({ lat: Number.NaN, lng: 69 })).toBe(false);
  });

  it('nol nuqta rad etiladi', () => {
    expect(isValid({ lat: 0, lng: 0 })).toBe(false);
  });

  it('nolga yaqin, lekin aniq nuqta qabul qilinadi', () => {
    expect(isValid({ lat: 0.0001, lng: 0 })).toBe(true);
  });
});

describe('formatCoordinates', () => {
  it('olti kasr bilan yozadi', () => {
    expect(formatCoordinates({ lat: 41.3111, lng: 69.2797 })).toBe('41.311100, 69.279700');
  });

  it('o`qigan narsasini qaytara oladi', () => {
    const original = { lat: 25.204849, lng: 55.270782 };
    expect(parseCoordinates(formatCoordinates(original))).toEqual(original);
  });
});

describe('defaultCenter', () => {
  it('davlatga qarab markaz tanlanadi', () => {
    expect(defaultCenter('UZ')).toEqual(TASHKENT);
    expect(defaultCenter('AE')).toEqual(DUBAI);
  });
});
