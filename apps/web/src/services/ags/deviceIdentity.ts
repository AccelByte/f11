import type { KeyValueStore } from '../local/identity';

const DEVICE_ID_KEY = 'football11.ags-device.v1';

function createDeviceId(): string {
  return globalThis.crypto.randomUUID();
}

export function getStoredDeviceId(store: KeyValueStore): string | null {
  const existing = store.getItem(DEVICE_ID_KEY)?.trim();
  return existing ? existing : null;
}

export function getOrCreateDeviceId(
  store: KeyValueStore,
  createId: () => string = createDeviceId,
): string {
  const existing = getStoredDeviceId(store);
  if (existing) return existing;

  const deviceId = createId();
  if (!deviceId) throw new Error('Unable to create an AGS device identifier.');
  store.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}
