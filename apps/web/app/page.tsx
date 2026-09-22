import { useState } from 'react';
import { ChevronRight, RotateCcw, Trophy, Dices } from 'lucide-react';
import {
  FORMATION_4_3_3_SLOTS,
  POSITION_BY_SLOT,
  type DraftOfferCard,
  type DraftSnapshot,
  type JsonValue,
  type RunResult,
  type SlotCode,
} from '@football-11/domain';
import { playerById, teamByCode } from '@/src/game/content';
import { orderOfferCardsForSelection } from '@/src/game/offerPresentation';
import { createGameSession, rerollOffer, selectPlayer, type GameSession } from '@/src/game/session';
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

function ResultScreen({ result, onAgain }: { result: RunResult; onAgain: () => void }) {
  return (
    <main className="result-page">
      <section className="result-hero">
        <div>
          <span className="eyebrow">
            <Trophy size={14} /> Season complete
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
        </div>
        <div className="result-actions">
          <button type="button" className="primary-button" onClick={onAgain}>
            <Dices size={18} /> Draft again
          </button>
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
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  const [session, setSession] = useState<GameSession | null>(null);
  const begin = () => setSession(createGameSession(crypto.randomUUID()));
  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <span className="quiet-note">Premier League 2023/24</span>
      </header>
      {session ? (
        session.resolved ? (
          <ResultScreen result={session.resolved.result} onAgain={begin} />
        ) : (
          <DraftScreen session={session} onChange={setSession} />
        )
      ) : (
        <main className="home-grid">
          <section className="home-copy">
            <span className="eyebrow">Football 11</span>
            <h1>Eleven choices. One full season.</h1>
            <p>
              Build your 4–3–3 from 1,041 player cards. Choose a player, place them on the pitch,
              and see how your team performs across 38 matches.
            </p>
            <button className="primary-button" type="button" onClick={begin}>
              <Dices size={18} /> Start random draft
            </button>
            <p className="quiet-note">Five rerolls. Your run lasts until you reload this page.</p>
          </section>
          <section className="formation-panel">
            <Pitch />
          </section>
        </main>
      )}
      <footer className="data-credits">
        <details>
          <summary>Data credits &amp; licenses</summary>
          <p>
            Player names and squad membership come from{' '}
            <a href="https://github.com/openfootball/england">OpenFootball England</a> and profile
            data from <a href="https://github.com/openfootball/players">OpenFootball Players</a>,
            published under <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a>.
            Formation positions and ratings are inferred or synthetic, not official player ratings.
            Source data does not settle player, club, or competition rights.
          </p>
        </details>
      </footer>
    </div>
  );
}
