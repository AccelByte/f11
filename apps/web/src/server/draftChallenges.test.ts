import { describe, expect, it, vi } from 'vitest';
import type { DraftChallengeReceiptV1, FriendRoomStateV1 } from '@football-11/contracts';

import { createInitialFriendRoomState, setMemberReady } from '../state/friendRoomMachine';
import {
  issueDraftChallenge,
  parseDraftConfigRecord,
  type DraftChallengeGateway,
} from './draftChallenges';

const now = new Date('2026-09-04T00:00:00.000Z');

function configRecord(revision = '1', maxOfferedPlayers = 15, maxRerolls = 5) {
  return {
    schemaVersion: 1,
    activeRevision: revision,
    revisions: { [revision]: { maxOfferedPlayers, maxRerolls } },
  };
}

interface FakeGateway extends DraftChallengeGateway {
  active: Map<string, DraftChallengeReceiptV1>;
  activeWrites: number;
  config: unknown;
  configReads: number;
  roomState: FriendRoomStateV1;
}

function gateway(): FakeGateway {
  let roomState = createInitialFriendRoomState(now.toISOString());
  roomState = setMemberReady(roomState, 'leader', true, now.toISOString());
  roomState = setMemberReady(roomState, 'member', true, now.toISOString());
  return {
    active: new Map(),
    activeWrites: 0,
    config: configRecord(),
    configReads: 0,
    roomState,
    authenticatePlayer: vi.fn(async () => ({ userId: 'leader', namespace: 'game-ns' })),
    readDraftConfigRecord: vi.fn(async function (this: FakeGateway) {
      this.configReads += 1;
      return this.config;
    }),
    readActiveDraftChallenge: vi.fn(async function (this: FakeGateway, userId: string) {
      return this.active.get(userId) ?? null;
    }),
    writeActiveDraftChallenge: vi.fn(async function (
      this: FakeGateway,
      userId: string,
      receipt: DraftChallengeReceiptV1,
    ) {
      this.activeWrites += 1;
      this.active.set(userId, structuredClone(receipt));
    }),
    readRoomForDraftChallenge: vi.fn(async function (this: FakeGateway) {
      return {
        sessionId: 'session-1',
        namespace: 'game-ns',
        configurationName: 'football11-friend-room-v1',
        leaderId: 'leader',
        activeMemberUserIds: ['member', 'leader'],
        state: this.roomState,
      };
    }),
  };
}

const options = {
  namespace: 'game-ns',
  now: () => now,
  randomHex: (bytes: number) => (bytes === 6 ? 'aabbccddeeff' : '0011223344556677'),
};

describe('AGS Game Record draft challenges', () => {
  it('accepts only the numeric configuration schema and supported bounds', () => {
    expect(parseDraftConfigRecord(configRecord())).toEqual({
      schemaVersion: 1,
      revision: '1',
      maxOfferedPlayers: 15,
      maxRerolls: 5,
    });
    expect(() => parseDraftConfigRecord({ ...configRecord(), schemaVersion: '1' })).toThrow(
      'unsupported draft configuration version',
    );
    expect(() => parseDraftConfigRecord(configRecord('1', 16, 5))).toThrow(
      'outside supported limits',
    );
    expect(() => parseDraftConfigRecord({ ...configRecord(), revisions: {} })).toThrow(
      'missing or malformed',
    );
  });

  it('reads the Game Record for every new solo challenge and freezes each revision', async () => {
    const target = gateway();
    const first = await issueDraftChallenge(
      { schemaVersion: 1, idempotencyKey: 'solo-key-0001' },
      'token',
      target,
      options,
    );
    target.config = configRecord('2', 12, 3);
    const second = await issueDraftChallenge(
      { schemaVersion: 1, idempotencyKey: 'solo-key-0002' },
      'token',
      target,
      options,
    );

    expect(target.configReads).toBe(2);
    expect(first.challenge.draftConfig).toMatchObject({ revision: '1', maxRerolls: 5 });
    expect(second.challenge.draftConfig).toMatchObject({ revision: '2', maxRerolls: 3 });
    expect(first.challenge.draftConfig).toMatchObject({ revision: '1', maxRerolls: 5 });
  });

  it('replays an idempotent request without issuing or reading configuration again', async () => {
    const target = gateway();
    const request = { schemaVersion: 1, idempotencyKey: 'solo-key-0001' } as const;
    const first = await issueDraftChallenge(request, 'token', target, options);
    const second = await issueDraftChallenge(request, 'token', target, options);

    expect(second).toEqual(first);
    expect(target.configReads).toBe(1);
    expect(target.activeWrites).toBe(1);
  });

  it('locks the canonical ready room participants and writes one private receipt each', async () => {
    const target = gateway();
    const response = await issueDraftChallenge(
      {
        schemaVersion: 1,
        idempotencyKey: 'room-key-0001',
        roomSessionId: 'session-1',
        roundSeconds: 900,
      },
      'token',
      target,
      options,
    );

    expect(response.challenge.schemaVersion).toBe('football11-room-challenge-v1');
    if (response.challenge.schemaVersion !== 'football11-room-challenge-v1') return;
    expect(response.challenge.participantUserIds).toEqual(['leader', 'member']);
    expect(response.challenge.draftConfig.schemaVersion).toBe(1);
    expect(target.active.get('leader')?.roomSessionId).toBe('session-1');
    expect(target.active.get('member')?.challenge).toEqual(response.challenge);
  });

  it('fails closed for a non-leader or a room without a complete ready set', async () => {
    const denied = gateway();
    denied.readRoomForDraftChallenge = vi.fn(async () => ({
      sessionId: 'session-1',
      namespace: 'game-ns',
      configurationName: 'football11-friend-room-v1',
      leaderId: 'someone-else',
      activeMemberUserIds: ['leader'],
      state: denied.roomState,
    }));
    const request = {
      schemaVersion: 1,
      idempotencyKey: 'room-key-0001',
      roomSessionId: 'session-1',
      roundSeconds: 900,
    } as const;
    await expect(issueDraftChallenge(request, 'token', denied, options)).rejects.toMatchObject({
      code: 'ROOM_CHALLENGE_FORBIDDEN',
      status: 403,
    });

    const notReady = gateway();
    notReady.roomState = createInitialFriendRoomState(now.toISOString());
    await expect(issueDraftChallenge(request, 'token', notReady, options)).rejects.toMatchObject({
      code: 'ROOM_NOT_READY',
      status: 409,
    });
  });
});
