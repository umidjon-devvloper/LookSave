import { describe, expect, it } from 'vitest';

import { distanceMeters } from './distance';

const TASHKENT = { lat: 41.3111, lng: 69.2797 };
const SAMARKAND = { lat: 39.627, lng: 66.975 };

describe('distanceMeters', () => {
  it('bir nuqtaning o`ziga masofasi nol', () => {
    expect(distanceMeters(TASHKENT, TASHKENT)).toBe(0);
  });

  it('Toshkent–Samarqand ~270 km', () => {
    const km = distanceMeters(TASHKENT, SAMARKAND) / 1000;
    // Haqiqiy to'g'ri chiziq masofasi ~270 km; haversine xatosi ~0.5%
    expect(km).toBeGreaterThan(265);
    expect(km).toBeLessThan(275);
  });

  it('yo`nalish ahamiyatsiz', () => {
    expect(distanceMeters(TASHKENT, SAMARKAND)).toBeCloseTo(distanceMeters(SAMARKAND, TASHKENT), 6);
  });

  it('ekvatorda 1 daraja kenglik ~111 km', () => {
    const km = distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) / 1000;
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });

  it('180-meridian orqali o`tganda ham musbat son qaytaradi', () => {
    expect(distanceMeters({ lat: 0, lng: 179 }, { lat: 0, lng: -179 })).toBeGreaterThan(0);
  });
});
