import { AccelByte, type AccelByteSDK } from '@accelbyte/sdk';
import { PublicPlayerRecordApi } from '@accelbyte/sdk-cloudsave';
import { IamOAuthClient, IamUserClient } from '@accelbyte/sdk-iam';
import type { CloudRunRecordV1 } from '@football-11/contracts';

import { CLOUD_RUN_RECORD_KEY, type CloudRunGateway } from '../local/runStore';
import type { AgsPublicConfig } from './config';
import { AgsLobbyGateway } from './lobbyGateway';
import { AgsSessionGateway } from './sessionGateway';
import { responseStatus } from './errors';

export { authErrorMessage, cloudSaveErrorMessage } from './errors';

export type AuthProgress = 'logging-in' | 'verifying';

export interface AgsGuestIdentity {
  kind: 'ags-device';
  deviceId: string;
  userId: string;
  namespace: string;
  displayName: string;
}

export interface AuthGateway {
  loginWithDevice(
    deviceId: string,
    onProgress?: (progress: AuthProgress) => void,
  ): Promise<AgsGuestIdentity>;
}

export class AgsAuthGateway implements AuthGateway, CloudRunGateway {
  private readonly sdk: AccelByteSDK;

  constructor(private readonly config: AgsPublicConfig) {
    this.sdk = AccelByte.SDK({
      coreConfig: {
        baseURL: config.baseURL,
        namespace: config.namespace,
        clientId: config.clientId,
        redirectURI: config.redirectURI,
      },
    });
  }

  createSessionGateway(): AgsSessionGateway {
    return AgsSessionGateway.fromSdk(this.sdk, this.config.namespace);
  }

  createLobbyGateway(): AgsLobbyGateway {
    return new AgsLobbyGateway(this.sdk);
  }

  async loginWithDevice(
    deviceId: string,
    onProgress?: (progress: AuthProgress) => void,
  ): Promise<AgsGuestIdentity> {
    onProgress?.('logging-in');
    const login = await IamOAuthClient.exchangeTokenOauthByPlatformId(
      'device',
      this.config.clientId,
      {
        client_id: this.config.clientId,
        device_id: deviceId,
        createHeadless: true,
        skipSetCookie: true,
      },
      this.sdk.assembly().axiosInstance.defaults,
    );
    if (login.error) throw login.error;

    const token = login.response?.data;
    if (!token?.access_token || !token.user_id) {
      throw new Error('AGS Device ID login returned no usable player session.');
    }
    if (token.namespace !== this.config.namespace) {
      throw new Error('AGS Device ID login returned a session for the wrong namespace.');
    }

    this.sdk.setToken({ accessToken: token.access_token, refreshToken: token.refresh_token });
    onProgress?.('verifying');
    const currentUser = await new IamUserClient(this.sdk).getCurrentUser();
    if (currentUser.error) throw currentUser.error;

    const profile = currentUser.response?.data;
    if (!profile?.userId || profile.userId !== token.user_id) {
      throw new Error('AGS current-user verification did not match the logged-in player.');
    }

    return {
      kind: 'ags-device',
      deviceId,
      userId: profile.userId,
      namespace: profile.namespace,
      displayName: profile.displayName || `Guest ${profile.userId.slice(-4).toUpperCase()}`,
    };
  }

  getAccessToken(): string | null {
    return this.sdk.getToken().accessToken ?? null;
  }

  async readLatest(ownerUserId: string): Promise<unknown> {
    try {
      const response = await PublicPlayerRecordApi(this.sdk).getRecord_ByUserId_ByKey(
        ownerUserId,
        CLOUD_RUN_RECORD_KEY,
      );
      if (
        response.data.user_id !== ownerUserId ||
        response.data.namespace !== this.config.namespace ||
        response.data.key !== CLOUD_RUN_RECORD_KEY
      ) {
        throw new Error('AGS Cloud Save returned a record outside the authenticated scope.');
      }
      return response.data.value;
    } catch (caught) {
      if (responseStatus(caught) === 404) return null;
      throw caught;
    }
  }

  async writeLatest(ownerUserId: string, record: CloudRunRecordV1): Promise<void> {
    const response = await PublicPlayerRecordApi(this.sdk).updateRecord_ByUserId_ByKey(
      ownerUserId,
      CLOUD_RUN_RECORD_KEY,
      {
        ...record,
        __META: { is_public: false },
      },
    );
    if (
      response.data.user_id !== ownerUserId ||
      response.data.namespace !== this.config.namespace ||
      response.data.key !== CLOUD_RUN_RECORD_KEY
    ) {
      throw new Error('AGS Cloud Save acknowledged a write outside the authenticated scope.');
    }
  }
}
