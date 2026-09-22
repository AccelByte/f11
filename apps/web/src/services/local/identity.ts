export interface LocalIdentity {
  kind: 'local';
  profileId: string;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const LOCAL_PROFILE_KEY = 'football11.local-profile.v1';

function createProfileId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return `local-${[...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function getOrCreateLocalIdentity(
  store: KeyValueStore,
  createId: () => string = createProfileId,
): LocalIdentity {
  const existing = store.getItem(LOCAL_PROFILE_KEY);
  if (existing?.startsWith('local-')) return { kind: 'local', profileId: existing };

  const profileId = createId();
  store.setItem(LOCAL_PROFILE_KEY, profileId);
  return { kind: 'local', profileId };
}
