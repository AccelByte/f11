import type { KeyValueStore } from '../local/identity';
import type { AgsGuestIdentity, AuthGateway, AuthProgress } from './authGateway';
import { getOrCreateDeviceId } from './deviceIdentity';

export class DeviceGuestAuth {
  private pending: Promise<AgsGuestIdentity> | null = null;

  constructor(private readonly gateway: AuthGateway) {}

  authenticate(
    store: KeyValueStore,
    onProgress?: (progress: AuthProgress) => void,
  ): Promise<AgsGuestIdentity> {
    if (this.pending) return this.pending;

    const deviceId = getOrCreateDeviceId(store);
    this.pending = this.gateway.loginWithDevice(deviceId, onProgress).finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
}
