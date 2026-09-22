import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { AccelByte } from '@accelbyte/sdk';
import { PlayerRecordAdminApi } from '@accelbyte/sdk-cloudsave';
import { IamOAuthClient } from '@accelbyte/sdk-iam';
import { LeaderboardDataV3Api } from '@accelbyte/sdk-leaderboard';
import { UserStatisticAdminApi } from '@accelbyte/sdk-social';
import {
  applyDraftAction,
  buildConstraintProfiles,
  createDraft,
  resolveRun,
  stateHash,
} from '@football-11/domain';

const routeURL = process.env.FOOTBALL11_TRUSTED_ROUTE_URL ?? 'http://127.0.0.1:8787/api/runs/submit';
const challengeRouteURL =
  process.env.FOOTBALL11_CHALLENGE_ROUTE_URL ?? new URL('/api/draft-challenges', routeURL).href;
const config = {
  baseURL: process.env.NEXT_PUBLIC_ACCELBYTE_BASE_URL,
  namespace: process.env.NEXT_PUBLIC_ACCELBYTE_NAMESPACE,
  publicClientId: process.env.NEXT_PUBLIC_ACCELBYTE_CLIENT_ID,
  serverClientId: process.env.ACCELBYTE_SERVER_CLIENT_ID,
  serverClientSecret: process.env.ACCELBYTE_SERVER_CLIENT_SECRET,
};
const missing = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missing.length > 0) throw new Error(`Missing trusted-ranking smoke configuration: ${missing.join(', ')}`);

const receiptKey = 'football11_trusted_settlement_v1';
const challengeReceiptKey = 'football11_active_draft_challenge_v1';
const statCode = 'football11bestpoints';
const leaderboardCode = 'football11-best-points';

try {
  const playerSdk = AccelByte.SDK({
    coreConfig: {
      baseURL: config.baseURL,
      namespace: config.namespace,
      clientId: config.publicClientId,
      redirectURI: 'http://127.0.0.1',
    },
  });
  const login = await IamOAuthClient.exchangeTokenOauthByPlatformId(
    'device',
    config.publicClientId,
    {
      client_id: config.publicClientId,
      device_id: randomUUID(),
      createHeadless: true,
      skipSetCookie: true,
    },
    playerSdk.assembly().axiosInstance.defaults,
  );
  if (login.error) throw new Error('Device login failed.');
  const playerToken = login.response?.data;
  if (!playerToken?.access_token || !playerToken.user_id) {
    throw new Error('Device login returned no usable player session.');
  }
  playerSdk.setToken({ accessToken: playerToken.access_token });

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
  const challengeResponse = await fetch(challengeRouteURL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${playerToken.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ schemaVersion: 1, idempotencyKey: randomUUID() }),
  });
  const challengePayload = await challengeResponse.json();
  const challenge = challengePayload?.data?.challenge;
  if (
    challengeResponse.status !== 200 ||
    challengePayload.ok !== true ||
    challenge?.schemaVersion !== 1 ||
    challenge?.kind !== 'solo' ||
    challenge?.draftConfig?.schemaVersion !== 1
  ) {
    const code = challengePayload?.error?.code ?? 'unexpected-response';
    throw new Error(
      `Draft challenge route did not return a usable AGS-backed challenge (${challengeResponse.status}, ${code}).`,
    );
  }
  const { challengeId, seed, versions, draftConfig } = challenge;
  let snapshot = createDraft({
    challengeId,
    seed,
    versions,
    players,
    profiles,
    draftConfig,
  });
  const actions = [];
  while (snapshot.offer) {
    const card = snapshot.offer.cards[0];
    const slotCode = card?.safeSlotCodes[0];
    if (!card || !slotCode) throw new Error('Trusted replay smoke could not select a legal card.');
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
      versions,
      players,
      profiles,
      actions,
      assessmentConfig,
      leagueProfile,
      draftConfig,
    },
    players,
    profiles,
  );
  const submission = {
    schemaVersion: 'football11-trusted-submit-v1',
    runId: replay.result.resultId,
    challengeId,
    seed,
    versions,
    draftConfig,
    actions,
  };

  async function submit(body) {
    const response = await fetch(routeURL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${playerToken.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, payload: await response.json() };
  }

  const accepted = await submit(submission);
  if (
    accepted.status !== 200 ||
    accepted.payload.ok !== true ||
    accepted.payload.data.duplicate !== false ||
    accepted.payload.data.result.resultId !== submission.runId ||
    accepted.payload.data.receipt.points !== replay.result.season.points
  ) {
    const code = accepted.payload?.error?.code ?? 'unexpected-response';
    throw new Error(
      `Trusted route did not accept and reproduce the legal run (${accepted.status}, ${code}).`,
    );
  }

  const duplicate = await submit(submission);
  if (duplicate.status !== 200 || duplicate.payload.ok !== true || duplicate.payload.data.duplicate !== true) {
    throw new Error('Trusted route did not treat the second identical submission as a duplicate.');
  }

  const tampered = structuredClone(submission);
  tampered.actions[0].round = 11;
  const rejected = await submit(tampered);
  if (
    rejected.status !== 400 ||
    rejected.payload.ok !== false ||
    rejected.payload.error.code !== 'REPLAY_REJECTED'
  ) {
    throw new Error('Trusted route did not reject the tampered replay before settlement.');
  }

  const unsupported = structuredClone(submission);
  unsupported.versions.rulesVersion = 'unsupported-smoke-version';
  const rejectedVersion = await submit(unsupported);
  if (
    rejectedVersion.status !== 400 ||
    rejectedVersion.payload.ok !== false ||
    rejectedVersion.payload.error.code !== 'UNSUPPORTED_VERSION'
  ) {
    throw new Error('Trusted route did not reject the unsupported mechanics version.');
  }

  const tamperedConfig = structuredClone(submission);
  tamperedConfig.draftConfig.maxRerolls -= 1;
  const rejectedConfig = await submit(tamperedConfig);
  if (
    rejectedConfig.status !== 409 ||
    rejectedConfig.payload.ok !== false ||
    rejectedConfig.payload.error.code !== 'DRAFT_CHALLENGE_MISMATCH'
  ) {
    throw new Error('Trusted route did not reject altered draft configuration evidence.');
  }

  const serviceResponse = await fetch(`${config.baseURL}/iam/v3/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.serverClientId}:${config.serverClientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', namespace: config.namespace }),
  });
  if (!serviceResponse.ok) throw new Error('Trusted service authentication failed.');
  const serviceToken = await serviceResponse.json();
  if (!serviceToken.access_token) throw new Error('Trusted service returned no usable token.');
  const serviceSdk = AccelByte.SDK({
    coreConfig: {
      baseURL: config.baseURL,
      namespace: config.namespace,
      clientId: config.serverClientId,
      redirectURI: 'http://127.0.0.1',
    },
  });
  serviceSdk.setToken({ accessToken: serviceToken.access_token });

  const receipt = await PlayerRecordAdminApi(serviceSdk).getRecord_ByUserId_ByKey(
    playerToken.user_id,
    receiptKey,
  );
  if (
    receipt.data.namespace !== config.namespace ||
    receipt.data.user_id !== playerToken.user_id ||
    receipt.data.key !== receiptKey ||
    receipt.data.is_public !== false ||
    receipt.data.set_by !== 'SERVER' ||
    receipt.data.value.runId !== submission.runId ||
    receipt.data.value.resultHash !== stateHash(replay.result)
  ) {
    throw new Error('Trusted Cloud Save receipt failed ownership or content readback.');
  }

  const challengeReceipt = await PlayerRecordAdminApi(serviceSdk).getRecord_ByUserId_ByKey(
    playerToken.user_id,
    challengeReceiptKey,
  );
  if (
    challengeReceipt.data.namespace !== config.namespace ||
    challengeReceipt.data.user_id !== playerToken.user_id ||
    challengeReceipt.data.key !== challengeReceiptKey ||
    challengeReceipt.data.is_public !== false ||
    challengeReceipt.data.set_by !== 'SERVER' ||
    challengeReceipt.data.value.schemaVersion !== 1 ||
    challengeReceipt.data.value.challenge.challengeId !== challengeId ||
    challengeReceipt.data.value.challenge.draftConfig.revision !== draftConfig.revision
  ) {
    throw new Error('Draft challenge receipt failed ownership or configuration readback.');
  }

  const statistics = UserStatisticAdminApi(serviceSdk);
  const { data: values } = await statistics.createStatitemValueBulkGetOrDefault_ByUserId_v2(
    playerToken.user_id,
    { statCodes: [statCode] },
  );
  const bestPoints = values.find((entry) => entry.statCode === statCode)?.value;
  if (typeof bestPoints !== 'number' || bestPoints < replay.result.season.points) {
    throw new Error('Trusted statistic readback did not contain the accepted score.');
  }

  let rank = null;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      const { data } = await LeaderboardDataV3Api(playerSdk).getUser_ByLeaderboardCode_ByUserId_v3(
        leaderboardCode,
        playerToken.user_id,
      );
      if (data.allTime && typeof data.allTime.rank === 'number') {
        rank = data.allTime.rank;
        break;
      }
    } catch {
      // Leaderboard materialization is eventually consistent; retry briefly.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (rank === null) throw new Error('Leaderboard did not materialize the accepted score in time.');

  const { data: valuesAfterRejection } =
    await statistics.createStatitemValueBulkGetOrDefault_ByUserId_v2(playerToken.user_id, {
      statCodes: [statCode],
    });
  const pointsAfterRejection = valuesAfterRejection.find((entry) => entry.statCode === statCode)?.value;
  if (pointsAfterRejection !== bestPoints) {
    throw new Error('A rejected replay unexpectedly changed the trusted statistic.');
  }

  console.log(
    JSON.stringify(
      {
        trustedRoute: 'ok',
        acceptedReplay: true,
        numericConfigSchema: draftConfig.schemaVersion === 1,
        configRevision: draftConfig.revision,
        configuredOffers: draftConfig.maxOfferedPlayers,
        configuredRerolls: draftConfig.maxRerolls,
        duplicateIdempotent: true,
        tamperedReplayRejected: true,
        tamperedConfigRejected: true,
        unsupportedVersionRejected: true,
        serverOwnedChallengeReceipt: true,
        serverOwnedPrivateReceipt: true,
        statisticReadback: true,
        leaderboardReadback: true,
        points: replay.result.season.points,
        bestPoints,
        rank,
      },
      null,
      2,
    ),
  );
} catch (caught) {
  const message = caught instanceof Error ? caught.message : 'Unknown trusted-ranking smoke failure';
  console.error(`Trusted-ranking smoke failed: ${message}`);
  process.exitCode = 1;
}
