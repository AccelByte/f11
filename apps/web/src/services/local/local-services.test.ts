import { describe, expect, it } from 'vitest';

import { createGameSession, selectPlayer } from '../../game/session';
import { soloDraftChallenge } from '../../test/draftChallenge';
import { getOrCreateLocalIdentity, type KeyValueStore } from './identity';
import {
  createCloudRunRecord,
  createLocalRunRecord,
  restoreLatestCloudRun,
  saveLatestCloudRun,
  verifyCloudRunRecord,
  type CloudRunGateway,
} from './runStore';

class MemoryStore implements KeyValueStore {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class MemoryCloudRunGateway implements CloudRunGateway {
  value: unknown = null;
  writes = 0;

  async readLatest() {
    return this.value;
  }

  async writeLatest(_ownerUserId: string, record: unknown) {
    this.writes += 1;
    this.value = structuredClone(record);
  }
}

function completeSession() {
  let session = createGameSession(soloDraftChallenge('phase-1b-local-store'));
  while (session.snapshot.offer) {
    const card = session.snapshot.offer.cards[0];
    const slot = card?.safeSlotCodes[0];
    if (!card || !slot) throw new Error('Expected a legal first card and slot.');
    session = selectPlayer(session, card.playerSeasonId, slot);
  }
  return session;
}

describe('local MVP services', () => {
  it('restores one stable local profile without browser fingerprinting', () => {
    const store = new MemoryStore();
    const first = getOrCreateLocalIdentity(store, () => 'local-fixed-profile');
    const second = getOrCreateLocalIdentity(store, () => 'local-should-not-rotate');

    expect(first).toEqual({ kind: 'local', profileId: 'local-fixed-profile' });
    expect(second).toEqual(first);
  });

  it('creates a checksummed replayable run record for Cloud Save', () => {
    const record = createLocalRunRecord(
      'local-fixed-profile',
      completeSession(),
      '2026-09-02T00:00:00.000Z',
    );

    expect(record.checksum).toHaveLength(32);
    expect(record.actions).toHaveLength(11);
    expect(record.stateHashes).toHaveLength(12);
    expect(record.result.season.matches).toHaveLength(38);
  });

  it('preserves optional AGS room context through local and cloud records', () => {
    const local = createLocalRunRecord(
      'ags-user-1',
      completeSession(),
      '2026-09-04T00:00:00.000Z',
      'session-1',
    );
    const cloud = createCloudRunRecord('ags-user-1', local);

    expect(local.roomSessionId).toBe('session-1');
    expect(cloud.roomSessionId).toBe('session-1');
  });

  it('uploads, reads back, replays, and idempotently reuses one cloud run', async () => {
    const ownerUserId = 'ags-user-1';
    const local = createLocalRunRecord(ownerUserId, completeSession(), '2026-09-03T00:00:00.000Z');
    const gateway = new MemoryCloudRunGateway();

    await expect(saveLatestCloudRun(gateway, ownerUserId, local)).resolves.toMatchObject({
      status: 'saved',
    });
    await expect(saveLatestCloudRun(gateway, ownerUserId, local)).resolves.toMatchObject({
      status: 'already-saved',
    });
    expect(gateway.writes).toBe(1);
    await expect(restoreLatestCloudRun(gateway, ownerUserId)).resolves.toEqual(local);
  });

  it('replaces a different verified cloud run with the newly completed latest run', async () => {
    const ownerUserId = 'ags-user-1';
    const cloud = createLocalRunRecord(ownerUserId, completeSession(), '2026-09-03T00:00:00.000Z');
    const local = createLocalRunRecord(ownerUserId, completeSession(), '2026-09-03T00:00:01.000Z');
    const gateway = new MemoryCloudRunGateway();
    gateway.value = createCloudRunRecord(ownerUserId, cloud);

    await expect(saveLatestCloudRun(gateway, ownerUserId, local)).resolves.toMatchObject({
      status: 'saved',
    });
    expect(gateway.writes).toBe(1);
    await expect(restoreLatestCloudRun(gateway, ownerUserId)).resolves.toEqual(local);
  });

  it('repairs an obsolete or damaged latest cloud slot with the newly completed run', async () => {
    const ownerUserId = 'ags-user-1';
    const local = createLocalRunRecord(ownerUserId, completeSession(), '2026-09-03T00:00:01.000Z');
    const gateway = new MemoryCloudRunGateway();
    gateway.value = { schemaVersion: 'football11-cloud-run-v0', damaged: true };

    await expect(saveLatestCloudRun(gateway, ownerUserId, local)).resolves.toMatchObject({
      status: 'saved',
    });
    expect(gateway.writes).toBe(1);
    await expect(restoreLatestCloudRun(gateway, ownerUserId)).resolves.toEqual(local);
  });

  it('rejects tampered, wrong-owner, and unsupported cloud records', () => {
    const ownerUserId = 'ags-user-1';
    const record = createCloudRunRecord(
      ownerUserId,
      createLocalRunRecord(ownerUserId, completeSession()),
    );

    expect(() => verifyCloudRunRecord({ ...record, seed: 'tampered' }, ownerUserId)).toThrow(
      'checksum does not match',
    );
    expect(() => verifyCloudRunRecord(record, 'ags-user-2')).toThrow(
      'different authenticated player',
    );
    const unsupported = {
      ...record,
      versions: { ...record.versions, rulesVersion: 'rules-v999' },
    };
    const { checksum: _checksum, ...unsigned } = unsupported;
    expect(() => verifyCloudRunRecord({ ...unsigned, checksum: 'invalid' }, ownerUserId)).toThrow(
      'checksum does not match',
    );
  });
});
