import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { AccelByte } from '@accelbyte/sdk';
import { PlayerRecordAdminApi } from '@accelbyte/sdk-cloudsave';
import { IamOAuthClient } from '@accelbyte/sdk-iam';
import { UserStatisticAdminApi } from '@accelbyte/sdk-social';
import {
  DEFAULT_MECHANICS_VERSION,
  applyDraftAction,
  buildConstraintProfiles,
  createDraft,
  resolveRun,
  stateHash,
} from '@football-11/domain';

const routeBase = process.env.FOOTBALL11_COMPETITION_BASE_URL ?? 'http://127.0.0.1:8787';
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
if (missing.length > 0)
  throw new Error(`Missing Saved-XI smoke configuration: ${missing.join(', ')}`);

const savedXiKey = 'football11_saved_xi_v1';
const challengeKey = 'football11_saved_xi_challenge_v1';
const historyKey = 'football11_async_history_v1';
const challengeScoreCode = 'football11challengescore';

try {
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
  const profiles = buildConstraintProfiles(catalogue.playerSeasons);

  async function loginPlayer() {
    const sdk = AccelByte.SDK({
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
      sdk.assembly().axiosInstance.defaults,
    );
    if (login.error) throw new Error('Device login failed.');
    const token = login.response?.data;
    if (!token?.access_token || !token.user_id)
      throw new Error('Device login returned no session.');
    return { accessToken: token.access_token, userId: token.user_id };
  }

  function makeSubmission(label) {
    const challengeId = `phase-5-saved-xi-smoke-${label}`;
    const seed = `phase-5-${label}-${randomUUID()}`;
    let snapshot = createDraft({
      challengeId,
      seed,
      versions: DEFAULT_MECHANICS_VERSION,
      players: catalogue.playerSeasons,
      profiles,
    });
    const actions = [];
    while (snapshot.offer) {
      const card = snapshot.offer.cards[0];
      const slotCode = card?.safeSlotCodes[0];
      if (!card || !slotCode) throw new Error('Saved-XI smoke could not select a legal card.');
      const action = {
        type: 'select',
        round: snapshot.state.round,
        playerSeasonId: card.playerSeasonId,
        slotCode,
      };
      actions.push(action);
      snapshot = applyDraftAction(snapshot, action, catalogue.playerSeasons, profiles);
    }
    const { result } = resolveRun(
      {
        challengeId,
        seed,
        versions: DEFAULT_MECHANICS_VERSION,
        players: catalogue.playerSeasons,
        profiles,
        actions,
        assessmentConfig,
        leagueProfile,
      },
      catalogue.playerSeasons,
      profiles,
    );
    return {
      schemaVersion: 'football11-trusted-submit-v1',
      runId: result.resultId,
      challengeId,
      seed,
      versions: DEFAULT_MECHANICS_VERSION,
      actions,
    };
  }

  async function route(path, method, accessToken, body) {
    const response = await fetch(`${routeBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, payload: await response.json() };
  }

  async function requireOk(path, method, player, body) {
    const response = await route(path, method, player.accessToken, body);
    if (response.status !== 200 || response.payload.ok !== true) {
      throw new Error(
        `${method} ${path} failed (${response.status}, ${response.payload?.error?.code ?? 'unknown'}).`,
      );
    }
    return response.payload.data;
  }

  const challenger = await loginPlayer();
  const opponent = await loginPlayer();
  const challengerRun = makeSubmission('challenger');
  const opponentRun = makeSubmission('opponent');

  for (const [player, submission] of [
    [challenger, challengerRun],
    [opponent, opponentRun],
  ]) {
    await requireOk('/api/runs/submit', 'POST', player, submission);
    await requireOk('/api/saved-xi', 'PUT', player, submission);
  }

  const initialStatus = await requireOk('/api/saved-xi', 'GET', challenger);
  if (!initialStatus.savedXi || initialStatus.challengeScore !== 0) {
    throw new Error('Published XI or initial Challenge Score did not read back.');
  }

  const preview = await requireOk('/api/opponents/nearby', 'POST', challenger);
  if (
    !preview.token ||
    preview.opponentXi.ownerUserId ||
    preview.opponentLabel.includes(opponent.userId)
  ) {
    throw new Error('Opponent preview leaked identity or omitted its opaque token.');
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
  const serviceSdk = AccelByte.SDK({
    coreConfig: {
      baseURL: config.baseURL,
      namespace: config.namespace,
      clientId: config.serverClientId,
      redirectURI: 'http://127.0.0.1',
    },
  });
  serviceSdk.setToken({ accessToken: serviceToken.access_token });
  const records = PlayerRecordAdminApi(serviceSdk);
  const stats = UserStatisticAdminApi(serviceSdk);
  const issuedBeforeSettlement = await records.getRecord_ByUserId_ByKey(
    challenger.userId,
    challengeKey,
  );
  const firstOpponentUserId = issuedBeforeSettlement.data.value.opponentXi.ownerUserId;
  const opponentScoreBeforeResponse = await stats.createStatitemValueBulkGetOrDefault_ByUserId_v2(
    firstOpponentUserId,
    {
      statCodes: [challengeScoreCode],
    },
  );
  const opponentScoreBefore = opponentScoreBeforeResponse.data.find(
    (entry) => entry.statCode === challengeScoreCode,
  )?.value;

  const resolveBody = {
    schemaVersion: 'football11-resolve-saved-xi-challenge-v1',
    token: preview.token,
  };
  const settled = await requireOk('/api/asynchronous-matches', 'POST', challenger, resolveBody);
  const duplicate = await requireOk('/api/asynchronous-matches', 'POST', challenger, resolveBody);
  if (
    settled.duplicate !== false ||
    duplicate.duplicate !== true ||
    stateHash(settled.match) !== stateHash(duplicate.match) ||
    settled.match.result.evidence ||
    settled.match.scoreAfter < 0
  ) {
    throw new Error(
      `Settlement replay, public projection, or score floor failed: ${JSON.stringify({
        firstDuplicate: settled.duplicate,
        secondDuplicate: duplicate.duplicate,
        sameMatch: stateHash(settled.match) === stateHash(duplicate.match),
        exposedEvidence: Boolean(settled.match.result.evidence),
        scoreAfter: settled.match.scoreAfter,
      })}`,
    );
  }

  const [savedXi, issuedChallenge, history] = await Promise.all([
    records.getRecord_ByUserId_ByKey(challenger.userId, savedXiKey),
    records.getRecord_ByUserId_ByKey(challenger.userId, challengeKey),
    records.getRecord_ByUserId_ByKey(challenger.userId, historyKey),
  ]);
  if (
    savedXi.data.is_public !== true ||
    savedXi.data.set_by !== 'SERVER' ||
    issuedChallenge.data.is_public !== false ||
    issuedChallenge.data.set_by !== 'SERVER' ||
    history.data.is_public !== false ||
    history.data.set_by !== 'SERVER' ||
    history.data.value.matches.length !== 1 ||
    history.data.value.matches[0].settlementStatus !== 'settled'
  ) {
    throw new Error('Cloud Save ownership, privacy, or immutable history readback failed.');
  }
  const [challengerScores, opponentScores] = await Promise.all([
    stats.createStatitemValueBulkGetOrDefault_ByUserId_v2(challenger.userId, {
      statCodes: [challengeScoreCode],
    }),
    stats.createStatitemValueBulkGetOrDefault_ByUserId_v2(firstOpponentUserId, {
      statCodes: [challengeScoreCode],
    }),
  ]);
  const challengerScore = challengerScores.data.find(
    (entry) => entry.statCode === challengeScoreCode,
  )?.value;
  const opponentScore = opponentScores.data.find(
    (entry) => entry.statCode === challengeScoreCode,
  )?.value;
  if (
    challengerScore !== settled.match.scoreAfter ||
    opponentScoreBefore === undefined ||
    opponentScore !== opponentScoreBefore
  ) {
    throw new Error('Challenger-only Challenge Score settlement failed readback.');
  }

  const rematchAttempt = await route('/api/opponents/nearby', 'POST', challenger.accessToken);
  let cooldownExcludedSameOpponent = rematchAttempt.status === 404;
  if (rematchAttempt.status === 200 && rematchAttempt.payload.ok === true) {
    const nextChallenge = await records.getRecord_ByUserId_ByKey(challenger.userId, challengeKey);
    cooldownExcludedSameOpponent =
      nextChallenge.data.value.opponentXi.ownerUserId !== firstOpponentUserId;
  }
  if (!cooldownExcludedSameOpponent) {
    throw new Error('The 24-hour cooldown did not exclude the resolved opponent.');
  }

  console.log(
    JSON.stringify(
      {
        savedXiCompetitionRoute: 'ok',
        trustedPublication: true,
        nearbyDiscovery: true,
        opaqueSingleUseToken: true,
        deterministicDuplicate: true,
        privateSeedProjection: true,
        challengerOnlyScore: true,
        scoreFloor: true,
        serverOwnedCloudSave: true,
        immutableSettledHistory: true,
        cooldownExcludedSameOpponent: true,
        outcome: settled.match.result.outcome,
        scoreAfter: settled.match.scoreAfter,
      },
      null,
      2,
    ),
  );
} catch (caught) {
  const message = caught instanceof Error ? caught.message : 'Unknown Saved-XI smoke failure';
  console.error(`Saved-XI smoke failed: ${message}`);
  process.exitCode = 1;
}
