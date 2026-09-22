import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_MECHANICS_VERSION,
  DEFAULT_DRAFT_CONFIG,
  applyDraftAction,
  buildConstraintProfiles,
  createDerivedRandomSource,
  createDraft,
  resolveRun,
} from '../../packages/domain/dist/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const runs = Number(argument('--runs', '10000'));
const output = argument('--output', 'data/reports/phase-1a-offer-analysis-v1.json');
const catalogueFile = argument(
  '--catalogue',
  'data/content/openfootball-pl-2023-24-named-squads-v2.json',
);
if (!Number.isSafeInteger(runs) || runs <= 0) throw new Error('--runs must be a positive integer');
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const catalogue = readJson(catalogueFile);
const assessmentConfig = readJson('data/config/assessment-v1.json');
const leagueProfile = readJson('data/config/league-profile-v1.json');
const players = catalogue.playerSeasons;
const profiles = buildConstraintProfiles(players);
const constraintOffers = new Map();
const playerOffers = new Map();
const selectedSlots = new Map();
const categoryTotals = {
  quality: 0,
  positioning: 0,
  chemistry: 0,
  tacticalBalance: 0,
  leadership: 0,
};
let offerCount = 0;
let offeredCardTotal = 0;
let minimumOfferSize = Number.POSITIVE_INFINITY;
let maximumOfferSize = 0;
let rerollUnavailableCount = 0;
let rerollCount = 0;
let maximumRerollsInRun = 0;
let failures = 0;
let firstFailure = null;
let pointsTotal = 0;
let minimumPoints = 114;
let maximumPoints = 0;
let winsTotal = 0;
let drawsTotal = 0;
let lossesTotal = 0;
let perfectSeasons = 0;
const startedAt = Date.now();

for (let run = 0; run < runs; run += 1) {
  const seed = `phase-1a-analysis-${run}`;
  const actions = [];
  let runRerolls = 0;
  try {
    let snapshot = createDraft({
      challengeId: `analysis-${run}`,
      seed,
      versions: DEFAULT_MECHANICS_VERSION,
      players,
      profiles,
    });
    while (snapshot.offer) {
      offerCount += 1;
      const offer = snapshot.offer;
      offeredCardTotal += offer.cards.length;
      minimumOfferSize = Math.min(minimumOfferSize, offer.cards.length);
      maximumOfferSize = Math.max(maximumOfferSize, offer.cards.length);
      constraintOffers.set(
        offer.constraint.key,
        (constraintOffers.get(offer.constraint.key) ?? 0) + 1,
      );
      for (const card of offer.cards)
        playerOffers.set(card.playerSeasonId, (playerOffers.get(card.playerSeasonId) ?? 0) + 1);
      if (!offer.rerollAvailable) rerollUnavailableCount += 1;
      const random = createDerivedRandomSource(
        seed,
        snapshot.state.round,
        snapshot.state.rerollOrdinal,
        'policy',
      );
      if (
        snapshot.state.rerollsRemaining > 0 &&
        offer.rerollAvailable &&
        random.nextInt(20) === 0
      ) {
        const action = { type: 'reroll', round: snapshot.state.round };
        actions.push(action);
        snapshot = applyDraftAction(snapshot, action, players, profiles);
        rerollCount += 1;
        runRerolls += 1;
        continue;
      }
      const card = offer.cards[random.nextInt(offer.cards.length)];
      const slot = card.safeSlotCodes[random.nextInt(card.safeSlotCodes.length)];
      const action = {
        type: 'select',
        round: snapshot.state.round,
        playerSeasonId: card.playerSeasonId,
        slotCode: slot,
      };
      actions.push(action);
      selectedSlots.set(slot, (selectedSlots.get(slot) ?? 0) + 1);
      snapshot = applyDraftAction(snapshot, action, players, profiles);
    }
    if (Object.keys(snapshot.state.roster).length !== 11) throw new Error('incomplete roster');
    maximumRerollsInRun = Math.max(maximumRerollsInRun, runRerolls);
    const { result } = resolveRun(
      {
        challengeId: `analysis-${run}`,
        seed,
        versions: DEFAULT_MECHANICS_VERSION,
        players,
        profiles,
        actions,
        assessmentConfig,
        leagueProfile,
      },
      players,
      profiles,
    );
    pointsTotal += result.season.points;
    minimumPoints = Math.min(minimumPoints, result.season.points);
    maximumPoints = Math.max(maximumPoints, result.season.points);
    winsTotal += result.season.wins;
    drawsTotal += result.season.draws;
    lossesTotal += result.season.losses;
    if (result.season.label === 'Perfect') perfectSeasons += 1;
    for (const key of Object.keys(categoryTotals))
      categoryTotals[key] += result.assessment.categories[key];
  } catch (error) {
    failures += 1;
    firstFailure ??= String(error?.code ?? error);
  }
}

const completedRuns = runs - failures;
const sortCounts = (counts) =>
  [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
const report = {
  schemaVersion: 'football11-phase1a-offer-analysis-v1',
  contentVersion: catalogue.contentVersion,
  rulesVersion: DEFAULT_MECHANICS_VERSION.rulesVersion,
  draftConfig: DEFAULT_DRAFT_CONFIG,
  runs,
  completedRuns,
  failures,
  firstFailure,
  offers: offerCount,
  offerSize: {
    minimum: Number.isFinite(minimumOfferSize) ? minimumOfferSize : 0,
    maximum: maximumOfferSize,
    mean: offerCount ? offeredCardTotal / offerCount : 0,
  },
  rerolls: rerollCount,
  maximumRerollsInRun,
  rerollUnavailableRate: offerCount ? rerollUnavailableCount / offerCount : 0,
  resultDistribution: {
    minimumPoints,
    maximumPoints,
    meanPoints: pointsTotal / completedRuns,
    meanWins: winsTotal / completedRuns,
    meanDraws: drawsTotal / completedRuns,
    meanLosses: lossesTotal / completedRuns,
    perfectSeasons,
    meanCategories: Object.fromEntries(
      Object.entries(categoryTotals).map(([key, total]) => [key, total / completedRuns]),
    ),
  },
  constraints: sortCounts(constraintOffers),
  selectedPositions: sortCounts(selectedSlots),
  playerAppearance: {
    distinctPlayers: playerOffers.size,
    mostFrequent: sortCounts(playerOffers).slice(0, 10),
    leastFrequent: sortCounts(playerOffers).toReversed().slice(0, 10),
  },
  durationMs: Date.now() - startedAt,
};
const outputPath = path.resolve(root, output);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (failures) process.exitCode = 1;
