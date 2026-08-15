import { describe, expect, it } from 'vitest';

import {
  initialRegion,
  regionToBounds,
  shouldRefetch,
  zoomFromDelta,
  zoomIntoCluster,
  type Region,
} from './region';

const TASHKENT: Region = {
  latitude: 41.3111,
  longitude: 69.2797,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

describe('zoomFromDelta', () => {
  it('butun dunyo — eng past zoom', () => {
    expect(zoomFromDelta(360)).toBe(1);
  });

  it('shahar darajasi serverda marker rejimini yoqadi', () => {
    // Server 12 dan boshlab marker qaytaradi (catalog/stores.ts)
    expect(zoomFromDelta(0.03)).toBeGreaterThanOrEqual(12);
  });

  it('viloyat darajasi klaster rejimida qoladi', () => {
    expect(zoomFromDelta(2)).toBeLessThan(12);
  });

  it('chegaradan chiqmaydi', () => {
    expect(zoomFromDelta(0)).toBe(21);
    expect(zoomFromDelta(-5)).toBe(21);
    expect(zoomFromDelta(0.0000001)).toBeLessThanOrEqual(21);
    expect(zoomFromDelta(100000)).toBeGreaterThanOrEqual(1);
  });
});

describe('regionToBounds', () => {
  it('server talab qilgan tartibni beradi: ne > sw', () => {
    const bounds = regionToBounds(TASHKENT);
    // storeMapQuerySchema aynan shuni tekshiradi
    expect(bounds.neLat).toBeGreaterThan(bounds.swLat);
    expect(bounds.neLng).toBeGreaterThan(bounds.swLng);
  });

  it("ko'rinadigan maydondan kengroq so'raydi", () => {
    const bounds = regionToBounds(TASHKENT);
    expect(bounds.neLat - bounds.swLat).toBeGreaterThan(TASHKENT.latitudeDelta);
  });

  it('qutblarda kenglik chegarasidan oshmaydi', () => {
    const bounds = regionToBounds({
      latitude: 89.5,
      longitude: 0,
      latitudeDelta: 10,
      longitudeDelta: 10,
    });
    expect(bounds.neLat).toBeLessThanOrEqual(90);
    expect(bounds.swLat).toBeGreaterThanOrEqual(-90);
  });

  it("sana chizig'ida uzunlik chegarasidan oshmaydi", () => {
    const bounds = regionToBounds({
      latitude: 0,
      longitude: 179,
      latitudeDelta: 4,
      longitudeDelta: 4,
    });
    expect(bounds.neLng).toBeLessThanOrEqual(180);
    expect(bounds.swLng).toBeGreaterThanOrEqual(-180);
  });
});

describe('shouldRefetch', () => {
  it("birinchi safar doim so'raladi", () => {
    expect(shouldRefetch(null, TASHKENT)).toBe(true);
  });

  it("kichik siljish so'rov yubormaydi", () => {
    const moved = { ...TASHKENT, latitude: TASHKENT.latitude + 0.002 };
    expect(shouldRefetch(TASHKENT, moved)).toBe(false);
  });

  it("katta siljishda so'raladi", () => {
    const moved = { ...TASHKENT, latitude: TASHKENT.latitude + 0.02 };
    expect(shouldRefetch(TASHKENT, moved)).toBe(true);
  });

  it("zoom o'zgarsa albatta so'raladi", () => {
    // Klasterdan markerga o'tish — butunlay boshqa javob
    const zoomed = { ...TASHKENT, latitudeDelta: 2, longitudeDelta: 2 };
    expect(shouldRefetch(TASHKENT, zoomed)).toBe(true);
  });
});

describe('zoomIntoCluster', () => {
  it("klaster markaziga o'tadi va ikki barobar yaqinlashadi", () => {
    const next = zoomIntoCluster(TASHKENT, 41.4, 69.6);
    expect(next.latitude).toBe(41.4);
    expect(next.longitude).toBe(69.6);
    expect(next.longitudeDelta).toBeCloseTo(TASHKENT.longitudeDelta / 2);
  });

  it('cheksiz yaqinlashmaydi', () => {
    let region: Region = { ...TASHKENT };
    for (let step = 0; step < 30; step += 1) {
      region = zoomIntoCluster(region, region.latitude, region.longitude);
    }
    expect(region.latitudeDelta).toBeGreaterThan(0);
    expect(region.longitudeDelta).toBeGreaterThan(0);
  });
});

describe('initialRegion', () => {
  it('joylashuv markazga tushadi', () => {
    const region = initialRegion({ lat: 25.2048, lng: 55.2708 });
    expect(region.latitude).toBe(25.2048);
    expect(region.longitude).toBe(55.2708);
    // Dubay ham, Toshkent ham marker darajasida ochilishi kerak
    expect(zoomFromDelta(region.longitudeDelta)).toBeGreaterThanOrEqual(12);
  });
});
