import { describe, expect, it, vi } from 'vitest';

const sdkMocks = vi.hoisted(() => {
  const lifecycle: string[] = [];
  const setToken = vi.fn(() => lifecycle.push('set-token'));
  const getCurrentUser = vi.fn();
  const exchangeToken = vi.fn();
  const getCloudRecord = vi.fn();
  const updateCloudRecord = vi.fn();
  const sdk = {
    assembly: vi.fn(() => ({ axiosInstance: { defaults: {} } })),
    setToken,
  };

  return {
    exchangeToken,
    getCloudRecord,
    getCurrentUser,
    lifecycle,
    sdk,
    setToken,
    updateCloudRecord,
  };
});

const sessionMocks = vi.hoisted(() => {
  const client = {
    createGamesession: vi.fn(),
    createGamesession_ByNS: vi.fn(),
    getUsersMeGamesessions: vi.fn(),
    getGamesession_BySessionId: vi.fn(),
    createJoin_BySessionId: vi.fn(),
    createGamesessionJoinCode: vi.fn(),
    patchGamesession_BySessionId: vi.fn(),
    deleteCode_BySessionId: vi.fn(),
    updateCode_BySessionId: vi.fn(),
    deleteLeave_BySessionId: vi.fn(),
  };
  return { client };
});

vi.mock('@accelbyte/sdk', () => ({
  AccelByte: { SDK: vi.fn(() => sdkMocks.sdk) },
}));

vi.mock('@accelbyte/sdk-iam', () => ({
  IamOAuthClient: { exchangeTokenOauthByPlatformId: sdkMocks.exchangeToken },
  IamUserClient: vi.fn(function IamUserClientMock() {
    sdkMocks.lifecycle.push('create-user-client');
    return { getCurrentUser: sdkMocks.getCurrentUser };
  }),
}));

vi.mock('@accelbyte/sdk-session', () => ({
  Session: { GameSessionApi: vi.fn(() => sessionMocks.client) },
}));

vi.mock('@accelbyte/sdk-cloudsave', () => ({
  PublicPlayerRecordApi: vi.fn(() => ({
    getRecord_ByUserId_ByKey: sdkMocks.getCloudRecord,
    updateRecord_ByUserId_ByKey: sdkMocks.updateCloudRecord,
  })),
}));

import {
  AgsAuthGateway,
  authErrorMessage,
  cloudSaveErrorMessage,
  type AuthGateway,
} from './authGateway';
import { AgsConfigError, readAgsPublicConfig } from './config';
import { DeviceGuestAuth } from './deviceAuth';
import { getOrCreateDeviceId, getStoredDeviceId } from './deviceIdentity';
import { FriendRoomResponseError, roomErrorMessage } from './errors';
import { AgsSessionGateway, mapFriendRoomResponse } from './sessionGateway';

class MemoryStore {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function gameSessionResponse(
  overrides: Record<string, unknown> = {},
): Parameters<typeof mapFriendRoomResponse>[0] {
  return {
    id: 'session-1',
    namespace: 'game',
    configuration: {
      name: 'football11-friend-room-v1',
      type: 'NONE',
      joinability: 'OPEN',
      minPlayers: 1,
      maxPlayers: 8,
    },
    isActive: true,
    isFull: false,
    leaderID: 'user-1',
    members: [
      {
        id: 'user-1',
        platformID: 'device',
        platformUserID: 'device-1',
        status: 'JOINED',
        statusV2: 'JOINED',
        updatedAt: '2026-09-03T00:00:00Z',
      },
    ],
    version: 1,
    createdAt: '2026-09-03T00:00:00Z',
    expiredAt: '2026-09-04T00:00:00Z',
    code: 'ABC123',
    attributes: {
      game: 'football-11',
      mode: 'friend-room',
      football11Room: {
        schemaVersion: 'football11-room-state-v1',
        phase: 'WAITING',
        revision: 0,
        roundOrdinal: 0,
        readyUserIds: [],
        challenge: null,
        progressByUserId: {},
        resultByUserId: {},
        countdownEndsAt: null,
        updatedAt: '2026-09-03T00:00:00Z',
      },
    },
    ...overrides,
  } as unknown as Parameters<typeof mapFriendRoomResponse>[0];
}

describe('AGS browser services', () => {
  it('requires only browser-safe public configuration', () => {
    expect(
      readAgsPublicConfig({
        baseURL: 'https://example.gamingservices.accelbyte.io/',
        namespace: 'game',
        clientId: 'public-client',
        redirectURI: 'http://127.0.0.1',
      }),
    ).toEqual({
      baseURL: 'https://example.gamingservices.accelbyte.io',
      namespace: 'game',
      clientId: 'public-client',
      redirectURI: 'http://127.0.0.1',
      friendRoomMaxPlayers: 8,
      friendRoomRoundSeconds: 900,
      friendRoomCountdownSeconds: 30,
    });

    expect(() => readAgsPublicConfig({})).toThrow(AgsConfigError);
    expect(() =>
      readAgsPublicConfig({
        baseURL: 'https://example.gamingservices.accelbyte.io',
        namespace: 'game',
        clientId: 'public-client',
        friendRoomMaxPlayers: 9,
      }),
    ).toThrow(AgsConfigError);
  });

  it('creates and restores a random device identifier without fingerprinting', () => {
    const store = new MemoryStore();
    const first = getOrCreateDeviceId(store, () => 'f11-device-fixed');
    const second = getOrCreateDeviceId(store, () => 'f11-device-rotated');

    expect(first).toBe('f11-device-fixed');
    expect(second).toBe(first);
    expect(getStoredDeviceId(store)).toBe(first);
  });

  it('deduplicates concurrent login attempts and keeps the same device identifier', async () => {
    const store = new MemoryStore();
    let resolveLogin!: (identity: Awaited<ReturnType<AuthGateway['loginWithDevice']>>) => void;
    const loginWithDevice = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<AuthGateway['loginWithDevice']>>>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const auth = new DeviceGuestAuth({ loginWithDevice });

    const first = auth.authenticate(store);
    const second = auth.authenticate(store);
    expect(loginWithDevice).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);

    resolveLogin({
      kind: 'ags-device',
      deviceId: getStoredDeviceId(store)!,
      userId: 'user-1',
      namespace: 'game',
      displayName: 'Guest',
    });
    await expect(first).resolves.toMatchObject({ userId: 'user-1' });
  });

  it('installs the user token before creating the authenticated IAM client', async () => {
    sdkMocks.lifecycle.length = 0;
    sdkMocks.exchangeToken.mockResolvedValueOnce({
      response: {
        data: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          user_id: 'user-1',
          namespace: 'game',
        },
      },
    });
    sdkMocks.getCurrentUser.mockResolvedValueOnce({
      response: {
        data: {
          userId: 'user-1',
          namespace: 'game',
          displayName: 'Guest',
        },
      },
    });

    const gateway = new AgsAuthGateway({
      baseURL: 'https://example.gamingservices.accelbyte.io',
      namespace: 'game',
      clientId: 'public-client',
      redirectURI: 'http://127.0.0.1',
      friendRoomMaxPlayers: 8,
      friendRoomRoundSeconds: 900,
      friendRoomCountdownSeconds: 30,
    });

    await expect(gateway.loginWithDevice('device-1')).resolves.toMatchObject({
      userId: 'user-1',
    });
    expect(sdkMocks.lifecycle).toEqual(['set-token', 'create-user-client']);
  });

  it('replaces service authentication details with player-facing copy', () => {
    expect(
      authErrorMessage({
        response: {
          status: 403,
          data: {
            error: 'invalid_request',
            error_description: 'platform config error, platform client not found',
          },
        },
      }),
    ).toBe('Guest sign-in was rejected. Reload the page and try again.');
    expect(authErrorMessage(new Error('private SDK request details'))).not.toContain('private SDK');
  });

  it('does not expose unexpected save-service errors', () => {
    expect(cloudSaveErrorMessage(new Error('private storage request details'))).toBe(
      'Saving is unavailable. Your result remains in this tab; retry before reloading.',
    );
  });

  it('creates one minimum-1 no-server room and maps the canonical response', async () => {
    let resolveCreate!: (value: { data: ReturnType<typeof gameSessionResponse> }) => void;
    const client = {
      createGamesession: vi.fn(
        () =>
          new Promise<{ data: ReturnType<typeof gameSessionResponse> }>((resolve) => {
            resolveCreate = resolve;
          }),
      ),
      createGamesession_ByNS: vi.fn(),
      getUsersMeGamesessions: vi.fn(),
      getGamesession_BySessionId: vi.fn(),
      createJoin_BySessionId: vi.fn(),
      createGamesessionJoinCode: vi.fn(),
      patchGamesession_BySessionId: vi.fn(),
      deleteCode_BySessionId: vi.fn(),
      updateCode_BySessionId: vi.fn(),
      deleteLeave_BySessionId: vi.fn(),
    };
    const gateway = new AgsSessionGateway('game', client);

    const first = gateway.createRoom({ playerId: 'user-1', maxPlayers: 8 });
    const second = gateway.createRoom({ playerId: 'user-1', maxPlayers: 8 });
    expect(second).toBe(first);
    expect(client.createGamesession).toHaveBeenCalledTimes(1);
    expect(client.createGamesession).toHaveBeenCalledWith(
      expect.objectContaining({
        configurationName: 'football11-friend-room-v1',
        type: 'NONE',
        joinability: 'OPEN',
        minPlayers: 1,
        maxPlayers: 8,
        autoJoin: true,
        teams: [{ teamID: 'players', userIDs: ['user-1'] }],
      }),
      { resolveMaxActiveSession: false },
    );

    resolveCreate({ data: gameSessionResponse() });
    await expect(first).resolves.toMatchObject({
      sessionId: 'session-1',
      serverType: 'NONE',
      joinability: 'OPEN',
      minPlayers: 1,
      maxPlayers: 8,
      leaderId: 'user-1',
      hasJoinCode: true,
      members: [{ userId: 'user-1', status: 'JOINED', isLeader: true }],
    });
  });

  it('reads and leaves a canonical room without exposing generated SDK types', async () => {
    const client = {
      createGamesession: vi.fn(),
      createGamesession_ByNS: vi.fn(),
      getUsersMeGamesessions: vi.fn(),
      getGamesession_BySessionId: vi.fn().mockResolvedValue({ data: gameSessionResponse() }),
      createJoin_BySessionId: vi.fn(),
      createGamesessionJoinCode: vi.fn(),
      patchGamesession_BySessionId: vi.fn(),
      deleteCode_BySessionId: vi.fn(),
      updateCode_BySessionId: vi.fn(),
      deleteLeave_BySessionId: vi.fn().mockResolvedValue({}),
    };
    const gateway = new AgsSessionGateway('game', client);

    await expect(gateway.getRoom(' session-1 ')).resolves.toMatchObject({
      sessionId: 'session-1',
      isActive: true,
    });
    await gateway.leaveRoom(' session-1 ');
    expect(client.getGamesession_BySessionId).toHaveBeenCalledWith('session-1');
    expect(client.deleteLeave_BySessionId).toHaveBeenCalledWith('session-1');
  });

  it('discovers only compatible open non-full rooms and joins by id or code', async () => {
    const full = gameSessionResponse({ id: 'full', isFull: true });
    const incompatible = gameSessionResponse({
      id: 'old',
      attributes: { game: 'football-11', mode: 'friend-room' },
    });
    const client = {
      createGamesession: vi.fn(),
      createGamesession_ByNS: vi.fn().mockResolvedValue({
        data: { data: [gameSessionResponse(), full, incompatible], paging: {} },
      }),
      getUsersMeGamesessions: vi.fn().mockResolvedValue({ data: { data: [], paging: {} } }),
      getGamesession_BySessionId: vi.fn(),
      createJoin_BySessionId: vi.fn().mockResolvedValue({ data: gameSessionResponse() }),
      createGamesessionJoinCode: vi.fn().mockResolvedValue({ data: gameSessionResponse() }),
      patchGamesession_BySessionId: vi.fn(),
      deleteCode_BySessionId: vi.fn(),
      updateCode_BySessionId: vi.fn(),
      deleteLeave_BySessionId: vi.fn(),
    };
    const gateway = new AgsSessionGateway('game', client);

    await expect(gateway.listOpenRooms()).resolves.toHaveLength(1);
    await expect(gateway.joinRoom('session-1')).resolves.toMatchObject({ sessionId: 'session-1' });
    await expect(gateway.joinRoomByCode('abc123')).resolves.toMatchObject({
      sessionId: 'session-1',
    });
    expect(client.createGamesessionJoinCode).toHaveBeenCalledWith({ code: 'ABC123' });
  });

  it('retries optimistic room updates and supports optional code revoke/regenerate', async () => {
    const initial = gameSessionResponse();
    const updated = gameSessionResponse({
      version: 2,
      attributes: {
        ...initial.attributes,
        football11Room: {
          ...(initial.attributes as Record<string, any>).football11Room,
          revision: 1,
          readyUserIds: ['user-1'],
        },
      },
    });
    const client = {
      createGamesession: vi.fn(),
      createGamesession_ByNS: vi.fn(),
      getUsersMeGamesessions: vi.fn(),
      getGamesession_BySessionId: vi
        .fn()
        .mockResolvedValueOnce({ data: initial })
        .mockResolvedValueOnce({ data: initial })
        .mockResolvedValueOnce({ data: { ...updated, code: undefined } }),
      createJoin_BySessionId: vi.fn(),
      createGamesessionJoinCode: vi.fn(),
      patchGamesession_BySessionId: vi
        .fn()
        .mockRejectedValueOnce({ response: { status: 409 } })
        .mockResolvedValueOnce({ data: updated }),
      deleteCode_BySessionId: vi.fn().mockResolvedValue({}),
      updateCode_BySessionId: vi.fn().mockResolvedValue({ data: updated }),
      deleteLeave_BySessionId: vi.fn(),
    };
    const gateway = new AgsSessionGateway('game', client);
    const changed = await gateway.updateRoom('session-1', (state) => ({
      ...state,
      revision: state.revision + 1,
      readyUserIds: ['user-1'],
    }));
    expect(changed.roomState?.readyUserIds).toEqual(['user-1']);
    expect(client.patchGamesession_BySessionId).toHaveBeenCalledTimes(2);
    expect(client.patchGamesession_BySessionId).toHaveBeenLastCalledWith(
      'session-1',
      expect.objectContaining({ version: 1 }),
    );
    await expect(gateway.revokeJoinCode('session-1')).resolves.toMatchObject({
      hasJoinCode: false,
    });
    await expect(gateway.generateJoinCode('session-1')).resolves.toMatchObject({
      hasJoinCode: true,
    });
  });

  it('rejects incompatible room snapshots and maps authorization failures safely', () => {
    expect(() =>
      mapFriendRoomResponse(
        gameSessionResponse({
          configuration: {
            name: 'football11-friend-room-v1',
            type: 'DS',
            joinability: 'OPEN',
            minPlayers: 1,
            maxPlayers: 8,
          },
        }),
        'game',
      ),
    ).toThrow(FriendRoomResponseError);
    expect(roomErrorMessage({ response: { status: 403 } })).toContain('closed to new players');
  });

  it('reads and writes only the authenticated player Cloud Save slot', async () => {
    sdkMocks.getCloudRecord.mockResolvedValueOnce({
      data: {
        user_id: 'user-1',
        namespace: 'game',
        key: 'football11_latest_run_v1',
        value: { schemaVersion: 'football11-cloud-run-v1' },
      },
    });
    sdkMocks.updateCloudRecord.mockResolvedValueOnce({
      data: {
        user_id: 'user-1',
        namespace: 'game',
        key: 'football11_latest_run_v1',
      },
    });
    const gateway = new AgsAuthGateway({
      baseURL: 'https://example.gamingservices.accelbyte.io',
      namespace: 'game',
      clientId: 'public-client',
      redirectURI: 'http://127.0.0.1',
      friendRoomMaxPlayers: 8,
      friendRoomRoundSeconds: 900,
      friendRoomCountdownSeconds: 30,
    });

    await expect(gateway.readLatest('user-1')).resolves.toMatchObject({
      schemaVersion: 'football11-cloud-run-v1',
    });
    await gateway.writeLatest('user-1', {
      schemaVersion: 'football11-cloud-run-v1',
    } as never);

    expect(sdkMocks.getCloudRecord).toHaveBeenCalledWith('user-1', 'football11_latest_run_v1');
    expect(sdkMocks.updateCloudRecord).toHaveBeenCalledWith(
      'user-1',
      'football11_latest_run_v1',
      expect.objectContaining({ __META: { is_public: false } }),
    );
  });

  it('maps a missing Cloud Save slot to an empty restore', async () => {
    sdkMocks.getCloudRecord.mockRejectedValueOnce({ response: { status: 404 } });
    const gateway = new AgsAuthGateway({
      baseURL: 'https://example.gamingservices.accelbyte.io',
      namespace: 'game',
      clientId: 'public-client',
      redirectURI: 'http://127.0.0.1',
      friendRoomMaxPlayers: 8,
      friendRoomRoundSeconds: 900,
      friendRoomCountdownSeconds: 30,
    });

    await expect(gateway.readLatest('user-1')).resolves.toBeNull();
  });
});
