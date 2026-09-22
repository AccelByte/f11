import { randomUUID } from 'node:crypto';

import { AccelByte } from '@accelbyte/sdk';
import { IamOAuthClient } from '@accelbyte/sdk-iam';
import { Session } from '@accelbyte/sdk-session';

const TEMPLATE = 'football11-friend-room-v1';
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

function safeError(caught) {
  const status = caught?.response?.status;
  const code = caught?.response?.data?.errorCode ?? caught?.response?.data?.error;
  const description =
    caught?.response?.data?.errorMessage ??
    caught?.response?.data?.message ??
    caught?.response?.data?.error_description;
  if (status || code) {
    const safeDescription =
      typeof description === 'string'
        ? `: ${description.replace(/[A-Fa-f0-9-]{24,}/g, '[redacted]')}`
        : '';
    return `${status ?? 'error'}${code ? ` (${code})` : ''}${safeDescription}`;
  }
  return caught instanceof Error
    ? caught.message.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]')
    : 'unknown';
}

async function login() {
  const sdk = AccelByte.SDK({ coreConfig: config });
  const loginResult = await IamOAuthClient.exchangeTokenOauthByPlatformId(
    'device',
    config.clientId,
    {
      client_id: config.clientId,
      device_id: randomUUID(),
      createHeadless: true,
      skipSetCookie: true,
    },
    sdk.assembly().axiosInstance.defaults,
  );
  if (loginResult.error) throw loginResult.error;
  const token = loginResult.response?.data;
  if (!token?.access_token || !token.user_id) throw new Error('Device login returned no token.');
  sdk.setToken({ accessToken: token.access_token, refreshToken: token.refresh_token });
  return { sdk, userId: token.user_id, sessions: Session.GameSessionApi(sdk) };
}

function createBody(userId) {
  return {
    attributes: {
      game: 'football-11',
      mode: 'friend-room',
      schemaVersion: 1,
      phase: 'WAITING',
      roomRevision: 0,
      roundOrdinal: 0,
    },
    autoJoin: true,
    backfillTicketID: '',
    clientVersion: 'web-0.1.0',
    configurationName: TEMPLATE,
    deployment: '',
    inactiveTimeout: 120,
    inviteTimeout: 60,
    joinability: 'OPEN',
    matchPool: '',
    maxPlayers: 8,
    minPlayers: 1,
    requestedRegions: [],
    serverName: '',
    teams: [{ teamID: 'players', userIDs: [userId] }],
    textChat: false,
    ticketIDs: [],
    tieTeamsSessionLifetime: false,
    type: 'NONE',
  };
}

function updateBody(snapshot, attributes, joinability = snapshot.configuration.joinability) {
  return {
    attributes,
    joinability,
    version: snapshot.version,
  };
}

const evidence = {
  login: false,
  create: false,
  canonicalReadback: false,
  availableDiscovery: false,
  joinById: false,
  leaderPreservedOnJoin: false,
  memberCanUpdate: false,
  closedProgressUpdate: false,
  closedRejectsJoinById: false,
  closedRejectsJoinByCode: false,
  reopen: false,
  joinByCode: false,
  revokeCode: false,
  regenerateCode: false,
  leaderMigration: false,
  leaveCleanup: false,
  lobbyConnected: false,
  lobbyTopics: [],
};

let host;
let member;
let late;
let sessionId;
let step = 'login';

try {
  [host, member, late] = await Promise.all([login(), login(), login()]);
  evidence.login = true;

  const topics = new Set();

  step = 'create';
  let snapshot = (
    await host.sessions.createGamesession(createBody(host.userId), {
      resolveMaxActiveSession: true,
    })
  ).data;
  sessionId = snapshot.id;
  evidence.create = Boolean(sessionId);

  step = 'canonical readback';
  snapshot = (await host.sessions.getGamesession_BySessionId(sessionId)).data;
  evidence.canonicalReadback =
    snapshot.configuration.name === TEMPLATE &&
    snapshot.configuration.type === 'NONE' &&
    snapshot.configuration.joinability === 'OPEN' &&
    snapshot.configuration.minPlayers === 1 &&
    snapshot.configuration.maxPlayers === 8 &&
    snapshot.members.some((candidate) => candidate.id === host.userId);

  step = 'available discovery';
  const available = (await member.sessions.createGamesession_ByNS()).data;
  evidence.availableDiscovery = available.data.some(
    (candidate) => candidate.id === sessionId && candidate.configuration.name === TEMPLATE,
  );

  step = 'join by id';
  snapshot = (await member.sessions.createJoin_BySessionId(sessionId)).data;
  evidence.joinById = snapshot.members.some((candidate) => candidate.id === member.userId);
  evidence.leaderPreservedOnJoin = snapshot.leaderID === host.userId;

  step = 'member update probe';
  try {
    snapshot = (
      await member.sessions.patchGamesession_BySessionId(
        sessionId,
        updateBody(snapshot, { ...snapshot.attributes, memberUpdateProbe: true }),
      )
    ).data;
    evidence.memberCanUpdate = snapshot.attributes?.memberUpdateProbe === true;
  } catch {
    snapshot = (await host.sessions.getGamesession_BySessionId(sessionId)).data;
  }

  step = 'close joinability';
  snapshot = (await host.sessions.getGamesession_BySessionId(sessionId)).data;
  const transitionOwner = snapshot.leaderID === host.userId ? host : member;
  const remainingMember = transitionOwner === host ? member : host;
  snapshot = (
    await transitionOwner.sessions.patchGamesession_BySessionId(
      sessionId,
      updateBody(
        snapshot,
        { ...snapshot.attributes, phase: 'DRAFTING', roomRevision: 1 },
        'CLOSED',
      ),
    )
  ).data;

  step = 'closed progress update';
  snapshot = (
    await remainingMember.sessions.patchGamesession_BySessionId(sessionId, {
      attributes: { ...snapshot.attributes, closedProgressProbe: true },
      version: snapshot.version,
    })
  ).data;
  evidence.closedProgressUpdate =
    snapshot.configuration.joinability === 'CLOSED' &&
    snapshot.attributes?.closedProgressProbe === true;

  step = 'closed join rejection';
  try {
    await late.sessions.createJoin_BySessionId(sessionId);
  } catch {
    evidence.closedRejectsJoinById = true;
  }
  try {
    await late.sessions.createGamesessionJoinCode({ code: snapshot.code });
  } catch {
    evidence.closedRejectsJoinByCode = true;
  }

  step = 'reopen joinability';
  snapshot = (
    await transitionOwner.sessions.patchGamesession_BySessionId(
      sessionId,
      updateBody(snapshot, { ...snapshot.attributes, phase: 'REVEAL', roomRevision: 2 }, 'OPEN'),
    )
  ).data;
  evidence.reopen = snapshot.configuration.joinability === 'OPEN';

  step = 'join by code';
  snapshot = (await late.sessions.createGamesessionJoinCode({ code: snapshot.code })).data;
  evidence.joinByCode = snapshot.members.some((candidate) => candidate.id === late.userId);
  await late.sessions.deleteLeave_BySessionId(sessionId);

  step = 'code revoke and regenerate';
  await transitionOwner.sessions.deleteCode_BySessionId(sessionId);
  snapshot = (await transitionOwner.sessions.getGamesession_BySessionId(sessionId)).data;
  evidence.revokeCode = !snapshot.code;
  snapshot = (await transitionOwner.sessions.updateCode_BySessionId(sessionId)).data;
  evidence.regenerateCode = Boolean(snapshot.code);

  step = 'leader migration';
  await transitionOwner.sessions.deleteLeave_BySessionId(sessionId);
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  snapshot = (await remainingMember.sessions.getGamesession_BySessionId(sessionId)).data;
  evidence.leaderMigration = snapshot.leaderID === remainingMember.userId;
  await remainingMember.sessions.deleteLeave_BySessionId(sessionId);
  const mine = (await remainingMember.sessions.getUsersMeGamesessions()).data;
  evidence.leaveCleanup = !mine.data.some((candidate) => candidate.id === sessionId);

  // The SDK's Lobby transport is browser-oriented. Browser QA owns websocket
  // connection/topic evidence so this Node probe cannot change member presence
  // or trigger leader migration before the REST lifecycle assertions complete.
  evidence.lobbyTopics = [...topics].sort();
  console.log(JSON.stringify(evidence, null, 2));
} catch (caught) {
  console.error(`AGS friend-room smoke failed at ${step}: ${safeError(caught)}`);
  console.error(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (sessionId) {
    await Promise.allSettled([
      host?.sessions.deleteLeave_BySessionId(sessionId),
      member?.sessions.deleteLeave_BySessionId(sessionId),
      late?.sessions.deleteLeave_BySessionId(sessionId),
    ]);
  }
}
