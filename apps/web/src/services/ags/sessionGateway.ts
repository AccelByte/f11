import type { AccelByteSDK } from '@accelbyte/sdk';
import {
  Session,
  type CreateGameSessionRequest,
  type GameSessionQueryResponse,
  type GameSessionResponse,
  type UpdateGameSessionRequest,
} from '@accelbyte/sdk-session';
import type { FriendRoomStateV1 } from '@football-11/contracts';

import {
  createInitialFriendRoomState,
  readFriendRoomState,
  writeFriendRoomState,
} from '../../state/friendRoomMachine';
import { FriendRoomResponseError } from './errors';

export const FRIEND_ROOM_TEMPLATE = 'football11-friend-room-v1';
export const FRIEND_ROOM_MIN_PLAYERS = 1;
export const FRIEND_ROOM_MAX_PLAYERS = 8;

export interface FriendRoomMember {
  userId: string;
  status: string;
  isLeader: boolean;
}

export interface FriendRoomSnapshot {
  sessionId: string;
  namespace: string;
  configurationName: string;
  serverType: 'NONE';
  joinability: 'OPEN' | 'CLOSED';
  minPlayers: number;
  maxPlayers: number;
  isActive: boolean;
  isFull: boolean;
  leaderId: string;
  members: FriendRoomMember[];
  version: number;
  createdAt: string;
  expiresAt: string | null;
  hasJoinCode: boolean;
  joinCode: string | null;
  roomState: FriendRoomStateV1 | null;
}

export interface CreateFriendRoomInput {
  playerId: string;
  maxPlayers?: number;
}

export interface GameSessionClient {
  createGamesession(
    data: CreateGameSessionRequest,
    queryParams?: { resolveMaxActiveSession?: boolean | null },
  ): Promise<{ data: GameSessionResponse }>;
  getGamesession_BySessionId(sessionId: string): Promise<{ data: GameSessionResponse }>;
  createGamesession_ByNS(): Promise<{ data: GameSessionQueryResponse }>;
  getUsersMeGamesessions(queryParams?: {
    order?: string | null;
    orderBy?: string | null;
    status?: string | null;
  }): Promise<{ data: GameSessionQueryResponse }>;
  createJoin_BySessionId(sessionId: string): Promise<{ data: GameSessionResponse }>;
  createGamesessionJoinCode(data: { code: string }): Promise<{ data: GameSessionResponse }>;
  patchGamesession_BySessionId(
    sessionId: string,
    data: UpdateGameSessionRequest,
  ): Promise<{ data: GameSessionResponse }>;
  deleteCode_BySessionId(sessionId: string): Promise<unknown>;
  updateCode_BySessionId(sessionId: string): Promise<{ data: GameSessionResponse }>;
  deleteLeave_BySessionId(sessionId: string): Promise<unknown>;
}

export interface SessionGateway {
  createRoom(input: CreateFriendRoomInput): Promise<FriendRoomSnapshot>;
  listOpenRooms(): Promise<FriendRoomSnapshot[]>;
  getMyRooms(): Promise<FriendRoomSnapshot[]>;
  getRoom(sessionId: string): Promise<FriendRoomSnapshot>;
  joinRoom(sessionId: string): Promise<FriendRoomSnapshot>;
  joinRoomByCode(code: string): Promise<FriendRoomSnapshot>;
  updateRoom(
    sessionId: string,
    update: (state: FriendRoomStateV1, room: FriendRoomSnapshot) => FriendRoomStateV1,
    joinability?: 'OPEN' | 'CLOSED',
  ): Promise<FriendRoomSnapshot>;
  revokeJoinCode(sessionId: string): Promise<FriendRoomSnapshot>;
  generateJoinCode(sessionId: string): Promise<FriendRoomSnapshot>;
  leaveRoom(sessionId: string): Promise<void>;
}

function boundedMaxPlayers(value = FRIEND_ROOM_MAX_PLAYERS): number {
  if (
    !Number.isInteger(value) ||
    value < FRIEND_ROOM_MIN_PLAYERS ||
    value > FRIEND_ROOM_MAX_PLAYERS
  ) {
    throw new FriendRoomResponseError('Room settings are unavailable. Try again later.');
  }
  return value;
}

function requireSessionId(sessionId: string): string {
  const trimmed = sessionId.trim();
  if (!trimmed || trimmed.length > 128) {
    throw new FriendRoomResponseError('This room could not be opened.');
  }
  return trimmed;
}

export function mapFriendRoomResponse(
  response: GameSessionResponse,
  expectedNamespace: string,
): FriendRoomSnapshot {
  const sessionId = requireSessionId(response.id);
  if (response.namespace !== expectedNamespace) {
    throw new FriendRoomResponseError('That is not a compatible Football 11 room.');
  }
  if (response.configuration.name !== FRIEND_ROOM_TEMPLATE) {
    throw new FriendRoomResponseError('That is not a compatible Football 11 room.');
  }
  if (response.configuration.type !== 'NONE') {
    throw new FriendRoomResponseError('That is not a compatible Football 11 room.');
  }
  if (
    response.configuration.joinability !== 'OPEN' &&
    response.configuration.joinability !== 'CLOSED'
  ) {
    throw new FriendRoomResponseError('That is not a compatible Football 11 room.');
  }

  let roomState: FriendRoomStateV1 | null = null;
  try {
    roomState = readFriendRoomState(response.attributes as Record<string, unknown> | undefined);
  } catch {
    // P4-01 sessions created before the room aggregate existed remain readable,
    // but discovery filters them out as incompatible.
  }

  return {
    sessionId,
    namespace: response.namespace,
    configurationName: response.configuration.name,
    serverType: 'NONE',
    joinability: response.configuration.joinability,
    minPlayers: response.configuration.minPlayers,
    maxPlayers: response.configuration.maxPlayers,
    isActive: response.isActive,
    isFull: response.isFull,
    leaderId: response.leaderID,
    members: response.members.map((member) => ({
      userId: member.id,
      status: member.statusV2 || member.status,
      isLeader: member.id === response.leaderID,
    })),
    version: response.version,
    createdAt: response.createdAt,
    expiresAt: response.expiredAt ?? null,
    hasJoinCode: Boolean(response.code),
    joinCode: response.code ?? null,
    roomState,
  };
}

function createRequest(playerId: string, maxPlayers: number): CreateGameSessionRequest {
  const initialState = createInitialFriendRoomState(new Date().toISOString());
  return {
    attributes: {
      game: 'football-11',
      mode: 'friend-room',
      schemaVersion: 1,
      football11Room: initialState,
    },
    autoJoin: true,
    backfillTicketID: '',
    clientVersion: 'web-0.1.0',
    configurationName: FRIEND_ROOM_TEMPLATE,
    deployment: '',
    inactiveTimeout: 120,
    inviteTimeout: 60,
    joinability: 'OPEN',
    matchPool: '',
    maxPlayers,
    minPlayers: FRIEND_ROOM_MIN_PLAYERS,
    requestedRegions: [],
    serverName: '',
    teams: [{ teamID: 'players', userIDs: [playerId] }],
    textChat: false,
    ticketIDs: [],
    tieTeamsSessionLifetime: false,
    type: 'NONE',
  };
}

export class AgsSessionGateway implements SessionGateway {
  private pendingCreate: Promise<FriendRoomSnapshot> | null = null;

  constructor(
    private readonly namespace: string,
    private readonly client: GameSessionClient,
  ) {}

  static fromSdk(sdk: AccelByteSDK, namespace: string): AgsSessionGateway {
    return new AgsSessionGateway(namespace, Session.GameSessionApi(sdk));
  }

  createRoom(input: CreateFriendRoomInput): Promise<FriendRoomSnapshot> {
    if (this.pendingCreate) return this.pendingCreate;
    const maxPlayers = boundedMaxPlayers(input.maxPlayers);
    const playerId = input.playerId.trim();
    if (!playerId) {
      return Promise.reject(new FriendRoomResponseError('Sign in again to use friend rooms.'));
    }

    this.pendingCreate = this.client
      .createGamesession(createRequest(playerId, maxPlayers), {
        resolveMaxActiveSession: false,
      })
      .then(({ data }) => mapFriendRoomResponse(data, this.namespace))
      .finally(() => {
        this.pendingCreate = null;
      });
    return this.pendingCreate;
  }

  async getRoom(sessionId: string): Promise<FriendRoomSnapshot> {
    const result = await this.client.getGamesession_BySessionId(requireSessionId(sessionId));
    return mapFriendRoomResponse(result.data, this.namespace);
  }

  async listOpenRooms(): Promise<FriendRoomSnapshot[]> {
    const result = await this.client.createGamesession_ByNS();
    return result.data.data
      .filter(
        (response) =>
          response.configuration.name === FRIEND_ROOM_TEMPLATE &&
          response.configuration.type === 'NONE',
      )
      .map((response) => mapFriendRoomResponse(response, this.namespace))
      .filter(
        (room) =>
          room.isActive && !room.isFull && room.joinability === 'OPEN' && room.roomState !== null,
      );
  }

  async getMyRooms(): Promise<FriendRoomSnapshot[]> {
    const result = await this.client.getUsersMeGamesessions();
    return result.data.data
      .filter(
        (response) =>
          response.configuration.name === FRIEND_ROOM_TEMPLATE &&
          response.configuration.type === 'NONE',
      )
      .map((response) => mapFriendRoomResponse(response, this.namespace))
      .filter((room) => room.isActive && room.roomState !== null);
  }

  async joinRoom(sessionId: string): Promise<FriendRoomSnapshot> {
    const result = await this.client.createJoin_BySessionId(requireSessionId(sessionId));
    const room = mapFriendRoomResponse(result.data, this.namespace);
    if (!room.roomState)
      throw new FriendRoomResponseError('That is not a compatible Football 11 room.');
    return room;
  }

  async joinRoomByCode(code: string): Promise<FriendRoomSnapshot> {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(normalized)) {
      throw new FriendRoomResponseError('Enter a valid room code.');
    }
    const result = await this.client.createGamesessionJoinCode({ code: normalized });
    const room = mapFriendRoomResponse(result.data, this.namespace);
    if (!room.roomState)
      throw new FriendRoomResponseError('That is not a compatible Football 11 room.');
    return room;
  }

  async updateRoom(
    sessionId: string,
    update: (state: FriendRoomStateV1, room: FriendRoomSnapshot) => FriendRoomStateV1,
    joinability?: 'OPEN' | 'CLOSED',
  ): Promise<FriendRoomSnapshot> {
    const id = requireSessionId(sessionId);
    let lastConflict: unknown = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const currentResponse = (await this.client.getGamesession_BySessionId(id)).data;
      const currentRoom = mapFriendRoomResponse(currentResponse, this.namespace);
      if (!currentRoom.roomState) {
        throw new FriendRoomResponseError('That room is no longer available.');
      }
      const nextState = update(currentRoom.roomState, currentRoom);
      if (
        nextState === currentRoom.roomState &&
        (!joinability || joinability === currentRoom.joinability)
      ) {
        return currentRoom;
      }
      // The generated type models the PUT-shaped request as required fields even
      // though this PATCH endpoint accepts the changed fields plus version.
      const patch = {
        attributes: writeFriendRoomState(
          currentResponse.attributes as Record<string, unknown> | undefined,
          nextState,
        ),
        ...(joinability ? { joinability } : {}),
        version: currentRoom.version,
      } as UpdateGameSessionRequest;
      try {
        const result = await this.client.patchGamesession_BySessionId(id, patch);
        return mapFriendRoomResponse(result.data, this.namespace);
      } catch (caught) {
        if (!isConflict(caught) || attempt === 3) throw caught;
        lastConflict = caught;
      }
    }
    throw lastConflict;
  }

  async revokeJoinCode(sessionId: string): Promise<FriendRoomSnapshot> {
    const id = requireSessionId(sessionId);
    await this.client.deleteCode_BySessionId(id);
    return this.getRoom(id);
  }

  async generateJoinCode(sessionId: string): Promise<FriendRoomSnapshot> {
    const id = requireSessionId(sessionId);
    const result = await this.client.updateCode_BySessionId(id);
    return mapFriendRoomResponse(result.data, this.namespace);
  }

  async leaveRoom(sessionId: string): Promise<void> {
    await this.client.deleteLeave_BySessionId(requireSessionId(sessionId));
  }
}

function isConflict(caught: unknown): boolean {
  return (
    typeof caught === 'object' &&
    caught !== null &&
    'response' in caught &&
    typeof caught.response === 'object' &&
    caught.response !== null &&
    'status' in caught.response &&
    caught.response.status === 409
  );
}
