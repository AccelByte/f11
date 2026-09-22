'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleUserRound,
  Dices,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Swords,
  TriangleAlert,
  Trophy,
  Users,
} from 'lucide-react';
import {
  FORMATION_4_3_3_SLOTS,
  POSITION_BY_SLOT,
  type DraftOfferCard,
  type DraftSnapshot,
  type JsonValue,
  type RunResult,
  type SlotCode,
} from '@football-11/domain';
import type {
  FriendRoomResultSummaryV1,
  LocalRunRecordV1,
  TrustedRunSubmissionResponseV1,
} from '@football-11/contracts';

import {
  FriendRoomBrowser,
  FriendRoomScreen as Phase4RoomScreen,
  type RoomPendingAction,
  type RoomPendingJoin,
  type RoomUiStatus,
} from '@/src/features/rooms/FriendRoomView';
import { SavedXiCompetitionView } from '@/src/features/competition/SavedXiCompetitionView';
import { catalogue, playerById, teamByCode } from '@/src/game/content';
import { orderOfferCardsForSelection } from '@/src/game/offerPresentation';
import {
  createGameSession,
  createGameSessionFromChallenge,
  deriveFriendRoomPlayerSeed,
  rerollOffer,
  selectPlayer,
  type GameSession,
} from '@/src/game/session';
import type { AgsAuthGateway } from '@/src/services/ags/authGateway';
import { AgsConfigError, readAgsPublicConfig } from '@/src/services/ags/config';
import { DeviceGuestAuth } from '@/src/services/ags/deviceAuth';
import { requestDraftChallenge } from '@/src/services/ags/draftChallenges';
import { getStoredDeviceId } from '@/src/services/ags/deviceIdentity';
import {
  authErrorMessage,
  cloudSaveErrorMessage,
  roomErrorMessage,
} from '@/src/services/ags/errors';
import type { LobbyConnectionStatus, LobbyGateway } from '@/src/services/ags/lobbyGateway';
import type { FriendRoomSnapshot, SessionGateway } from '@/src/services/ags/sessionGateway';
import {
  abandonFriendRoomParticipant,
  beginFriendRoomCountdown,
  beginFriendRoomDraft,
  canStartFriendRoom,
  isFriendRoomCountdownDue,
  revealFriendRoom,
  setMemberReady,
  shouldRevealFriendRoom,
  startFriendRoomRound,
  updateFriendRoomProgress,
} from '@/src/state/friendRoomMachine';
import { submitTrustedRun } from '@/src/services/ags/trustedRanking';
import { loadRoomDraft, roomDraftStorageKey } from '@/src/services/local/roomDraftStore';
import {
  createLocalRunRecord,
  restoreLatestCloudRun,
  saveLatestCloudRun,
} from '@/src/services/local/runStore';

type Screen = 'home' | 'rooms' | 'room' | 'draft' | 'result' | 'competition';
type AuthStatus =
  | 'initializing'
  | 'idle'
  | 'restoring'
  | 'logging-in'
  | 'verifying'
  | 'authenticated'
  | 'error'
  | 'configuration-error';
type RankingStatus = 'idle' | 'submitting' | 'success' | 'error';

const ROOM_SESSION_STORAGE_KEY = 'football11.ags.friend-room.session.v1';

const SLOT_LAYOUT: Record<SlotCode, { left: string; top: string }> = {
  GK: { left: '50%', top: '86%' },
  LB: { left: '14%', top: '67%' },
  LCB: { left: '38%', top: '71%' },
  RCB: { left: '62%', top: '71%' },
  RB: { left: '86%', top: '67%' },
  DM: { left: '50%', top: '53%' },
  CM: { left: '31%', top: '42%' },
  AM: { left: '69%', top: '34%' },
  LW: { left: '16%', top: '16%' },
  CF: { left: '50%', top: '11%' },
  RW: { left: '84%', top: '16%' },
};

const CATEGORY_LABELS = {
  quality: 'Quality',
  positioning: 'Positioning',
  chemistry: 'Chemistry',
  tacticalBalance: 'Tactical balance',
  leadership: 'Leadership',
} as const;

const CATEGORY_ENTRIES = [
  ['quality', 'Quality'],
  ['positioning', 'Positioning'],
  ['chemistry', 'Chemistry'],
  ['tacticalBalance', 'Tactical balance'],
  ['leadership', 'Leadership'],
] as const satisfies ReadonlyArray<[keyof typeof CATEGORY_LABELS, string]>;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatFactValue(value: JsonValue): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null) return '—';
  return JSON.stringify(value);
}

function factLabel(key: string): string {
  const raw = key.split('.').at(-1) ?? key;
  const spaced = raw.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function Brand() {
  return (
    <div className="brand" aria-label="Football 11">
      <span className="brand-mark">F/11</span>
      <span className="brand-copy">
        <strong>Football 11</strong>
        <small>Selection room</small>
      </span>
    </div>
  );
}

function IdentityChip({ guestId, status }: { guestId: string | null; status: AuthStatus }) {
  const busy =
    status === 'initializing' ||
    status === 'restoring' ||
    status === 'logging-in' ||
    status === 'verifying';
  return (
    <div className="identity-chip">
      <CircleUserRound aria-hidden="true" size={18} />
      <span>
        <small>{guestId ? 'Guest player' : 'Player profile'}</small>
        <strong>
          {guestId
            ? `Guest ${guestId.slice(-4).toUpperCase()}`
            : busy
              ? 'Connecting…'
              : 'Not signed in'}
        </strong>
      </span>
      <span
        className={`identity-dot ${guestId ? 'is-ready' : ''}`}
        aria-label={guestId ? 'Player connected' : 'Player not connected'}
      />
    </div>
  );
}

function Pitch({
  snapshot,
  selectedCard,
  onChooseSlot,
  result,
}: {
  snapshot?: DraftSnapshot;
  selectedCard?: DraftOfferCard | null;
  onChooseSlot?: (slot: SlotCode) => void;
  result?: RunResult;
}) {
  const roster =
    snapshot?.state.roster ??
    Object.fromEntries(
      result?.roster.map((assignment) => [assignment.slotId, assignment.playerSeasonId]) ?? [],
    );

  return (
    <div className="pitch-shell">
      <div className="pitch" aria-label="4-3-3 formation">
        <span className="pitch-halfway" />
        <span className="pitch-circle" />
        <span className="pitch-box pitch-box-top" />
        <span className="pitch-box pitch-box-bottom" />
        {FORMATION_4_3_3_SLOTS.map((formationSlot) => {
          const slot = formationSlot.id;
          const playerSeasonId = roster[slot];
          const player = playerSeasonId ? playerById.get(playerSeasonId) : undefined;
          const isLegal =
            player === undefined && selectedCard?.safeSlotCodes.includes(slot) === true;
          const previewRating = selectedCard?.ratingsBySlot[slot];
          const placedRating = player?.ratingsByPosition[POSITION_BY_SLOT[slot]];
          return (
            <button
              className={`formation-slot ${player ? 'is-filled' : ''} ${isLegal ? 'is-legal' : ''}`}
              disabled={!isLegal || !onChooseSlot}
              key={slot}
              onClick={() => onChooseSlot?.(slot)}
              style={SLOT_LAYOUT[slot]}
              type="button"
              aria-label={
                player
                  ? `${slot}: ${player.displayName}, rating ${placedRating}`
                  : isLegal
                    ? `Place selected player at ${slot}, rating ${previewRating}`
                    : `${slot}: open`
              }
            >
              <span className="slot-avatar">{player ? initials(player.displayName) : slot}</span>
              <span className="slot-copy">
                <strong>{player?.displayName ?? (isLegal ? `Place at ${slot}` : 'Open')}</strong>
                <small>
                  {player
                    ? `${slot} · ${placedRating}`
                    : isLegal
                      ? `Rating ${previewRating}`
                      : slot}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HomeScreen({
  onStart,
  onCreateRoom,
  onCompetition,
  onAuthenticate,
  onViewLast,
  ready,
  authStatus,
  authMessage,
  lastRun,
  storageMessage,
  storageError,
  canRetryCloud,
  onRetryCloud,
  storageBusy,
  startBusy,
  startMessage,
}: {
  onStart: () => void;
  onCreateRoom: () => void;
  onCompetition: () => void;
  onAuthenticate: () => void;
  onViewLast: () => void;
  ready: boolean;
  authStatus: AuthStatus;
  authMessage: string | null;
  lastRun: LocalRunRecordV1 | null;
  storageMessage: string | null;
  storageError: boolean;
  canRetryCloud: boolean;
  onRetryCloud: () => void;
  storageBusy: boolean;
  startBusy: boolean;
  startMessage: string | null;
}) {
  const authBusy =
    authStatus === 'initializing' ||
    authStatus === 'restoring' ||
    authStatus === 'logging-in' ||
    authStatus === 'verifying';
  const authButtonLabel =
    authStatus === 'initializing'
      ? 'Preparing services…'
      : authStatus === 'restoring'
        ? 'Restoring guest…'
        : authStatus === 'logging-in'
          ? 'Signing in…'
          : authStatus === 'verifying'
            ? 'Verifying player…'
            : authStatus === 'error'
              ? 'Retry guest login'
              : 'Continue as guest';

  return (
    <main className="home-grid">
      <section className="hero-copy">
        <span className="eyebrow">
          <Sparkles size={14} aria-hidden="true" /> The six-minute football draft
        </span>
        <h1>
          Eleven choices.
          <br />
          <em>One full season.</em>
        </h1>
        <p className="hero-lede">
          Build a complete 4‑3‑3 from five Premier League seasons. Every club-role rating is
          visible, and every choice shapes a full 38-match season.
        </p>
        <button
          aria-busy={authBusy || startBusy}
          className="primary-button"
          disabled={authBusy || startBusy || authStatus === 'configuration-error'}
          onClick={ready ? onStart : onAuthenticate}
          type="button"
        >
          {authBusy || startBusy ? (
            <LoaderCircle className="is-spinning" size={19} aria-hidden="true" />
          ) : ready ? (
            <Dices size={19} aria-hidden="true" />
          ) : (
            <CircleUserRound size={19} aria-hidden="true" />
          )}
          {ready ? (startBusy ? 'Starting draft…' : 'Start random draft') : authButtonLabel}{' '}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
        {ready && !startBusy ? (
          <button className="secondary-button room-button" onClick={onCreateRoom} type="button">
            <Users size={17} aria-hidden="true" /> Play with friends
          </button>
        ) : null}
        {ready && !startBusy ? (
          <button className="secondary-button" onClick={onCompetition} type="button">
            <Swords size={17} aria-hidden="true" /> Saved-XI competition
          </button>
        ) : null}
        {lastRun ? (
          <button className="secondary-button" onClick={onViewLast} type="button">
            <Trophy size={17} aria-hidden="true" /> View last result ·{' '}
            {lastRun.result.season.points} pts
          </button>
        ) : null}
        {startMessage ? (
          <p className="auth-message is-error" role="status">
            {startMessage}
          </p>
        ) : !ready ? (
          <p
            className={`auth-message ${authStatus === 'error' || authStatus === 'configuration-error' ? 'is-error' : ''}`}
            role="status"
          >
            {authMessage ??
              'Guest progress is linked to this browser. Account linking is not available yet, so clearing browser data can remove access to this guest.'}
          </p>
        ) : (
          <p className="auth-message" role="status">
            {authMessage ?? 'Guest profile ready. Your progress can be saved online.'}
          </p>
        )}
        {storageMessage ? (
          <div className="storage-status">
            <p className={`storage-message ${storageError ? 'is-error' : ''}`} role="status">
              {storageMessage}
            </p>
            {canRetryCloud ? (
              <button
                aria-busy={storageBusy}
                className="sync-retry-button"
                disabled={storageBusy}
                onClick={onRetryCloud}
                type="button"
              >
                {storageBusy ? (
                  <LoaderCircle className="is-spinning" size={15} aria-hidden="true" />
                ) : null}
                {storageBusy ? 'Retrying save…' : 'Retry save'}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="hero-proof" aria-label="Game features">
          <span>
            <Check size={15} /> 11 rounds
          </span>
          <span>
            <Check size={15} /> Live-configured rerolls
          </span>
          <span>
            <Check size={15} /> 38 matches
          </span>
        </div>
      </section>
      <section className="hero-board" aria-label="Formation preview">
        <div className="board-stamp">Random challenge</div>
        <Pitch />
        <div className="board-caption">
          <span>Formation</span>
          <strong>4–3–3</strong>
          <span>Player pool</span>
          <strong>{catalogue.summary.playerCount.toLocaleString()}</strong>
        </div>
      </section>
    </main>
  );
}

function offerRatingTone(slot: SlotCode): 'defender' | 'forward' | 'goalkeeper' | 'midfielder' {
  if (slot === 'GK') return 'goalkeeper';
  if (slot === 'LW' || slot === 'CF' || slot === 'RW') return 'forward';
  if (slot === 'DM' || slot === 'CM' || slot === 'AM') return 'midfielder';
  return 'defender';
}

function OfferEntry({
  card,
  rank,
  active,
  onSelect,
}: {
  card: DraftOfferCard;
  rank: number;
  active: boolean;
  onSelect: () => void;
}) {
  const player = playerById.get(card.playerSeasonId);
  if (!player) return null;
  return (
    <button
      type="button"
      className={`offer-entry ${active ? 'is-active' : ''}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <span className="offer-rank">{String(rank).padStart(2, '0')}</span>
      <span className="offer-player-copy">
        <strong className="offer-player-name">{player.displayName}</strong>
        <span className="offer-ratings" aria-label="Legal position ratings">
          {card.safeSlotCodes.map((slot) => (
            <span className={`offer-rating offer-rating--${offerRatingTone(slot)}`} key={slot}>
              <small>{slot}</small>
              <strong>{card.ratingsBySlot[slot]}</strong>
            </span>
          ))}
        </span>
      </span>
      <span className="offer-entry-action" aria-hidden="true">
        <ChevronRight size={15} />
      </span>
    </button>
  );
}

export function DraftScreen({
  session,
  onChange,
}: {
  session: GameSession;
  onChange: (next: GameSession) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const offer = session.snapshot.offer;
  const selectedCard = offer?.cards.find((card) => card.playerSeasonId === selectedId) ?? null;
  const club = offer
    ? (teamByCode.get(offer.constraint.clubCode) ?? offer.constraint.clubCode)
    : '';
  const orderedCards = offer ? orderOfferCardsForSelection(offer.cards) : [];
  const selectedCount = Object.keys(session.snapshot.state.roster).length;

  function place(slot: SlotCode) {
    if (!selectedId) return;
    try {
      setError(null);
      onChange(selectPlayer(session, selectedId, slot));
      setSelectedId(null);
    } catch {
      setError('That player could not be placed there. Choose a highlighted position.');
    }
  }

  function reroll() {
    try {
      setError(null);
      onChange(rerollOffer(session));
      setSelectedId(null);
    } catch {
      setError('The offer could not be refreshed. Try again.');
    }
  }

  if (!offer) return null;

  return (
    <main className="draft-page">
      <section className="draft-scoreboard" aria-label="Draft status">
        <div>
          <small>Round</small>
          <strong>
            {session.snapshot.state.round}
            <span>/11</span>
          </strong>
        </div>
        <div>
          <small>Selected</small>
          <strong>
            {selectedCount}
            <span>/11</span>
          </strong>
        </div>
        <div>
          <small>Rerolls</small>
          <strong>
            {session.snapshot.state.rerollsRemaining}
            <span>/{session.draftConfig.maxRerolls}</span>
          </strong>
        </div>
        <div className="constraint-readout">
          <small>Current constraint</small>
          <strong>{club}</strong>
          <span>{offer.constraint.eraCode}</span>
        </div>
      </section>

      <div className="draft-grid">
        <section className="formation-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Your XI</span>
              <h2>Build the shape</h2>
            </div>
            <span className="formation-chip">4–3–3</span>
          </div>
          <Pitch snapshot={session.snapshot} selectedCard={selectedCard} onChooseSlot={place} />
          <p className="pitch-instruction" aria-live="polite">
            {selectedCard
              ? `${playerById.get(selectedCard.playerSeasonId)?.displayName ?? 'Player'} selected. Choose any highlighted position.`
              : 'Choose one player, then place them in a highlighted position.'}
          </p>
        </section>

        <section className="offer-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Scouting desk</span>
              <h2>Choose one</h2>
            </div>
            <button
              className="reroll-button"
              disabled={!offer.rerollAvailable}
              onClick={reroll}
              type="button"
              title={offer.rerollUnavailableReason ?? 'Replace the team and all offered players'}
            >
              <RotateCcw size={16} aria-hidden="true" /> Reroll team
              <span>{session.snapshot.state.rerollsRemaining}</span>
            </button>
          </div>
          <p className="offer-note">Every legal position and its exact rating remain visible.</p>
          <div className="offer-list-frame">
            <div className="offer-list-header" aria-hidden="true">
              <span>#</span>
              <span className="offer-list-labels">
                <span>Player</span>
                <span>Ratings</span>
              </span>
              <span />
            </div>
            <div className="offer-list">
              {orderedCards.map((card, index) => (
                <OfferEntry
                  key={card.playerSeasonId}
                  card={card}
                  rank={index + 1}
                  active={selectedId === card.playerSeasonId}
                  onSelect={() => setSelectedId(card.playerSeasonId)}
                />
              ))}
            </div>
          </div>
          {error ? (
            <p className="error-banner" role="alert">
              {error}
            </p>
          ) : null}
          {!offer.rerollAvailable && session.snapshot.state.rerollsRemaining > 0 ? (
            <p className="quiet-note">
              No different team can provide a safe replacement offer. Your rerolls remain available
              for another round.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value.toFixed(1)}</strong>
      <div>
        <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function ResultScreen({
  result,
  onAgain,
  persistenceMessage,
  persistenceError,
  canRetryCloud,
  onRetryCloud,
  rankingStatus,
  ranking,
  rankingMessage,
  canRank,
  onRank,
  onCompetition,
  canCompete,
  startBusy,
  startMessage,
  storageBusy,
}: {
  result: RunResult;
  onAgain: () => void;
  persistenceMessage: string | null;
  persistenceError: boolean;
  canRetryCloud: boolean;
  onRetryCloud: () => void;
  rankingStatus: RankingStatus;
  ranking: TrustedRunSubmissionResponseV1 | null;
  rankingMessage: string | null;
  canRank: boolean;
  onRank: () => void;
  onCompetition: () => void;
  canCompete: boolean;
  startBusy: boolean;
  startMessage: string | null;
  storageBusy: boolean;
}) {
  const leaderboard = ranking?.leaderboard ?? null;
  return (
    <main className="result-page">
      <section className="result-hero">
        <div>
          <span className="eyebrow">
            <Trophy size={14} aria-hidden="true" /> Season complete
          </span>
          <h1>
            {result.season.points}
            <small>PTS</small>
          </h1>
          <p>{result.explanation.summary}</p>
          <div className="record-strip" aria-label="Season record">
            <span>
              <strong>{result.season.wins}</strong> Wins
            </span>
            <span>
              <strong>{result.season.draws}</strong> Draws
            </span>
            <span>
              <strong>{result.season.losses}</strong> Losses
            </span>
          </div>
          <div className={`authority-note ${ranking ? 'is-trusted' : ''}`}>
            <ShieldCheck size={17} /> {ranking ? 'Verified result' : 'Season result ready'}
          </div>
          {persistenceMessage ? (
            <div className="persistence-status">
              <div
                className={`persistence-note ${persistenceError ? 'is-error' : ''}`}
                role="status"
              >
                {persistenceError ? (
                  <TriangleAlert size={16} aria-hidden="true" />
                ) : (
                  <Check size={16} aria-hidden="true" />
                )}{' '}
                {persistenceMessage}
              </div>
              {canRetryCloud ? (
                <button
                  aria-busy={storageBusy}
                  className="sync-retry-button"
                  disabled={storageBusy}
                  onClick={onRetryCloud}
                  type="button"
                >
                  {storageBusy ? (
                    <LoaderCircle className="is-spinning" size={15} aria-hidden="true" />
                  ) : null}
                  {storageBusy ? 'Retrying save…' : 'Retry save'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="result-actions">
          <button
            aria-busy={rankingStatus === 'submitting'}
            className="primary-button rank-button"
            disabled={!canRank || rankingStatus === 'submitting'}
            onClick={onRank}
            type="button"
          >
            {rankingStatus === 'submitting' ? (
              <LoaderCircle className="is-spinning" size={18} aria-hidden="true" />
            ) : (
              <ShieldCheck size={18} />
            )}
            {rankingStatus === 'submitting'
              ? 'Verifying result…'
              : ranking
                ? 'Refresh ranking'
                : 'Verify and rank this result'}
          </button>
          <button
            className="secondary-button"
            disabled={!canCompete}
            onClick={onCompetition}
            type="button"
          >
            <Swords size={18} />
            {ranking ? 'Publish or challenge with this XI' : 'Open Saved-XI competition'}
          </button>
          <button
            aria-busy={startBusy}
            className="secondary-button"
            disabled={startBusy}
            onClick={onAgain}
            type="button"
          >
            {startBusy ? (
              <LoaderCircle className="is-spinning" size={18} aria-hidden="true" />
            ) : (
              <Dices size={18} />
            )}{' '}
            {startBusy ? 'Starting draft…' : 'Draft again'}
          </button>
          {startMessage ? (
            <p className="result-action-message is-error" role="alert">
              {startMessage}
            </p>
          ) : null}
        </div>
      </section>

      <div className="result-grid">
        <section className="formation-panel result-formation">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Final team</span>
              <h2>Your Football 11</h2>
            </div>
            <span className="formation-chip">4–3–3</span>
          </div>
          <Pitch result={result} />
        </section>
        <section className="result-analysis">
          <div className="analysis-card">
            <span className="eyebrow">Squad assessment</span>
            <h2>{result.assessment.composite.toFixed(1)} overall</h2>
            <div className="metric-list">
              {CATEGORY_ENTRIES.map(([key, label]) => (
                <MetricBar key={key} label={label} value={result.assessment.categories[key]} />
              ))}
            </div>
          </div>
          <div className="unit-grid">
            {Object.entries(result.assessment.units).map(([label, value]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{value.toFixed(1)}</strong>
              </div>
            ))}
          </div>
          <div className="analysis-card explanation-card">
            <span className="eyebrow">Why this result</span>
            {result.explanation.facts.map((fact) => (
              <p key={fact.key}>
                <span data-polarity={fact.polarity}>{fact.polarity}</span>
                <strong>{factLabel(fact.key)}</strong>
                <em>{formatFactValue(fact.value)}</em>
              </p>
            ))}
          </div>
          <div className="analysis-card leaderboard-card">
            <div className="leaderboard-heading">
              <div>
                <span className="eyebrow">All-time leaderboard</span>
                <h2>{leaderboard?.rank ? `Rank #${leaderboard.rank}` : 'Your ranking'}</h2>
              </div>
              {leaderboard ? <strong>{leaderboard.bestPoints} pts best</strong> : null}
            </div>
            {rankingStatus === 'idle' ? (
              <p>Verify this result to add your score to the all-time leaderboard.</p>
            ) : null}
            {rankingStatus === 'submitting' ? <p role="status">Verifying your result…</p> : null}
            {rankingStatus === 'error' ? (
              <div className="ranking-error" role="alert">
                <TriangleAlert size={17} aria-hidden="true" />
                <p>{rankingMessage}</p>
                <button
                  className="sync-retry-button"
                  disabled={!canRank}
                  onClick={onRank}
                  type="button"
                >
                  Retry ranking
                </button>
              </div>
            ) : null}
            {rankingStatus === 'success' && leaderboard ? (
              <>
                <p
                  className={`ranking-message ${leaderboard.status === 'stale' ? 'is-stale' : ''}`}
                  role="status"
                >
                  {rankingMessage}
                </p>
                {leaderboard.entries.length > 0 ? (
                  <ol className="leaderboard-list" aria-label="Nearby all-time rankings">
                    {leaderboard.entries.map((entry) => (
                      <li
                        className={entry.isCurrentPlayer ? 'is-current' : ''}
                        key={`${entry.rank}-${entry.label}`}
                      >
                        <span>#{entry.rank}</span>
                        <strong>{entry.label}</strong>
                        <em>{entry.points} pts</em>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="leaderboard-empty">No ranked entries are visible yet.</p>
                )}
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  const [guestId, setGuestId] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('initializing');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [session, setSession] = useState<GameSession | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [lastRun, setLastRun] = useState<LocalRunRecordV1 | null>(null);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [openRooms, setOpenRooms] = useState<FriendRoomSnapshot[]>([]);
  const [room, setRoom] = useState<FriendRoomSnapshot | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomUiStatus>('idle');
  const [roomMessage, setRoomMessage] = useState<string | null>(null);
  const [roomAction, setRoomAction] = useState<RoomPendingAction>('idle');
  const [pendingRoomJoin, setPendingRoomJoin] = useState<RoomPendingJoin>(null);
  const [lobbyStatus, setLobbyStatus] = useState<LobbyConnectionStatus>('disconnected');
  const authRef = useRef<DeviceGuestAuth | null>(null);
  const agsGatewayRef = useRef<AgsAuthGateway | null>(null);
  const sessionGatewayRef = useRef<SessionGateway | null>(null);
  const lobbyGatewayRef = useRef<LobbyGateway | null>(null);
  const lobbyDisconnectRef = useRef<(() => void) | null>(null);
  const roomRef = useRef<FriendRoomSnapshot | null>(null);
  const screenRef = useRef<Screen>('home');
  const roomWriteRef = useRef<Promise<void>>(Promise.resolve());
  const coordinatorBusyRef = useRef(false);
  const roomActionRef = useRef<RoomPendingAction>('idle');
  const authBusyRef = useRef(false);
  const startBusyRef = useRef(false);
  const rankingBusyRef = useRef(false);
  const storageBusyRef = useRef(false);
  const roomMaxPlayersRef = useRef(8);
  const roundSecondsRef = useRef(900);
  const countdownSecondsRef = useRef(30);
  const [canRetryCloud, setCanRetryCloud] = useState(false);
  const [storageBusy, setStorageBusy] = useState(false);
  const [rankingStatus, setRankingStatus] = useState<RankingStatus>('idle');
  const [ranking, setRanking] = useState<TrustedRunSubmissionResponseV1 | null>(null);
  const [rankingMessage, setRankingMessage] = useState<string | null>(null);
  const [startBusy, setStartBusy] = useState(false);
  const [startMessage, setStartMessage] = useState<string | null>(null);

  function beginRoomAction(action: Exclude<RoomPendingAction, 'idle'>): boolean {
    if (roomActionRef.current !== 'idle') return false;
    roomActionRef.current = action;
    setRoomAction(action);
    return true;
  }

  function finishRoomAction(action: Exclude<RoomPendingAction, 'idle'>): void {
    if (roomActionRef.current !== action) return;
    roomActionRef.current = 'idle';
    setRoomAction('idle');
  }

  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    screenRef.current = screen;
    globalThis.scrollTo({ top: 0 });
  }, [screen]);

  useEffect(() => {
    let cancelled = false;
    void initializeBrowserServices();

    async function initializeBrowserServices() {
      try {
        // The AGS SDK is browser-facing. Deferring its module evaluation until
        // hydration keeps the Sites Worker free to server-render the root page.
        const { AgsAuthGateway } = await import('@/src/services/ags/authGateway');
        if (cancelled) return;
        const config = readAgsPublicConfig();
        const gateway = new AgsAuthGateway(config);
        const auth = new DeviceGuestAuth(gateway);
        agsGatewayRef.current = gateway;
        authRef.current = auth;
        roomMaxPlayersRef.current = config.friendRoomMaxPlayers;
        roundSecondsRef.current = config.friendRoomRoundSeconds;
        countdownSecondsRef.current = config.friendRoomCountdownSeconds;
        if (getStoredDeviceId(globalThis.localStorage)) {
          authBusyRef.current = true;
          setAuthStatus('restoring');
          setAuthMessage('Restoring the AccelByte guest linked to this browser…');
          void auth
            .authenticate(globalThis.localStorage, (progress) => {
              if (!cancelled) setAuthStatus(progress);
            })
            .then(async (identity) => {
              if (cancelled) return;
              setGuestId(identity.userId);
              setAuthStatus('verifying');
              setAuthMessage('Restoring your latest progress…');
              const authenticatedSessions = gateway.createSessionGateway();
              const authenticatedLobby = gateway.createLobbyGateway();
              sessionGatewayRef.current = authenticatedSessions;
              lobbyGatewayRef.current = authenticatedLobby;
              connectLobby(authenticatedLobby, authenticatedSessions);
              await restoreStoredRoom(authenticatedSessions, () => !cancelled);
              await reconcileCloudAfterLogin(gateway, identity.userId);
              if (cancelled) return;
              setAuthStatus('authenticated');
              setAuthMessage('Guest profile restored.');
            })
            .catch((caught: unknown) => {
              if (cancelled) return;
              setAuthStatus('error');
              setAuthMessage(authErrorMessage(caught));
            })
            .finally(() => {
              authBusyRef.current = false;
            });
        } else {
          setAuthStatus('idle');
        }
      } catch (caught) {
        if (cancelled) return;
        setAuthStatus('configuration-error');
        setAuthMessage(
          caught instanceof AgsConfigError
            ? 'Online services are unavailable. Reload the page and try again.'
            : authErrorMessage(caught),
        );
      }
    }

    return () => {
      cancelled = true;
      lobbyDisconnectRef.current?.();
      lobbyDisconnectRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!room?.sessionId) return;
    const refresh = () => {
      const gateway = sessionGatewayRef.current;
      if (!gateway || roomActionRef.current !== 'idle') return;
      void gateway
        .getRoom(room.sessionId)
        .then((next) => {
          setRoom(next);
          setRoomStatus('ready');
        })
        .catch((caught: unknown) => {
          setRoomStatus('error');
          setRoomMessage(roomErrorMessage(caught));
        });
    };
    const timer = globalThis.setInterval(refresh, 4_000);
    globalThis.addEventListener('focus', refresh);
    return () => {
      globalThis.clearInterval(timer);
      globalThis.removeEventListener('focus', refresh);
    };
  }, [room?.sessionId]);

  useEffect(() => {
    if (screen !== 'rooms') return;
    const timer = globalThis.setInterval(() => void refreshOpenRooms(false), 8_000);
    return () => globalThis.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    const state = room?.roomState;
    if (!guestId || !state?.challenge || state.phase !== 'DRAFTING') return;
    const progress = state.progressByUserId[guestId];
    if (!progress) return;
    if (['FINISHED', 'ABANDONED', 'TIMED_OUT'].includes(progress.status)) {
      if (screen === 'draft') setScreen('room');
      return;
    }
    const playerSeed = deriveFriendRoomPlayerSeed(state.challenge, guestId);
    // A completed result is held in memory before its AGS progress update. Keep
    // the player in the room while that write is in flight instead of opening
    // a fresh draft for the same challenge during the short consistency gap.
    if (
      session?.challengeId === state.challenge.challengeId &&
      session.seed === playerSeed &&
      session.resolved
    ) {
      if (screen === 'draft') setScreen('room');
      return;
    }
    if (
      screen === 'draft' &&
      session?.challengeId === state.challenge.challengeId &&
      session.seed === playerSeed
    ) {
      return;
    }

    const candidate = loadRoomDraft(globalThis.sessionStorage, state.challenge, guestId);
    const restored = candidate && !candidate.resolved ? candidate : null;
    setSession(restored ?? createGameSessionFromChallenge(state.challenge, guestId));
    setResult(null);
    setScreen('draft');
  }, [guestId, room, screen, session?.challengeId]);

  useEffect(() => {
    const current = room?.roomState;
    if (!guestId || !room || !current || room.leaderId !== guestId || coordinatorBusyRef.current) {
      return;
    }
    const gateway = sessionGatewayRef.current;
    if (!gateway) return;
    const coordinatorGateway = gateway;
    const coordinatorState = current;
    const coordinatorRoom = room;

    async function coordinate() {
      coordinatorBusyRef.current = true;
      try {
        let next: FriendRoomSnapshot | null = null;
        const now = new Date().toISOString();
        if (coordinatorState.phase === 'STARTING') {
          next = await coordinatorGateway.updateRoom(coordinatorRoom.sessionId, (state) =>
            state.phase === 'STARTING' ? beginFriendRoomDraft(state, now) : state,
          );
        } else if (
          coordinatorState.phase === 'DRAFTING' &&
          shouldRevealFriendRoom(coordinatorState, now)
        ) {
          next = await coordinatorGateway.updateRoom(
            coordinatorRoom.sessionId,
            (state) =>
              state.phase === 'DRAFTING' && shouldRevealFriendRoom(state, now)
                ? revealFriendRoom(state, now, countdownSecondsRef.current)
                : state,
            'OPEN',
          );
        } else if (coordinatorState.phase === 'REVEAL') {
          next = await coordinatorGateway.updateRoom(coordinatorRoom.sessionId, (state) =>
            state.phase === 'REVEAL' ? beginFriendRoomCountdown(state, now) : state,
          );
        } else if (
          coordinatorState.phase === 'COUNTDOWN' &&
          isFriendRoomCountdownDue(coordinatorState, now)
        ) {
          const active = coordinatorRoom.members
            .filter((member) => member.status === 'JOINED' || member.status === 'CONNECTED')
            .map((member) => member.userId);
          if (canStartFriendRoom(coordinatorState, active)) {
            await startRoomNow();
            return;
          }
        }
        if (next) setRoom(next);
      } catch (caught) {
        setRoomStatus('error');
        setRoomMessage(roomErrorMessage(caught));
      } finally {
        coordinatorBusyRef.current = false;
      }
    }

    void coordinate();
  }, [guestId, room]);

  const contentLabel = useMemo(() => 'Premier League 2023/24 named squad pool', []);

  function connectLobby(lobby: LobbyGateway, sessions: SessionGateway) {
    lobbyDisconnectRef.current?.();
    lobbyDisconnectRef.current = lobby.connect((event) => {
      const storedSessionId = globalThis.sessionStorage.getItem(ROOM_SESSION_STORAGE_KEY);
      if (storedSessionId && (!event.sessionId || event.sessionId === storedSessionId)) {
        void sessions
          .getRoom(storedSessionId)
          .then((next) => setRoom(next))
          .catch(() => undefined);
      } else if (!storedSessionId && screenRef.current === 'rooms') {
        void sessions
          .listOpenRooms()
          .then((next) => setOpenRooms(next))
          .catch(() => undefined);
      }
    }, setLobbyStatus);
  }

  async function restoreStoredRoom(
    gateway: SessionGateway,
    isCurrent: () => boolean = () => true,
  ): Promise<void> {
    const storedSessionId = globalThis.sessionStorage.getItem(ROOM_SESSION_STORAGE_KEY);
    if (!storedSessionId || !isCurrent()) return;
    const action = 'restoring' as const;
    if (!beginRoomAction(action)) return;
    setScreen('room');
    setRoomStatus('restoring');
    setRoomMessage('Restoring your room…');
    try {
      const restored = await gateway.getRoom(storedSessionId);
      if (!restored.roomState) throw new Error('Incompatible room');
      if (!isCurrent()) return;
      setRoom(restored);
      setRoomStatus('ready');
      setRoomMessage('Room restored.');
    } catch {
      if (!isCurrent()) return;
      globalThis.sessionStorage.removeItem(ROOM_SESSION_STORAGE_KEY);
      setRoom(null);
      setRoomStatus('idle');
      setRoomMessage(null);
      setScreen('home');
      setAuthMessage('Guest profile restored. The previous friend room is no longer available.');
    } finally {
      finishRoomAction(action);
    }
  }

  async function authenticateGuest() {
    const gateway = agsGatewayRef.current;
    if (!authRef.current || !gateway || authBusyRef.current) return;
    authBusyRef.current = true;
    try {
      setAuthStatus('logging-in');
      setAuthMessage('Preparing your guest profile…');
      const identity = await authRef.current.authenticate(globalThis.localStorage, setAuthStatus);
      setGuestId(identity.userId);
      setAuthStatus('verifying');
      setAuthMessage('Restoring your latest progress…');
      const authenticatedSessions = gateway.createSessionGateway();
      const authenticatedLobby = gateway.createLobbyGateway();
      sessionGatewayRef.current = authenticatedSessions;
      lobbyGatewayRef.current = authenticatedLobby;
      connectLobby(authenticatedLobby, authenticatedSessions);
      await restoreStoredRoom(authenticatedSessions);
      await reconcileCloudAfterLogin(gateway, identity.userId);
      setAuthStatus('authenticated');
      setAuthMessage('Guest profile ready.');
    } catch (caught) {
      setAuthStatus('error');
      setAuthMessage(authErrorMessage(caught));
    } finally {
      authBusyRef.current = false;
    }
  }

  async function refreshOpenRooms(showBusy = true) {
    const gateway = sessionGatewayRef.current;
    if (!gateway) return;
    const action = 'discovering' as const;
    if (!showBusy && roomActionRef.current !== 'idle') return;
    if (showBusy && !beginRoomAction(action)) return;
    if (showBusy) {
      setRoomStatus('discovering');
      setRoomMessage('Refreshing open rooms…');
    }
    try {
      setOpenRooms(await gateway.listOpenRooms());
      if (showBusy) {
        setRoomStatus('ready');
        setRoomMessage(null);
      }
    } catch (caught) {
      if (showBusy) {
        setRoomStatus('error');
        setRoomMessage(roomErrorMessage(caught));
      }
    } finally {
      if (showBusy) finishRoomAction(action);
    }
  }

  function openRoomBrowser() {
    setScreen('rooms');
    setRoomMessage(null);
    void refreshOpenRooms();
  }

  function adoptRoom(next: FriendRoomSnapshot, message: string) {
    globalThis.sessionStorage.setItem(ROOM_SESSION_STORAGE_KEY, next.sessionId);
    setRoom(next);
    setRoomStatus('ready');
    setRoomMessage(message);
    setScreen('room');
  }

  async function createFriendRoom() {
    const gateway = sessionGatewayRef.current;
    if (!gateway || !guestId) return;
    const action = 'creating' as const;
    if (!beginRoomAction(action)) return;
    setScreen('room');
    setRoom(null);
    setRoomStatus('creating');
    setRoomMessage('Creating an open room…');
    try {
      const created = await gateway.createRoom({
        playerId: guestId,
        maxPlayers: roomMaxPlayersRef.current,
      });
      const verified = await gateway.getRoom(created.sessionId);
      adoptRoom(verified, 'Room created.');
    } catch (caught) {
      setRoom(null);
      setRoomStatus('error');
      setRoomMessage(roomErrorMessage(caught));
    } finally {
      finishRoomAction(action);
    }
  }

  async function joinFriendRoom(value: string, byCode: boolean) {
    const gateway = sessionGatewayRef.current;
    if (!gateway) return;
    const action = 'joining' as const;
    if (!beginRoomAction(action)) return;
    setPendingRoomJoin({ kind: byCode ? 'code' : 'id', value: value.trim() });
    setRoomStatus('joining');
    setRoomMessage(byCode ? 'Joining with the room code…' : 'Joining the open room…');
    try {
      const joined = byCode ? await gateway.joinRoomByCode(value) : await gateway.joinRoom(value);
      adoptRoom(joined, 'Joined room.');
    } catch (caught) {
      setRoomStatus('error');
      setRoomMessage(roomErrorMessage(caught));
    } finally {
      setPendingRoomJoin(null);
      finishRoomAction(action);
    }
  }

  async function retryFriendRoom() {
    const gateway = sessionGatewayRef.current;
    const sessionId =
      room?.sessionId ?? globalThis.sessionStorage.getItem(ROOM_SESSION_STORAGE_KEY);
    if (!gateway || !sessionId) {
      setScreen('rooms');
      await refreshOpenRooms();
      return;
    }
    const action = 'refreshing' as const;
    if (!beginRoomAction(action)) return;
    setRoomStatus('restoring');
    setRoomMessage('Refreshing room…');
    try {
      adoptRoom(await gateway.getRoom(sessionId), 'Room refreshed.');
    } catch (caught) {
      setRoomStatus('error');
      setRoomMessage(roomErrorMessage(caught));
    } finally {
      finishRoomAction(action);
    }
  }

  async function setReady(ready: boolean) {
    const gateway = sessionGatewayRef.current;
    if (!gateway || !room || !guestId) return;
    const action = 'readying' as const;
    if (!beginRoomAction(action)) return;
    setRoomStatus('updating');
    setRoomMessage(ready ? 'Saving your ready status…' : 'Saving your sit-out status…');
    try {
      const updated = await gateway.updateRoom(room.sessionId, (state) =>
        setMemberReady(state, guestId, ready, new Date().toISOString()),
      );
      setRoom(updated);
      setRoomStatus('ready');
      setRoomMessage(ready ? 'Ready for the next round.' : 'You are sitting out.');
    } catch (caught) {
      setRoomStatus('error');
      setRoomMessage(roomErrorMessage(caught));
    } finally {
      finishRoomAction(action);
    }
  }

  async function startRoomNow() {
    const gateway = sessionGatewayRef.current;
    const currentRoom = roomRef.current;
    const currentState = currentRoom?.roomState;
    if (!gateway || !currentRoom || !currentState) return;
    const accessToken = agsGatewayRef.current?.getAccessToken();
    if (!accessToken) {
      setRoomStatus('error');
      setRoomMessage('Sign in again before starting the next round.');
      return;
    }
    const action = 'starting' as const;
    if (!beginRoomAction(action)) return;
    const ordinal = currentState.roundOrdinal + 1;
    const idempotencyKey = `room-round-${ordinal}-${currentRoom.sessionId}`
      .replace(/[^A-Za-z0-9-]/g, '-')
      .slice(0, 96);
    setRoomStatus('updating');
    setRoomMessage('Loading the live draft settings…');
    try {
      const issued = await requestDraftChallenge(accessToken, {
        roomSessionId: currentRoom.sessionId,
        roundSeconds: roundSecondsRef.current,
        idempotencyKey,
      });
      if (issued.schemaVersion !== 'football11-room-challenge-v1') {
        throw new Error('The room received an incompatible draft challenge.');
      }
      const updated = await gateway.updateRoom(
        currentRoom.sessionId,
        (state, canonical) => {
          if (state.roundOrdinal >= ordinal) return state;
          const active = canonical.members
            .filter((member) => member.status === 'JOINED' || member.status === 'CONNECTED')
            .map((member) => member.userId);
          return startFriendRoomRound(state, active, issued, issued.startedAt);
        },
        'CLOSED',
      );
      setRoom(updated);
      setRoomStatus('ready');
      setRoomMessage('Round started. New players can join after this draft.');
    } catch (caught) {
      setRoomStatus('error');
      setRoomMessage(roomErrorMessage(caught));
    } finally {
      finishRoomAction(action);
    }
  }

  async function changeJoinCode(generate: boolean) {
    const gateway = sessionGatewayRef.current;
    if (!gateway || !room) return;
    const action = generate ? ('generating-code' as const) : ('revoking-code' as const);
    if (!beginRoomAction(action)) return;
    setRoomStatus('updating');
    setRoomMessage(generate ? 'Generating a new room code…' : 'Revoking the room code…');
    try {
      const next = generate
        ? await gateway.generateJoinCode(room.sessionId)
        : await gateway.revokeJoinCode(room.sessionId);
      setRoom(next);
      setRoomStatus('ready');
      setRoomMessage(
        generate ? 'A new optional code is available.' : 'The optional code was revoked.',
      );
    } catch (caught) {
      setRoomStatus('error');
      setRoomMessage(roomErrorMessage(caught));
    } finally {
      finishRoomAction(action);
    }
  }

  async function leaveFriendRoom() {
    const gateway = sessionGatewayRef.current;
    const currentRoom = roomRef.current;
    if (!gateway || !currentRoom || !guestId) return;
    const action = 'leaving' as const;
    if (!beginRoomAction(action)) return;
    setRoomStatus('leaving');
    setRoomMessage('Leaving room…');
    try {
      if (currentRoom.roomState?.phase === 'DRAFTING') {
        try {
          await gateway.updateRoom(currentRoom.sessionId, (state) =>
            abandonFriendRoomParticipant(state, guestId, new Date().toISOString()),
          );
        } catch {
          // Leaving the AGS membership remains the canonical fallback.
        }
      }
      await gateway.leaveRoom(currentRoom.sessionId);
      globalThis.sessionStorage.removeItem(ROOM_SESSION_STORAGE_KEY);
      setRoom(null);
      setRoomStatus('idle');
      setRoomMessage(null);
      setScreen('home');
      setAuthMessage('Friend room left. Your guest profile remains connected.');
    } catch (caught) {
      setRoomStatus('error');
      setRoomMessage(roomErrorMessage(caught));
    } finally {
      finishRoomAction(action);
    }
  }

  async function start() {
    const accessToken = agsGatewayRef.current?.getAccessToken();
    if (!accessToken) {
      setStartMessage('Sign in again before starting a draft.');
      return;
    }
    if (startBusyRef.current) return;
    startBusyRef.current = true;
    setStartBusy(true);
    setStartMessage(null);
    try {
      const challenge = await requestDraftChallenge(accessToken);
      if (!('kind' in challenge) || challenge.schemaVersion !== 1 || challenge.kind !== 'solo') {
        throw new Error('The server returned an incompatible draft challenge.');
      }
      setRoom(null);
      globalThis.sessionStorage.removeItem(ROOM_SESSION_STORAGE_KEY);
      setSession(createGameSession(challenge));
      setResult(null);
      setStorageMessage(null);
      setStorageError(false);
      setCanRetryCloud(false);
      setRankingStatus('idle');
      setRanking(null);
      setRankingMessage(null);
      setScreen('draft');
    } catch {
      setStartMessage('Draft settings are unavailable right now. Try starting again.');
    } finally {
      startBusyRef.current = false;
      setStartBusy(false);
    }
  }

  function persistResult(next: GameSession, roomSessionId?: string) {
    if (!guestId || !next.resolved) return;
    try {
      const record = createLocalRunRecord(guestId, next, undefined, roomSessionId);
      setLastRun(record);
      setStorageError(false);
      setCanRetryCloud(false);
      setStorageMessage('Saving your result…');
      const gateway = agsGatewayRef.current;
      if (gateway) void saveRunToCloud(gateway, guestId, record);
    } catch {
      setStorageError(true);
      setStorageMessage('Result complete, but it could not be saved.');
    }
  }

  function changeSession(next: GameSession) {
    setSession(next);
    const activeRoom = roomRef.current;
    const activeChallenge = activeRoom?.roomState?.challenge;
    const isRoomRun = activeChallenge?.challengeId === next.challengeId;
    if (isRoomRun && guestId && activeRoom && activeChallenge) {
      globalThis.sessionStorage.setItem(
        roomDraftStorageKey(activeChallenge, guestId),
        JSON.stringify(next),
      );
      const selectedCount = Object.keys(next.snapshot.state.roster).length;
      const summary: FriendRoomResultSummaryV1 | null = next.resolved
        ? {
            challengeId: next.challengeId,
            userId: guestId,
            points: next.resolved.result.season.points,
            wins: next.resolved.result.season.wins,
            draws: next.resolved.result.season.draws,
            losses: next.resolved.result.season.losses,
            composite: next.resolved.result.assessment.composite,
            finalStateHash: next.resolved.result.finalStateHash,
            submittedAt: new Date().toISOString(),
          }
        : null;
      roomWriteRef.current = roomWriteRef.current
        .catch(() => undefined)
        .then(async () => {
          const gateway = sessionGatewayRef.current;
          if (!gateway) return;
          const updated = await gateway.updateRoom(activeRoom.sessionId, (state) =>
            updateFriendRoomProgress(
              state,
              guestId,
              selectedCount,
              summary ? 'FINISHED' : 'DRAFTING',
              summary,
              new Date().toISOString(),
            ),
          );
          setRoom(updated);
        })
        .catch((caught: unknown) => {
          setRoomStatus('error');
          setRoomMessage(
            `Your draft is safe, but room progress could not be updated. ${roomErrorMessage(caught)}`,
          );
        });
      if (next.resolved) {
        setResult(next.resolved.result);
        persistResult(next, activeRoom.sessionId);
        setScreen('room');
        setRoomMessage('Your result is in. Waiting for the room reveal…');
      }
      return;
    }

    if (!next.resolved) return;
    setResult(next.resolved.result);
    setScreen('result');
    if (!guestId) {
      setStorageError(true);
      setStorageMessage('Result complete, but your guest profile was unavailable for saving.');
      return;
    }
    persistResult(next);
  }

  function viewLastResult() {
    if (!lastRun) return;
    setSession(null);
    setResult(lastRun.result);
    setStorageError(false);
    setCanRetryCloud(false);
    setStorageMessage('Loaded your latest result.');
    setRankingStatus('idle');
    setRanking(null);
    setRankingMessage(null);
    setScreen('result');
  }

  function resumeRoomDraft() {
    const challenge = room?.roomState?.challenge;
    if (!challenge || !guestId) return;
    setSession(
      loadRoomDraft(globalThis.sessionStorage, challenge, guestId) ??
        createGameSessionFromChallenge(challenge, guestId),
    );
    setScreen('draft');
  }

  async function rankCurrentRun() {
    const gateway = agsGatewayRef.current;
    const accessToken = gateway?.getAccessToken();
    if (
      !lastRun ||
      !guestId ||
      !gateway ||
      !accessToken ||
      lastRun.localProfileId !== guestId ||
      lastRun.runId !== result?.resultId
    ) {
      setRankingStatus('error');
      setRankingMessage('Sign in again and restore this saved result before updating its rank.');
      return;
    }
    if (rankingBusyRef.current) return;
    rankingBusyRef.current = true;
    try {
      setRankingStatus('submitting');
      setRankingMessage('Verifying your result…');
      const accepted = await submitTrustedRun(lastRun, accessToken);
      setResult(accepted.result);
      setRanking(accepted);
      setRankingStatus('success');
      setRankingMessage(
        accepted.leaderboard.status === 'stale'
          ? 'Score verified. Rankings are still updating.'
          : accepted.leaderboard.status === 'unranked'
            ? 'Score verified. Your all-time rank is not available yet.'
            : accepted.leaderboard.status === 'empty'
              ? 'Score verified. The all-time leaderboard has no visible entries yet.'
              : accepted.duplicate
                ? 'This score was already recorded.'
                : 'Score verified and ranking updated.',
      );
    } catch {
      setRankingStatus('error');
      setRankingMessage('Ranking could not be updated. Your saved result is safe; try again.');
    } finally {
      rankingBusyRef.current = false;
    }
  }

  async function saveRunToCloud(
    gateway: AgsAuthGateway,
    ownerUserId: string,
    local: LocalRunRecordV1,
    retrying = false,
  ) {
    if (storageBusyRef.current) return;
    storageBusyRef.current = true;
    setStorageBusy(true);
    try {
      setStorageError(false);
      if (!retrying) setCanRetryCloud(false);
      setStorageMessage(retrying ? 'Retrying your result save…' : 'Saving your result…');
      const outcome = await saveLatestCloudRun(gateway, ownerUserId, local);
      setCanRetryCloud(false);
      setStorageMessage(
        outcome.status === 'saved' ? 'Result saved.' : 'This result is already saved.',
      );
    } catch (caught) {
      setStorageError(true);
      setCanRetryCloud(true);
      setStorageMessage(cloudSaveErrorMessage(caught));
    } finally {
      storageBusyRef.current = false;
      setStorageBusy(false);
    }
  }

  async function reconcileCloudAfterLogin(
    gateway: AgsAuthGateway,
    ownerUserId: string,
    retrying = false,
  ) {
    if (storageBusyRef.current) return;
    storageBusyRef.current = true;
    setStorageBusy(true);
    try {
      setLastRun(null);

      setStorageError(false);
      if (!retrying) setCanRetryCloud(false);
      setStorageMessage(
        retrying ? 'Retrying your latest-result check…' : 'Checking for your latest result…',
      );
      const restored = await restoreLatestCloudRun(gateway, ownerUserId);
      if (!restored) {
        setCanRetryCloud(false);
        setStorageMessage('Your next completed result will be saved.');
        return;
      }
      setLastRun(restored);
      setCanRetryCloud(false);
      setStorageMessage('Latest result restored.');
    } catch (caught) {
      setStorageError(true);
      setCanRetryCloud(true);
      setStorageMessage(cloudSaveErrorMessage(caught));
    } finally {
      storageBusyRef.current = false;
      setStorageBusy(false);
    }
  }

  function retryCloudSync() {
    const gateway = agsGatewayRef.current;
    if (!gateway || !guestId || storageBusyRef.current) return;
    if (lastRun?.localProfileId === guestId) {
      void saveRunToCloud(gateway, guestId, lastRun, true);
      return;
    }
    void reconcileCloudAfterLogin(gateway, guestId, true);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="topbar-meta">
          <span className="content-pill">{contentLabel}</span>
          <IdentityChip guestId={guestId} status={authStatus} />
        </div>
      </header>
      {screen === 'home' ? (
        <HomeScreen
          onStart={() => void start()}
          onCreateRoom={openRoomBrowser}
          onCompetition={() => setScreen('competition')}
          onAuthenticate={() => void authenticateGuest()}
          onViewLast={viewLastResult}
          ready={guestId !== null && authStatus === 'authenticated'}
          authStatus={authStatus}
          authMessage={authMessage}
          lastRun={lastRun}
          storageMessage={storageMessage}
          storageError={storageError}
          canRetryCloud={canRetryCloud}
          onRetryCloud={retryCloudSync}
          storageBusy={storageBusy}
          startBusy={startBusy}
          startMessage={startMessage}
        />
      ) : null}
      {screen === 'rooms' && guestId ? (
        <FriendRoomBrowser
          rooms={openRooms}
          status={roomStatus}
          action={roomAction}
          pendingJoin={pendingRoomJoin}
          message={roomMessage}
          onRefresh={() => void refreshOpenRooms()}
          onCreate={() => void createFriendRoom()}
          onJoinId={(id) => void joinFriendRoom(id, false)}
          onJoinCode={(code) => void joinFriendRoom(code, true)}
          onBack={() => setScreen('home')}
        />
      ) : null}
      {screen === 'room' && guestId ? (
        <Phase4RoomScreen
          room={room}
          status={roomStatus}
          action={roomAction}
          message={roomMessage}
          currentUserId={guestId}
          lobbyStatus={lobbyStatus}
          onRetry={() => void retryFriendRoom()}
          onReady={(ready) => void setReady(ready)}
          onStart={() => void startRoomNow()}
          onResumeDraft={resumeRoomDraft}
          onRevokeCode={() => void changeJoinCode(false)}
          onGenerateCode={() => void changeJoinCode(true)}
          onLeave={() => void leaveFriendRoom()}
          onBack={() => setScreen('rooms')}
        />
      ) : null}
      {screen === 'draft' && session ? (
        <DraftScreen session={session} onChange={changeSession} />
      ) : null}
      {screen === 'competition' && guestId ? (
        <SavedXiCompetitionView
          accessToken={agsGatewayRef.current?.getAccessToken() ?? ''}
          publishRecord={ranking && lastRun?.runId === result?.resultId ? lastRun : null}
          onBack={() => setScreen(result ? 'result' : 'home')}
        />
      ) : null}
      {screen === 'result' && result ? (
        <ResultScreen
          result={result}
          onAgain={() => void start()}
          persistenceMessage={storageMessage}
          persistenceError={storageError}
          canRetryCloud={canRetryCloud}
          onRetryCloud={retryCloudSync}
          storageBusy={storageBusy}
          rankingStatus={rankingStatus}
          ranking={ranking}
          rankingMessage={rankingMessage}
          canRank={
            guestId !== null &&
            lastRun?.localProfileId === guestId &&
            lastRun.runId === result.resultId &&
            authStatus === 'authenticated'
          }
          onRank={() => void rankCurrentRun()}
          onCompetition={() => setScreen('competition')}
          canCompete={guestId !== null && authStatus === 'authenticated'}
          startBusy={startBusy}
          startMessage={startMessage}
        />
      ) : null}
      <footer className="footer">
        <details className="data-credits">
          <summary>Data credits &amp; licenses</summary>
          <div className="data-credits-panel">
            <p>
              <strong>Dataset.</strong> Premier League 2023/24 match results, squad names, clubs,
              shirt numbers, broad positions, and available birth years come from OpenFootball
              England. Available heights are matched from OpenFootball Players. Both repositories
              dedicate their data to the public domain under their published public-domain/CC0
              terms.
            </p>
            <p>
              <strong>Adaptation.</strong> Cards use real 2023/24 squad names and club membership.
              Football 11 derives club strength from match results and deterministically infers
              fine-grained positions, missing physical details, ratings, attributes, and tactical
              traits. These modeled values are gameplay constructs, not official player ratings.
            </p>
            <p>
              <strong>Rights boundary.</strong> Public-domain data status does not independently
              grant rights to club crests, logos, kits, or trademarks. Football 11 does not use
              source photographs or official ratings.
            </p>
            <nav className="data-credit-links" aria-label="Data attribution resources">
              <a
                href="https://github.com/openfootball/england/tree/0690446f794fde748ea4b994244def699c6a65b2"
                target="_blank"
                rel="noreferrer"
              >
                OpenFootball England
              </a>
              <a
                href="https://github.com/openfootball/players/tree/125d20f7cc06cac7e758b40df535a7695632680a"
                target="_blank"
                rel="noreferrer"
              >
                OpenFootball Players
              </a>
              <a
                href="https://creativecommons.org/publicdomain/zero/1.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC0 1.0 public-domain dedication
              </a>
            </nav>
          </div>
        </details>
      </footer>
    </div>
  );
}
