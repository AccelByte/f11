'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Swords,
  Target,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import type {
  AsyncMatchViewV1,
  LocalRunRecordV1,
  SavedXiCompetitionStatusV1,
} from '@football-11/contracts';

import { playerById } from '@/src/game/content';
import {
  CompetitionClientError,
  findNearbySavedXiOpponent,
  loadSavedXiCompetition,
  publishPersonalBestXi,
  resolveSavedXiMatch,
} from '@/src/services/ags/savedXiCompetition';

type CompetitionAction = 'loading' | 'publishing' | 'finding' | 'resolving' | 'idle';

export function SavedXiCompetitionView({
  accessToken,
  publishRecord,
  onBack,
}: {
  accessToken: string;
  publishRecord: LocalRunRecordV1 | null;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<SavedXiCompetitionStatusV1 | null>(null);
  const [action, setAction] = useState<CompetitionAction>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const actionRef = useRef<CompetitionAction>('idle');

  const load = useCallback(async () => {
    if (actionRef.current !== 'idle') return;
    actionRef.current = 'loading';
    setAction('loading');
    setMessage(null);
    setErrorCode(null);
    try {
      setStatus(await loadSavedXiCompetition(accessToken));
    } catch (caught) {
      showError(caught, setMessage, setErrorCode);
    } finally {
      actionRef.current = 'idle';
      setAction('idle');
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = globalThis.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => globalThis.clearInterval(timer);
  }, []);

  const activeChallenge = status?.activeChallenge ?? null;
  const pendingChallenge =
    activeChallenge === null
      ? null
      : (status?.history.find(
          (match) =>
            match.matchId === activeChallenge.matchId && match.settlementStatus === 'pending',
        ) ?? null);
  const secondsRemaining = activeChallenge
    ? Math.max(0, Math.ceil((Date.parse(activeChallenge.expiresAt) - nowMs) / 1_000))
    : 0;
  const challengeExpired =
    activeChallenge !== null && secondsRemaining === 0 && pendingChallenge === null;
  const currentRunAlreadyPublished =
    Boolean(publishRecord) && status?.savedXi?.sourceResultId === publishRecord?.result.resultId;
  const latestMatch = status?.history[0] ?? null;
  const busy = action !== 'idle';

  async function publish() {
    if (!publishRecord || actionRef.current !== 'idle') return;
    actionRef.current = 'publishing';
    setAction('publishing');
    setMessage('Publishing your team…');
    setErrorCode(null);
    try {
      const published = await publishPersonalBestXi(publishRecord, accessToken);
      const next = await loadSavedXiCompetition(accessToken);
      setStatus(next);
      setMessage(
        published.replaced
          ? 'Your previous Saved XI was replaced. Future challengers now face this team.'
          : 'Your personal-best XI is published and ready for nearby challenges.',
      );
    } catch (caught) {
      showError(caught, setMessage, setErrorCode);
    } finally {
      actionRef.current = 'idle';
      setAction('idle');
    }
  }

  async function findOpponent() {
    if (actionRef.current !== 'idle' || !status?.savedXi) return;
    actionRef.current = 'finding';
    setAction('finding');
    setMessage('Finding a nearby opponent…');
    setErrorCode(null);
    try {
      const challenge = await findNearbySavedXiOpponent(accessToken);
      setStatus((current) => (current ? { ...current, activeChallenge: challenge } : current));
      setNowMs(Date.now());
      setMessage('Opponent selected for ten minutes. Review both teams before playing.');
    } catch (caught) {
      showError(caught, setMessage, setErrorCode);
    } finally {
      actionRef.current = 'idle';
      setAction('idle');
    }
  }

  async function resolve() {
    if (actionRef.current !== 'idle' || !activeChallenge || challengeExpired) return;
    actionRef.current = 'resolving';
    setAction('resolving');
    setMessage('Playing the match and updating your score…');
    setErrorCode(null);
    try {
      const resolved = await resolveSavedXiMatch(activeChallenge.token, accessToken);
      const next = await loadSavedXiCompetition(accessToken);
      setStatus(next);
      setMessage(
        resolved.duplicate
          ? 'This match was already recorded. Your score is unchanged.'
          : `${outcomeLabel(resolved.match)} Challenge Score updated to ${resolved.match.scoreAfter}.`,
      );
    } catch (caught) {
      showError(caught, setMessage, setErrorCode);
    } finally {
      actionRef.current = 'idle';
      setAction('idle');
    }
  }

  return (
    <main className="competition-page">
      <section className="competition-heading">
        <button className="text-button competition-back" onClick={onBack} type="button">
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <span className="eyebrow">
            <Swords size={14} aria-hidden="true" /> Saved-XI competition
          </span>
          <h1>Your best eleven, one neutral match.</h1>
          <p>
            Publish your personal-best XI, challenge a nearby team, and see how your eleven
            performs. Wins add 3, draws add 0, and losses subtract 2 without going below zero.
          </p>
        </div>
        <div className="challenge-score" aria-label="Challenge Score">
          <small>Challenge Score</small>
          <strong>{status?.challengeScore ?? '—'}</strong>
          <span>Tracks your completed challenges</span>
        </div>
      </section>

      {message ? (
        <div
          className={`competition-message ${errorCode ? 'is-error' : ''}`}
          role={errorCode ? 'alert' : 'status'}
        >
          {errorCode ? <TriangleAlert size={17} /> : <Check size={17} />}
          <span>
            {message}
            {errorCode ? <small>{friendlyErrorHint(errorCode)}</small> : null}
          </span>
        </div>
      ) : null}

      <div className="competition-grid">
        <section className="competition-card saved-xi-card">
          <div className="competition-card-heading">
            <div>
              <span className="eyebrow">Published team</span>
              <h2>{status?.savedXi ? 'Your Saved XI' : 'No XI published'}</h2>
            </div>
            {status?.savedXi ? <ShieldCheck className="competition-card-icon" size={24} /> : null}
          </div>
          {action === 'loading' && !status ? <p>Loading your competition…</p> : null}
          {status?.savedXi ? (
            <XiSummary xi={status.savedXi} />
          ) : action !== 'loading' ? (
            <p>
              Open your best saved result and publish it here when you are ready. Nothing is
              published automatically.
            </p>
          ) : null}
          {publishRecord ? (
            <button
              aria-busy={action === 'publishing'}
              className="secondary-button competition-action"
              disabled={busy || currentRunAlreadyPublished}
              onClick={() => void publish()}
              type="button"
            >
              {action === 'publishing' ? (
                <LoaderCircle className="is-spinning" size={17} aria-hidden="true" />
              ) : (
                <Upload size={17} aria-hidden="true" />
              )}
              {action === 'publishing'
                ? 'Publishing…'
                : currentRunAlreadyPublished
                  ? 'This result is already published'
                  : status?.savedXi
                    ? 'Replace with this XI'
                    : 'Publish this XI'}
            </button>
          ) : (
            <p className="competition-note">
              To publish or replace your XI, open a saved result and verify its score first.
            </p>
          )}
        </section>

        <section className="competition-card opponent-card">
          <div className="competition-card-heading">
            <div>
              <span className="eyebrow">Opponent search</span>
              <h2>
                {activeChallenge && !challengeExpired
                  ? activeChallenge.opponentLabel
                  : 'Find an opponent'}
              </h2>
            </div>
            <Target className="competition-card-icon" size={24} />
          </div>
          {activeChallenge && !challengeExpired ? (
            <>
              <div className="opponent-meta">
                <span>Season rank #{activeChallenge.opponentRank}</span>
                <span className={secondsRemaining <= 60 && !pendingChallenge ? 'is-urgent' : ''}>
                  {pendingChallenge ? <RefreshCw size={14} /> : <Clock3 size={14} />}{' '}
                  {pendingChallenge ? 'Ready to retry' : formatClock(secondsRemaining)}
                </span>
              </div>
              <XiSummary xi={activeChallenge.opponentXi} compact />
              <button
                aria-busy={action === 'resolving'}
                className="primary-button competition-action"
                disabled={busy}
                onClick={() => void resolve()}
                type="button"
              >
                {action === 'resolving' ? (
                  <LoaderCircle className="is-spinning" size={18} aria-hidden="true" />
                ) : (
                  <Swords size={18} aria-hidden="true" />
                )}
                {action === 'resolving'
                  ? 'Playing match…'
                  : pendingChallenge
                    ? 'Retry match'
                    : 'Play match'}
              </button>
            </>
          ) : (
            <>
              <p>
                {challengeExpired
                  ? 'That opponent is no longer available. Find another nearby XI.'
                  : status?.savedXi
                    ? 'We will look for an opponent close to your best-season rank.'
                    : 'Publish your XI before searching for an opponent.'}
              </p>
              <button
                aria-busy={action === 'finding'}
                className="primary-button competition-action"
                disabled={busy || !status?.savedXi}
                onClick={() => void findOpponent()}
                type="button"
              >
                {action === 'finding' ? (
                  <LoaderCircle className="is-spinning" size={18} aria-hidden="true" />
                ) : (
                  <Target size={18} aria-hidden="true" />
                )}
                {action === 'finding'
                  ? 'Searching…'
                  : challengeExpired
                    ? 'Find another opponent'
                    : 'Find nearby opponent'}
              </button>
            </>
          )}
        </section>

        <section className="competition-card history-card">
          <div className="competition-card-heading">
            <div>
              <span className="eyebrow">Match history</span>
              <h2>Recent matches</h2>
            </div>
            <button
              aria-busy={action === 'loading'}
              className="icon-button"
              disabled={busy}
              onClick={() => void load()}
              type="button"
              aria-label={
                action === 'loading'
                  ? 'Refreshing competition status'
                  : 'Refresh competition status'
              }
            >
              <RefreshCw
                className={action === 'loading' ? 'is-spinning' : ''}
                size={17}
                aria-hidden="true"
              />
            </button>
          </div>
          {latestMatch ? (
            <ol className="match-history">
              {status?.history.map((match) => (
                <MatchRow key={match.matchId} match={match} />
              ))}
            </ol>
          ) : (
            <p>No Saved-XI matches yet. Your first result will appear here.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function XiSummary({
  xi,
  compact = false,
}: {
  xi: NonNullable<SavedXiCompetitionStatusV1['savedXi']>;
  compact?: boolean;
}) {
  const rosterNames = useMemo(
    () =>
      xi.roster.map(
        (assignment) => playerById.get(assignment.playerSeasonId)?.displayName ?? 'Unknown player',
      ),
    [xi.roster],
  );
  return (
    <div className={`xi-summary ${compact ? 'is-compact' : ''}`}>
      <div className="xi-facts">
        <span>
          <small>Best season</small>
          <strong>{xi.seasonPoints} pts</strong>
        </span>
        <span>
          <small>Attack</small>
          <strong>{xi.units.attack.toFixed(1)}</strong>
        </span>
        <span>
          <small>Defence</small>
          <strong>{xi.units.defence.toFixed(1)}</strong>
        </span>
        <span>
          <small>Control</small>
          <strong>{xi.units.control.toFixed(1)}</strong>
        </span>
      </div>
      <p className="xi-roster" aria-label="Saved XI roster">
        {rosterNames.join(' · ')}
      </p>
    </div>
  );
}

function MatchRow({ match }: { match: AsyncMatchViewV1 }) {
  const delta = match.scoreAfter - match.scoreBefore;
  return (
    <li data-outcome={match.result.outcome}>
      <span className="match-outcome">{match.result.outcome}</span>
      <span>
        <strong>{match.opponentLabel}</strong>
        <small>
          Rank #{match.opponentRank} · {new Date(match.createdAt).toLocaleDateString()}
        </small>
      </span>
      <span className="match-score">
        <strong>{delta > 0 ? `+${delta}` : delta}</strong>
        <small>{match.scoreAfter} total</small>
      </span>
      {match.settlementStatus === 'pending' ? (
        <em>Result update pending — retry this match</em>
      ) : null}
    </li>
  );
}

function showError(
  caught: unknown,
  setMessage: (message: string) => void,
  setCode: (code: string | null) => void,
): void {
  setCode(caught instanceof CompetitionClientError ? caught.code : 'UNKNOWN');
  setMessage('We could not complete that action.');
}

function outcomeLabel(match: AsyncMatchViewV1): string {
  return match.result.outcome === 'win'
    ? 'Win.'
    : match.result.outcome === 'draw'
      ? 'Draw.'
      : 'Loss.';
}

function friendlyErrorHint(code: string): string {
  const hints: Record<string, string> = {
    NO_SAVED_XI: 'Publish a personal-best XI first.',
    RUN_NOT_TRUSTED: 'Verify this saved result before publishing it.',
    NOT_PERSONAL_BEST: 'Open and verify the result tied with your current best points.',
    NO_COMPATIBLE_OPPONENT: 'No eligible nearby XI is available; retry when more players publish.',
    CHALLENGE_EXPIRED: 'Find another opponent and try again.',
    INCOMPATIBLE_XI_VERSION: 'Publish a XI created with the current game version.',
    SETTLEMENT_PENDING: 'Retry the existing match to finish updating your score.',
    DAILY_CHALLENGE_LIMIT: 'You can play up to 20 challenges in any 24-hour period.',
  };
  return hints[code] ?? 'Your Saved XI and match history are safe. Try again.';
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')} remaining`;
}
