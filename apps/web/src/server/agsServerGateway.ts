import { AccelByte, type AccelByteSDK } from '@accelbyte/sdk';
import {
  GameRecordAdminApi,
  PlayerRecordAdminApi,
  PublicPlayerRecordApi,
} from '@accelbyte/sdk-cloudsave';
import { IamUserClient } from '@accelbyte/sdk-iam';
import { LeaderboardDataV3Api } from '@accelbyte/sdk-leaderboard';
import { UserStatisticAdminApi } from '@accelbyte/sdk-social';
import type {
  AsyncMatchHistoryV1,
  AsyncMatchRecordV1,
  DraftChallengeReceiptV1,
  IssuedSavedXiChallengeV1,
  LeaderboardEntryV1,
  SavedXiRecordV1,
  TrustedLeaderboardViewV1,
  TrustedRunReceiptV1,
} from '@football-11/contracts';
import { stateHash } from '@football-11/domain';

import { readFriendRoomState } from '../state/friendRoomMachine';
import {
  ACTIVE_DRAFT_CHALLENGE_RECORD_KEY,
  GAME_CONFIG_RECORD_KEY,
  type DraftChallengeGateway,
  type DraftChallengeRoomSnapshot,
} from './draftChallenges';
import {
  TRUSTED_LEADERBOARD_CODE,
  TRUSTED_POINTS_STAT_CODE,
  TRUSTED_SETTLEMENT_RECORD_KEY,
  TrustedReplayError,
  type AuthenticatedPlayer,
  type TrustedReplayGateway,
  type TrustedRoomSnapshot,
} from './trustedReplay';
import {
  ASYNC_MATCH_HISTORY_RECORD_KEY,
  CHALLENGE_SCORE_STAT_CODE,
  SAVED_XI_CHALLENGE_RECORD_KEY,
  SAVED_XI_RECORD_KEY,
  type NearbyLeaderboardCandidate,
  type SavedXiCompetitionGateway,
} from './savedXiCompetition';

export interface AgsServerConfig {
  baseURL: string;
  namespace: string;
  publicClientId: string;
  serverClientId: string;
  serverClientSecret: string;
}

interface CachedServiceToken {
  accessToken: string;
  expiresAtMs: number;
  cacheKey: string;
}

let cachedServiceToken: CachedServiceToken | null = null;

export class AgsServerGateway
  implements TrustedReplayGateway, SavedXiCompetitionGateway, DraftChallengeGateway
{
  constructor(private readonly config: AgsServerConfig) {}

  async authenticatePlayer(accessToken: string): Promise<AuthenticatedPlayer> {
    const sdk = makeSdk(this.config, this.config.publicClientId);
    sdk.setToken({ accessToken });
    try {
      const response = await new IamUserClient(sdk).getCurrentUser();
      if (response.error) throw response.error;
      const profile = response.response?.data;
      if (!profile?.userId || !profile.namespace) {
        throw new TrustedReplayError(
          401,
          'INVALID_SESSION',
          'AGS did not return a usable authenticated player.',
        );
      }
      return { userId: profile.userId, namespace: profile.namespace };
    } catch (caught) {
      if (caught instanceof TrustedReplayError) throw caught;
      const status = responseStatus(caught);
      if (status === 401 || status === 403) {
        throw new TrustedReplayError(
          401,
          'INVALID_SESSION',
          'The AGS player session is missing, expired, or invalid.',
        );
      }
      throw caught;
    }
  }

  async readDraftConfigRecord(): Promise<unknown> {
    try {
      const { data } = await GameRecordAdminApi(await this.serviceSdk()).getRecord_ByKey(
        GAME_CONFIG_RECORD_KEY,
      );
      if (
        data.namespace !== this.config.namespace ||
        data.key !== GAME_CONFIG_RECORD_KEY ||
        data.set_by !== 'SERVER'
      ) {
        throw new TrustedReplayError(
          502,
          'DRAFT_CONFIG_SCOPE_MISMATCH',
          'AGS returned draft configuration outside its trusted scope.',
        );
      }
      return data.value;
    } catch (caught) {
      if (caught instanceof TrustedReplayError) throw caught;
      throw upstreamError(
        'DRAFT_CONFIG_READ_FAILED',
        'The trusted service could not read the AGS draft configuration.',
        caught,
      );
    }
  }

  async readActiveDraftChallenge(userId: string): Promise<unknown> {
    return this.readPlayerRecord(userId, ACTIVE_DRAFT_CHALLENGE_RECORD_KEY, false);
  }

  async writeActiveDraftChallenge(userId: string, receipt: DraftChallengeReceiptV1): Promise<void> {
    await this.writePlayerRecord(userId, ACTIVE_DRAFT_CHALLENGE_RECORD_KEY, receipt, false);
  }

  async readRoomForDraftChallenge(
    sessionId: string,
    accessToken: string,
  ): Promise<DraftChallengeRoomSnapshot> {
    if (!sessionId || sessionId.length > 128 || !accessToken) {
      throw new TrustedReplayError(
        400,
        'INVALID_ROOM_CONTEXT',
        'The room challenge request has invalid AGS context.',
      );
    }
    const url = `${this.config.baseURL}/session/v1/public/namespaces/${encodeURIComponent(this.config.namespace)}/gamesessions/${encodeURIComponent(sessionId)}`;
    let response: Response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    } catch (caught) {
      throw upstreamError(
        'ROOM_READ_UNAVAILABLE',
        'The trusted service could not read the AGS room.',
        caught,
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new TrustedReplayError(
        403,
        'ROOM_ACCESS_DENIED',
        'The authenticated player cannot access this AGS room.',
      );
    }
    if (response.status === 404) {
      throw new TrustedReplayError(404, 'ROOM_NOT_FOUND', 'The AGS room could not be found.');
    }
    if (!response.ok) {
      throw new TrustedReplayError(
        502,
        'ROOM_READ_FAILED',
        'The trusted service could not read the AGS room.',
      );
    }
    const value: unknown = await response.json();
    if (
      !isRecord(value) ||
      !isRecord(value.configuration) ||
      !Array.isArray(value.members) ||
      typeof value.leaderID !== 'string'
    ) {
      throw new TrustedReplayError(
        502,
        'INVALID_ROOM_RESPONSE',
        'AGS returned an invalid room response.',
      );
    }
    let state;
    try {
      state = readFriendRoomState(isRecord(value.attributes) ? value.attributes : undefined);
    } catch {
      throw new TrustedReplayError(
        409,
        'INCOMPATIBLE_ROOM_STATE',
        'The AGS room does not contain compatible Football 11 state.',
      );
    }
    return {
      sessionId: requiredRoomString(value.id, 'session identifier'),
      namespace: requiredRoomString(value.namespace, 'namespace'),
      configurationName: requiredRoomString(value.configuration.name, 'configuration'),
      leaderId: value.leaderID,
      activeMemberUserIds: value.members.flatMap((member) => {
        if (!isRecord(member) || typeof member.id !== 'string') return [];
        const status = typeof member.statusV2 === 'string' ? member.statusV2 : member.status;
        return status === 'JOINED' || status === 'CONNECTED' ? [member.id] : [];
      }),
      state,
    };
  }

  async readRoom(sessionId: string, accessToken: string): Promise<TrustedRoomSnapshot> {
    if (!sessionId || sessionId.length > 128 || !accessToken) {
      throw new TrustedReplayError(
        400,
        'INVALID_ROOM_CONTEXT',
        'The ranked run has invalid AGS room context.',
      );
    }
    const url = `${this.config.baseURL}/session/v1/public/namespaces/${encodeURIComponent(this.config.namespace)}/gamesessions/${encodeURIComponent(sessionId)}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (caught) {
      throw upstreamError(
        'ROOM_READ_UNAVAILABLE',
        'The trusted service could not read the AGS room.',
        caught,
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new TrustedReplayError(
        403,
        'ROOM_ACCESS_DENIED',
        'The authenticated player cannot access this AGS room.',
      );
    }
    if (response.status === 404) {
      throw new TrustedReplayError(404, 'ROOM_NOT_FOUND', 'The AGS room could not be found.');
    }
    if (!response.ok) {
      throw new TrustedReplayError(
        502,
        'ROOM_READ_FAILED',
        'The trusted service could not read the AGS room.',
      );
    }

    const value: unknown = await response.json();
    if (!isRecord(value) || !isRecord(value.configuration) || !Array.isArray(value.members)) {
      throw new TrustedReplayError(
        502,
        'INVALID_ROOM_RESPONSE',
        'AGS returned an invalid room response.',
      );
    }
    let state;
    try {
      state = readFriendRoomState(isRecord(value.attributes) ? value.attributes : undefined);
    } catch {
      throw new TrustedReplayError(
        409,
        'INCOMPATIBLE_ROOM_STATE',
        'The AGS room does not contain a compatible Football 11 challenge.',
      );
    }
    if (!state.challenge) {
      throw new TrustedReplayError(
        409,
        'ROOM_CHALLENGE_UNAVAILABLE',
        'The AGS room has no active Football 11 challenge to verify.',
      );
    }

    const activeMemberUserIds = value.members.flatMap((member) => {
      if (!isRecord(member) || typeof member.id !== 'string') return [];
      const status = typeof member.statusV2 === 'string' ? member.statusV2 : member.status;
      return status === 'JOINED' || status === 'CONNECTED' || status === 'DISCONNECTED'
        ? [member.id]
        : [];
    });
    return {
      sessionId: requiredRoomString(value.id, 'session identifier'),
      namespace: requiredRoomString(value.namespace, 'namespace'),
      configurationName: requiredRoomString(value.configuration.name, 'configuration'),
      activeMemberUserIds,
      challenge: state.challenge,
    };
  }

  async readReceipt(userId: string): Promise<unknown> {
    const api = PlayerRecordAdminApi(await this.serviceSdk());
    try {
      const { data } = await api.getRecord_ByUserId_ByKey(userId, TRUSTED_SETTLEMENT_RECORD_KEY);
      this.assertPlayerRecord(data, userId, true);
      return data.value;
    } catch (caught) {
      if (responseStatus(caught) === 404) return null;
      throw upstreamError(
        'RECEIPT_READ_FAILED',
        'The trusted service could not read the AGS settlement receipt.',
        caught,
      );
    }
  }

  async settleBestPoints(
    userId: string,
    points: number,
    receipt: TrustedRunReceiptV1,
  ): Promise<number> {
    try {
      const api = UserStatisticAdminApi(await this.serviceSdk());
      const { data: results } = await api.updateStatitemValueBulk_v2([
        {
          userId,
          statCode: TRUSTED_POINTS_STAT_CODE,
          value: points,
          updateStrategy: 'MAX',
          additionalData: {
            runId: receipt.runId,
            resultHash: receipt.resultHash,
            finalStateHash: receipt.finalStateHash,
          },
        },
      ]);
      const operation = results.find(
        (entry) => entry.userId === userId && entry.statCode === TRUSTED_POINTS_STAT_CODE,
      );
      if (!operation?.success) {
        throw new TrustedReplayError(
          502,
          'STAT_SETTLEMENT_FAILED',
          'AGS did not acknowledge the trusted best-points update.',
        );
      }

      const { data: values } = await api.createStatitemValueBulkGetOrDefault_ByUserId_v2(userId, {
        statCodes: [TRUSTED_POINTS_STAT_CODE],
      });
      const best = values.find((entry) => entry.statCode === TRUSTED_POINTS_STAT_CODE)?.value;
      if (typeof best !== 'number' || !Number.isFinite(best) || best < points) {
        throw new TrustedReplayError(
          502,
          'STAT_READBACK_FAILED',
          'AGS Statistics readback did not contain the accepted best score.',
        );
      }
      return best;
    } catch (caught) {
      throw upstreamError(
        'STAT_SETTLEMENT_UNAVAILABLE',
        'The trusted service could not settle AGS best points.',
        caught,
      );
    }
  }

  async writeReceipt(userId: string, receipt: TrustedRunReceiptV1): Promise<void> {
    try {
      const api = PlayerRecordAdminApi(await this.serviceSdk());
      const payload = {
        ...receipt,
        __META: {
          is_public: false,
          set_by: 'SERVER',
        },
      };
      let response;
      try {
        response = await api.updateRecord_ByUserId_ByKey(
          userId,
          TRUSTED_SETTLEMENT_RECORD_KEY,
          payload,
        );
      } catch (caught) {
        const status = responseStatus(caught);
        if (status !== 404) {
          throw new TrustedReplayError(
            502,
            `RECEIPT_UPDATE_FAILED_${status ?? 'UNKNOWN'}`,
            'AGS rejected the trusted settlement receipt update.',
          );
        }
        try {
          response = await api.createRecord_ByUserId_ByKey(
            userId,
            TRUSTED_SETTLEMENT_RECORD_KEY,
            payload,
          );
        } catch {
          throw new TrustedReplayError(
            502,
            'RECEIPT_CREATE_FAILED',
            'AGS rejected the trusted settlement receipt creation.',
          );
        }
      }
      this.assertPlayerRecord(response.data, userId, true);
      if (!sameReceipt(response.data.value, receipt)) {
        throw new TrustedReplayError(
          502,
          'RECEIPT_WRITE_FAILED',
          'AGS Cloud Save did not acknowledge the trusted settlement receipt.',
        );
      }

      const { data: readback } = await api.getRecord_ByUserId_ByKey(
        userId,
        TRUSTED_SETTLEMENT_RECORD_KEY,
      );
      this.assertPlayerRecord(readback, userId, true);
      if (!sameReceipt(readback.value, receipt)) {
        throw new TrustedReplayError(
          502,
          'RECEIPT_READBACK_FAILED',
          'AGS Cloud Save receipt readback did not match the accepted run.',
        );
      }
    } catch (caught) {
      throw upstreamError(
        'RECEIPT_WRITE_UNAVAILABLE',
        'The trusted service could not persist the AGS settlement receipt.',
        caught,
      );
    }
  }

  async readLeaderboard(
    userId: string,
    expectedBestPoints: number,
    accessToken: string,
  ): Promise<TrustedLeaderboardViewV1> {
    const sdk = makeSdk(this.config, this.config.publicClientId);
    sdk.setToken({ accessToken });
    const api = LeaderboardDataV3Api(sdk);
    let own: { point: number; rank: number } | null = null;
    try {
      const { data } = await api.getUser_ByLeaderboardCode_ByUserId_v3(
        TRUSTED_LEADERBOARD_CODE,
        userId,
      );
      own = data.allTime ?? null;
    } catch (caught) {
      if (responseStatus(caught) !== 404) throw caught;
    }

    const offset = own ? Math.max(0, own.rank - 3) : 0;
    const { data: ranking } = await api.getAlltime_ByLeaderboardCode_v3(TRUSTED_LEADERBOARD_CODE, {
      limit: 5,
      offset,
    });
    const entries = ranking.data
      .filter((entry) => entry.hidden !== true)
      .map((entry, index) => sanitizeEntry(entry.userId, entry.point, offset + index + 1, userId));
    const observedBest = own?.point ?? expectedBestPoints;
    const stale = own === null || own.point < expectedBestPoints;
    return {
      status: stale
        ? expectedBestPoints > 0
          ? 'stale'
          : entries.length === 0
            ? 'empty'
            : 'unranked'
        : 'ranked',
      bestPoints: observedBest,
      rank: own?.rank ?? null,
      entries,
    };
  }

  async readBestPoints(userId: string): Promise<number> {
    return this.readStatistic(userId, TRUSTED_POINTS_STAT_CODE);
  }

  async readChallengeScore(userId: string): Promise<number> {
    return this.readStatistic(userId, CHALLENGE_SCORE_STAT_CODE);
  }

  async readSavedXi(userId: string): Promise<unknown> {
    return this.readPlayerRecord(userId, SAVED_XI_RECORD_KEY, true);
  }

  async readSavedXis(
    userIds: string[],
    accessToken: string,
  ): Promise<Array<{ userId: string; value: unknown }>> {
    if (userIds.length === 0) return [];
    const records: Array<{ userId: string; value: unknown }> = [];
    const sdk = makeSdk(this.config, this.config.publicClientId);
    sdk.setToken({ accessToken });
    const api = PublicPlayerRecordApi(sdk);
    try {
      for (let offset = 0; offset < userIds.length; offset += 20) {
        const batch = userIds.slice(offset, offset + 20);
        const { data } = await api.fetchPublicBulkUser_ByKey(SAVED_XI_RECORD_KEY, {
          userIds: batch,
        });
        for (const record of data.data) {
          this.assertScopedPlayerRecord(record, record.user_id, SAVED_XI_RECORD_KEY, true, true);
          records.push({ userId: record.user_id, value: record.value });
        }
      }
      return records;
    } catch (caught) {
      throw upstreamError(
        'SAVED_XI_BULK_READ_FAILED',
        'The trusted service could not read nearby public Saved XIs.',
        caught,
      );
    }
  }

  async writeSavedXi(userId: string, record: SavedXiRecordV1): Promise<void> {
    await this.writePlayerRecord(userId, SAVED_XI_RECORD_KEY, record, true);
  }

  async readIssuedChallenge(userId: string): Promise<unknown> {
    return this.readPlayerRecord(userId, SAVED_XI_CHALLENGE_RECORD_KEY, false);
  }

  async writeIssuedChallenge(userId: string, challenge: IssuedSavedXiChallengeV1): Promise<void> {
    await this.writePlayerRecord(userId, SAVED_XI_CHALLENGE_RECORD_KEY, challenge, false);
  }

  async readMatchHistory(userId: string): Promise<unknown> {
    return this.readPlayerRecord(userId, ASYNC_MATCH_HISTORY_RECORD_KEY, false);
  }

  async writeMatchHistory(userId: string, history: AsyncMatchHistoryV1): Promise<void> {
    await this.writePlayerRecord(userId, ASYNC_MATCH_HISTORY_RECORD_KEY, history, false);
  }

  async readNearbyLeaderboardCandidates(
    userId: string,
    accessToken: string,
    radius: number,
  ): Promise<NearbyLeaderboardCandidate[]> {
    const sdk = makeSdk(this.config, this.config.publicClientId);
    sdk.setToken({ accessToken });
    const api = LeaderboardDataV3Api(sdk);
    let ownRank: number | null = null;
    try {
      const { data } = await api.getUser_ByLeaderboardCode_ByUserId_v3(
        TRUSTED_LEADERBOARD_CODE,
        userId,
      );
      ownRank = data.allTime?.rank ?? null;
    } catch (caught) {
      if (responseStatus(caught) !== 404) {
        throw upstreamError(
          'LEADERBOARD_RANK_READ_FAILED',
          'The trusted service could not read the player rank.',
          caught,
        );
      }
    }
    const offset = ownRank === null ? 0 : Math.max(0, ownRank - radius);
    const limit = Math.min(100, radius * 2 + 1);
    try {
      const { data } = await api.getAlltime_ByLeaderboardCode_v3(TRUSTED_LEADERBOARD_CODE, {
        limit,
        offset,
      });
      return data.data
        .filter((entry) => entry.hidden !== true)
        .map((entry, index) => ({
          userId: entry.userId,
          points: entry.point,
          rank: offset + index + 1,
        }));
    } catch (caught) {
      throw upstreamError(
        'LEADERBOARD_WINDOW_READ_FAILED',
        'The trusted service could not read nearby ranked players.',
        caught,
      );
    }
  }

  async setChallengeScore(
    userId: string,
    score: number,
    match: AsyncMatchRecordV1,
  ): Promise<number> {
    try {
      const api = UserStatisticAdminApi(await this.serviceSdk());
      const { data: results } = await api.updateStatitemValueBulk_v2([
        {
          userId,
          statCode: CHALLENGE_SCORE_STAT_CODE,
          value: score,
          updateStrategy: 'OVERRIDE',
          additionalData: {
            matchId: match.matchId,
            outcome: match.result.outcome,
            scoreBefore: match.scoreBefore,
            scoreAfter: match.scoreAfter,
          },
        },
      ]);
      const operation = results.find(
        (entry) => entry.userId === userId && entry.statCode === CHALLENGE_SCORE_STAT_CODE,
      );
      if (!operation?.success) {
        throw new TrustedReplayError(
          502,
          'CHALLENGE_SCORE_SETTLEMENT_FAILED',
          'AGS did not acknowledge the Challenge Score settlement.',
        );
      }
      return this.readChallengeScore(userId);
    } catch (caught) {
      throw upstreamError(
        'CHALLENGE_SCORE_UNAVAILABLE',
        'The trusted service could not settle Challenge Score.',
        caught,
      );
    }
  }

  private async serviceSdk(): Promise<AccelByteSDK> {
    const accessToken = await getServiceToken(this.config);
    const sdk = makeSdk(this.config, this.config.serverClientId);
    sdk.setToken({ accessToken });
    return sdk;
  }

  private async readStatistic(userId: string, statCode: string): Promise<number> {
    try {
      const api = UserStatisticAdminApi(await this.serviceSdk());
      const { data } = await api.createStatitemValueBulkGetOrDefault_ByUserId_v2(userId, {
        statCodes: [statCode],
      });
      const value = data.find((entry) => entry.statCode === statCode)?.value;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new TrustedReplayError(
          502,
          'STAT_READBACK_FAILED',
          'AGS Statistics returned no usable value.',
        );
      }
      return value;
    } catch (caught) {
      throw upstreamError(
        'STAT_READ_UNAVAILABLE',
        'The trusted service could not read AGS Statistics.',
        caught,
      );
    }
  }

  private async readPlayerRecord(
    userId: string,
    key: string,
    requirePublic: boolean,
  ): Promise<unknown> {
    const api = PlayerRecordAdminApi(await this.serviceSdk());
    try {
      const { data } = await api.getRecord_ByUserId_ByKey(userId, key);
      this.assertScopedPlayerRecord(data, userId, key, requirePublic, true);
      return data.value;
    } catch (caught) {
      if (responseStatus(caught) === 404) return null;
      throw upstreamError(
        'PLAYER_RECORD_READ_FAILED',
        'The trusted service could not read a Football 11 player record.',
        caught,
      );
    }
  }

  private async writePlayerRecord(
    userId: string,
    key: string,
    value: object,
    isPublic: boolean,
  ): Promise<void> {
    const api = PlayerRecordAdminApi(await this.serviceSdk());
    const payload = {
      ...value,
      __META: {
        is_public: isPublic,
        set_by: 'SERVER' as const,
      },
    };
    try {
      let written;
      try {
        written = await api.updateRecord_ByUserId_ByKey(userId, key, payload);
      } catch (caught) {
        if (responseStatus(caught) !== 404) throw caught;
        written = await api.createRecord_ByUserId_ByKey(userId, key, payload);
      }
      this.assertScopedPlayerRecord(written.data, userId, key, isPublic, true);
      const { data: readback } = await api.getRecord_ByUserId_ByKey(userId, key);
      this.assertScopedPlayerRecord(readback, userId, key, isPublic, true);
      if (stateHash(readback.value) !== stateHash(value)) {
        throw new TrustedReplayError(
          502,
          'PLAYER_RECORD_READBACK_FAILED',
          'AGS Cloud Save readback did not match the trusted record.',
        );
      }
    } catch (caught) {
      throw upstreamError(
        'PLAYER_RECORD_WRITE_FAILED',
        'The trusted service could not persist a Football 11 player record.',
        caught,
      );
    }
  }

  private assertScopedPlayerRecord(
    record: {
      namespace: string;
      user_id: string;
      key: string;
      is_public: boolean;
      set_by?: 'CLIENT' | 'SERVER' | null;
    },
    userId: string,
    key: string,
    requirePublic: boolean,
    requireServerOwned: boolean,
  ): void {
    if (
      record.namespace !== this.config.namespace ||
      record.user_id !== userId ||
      record.key !== key ||
      record.is_public !== requirePublic ||
      (requireServerOwned && record.set_by !== 'SERVER')
    ) {
      throw new TrustedReplayError(
        502,
        'PLAYER_RECORD_SCOPE_MISMATCH',
        'AGS Cloud Save returned a player record outside its trusted scope.',
      );
    }
  }

  private assertPlayerRecord(
    record: {
      namespace: string;
      user_id: string;
      key: string;
      is_public: boolean;
      set_by?: 'CLIENT' | 'SERVER' | null;
    },
    userId: string,
    requireServerOwned: boolean,
  ): void {
    if (
      record.namespace !== this.config.namespace ||
      record.user_id !== userId ||
      record.key !== TRUSTED_SETTLEMENT_RECORD_KEY ||
      record.is_public ||
      (requireServerOwned && record.set_by !== 'SERVER')
    ) {
      throw new TrustedReplayError(
        502,
        'RECEIPT_SCOPE_MISMATCH',
        'AGS Cloud Save returned a settlement receipt outside its trusted scope.',
      );
    }
  }
}

export function readAgsServerConfig(environment: NodeJS.ProcessEnv = process.env): AgsServerConfig {
  return {
    baseURL: required(
      environment.ACCELBYTE_BASE_URL ?? environment.NEXT_PUBLIC_ACCELBYTE_BASE_URL,
      'ACCELBYTE_BASE_URL',
    ).replace(/\/$/, ''),
    namespace: required(
      environment.ACCELBYTE_NAMESPACE ?? environment.NEXT_PUBLIC_ACCELBYTE_NAMESPACE,
      'ACCELBYTE_NAMESPACE',
    ),
    publicClientId: required(
      environment.ACCELBYTE_PUBLIC_CLIENT_ID ?? environment.NEXT_PUBLIC_ACCELBYTE_CLIENT_ID,
      'ACCELBYTE_PUBLIC_CLIENT_ID',
    ),
    serverClientId: required(environment.ACCELBYTE_SERVER_CLIENT_ID, 'ACCELBYTE_SERVER_CLIENT_ID'),
    serverClientSecret: required(
      environment.ACCELBYTE_SERVER_CLIENT_SECRET,
      'ACCELBYTE_SERVER_CLIENT_SECRET',
    ),
  };
}

async function getServiceToken(config: AgsServerConfig): Promise<string> {
  const cacheKey = `${config.baseURL}|${config.namespace}|${config.serverClientId}`;
  if (
    cachedServiceToken?.cacheKey === cacheKey &&
    cachedServiceToken.expiresAtMs > Date.now() + 60_000
  ) {
    return cachedServiceToken.accessToken;
  }

  const authorization = btoa(`${config.serverClientId}:${config.serverClientSecret}`);
  const response = await fetch(`${config.baseURL}/iam/v3/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      namespace: config.namespace,
    }),
  });
  if (!response.ok) {
    throw new TrustedReplayError(
      502,
      'SERVICE_AUTH_FAILED',
      'The trusted service could not authenticate with AGS.',
    );
  }
  const data: unknown = await response.json();
  if (!isRecord(data) || typeof data.access_token !== 'string' || !data.access_token) {
    throw new TrustedReplayError(
      502,
      'SERVICE_AUTH_FAILED',
      'AGS returned no usable trusted-service token.',
    );
  }
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 600;
  cachedServiceToken = {
    accessToken: data.access_token,
    expiresAtMs: Date.now() + Math.max(60, expiresIn) * 1000,
    cacheKey,
  };
  return data.access_token;
}

function makeSdk(config: AgsServerConfig, clientId: string): AccelByteSDK {
  return AccelByte.SDK({
    coreConfig: {
      baseURL: config.baseURL,
      namespace: config.namespace,
      clientId,
      redirectURI: 'http://127.0.0.1',
    },
  });
}

function sanitizeEntry(
  userId: string,
  points: number,
  rank: number,
  currentUserId: string,
): LeaderboardEntryV1 {
  const isCurrentPlayer = userId === currentUserId;
  return {
    rank,
    points,
    label: isCurrentPlayer ? 'You' : `Player ${stateHash(userId).slice(0, 4).toUpperCase()}`,
    isCurrentPlayer,
  };
}

function sameReceipt(value: unknown, expected: TrustedRunReceiptV1): boolean {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === expected.schemaVersion &&
    value.runId === expected.runId &&
    value.resultId === expected.resultId &&
    value.resultHash === expected.resultHash &&
    value.finalStateHash === expected.finalStateHash &&
    value.points === expected.points &&
    value.verifiedAt === expected.verifiedAt
  );
}

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new TrustedReplayError(
      503,
      'SERVER_NOT_CONFIGURED',
      `The trusted runtime is missing ${name}.`,
    );
  }
  return value;
}

function requiredRoomString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) {
    throw new TrustedReplayError(
      502,
      'INVALID_ROOM_RESPONSE',
      `AGS returned a room without a usable ${field}.`,
    );
  }
  return value;
}

function responseStatus(caught: unknown): number | undefined {
  if (typeof caught !== 'object' || caught === null) return undefined;
  if ('status' in caught && typeof caught.status === 'number') return caught.status;
  if (!('response' in caught)) return undefined;
  const response = caught.response;
  if (typeof response !== 'object' || response === null || !('status' in response))
    return undefined;
  return typeof response.status === 'number' ? response.status : undefined;
}

function upstreamError(code: string, message: string, caught: unknown): TrustedReplayError {
  const diagnostic = responseErrorSummary(caught);
  if (diagnostic) console.warn(`[Football 11] ${code}`, diagnostic);
  return caught instanceof TrustedReplayError ? caught : new TrustedReplayError(502, code, message);
}

function responseErrorSummary(
  caught: unknown,
): { status?: number; errorCode?: number | string; message?: string } | null {
  if (!isRecord(caught) || !isRecord(caught.response)) return null;
  const data = isRecord(caught.response.data) ? caught.response.data : null;
  return {
    status: typeof caught.response.status === 'number' ? caught.response.status : undefined,
    errorCode:
      data && (typeof data.errorCode === 'number' || typeof data.errorCode === 'string')
        ? data.errorCode
        : undefined,
    message: data && typeof data.message === 'string' ? data.message : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
