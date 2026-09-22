import type { AccelByteSDK } from '@accelbyte/sdk';
import { Lobby } from '@accelbyte/sdk-lobby';

const SESSION_TOPICS = new Set([
  'OnSessionJoined',
  'OnSessionMembersChanged',
  'OnGameSessionUpdated',
  'OnSessionEnded',
]);

export type LobbyConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SessionInvalidation {
  topic: string;
  sessionId: string | null;
  sequenceId: number | null;
  sequenceNumber: number | null;
}

export interface LobbyGateway {
  connect(
    onInvalidation: (event: SessionInvalidation) => void,
    onStatus: (status: LobbyConnectionStatus) => void,
  ): () => void;
}

function findSessionId(value: unknown, depth = 0): string | null {
  if (depth > 4 || !value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    if (/^(sessionid|session_id|id)$/i.test(key) && typeof child === 'string' && child) {
      return child;
    }
  }
  for (const child of Object.values(value)) {
    const found = findSessionId(child, depth + 1);
    if (found) return found;
  }
  return null;
}

function parsePayload(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
}

export class AgsLobbyGateway implements LobbyGateway {
  constructor(private readonly sdk: AccelByteSDK) {}

  connect(
    onInvalidation: (event: SessionInvalidation) => void,
    onStatus: (status: LobbyConnectionStatus) => void,
  ): () => void {
    const socket = Lobby.WebSocket(this.sdk);
    let closedByClient = false;
    onStatus('connecting');
    // The generated Lobby client only attaches callbacks after connect() has
    // created its native WebSocket instance.
    socket.connect();
    const listeners = [
      socket.onOpen(() => onStatus('connected')),
      socket.onClose(() => onStatus('disconnected')),
      socket.onError(() => {
        if (!closedByClient) onStatus('error');
      }),
      socket.onMessage((message) => {
        if (
          typeof message !== 'object' ||
          message === null ||
          message.type !== 'messageSessionNotif' ||
          !SESSION_TOPICS.has(message.topic)
        ) {
          return;
        }
        const envelope = message as typeof message & {
          sequenceID?: number;
          sequenceId?: number;
          sequenceNumber?: number;
        };
        onInvalidation({
          topic: message.topic,
          sessionId: findSessionId(parsePayload(message.payload)),
          sequenceId: envelope.sequenceID ?? envelope.sequenceId ?? null,
          sequenceNumber: envelope.sequenceNumber ?? null,
        });
      }),
    ];

    return () => {
      closedByClient = true;
      listeners.forEach((listener) => listener?.removeEventListener?.());
      socket.disconnect(1000, 'Football 11 room closed');
    };
  }
}
