import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_MECHANICS_VERSION,
  applyDraftAction,
  buildConstraintProfiles,
  createDraft,
  resolveRun,
} from '../../packages/domain/dist/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const valueAfter = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const seed = valueAfter('--seed', 'fixture-seed-v1');
const actionsFile = valueAfter('--actions', null);
const catalogueFile = valueAfter(
  '--catalogue',
  'data/content/openfootball-pl-2023-24-named-squads-v2.json',
);
const readJson = (file) => JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'));
const catalogue = readJson(catalogueFile);
const assessmentConfig = readJson('data/config/assessment-v1.json');
const leagueProfile = readJson('data/config/league-profile-v1.json');
const players = catalogue.playerSeasons;
const profiles = buildConstraintProfiles(players);
let actions = actionsFile ? readJson(actionsFile) : [];

if (!actionsFile) {
  let snapshot = createDraft({
    challengeId: `fixture-${seed}`,
    seed,
    versions: DEFAULT_MECHANICS_VERSION,
    players,
    profiles,
  });
  while (snapshot.offer) {
    const card = snapshot.offer.cards[0];
    const action = {
      type: 'select',
      round: snapshot.state.round,
      playerSeasonId: card.playerSeasonId,
      slotCode: card.safeSlotCodes[0],
    };
    actions.push(action);
    snapshot = applyDraftAction(snapshot, action, players, profiles);
  }
}

const resolved = resolveRun(
  {
    challengeId: `fixture-${seed}`,
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
console.log(JSON.stringify(resolved, null, 2));
