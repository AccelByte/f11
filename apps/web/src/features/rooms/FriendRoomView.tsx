'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clipboard,
  DoorOpen,
  KeyRound,
  LoaderCircle,
  LogOut,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  TriangleAlert,
  Users,
} from 'lucide-react';

import type { LobbyConnectionStatus } from '@/src/services/ags/lobbyGateway';
import type { FriendRoomSnapshot } from '@/src/services/ags/sessionGateway';
import { canStartFriendRoom, friendRoomComparison } from '@/src/state/friendRoomMachine';

export type RoomUiStatus =
  | 'idle'
  | 'discovering'
  | 'restoring'
  | 'creating'
  | 'joining'
  | 'updating'
  | 'leaving'
  | 'ready'
  | 'error';

export type RoomPendingAction =
  | 'idle'
  | 'discovering'
  | 'restoring'
  | 'creating'
  | 'joining'
  | 'refreshing'
  | 'readying'
  | 'starting'
  | 'generating-code'
  | 'revoking-code'
  | 'leaving';

export type RoomPendingJoin = { kind: 'code' | 'id'; value: string } | null;

function roomLabel(room: FriendRoomSnapshot): string {
  return room.sessionId.slice(-8).toUpperCase();
}

function isActiveMember(status: string): boolean {
  return status === 'JOINED' || status === 'CONNECTED';
}

function phaseLabel(phase: string | null | undefined): string {
  const labels: Record<string, string> = {
    WAITING: 'Waiting for players',
    STARTING: 'Starting round',
    DRAFTING: 'Draft in progress',
    REVEAL: 'Results ready',
    COUNTDOWN: 'Next round soon',
  };
  return phase ? (labels[phase] ?? 'Room active') : 'Waiting for players';
}

function memberStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    JOINED: 'In room',
    CONNECTED: 'In room',
    DRAFTING: 'Drafting',
    FINISHED: 'Finished',
    ABANDONED: 'Left round',
    TIMED_OUT: 'Time expired',
  };
  return labels[status] ?? 'Waiting';
}

function connectionLabel(status: LobbyConnectionStatus): string {
  if (status === 'connected') return 'Live updates on';
  if (status === 'connecting') return 'Connecting updates';
  if (status === 'error') return 'Reconnecting updates';
  return 'Updates paused';
}

function joinabilityLabel(joinability: string): string {
  return joinability === 'OPEN' ? 'Open' : 'Round in progress';
}

export function FriendRoomBrowser({
  rooms,
  status,
  action,
  pendingJoin,
  message,
  onRefresh,
  onCreate,
  onJoinId,
  onJoinCode,
  onBack,
}: {
  rooms: FriendRoomSnapshot[];
  status: RoomUiStatus;
  action: RoomPendingAction;
  pendingJoin: RoomPendingJoin;
  message: string | null;
  onRefresh: () => void;
  onCreate: () => void;
  onJoinId: (sessionId: string) => void;
  onJoinCode: (code: string) => void;
  onBack: () => void;
}) {
  const [sessionId, setSessionId] = useState('');
  const [code, setCode] = useState('');
  const busy = action !== 'idle';

  return (
    <main className="room-page">
      <section className="room-header">
        <div>
          <span className="eyebrow">
            <DoorOpen size={14} aria-hidden="true" /> Friend rooms
          </span>
          <h1>Find an open room</h1>
          <p>Any compatible room with an open slot appears here. A code is optional.</p>
        </div>
        <button
          aria-busy={action === 'creating'}
          className="primary-button"
          disabled={busy}
          onClick={onCreate}
          type="button"
        >
          {action === 'creating' ? (
            <LoaderCircle className="is-spinning" size={17} aria-hidden="true" />
          ) : (
            <Users size={17} aria-hidden="true" />
          )}{' '}
          {action === 'creating' ? 'Creating room…' : 'Create room'}
        </button>
      </section>

      <div className="room-browser-grid">
        <section className="room-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Open now</span>
              <h2>{rooms.length ? `${rooms.length} available` : 'No rooms found'}</h2>
            </div>
            <button
              aria-busy={action === 'discovering'}
              aria-label={action === 'discovering' ? 'Refreshing rooms' : 'Refresh rooms'}
              className="icon-button"
              disabled={busy}
              onClick={onRefresh}
              type="button"
            >
              <RefreshCw className={action === 'discovering' ? 'is-spinning' : ''} size={18} />
            </button>
          </div>
          <div className="room-list">
            {rooms.map((room) => {
              const joiningThisRoom =
                action === 'joining' &&
                pendingJoin?.kind === 'id' &&
                pendingJoin.value === room.sessionId;
              return (
                <button
                  aria-busy={joiningThisRoom}
                  className="room-list-item"
                  disabled={busy}
                  key={room.sessionId}
                  onClick={() => onJoinId(room.sessionId)}
                  type="button"
                >
                  <span className="slot-avatar">{roomLabel(room).slice(-3)}</span>
                  <span>
                    <strong>Room {roomLabel(room)}</strong>
                    <small>
                      {room.members.length}/{room.maxPlayers} players ·{' '}
                      {phaseLabel(room.roomState?.phase)}
                    </small>
                  </span>
                  <span className="room-joinability is-open">
                    {joiningThisRoom ? (
                      <LoaderCircle className="is-spinning" size={14} aria-hidden="true" />
                    ) : null}
                    {joiningThisRoom ? 'Joining…' : 'Join'}
                  </span>
                </button>
              );
            })}
            {!rooms.length && status !== 'discovering' ? (
              <p className="room-empty">
                Create the first room, or refresh after a friend opens one.
              </p>
            ) : null}
          </div>
        </section>

        <aside className="room-panel room-direct-join">
          <span className="eyebrow">Direct join</span>
          <label>
            Room ID
            <span>
              <Search size={16} aria-hidden="true" />
              <input
                autoComplete="off"
                onChange={(event) => setSessionId(event.target.value)}
                placeholder="Paste a room ID"
                value={sessionId}
              />
            </span>
          </label>
          <button
            aria-busy={action === 'joining' && pendingJoin?.kind === 'id'}
            className="secondary-button"
            disabled={busy || !sessionId.trim()}
            onClick={() => onJoinId(sessionId)}
            type="button"
          >
            {action === 'joining' && pendingJoin?.kind === 'id' ? (
              <LoaderCircle className="is-spinning" size={16} aria-hidden="true" />
            ) : null}
            {action === 'joining' && pendingJoin?.kind === 'id' ? 'Joining by ID…' : 'Join by ID'}
          </button>
          <label>
            Optional room code
            <span>
              <KeyRound size={16} aria-hidden="true" />
              <input
                autoComplete="off"
                maxLength={16}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="ABC123"
                value={code}
              />
            </span>
          </label>
          <button
            aria-busy={action === 'joining' && pendingJoin?.kind === 'code'}
            className="secondary-button"
            disabled={busy || !code.trim()}
            onClick={() => onJoinCode(code)}
            type="button"
          >
            {action === 'joining' && pendingJoin?.kind === 'code' ? (
              <LoaderCircle className="is-spinning" size={16} aria-hidden="true" />
            ) : null}
            {action === 'joining' && pendingJoin?.kind === 'code'
              ? 'Joining by code…'
              : 'Join by code'}
          </button>
          {message ? (
            <p className={`room-message ${status === 'error' ? 'is-error' : ''}`} role="status">
              {message}
            </p>
          ) : null}
          <button className="text-button" disabled={busy} onClick={onBack} type="button">
            Back home
          </button>
        </aside>
      </div>
    </main>
  );
}

export function FriendRoomScreen({
  room,
  status,
  action,
  message,
  currentUserId,
  lobbyStatus,
  onRetry,
  onReady,
  onStart,
  onResumeDraft,
  onRevokeCode,
  onGenerateCode,
  onLeave,
  onBack,
}: {
  room: FriendRoomSnapshot | null;
  status: RoomUiStatus;
  action: RoomPendingAction;
  message: string | null;
  currentUserId: string;
  lobbyStatus: LobbyConnectionStatus;
  onRetry: () => void;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onResumeDraft: () => void;
  onRevokeCode: () => void;
  onGenerateCode: () => void;
  onLeave: () => void;
  onBack: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [copyStatus, setCopyStatus] = useState<'copied' | 'copying' | 'error' | 'idle'>('idle');
  const copyBusyRef = useRef(false);
  const copyResetTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      globalThis.clearInterval(timer);
      if (copyResetTimerRef.current !== null) {
        globalThis.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  async function copyJoinCode(): Promise<void> {
    if (!room?.joinCode || copyBusyRef.current) return;
    copyBusyRef.current = true;
    setCopyStatus('copying');
    try {
      await globalThis.navigator.clipboard.writeText(room.joinCode);
      setCopyStatus('copied');
      if (copyResetTimerRef.current !== null) {
        globalThis.clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = globalThis.setTimeout(() => setCopyStatus('idle'), 1_500);
    } catch {
      setCopyStatus('error');
      copyResetTimerRef.current = globalThis.setTimeout(() => setCopyStatus('idle'), 2_500);
    } finally {
      copyBusyRef.current = false;
    }
  }

  const busy = action !== 'idle';
  const state = room?.roomState ?? null;
  const activeMembers = useMemo(
    () =>
      room?.members
        .filter((member) => isActiveMember(member.status))
        .map((member) => member.userId) ?? [],
    [room],
  );
  const ready = state?.readyUserIds.includes(currentUserId) ?? false;
  const participant = state?.challenge?.participantUserIds.includes(currentUserId) ?? false;
  const canStart = Boolean(
    room && state && room.leaderId === currentUserId && canStartFriendRoom(state, activeMembers),
  );
  const comparison = state ? friendRoomComparison(state) : [];
  const countdownSeconds = state?.countdownEndsAt
    ? Math.max(0, Math.ceil((Date.parse(state.countdownEndsAt) - now) / 1_000))
    : null;

  if (!room) {
    return (
      <main className="room-page">
        <section className="room-loading-panel" aria-live="polite">
          {status === 'error' ? (
            <TriangleAlert size={28} aria-hidden="true" />
          ) : (
            <RefreshCw className="is-spinning" size={28} aria-hidden="true" />
          )}
          <span className="eyebrow">Friend room</span>
          <h1>{status === 'restoring' ? 'Restoring your room' : 'Opening your room'}</h1>
          <p>{message ?? 'Loading room…'}</p>
          {status === 'error' ? (
            <div className="room-actions">
              <button className="primary-button" onClick={onRetry} type="button">
                <RefreshCw size={17} aria-hidden="true" /> Retry
              </button>
              <button className="secondary-button" onClick={onBack} type="button">
                Browse rooms
              </button>
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="room-page">
      <section className="room-header">
        <div>
          <span className="eyebrow">
            <DoorOpen size={14} aria-hidden="true" /> Friend room
          </span>
          <h1>
            {state?.phase === 'WAITING' ? 'Waiting room' : `Round ${state?.roundOrdinal ?? 0}`}
          </h1>
          <p>Room {roomLabel(room)}</p>
        </div>
        <div className="room-header-badges">
          <span className={`lobby-status is-${lobbyStatus}`}>{connectionLabel(lobbyStatus)}</span>
          <span className={`room-joinability is-${room.joinability.toLowerCase()}`}>
            {joinabilityLabel(room.joinability)}
          </span>
        </div>
      </section>

      <div className="room-grid">
        <section className="room-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Members</span>
              <h2>
                {activeMembers.length}/{room.maxPlayers} active
              </h2>
            </div>
            <Users size={22} aria-hidden="true" />
          </div>
          <div className="room-roster" role="list">
            {room.members.map((member) => {
              const progress = state?.progressByUserId[member.userId];
              const optedIn = state?.readyUserIds.includes(member.userId);
              return (
                <div className="room-member" key={member.userId} role="listitem">
                  <span className="slot-avatar">
                    {member.userId === currentUserId
                      ? 'YOU'
                      : member.userId.slice(-3).toUpperCase()}
                  </span>
                  <span>
                    <strong>
                      {member.userId === currentUserId ? 'You' : 'Room member'}
                      {member.isLeader ? ' · Host' : ''}
                    </strong>
                    <small>
                      {progress
                        ? `${memberStatusLabel(progress.status)} · ${progress.selectedCount}/11`
                        : optedIn
                          ? 'Ready for next round'
                          : memberStatusLabel(member.status)}
                    </small>
                  </span>
                  <i aria-label={memberStatusLabel(member.status)} />
                </div>
              );
            })}
          </div>

          {state && ['WAITING', 'REVEAL', 'COUNTDOWN'].includes(state.phase) ? (
            <div className="room-ready-actions">
              <button
                aria-busy={action === 'readying'}
                className={`secondary-button ${ready ? 'is-ready' : ''}`}
                disabled={busy}
                onClick={() => onReady(!ready)}
                type="button"
              >
                {action === 'readying' ? (
                  <LoaderCircle className="is-spinning" size={17} aria-hidden="true" />
                ) : (
                  <Check size={17} aria-hidden="true" />
                )}{' '}
                {action === 'readying' ? 'Saving status…' : ready ? 'Ready' : 'Ready up'}
              </button>
              {room.leaderId === currentUserId ? (
                <button
                  aria-busy={action === 'starting'}
                  className="primary-button"
                  disabled={busy || !canStart}
                  onClick={onStart}
                  type="button"
                >
                  {action === 'starting' ? (
                    <LoaderCircle className="is-spinning" size={17} aria-hidden="true" />
                  ) : (
                    <Play size={17} aria-hidden="true" />
                  )}
                  {action === 'starting'
                    ? 'Starting round…'
                    : state.roundOrdinal
                      ? 'Start next round now'
                      : 'Start round'}
                </button>
              ) : (
                <p className="room-note">The host starts when the eligible players are ready.</p>
              )}
            </div>
          ) : null}

          {state?.phase === 'DRAFTING' ? (
            <div className="room-ready-actions">
              {participant ? (
                <button className="primary-button" onClick={onResumeDraft} type="button">
                  <Play size={17} aria-hidden="true" /> Resume your draft
                </button>
              ) : (
                <p className="room-note">This round is closed. You can opt in after reveal.</p>
              )}
            </div>
          ) : null}

          {state && ['REVEAL', 'COUNTDOWN'].includes(state.phase) ? (
            <div className="room-comparison">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Round comparison</span>
                  <h2>Next round in {countdownSeconds ?? '—'}s</h2>
                </div>
                <RotateCcw size={20} aria-hidden="true" />
              </div>
              {comparison.map((entry) => (
                <div className="comparison-row" key={entry.userId}>
                  <strong>{entry.rank ? `#${entry.rank}` : '—'}</strong>
                  <span>
                    {entry.userId === currentUserId
                      ? 'You'
                      : `Player ${entry.userId.slice(-3).toUpperCase()}`}
                  </span>
                  <small>
                    {entry.result
                      ? `${entry.result.points} pts · ${entry.result.wins} wins`
                      : memberStatusLabel(entry.status)}
                  </small>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <aside className="room-panel room-details">
          <span className="eyebrow">Room details</span>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{phaseLabel(state?.phase)}</dd>
            </div>
            <div>
              <dt>Capacity</dt>
              <dd>
                {room.minPlayers}–{room.maxPlayers}
              </dd>
            </div>
          </dl>
          <div className="room-code">
            <span>Optional code</span>
            {room.joinCode ? (
              <strong>{room.joinCode}</strong>
            ) : (
              <strong className="is-muted">Revoked</strong>
            )}
            {room.joinCode ? (
              <button
                aria-busy={copyStatus === 'copying'}
                aria-label={
                  copyStatus === 'copying'
                    ? 'Copying room code'
                    : copyStatus === 'copied'
                      ? 'Room code copied'
                      : copyStatus === 'error'
                        ? 'Room code copy failed'
                        : 'Copy room code'
                }
                className="icon-button"
                disabled={copyStatus === 'copying'}
                onClick={() => void copyJoinCode()}
                type="button"
              >
                {copyStatus === 'copying' ? (
                  <LoaderCircle className="is-spinning" size={17} aria-hidden="true" />
                ) : copyStatus === 'copied' ? (
                  <Check size={17} aria-hidden="true" />
                ) : copyStatus === 'error' ? (
                  <TriangleAlert size={17} aria-hidden="true" />
                ) : (
                  <Clipboard size={17} aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>
          {room.leaderId === currentUserId ? (
            <button
              aria-busy={action === 'generating-code' || action === 'revoking-code'}
              className="text-button"
              disabled={busy}
              onClick={room.joinCode ? onRevokeCode : onGenerateCode}
              type="button"
            >
              {action === 'generating-code' || action === 'revoking-code' ? (
                <LoaderCircle className="is-spinning" size={15} aria-hidden="true" />
              ) : null}
              {action === 'generating-code'
                ? 'Generating code…'
                : action === 'revoking-code'
                  ? 'Revoking code…'
                  : room.joinCode
                    ? 'Revoke optional code'
                    : 'Generate a new code'}
            </button>
          ) : null}
          <p className="room-note">
            Players can join between rounds. The room is locked while a draft is underway.
          </p>
          {message ? (
            <p className={`room-message ${status === 'error' ? 'is-error' : ''}`} role="status">
              {message}
            </p>
          ) : null}
          <div className="room-actions room-actions-column">
            <button
              aria-busy={action === 'refreshing'}
              className="secondary-button"
              disabled={busy}
              onClick={onRetry}
              type="button"
            >
              <RefreshCw
                className={action === 'refreshing' ? 'is-spinning' : ''}
                size={17}
                aria-hidden="true"
              />{' '}
              {action === 'refreshing' ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              aria-busy={action === 'leaving'}
              className="secondary-button leave-room-button"
              disabled={busy}
              onClick={onLeave}
              type="button"
            >
              {action === 'leaving' ? (
                <LoaderCircle className="is-spinning" size={17} aria-hidden="true" />
              ) : (
                <LogOut size={17} aria-hidden="true" />
              )}
              {action === 'leaving' ? 'Leaving…' : 'Leave room'}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
