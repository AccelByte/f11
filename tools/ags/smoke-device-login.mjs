import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { AccelByte } from '@accelbyte/sdk';
import { PublicPlayerRecordApi } from '@accelbyte/sdk-cloudsave';
import { IamOAuthClient, IamUserClient } from '@accelbyte/sdk-iam';
import {
  DEFAULT_MECHANICS_VERSION,
  applyDraftAction,
  buildConstraintProfiles,
  createDraft,
  resolveRun,
  stateHash,
} from '@football-11/domain';

const config = {
  baseURL: process.env.NEXT_PUBLIC_ACCELBYTE_BASE_URL,
  namespace: process.env.NEXT_PUBLIC_ACCELBYTE_NAMESPACE,
  clientId: process.env.NEXT_PUBLIC_ACCELBYTE_CLIENT_ID,
  redirectURI: process.env.NEXT_PUBLIC_ACCELBYTE_REDIRECT_URI ?? 'http://127.0.0.1',
};

const missing = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missing.length > 0) throw new Error(`Missing AGS smoke configuration: ${missing.join(', ')}`);

try {
  async function loginAndVerify(deviceId) {
    const sdk = AccelByte.SDK({ coreConfig: config });
    const login = await IamOAuthClient.exchangeTokenOauthByPlatformId(
      'device',
      config.clientId,
      {
        client_id: config.clientId,
        device_id: deviceId,
        createHeadless: true,
        skipSetCookie: true,
      },
      sdk.assembly().axiosInstance.defaults,
    );
    if (login.error) throw login.error;

    const token = login.response?.data;
    if (!token?.access_token || !token.user_id) {
      throw new Error('Device login returned no usable player session.');
    }
    sdk.setToken({ accessToken: token.access_token, refreshToken: token.refresh_token });

    const currentUser = await new IamUserClient(sdk).getCurrentUser();
    if (currentUser.error) throw currentUser.error;
    if (currentUser.response?.data.userId !== token.user_id) {
      throw new Error('Current-user verification did not match the Device ID session.');
    }

    return {
      sdk,
      userId: token.user_id,
      namespace: token.namespace,
      anonymous: ((token.jflgs ?? 0) & 4) === 4,
    };
  }

  const firstDeviceId = randomUUID();
  const first = await loginAndVerify(firstDeviceId);
  const restored = await loginAndVerify(firstDeviceId);
  const clean = await loginAndVerify(randomUUID());

  if (first.userId !== restored.userId) {
    throw new Error('The same Device ID did not restore the same AGS guest.');
  }
  if (first.userId === clean.userId) {
    throw new Error('Two clean Device IDs unexpectedly resolved to the same AGS guest.');
  }

  let cloudSave = undefined;
  if (process.argv.includes('--cloud-save')) {
    const catalogue = JSON.parse(
      readFileSync(
        new URL('../../data/content/openfootball-pl-2023-24-named-squads-v2.json', import.meta.url),
        'utf8',
      ),
    );
    const assessmentConfig = JSON.parse(
      readFileSync(new URL('../../data/config/assessment-v1.json', import.meta.url), 'utf8'),
    );
    const leagueProfile = JSON.parse(
      readFileSync(new URL('../../data/config/league-profile-v1.json', import.meta.url), 'utf8'),
    );
    const players = catalogue.playerSeasons;
    const profiles = buildConstraintProfiles(players);
    const challengeId = 'phase-2b-cloud-save-smoke';
    const seed = 'phase-2b-cloud-save-smoke-seed';
    let snapshot = createDraft({
      challengeId,
      seed,
      versions: DEFAULT_MECHANICS_VERSION,
      players,
      profiles,
    });
    const actions = [];
    while (snapshot.offer) {
      const card = snapshot.offer.cards[0];
      const slotCode = card?.safeSlotCodes[0];
      if (!card || !slotCode) throw new Error('Cloud Save smoke could not select a legal card.');
      const action = {
        type: 'select',
        round: snapshot.state.round,
        playerSeasonId: card.playerSeasonId,
        slotCode,
      };
      actions.push(action);
      snapshot = applyDraftAction(snapshot, action, players, profiles);
    }
    const replay = resolveRun(
      {
        challengeId,
        seed,
        versions: DEFAULT_MECHANICS_VERSION,
        players,
        profiles,
        actions,
        assessmentConfig,
        leagueProfile,
      },
      players,
      profiles,
    );
    const unsigned = {
      schemaVersion: 'football11-cloud-run-v1',
      runId: replay.result.resultId,
      ownerUserId: first.userId,
      seed,
      versions: DEFAULT_MECHANICS_VERSION,
      actions,
      stateHashes: replay.stateHashes,
      result: replay.result,
      createdAt: '2026-09-03T00:00:00.000Z',
      authority: 'player',
    };
    const record = { ...unsigned, checksum: stateHash(unsigned) };
    const key = 'football11_phase2b_smoke_v1';
    const firstCloudSave = PublicPlayerRecordApi(first.sdk);
    await firstCloudSave.updateRecord_ByUserId_ByKey(first.userId, key, {
      ...record,
      __META: { is_public: false },
    });
    const firstReadback = await firstCloudSave.getRecord_ByUserId_ByKey(first.userId, key);
    const restoredReadback = await PublicPlayerRecordApi(restored.sdk).getRecord_ByUserId_ByKey(
      restored.userId,
      key,
    );
    for (const response of [firstReadback, restoredReadback]) {
      if (
        response.data.user_id !== first.userId ||
        response.data.namespace !== config.namespace ||
        response.data.key !== key ||
        stateHash(response.data.value) !== stateHash(record)
      ) {
        throw new Error('Cloud Save smoke readback did not match the authenticated write.');
      }
    }
    const replayed = resolveRun(
      {
        challengeId: restoredReadback.data.value.result.challengeId,
        seed: restoredReadback.data.value.seed,
        versions: restoredReadback.data.value.versions,
        players,
        profiles,
        actions: restoredReadback.data.value.actions,
        assessmentConfig,
        leagueProfile,
      },
      players,
      profiles,
    );
    if (
      replayed.result.finalStateHash !== restoredReadback.data.value.result.finalStateHash ||
      stateHash(replayed.result) !== stateHash(restoredReadback.data.value.result)
    ) {
      throw new Error('Cloud Save smoke replay did not reproduce the saved result.');
    }
    cloudSave = {
      write: 'ok',
      readbackVerified: true,
      sameDeviceSessionReadback: true,
      replayVerified: true,
      payloadBytes: Buffer.byteLength(JSON.stringify(record), 'utf8'),
      recommendedPayloadLimitBytes: 250 * 1024,
    };
  }

  console.log(
    JSON.stringify(
      {
        login: 'ok',
        namespace: first.namespace,
        userIdPresent: true,
        currentUserVerified: true,
        anonymous: first.anonymous && restored.anonymous && clean.anonymous,
        sameDeviceRestored: true,
        cleanDeviceSeparated: true,
        ...(cloudSave ? { cloudSave } : {}),
      },
      null,
      2,
    ),
  );
} catch (caught) {
  const responseData =
    typeof caught === 'object' &&
    caught !== null &&
    'response' in caught &&
    typeof caught.response === 'object' &&
    caught.response !== null &&
    'data' in caught.response
      ? caught.response.data
      : null;
  const safeMessage =
    responseData && typeof responseData === 'object'
      ? JSON.stringify(responseData)
      : caught instanceof Error
        ? caught.message
        : 'Unknown AGS smoke-test failure';
  console.error(`AGS Device ID smoke test failed: ${safeMessage}`);
  process.exitCode = 1;
}
