export interface AgsPublicConfig {
  baseURL: string;
  namespace: string;
  clientId: string;
  redirectURI: string;
  friendRoomMaxPlayers: number;
  friendRoomRoundSeconds: number;
  friendRoomCountdownSeconds: number;
}

export interface AgsPublicEnvironment {
  baseURL?: string;
  namespace?: string;
  clientId?: string;
  redirectURI?: string;
  friendRoomMaxPlayers?: string | number;
  friendRoomRoundSeconds?: string | number;
  friendRoomCountdownSeconds?: string | number;
}

export class AgsConfigError extends Error {
  constructor(readonly missingKeys: string[]) {
    super(`Missing browser-safe AGS configuration: ${missingKeys.join(', ')}`);
    this.name = 'AgsConfigError';
  }
}

function browserEnvironment(): AgsPublicEnvironment {
  return {
    baseURL: process.env.NEXT_PUBLIC_ACCELBYTE_BASE_URL,
    namespace: process.env.NEXT_PUBLIC_ACCELBYTE_NAMESPACE,
    clientId: process.env.NEXT_PUBLIC_ACCELBYTE_CLIENT_ID,
    redirectURI: process.env.NEXT_PUBLIC_ACCELBYTE_REDIRECT_URI,
    friendRoomMaxPlayers: process.env.NEXT_PUBLIC_FRIEND_ROOM_MAX_PLAYERS,
    friendRoomRoundSeconds: process.env.NEXT_PUBLIC_FRIEND_ROOM_ROUND_SECONDS,
    friendRoomCountdownSeconds: process.env.NEXT_PUBLIC_FRIEND_ROOM_COUNTDOWN_SECONDS,
  };
}

export function readAgsPublicConfig(
  environment: AgsPublicEnvironment = browserEnvironment(),
): AgsPublicConfig {
  const missingKeys: string[] = [];
  if (!environment.baseURL) missingKeys.push('NEXT_PUBLIC_ACCELBYTE_BASE_URL');
  if (!environment.namespace) missingKeys.push('NEXT_PUBLIC_ACCELBYTE_NAMESPACE');
  if (!environment.clientId) missingKeys.push('NEXT_PUBLIC_ACCELBYTE_CLIENT_ID');
  const friendRoomMaxPlayers = Number(environment.friendRoomMaxPlayers ?? 8);
  if (
    !Number.isInteger(friendRoomMaxPlayers) ||
    friendRoomMaxPlayers < 1 ||
    friendRoomMaxPlayers > 8
  ) {
    missingKeys.push('NEXT_PUBLIC_FRIEND_ROOM_MAX_PLAYERS (integer from 1 to 8)');
  }
  const friendRoomRoundSeconds = Number(environment.friendRoomRoundSeconds ?? 900);
  if (
    !Number.isInteger(friendRoomRoundSeconds) ||
    friendRoomRoundSeconds < 30 ||
    friendRoomRoundSeconds > 3600
  ) {
    missingKeys.push('NEXT_PUBLIC_FRIEND_ROOM_ROUND_SECONDS (integer from 30 to 3600)');
  }
  const friendRoomCountdownSeconds = Number(environment.friendRoomCountdownSeconds ?? 30);
  if (
    !Number.isInteger(friendRoomCountdownSeconds) ||
    friendRoomCountdownSeconds < 3 ||
    friendRoomCountdownSeconds > 300
  ) {
    missingKeys.push('NEXT_PUBLIC_FRIEND_ROOM_COUNTDOWN_SECONDS (integer from 3 to 300)');
  }
  if (missingKeys.length > 0) throw new AgsConfigError(missingKeys);

  return {
    baseURL: environment.baseURL!.replace(/\/$/, ''),
    namespace: environment.namespace!,
    clientId: environment.clientId!,
    redirectURI:
      environment.redirectURI ??
      (typeof globalThis.location === 'undefined'
        ? 'http://127.0.0.1'
        : globalThis.location.origin),
    friendRoomMaxPlayers,
    friendRoomRoundSeconds,
    friendRoomCountdownSeconds,
  };
}
