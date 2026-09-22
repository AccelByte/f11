import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MECHANICS_VERSION } from '@football-11/domain';

import { AgsServerGateway } from './agsServerGateway';
import { TEST_DRAFT_CONFIG } from '../test/draftChallenge';

const config = {
  baseURL: 'https://example.test',
  namespace: 'game-ns',
  publicClientId: 'public-client',
  serverClientId: 'server-client',
  serverClientSecret: 'server-secret',
};

const challenge = {
  schemaVersion: 'football11-room-challenge-v1',
  challengeId: 'room-round-1',
  roundOrdinal: 1,
  seed: '0123456789abcdef0123456789abcdef',
  seedStrategy: 'per-player-v1',
  versions: DEFAULT_MECHANICS_VERSION,
  draftConfig: TEST_DRAFT_CONFIG,
  participantUserIds: ['user-1'],
  startedAt: '2026-09-04T00:00:00.000Z',
  deadlineAt: '2026-09-04T00:15:00.000Z',
} as const;

function roomResponse(seedStrategy: string = challenge.seedStrategy) {
  return {
    id: 'session-1',
    namespace: 'game-ns',
    configuration: { name: 'football11-friend-room-v1' },
    members: [
      { id: 'user-1', status: 'JOINED', statusV2: 'CONNECTED' },
      { id: 'former-user', status: 'LEFT', statusV2: 'LEFT' },
    ],
    attributes: {
      football11Room: {
        schemaVersion: 'football11-room-state-v1',
        phase: 'DRAFTING',
        revision: 2,
        roundOrdinal: 1,
        readyUserIds: [],
        challenge: { ...challenge, seedStrategy },
        progressByUserId: {},
        resultByUserId: {},
        countdownEndsAt: null,
        updatedAt: '2026-09-04T00:00:01.000Z',
      },
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AGS trusted room lookup', () => {
  it('reads canonical challenge and active membership with the player bearer token', async () => {
    const request = vi.fn(async () => Response.json(roomResponse()));
    vi.stubGlobal('fetch', request);

    const room = await new AgsServerGateway(config).readRoom('session-1', 'player-token');

    expect(room).toMatchObject({
      sessionId: 'session-1',
      namespace: 'game-ns',
      configurationName: 'football11-friend-room-v1',
      activeMemberUserIds: ['user-1'],
      challenge,
    });
    expect(request).toHaveBeenCalledWith(
      'https://example.test/session/v1/public/namespaces/game-ns/gamesessions/session-1',
      { headers: { Authorization: 'Bearer player-token' } },
    );
  });

  it('fails closed for an unknown seed strategy returned by AGS', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(roomResponse('per-player-v2'))),
    );

    await expect(
      new AgsServerGateway(config).readRoom('session-1', 'player-token'),
    ).rejects.toMatchObject({ code: 'INCOMPATIBLE_ROOM_STATE', status: 409 });
  });

  it('maps denied session access to a sanitized trust error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 403 })),
    );

    await expect(
      new AgsServerGateway(config).readRoom('session-1', 'player-token'),
    ).rejects.toMatchObject({ code: 'ROOM_ACCESS_DENIED', status: 403 });
  });
});
