import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const productionSources = [
  new URL('../app/page.tsx', import.meta.url),
  new URL('./features/rooms/FriendRoomView.tsx', import.meta.url),
  new URL('./features/competition/SavedXiCompetitionView.tsx', import.meta.url),
];

const developmentCopy = [
  'Connected development',
  'AGS guest · Cloud Save',
  'access token stays in memory',
  'replay hash',
  'local development also requires',
  'canonical AGS room',
  'read back from AGS',
  'Statistics read back',
  'player-authoritative result',
  'AGS friend room',
  'session v',
  'OPEN allows discovery',
  'trusted receipt',
  'server-seeded match',
  'Settlement retry ready',
  'Repair exact settlement',
  'opponent token',
  'current mechanics version',
  'Settlement pending',
];

describe('production copy', () => {
  it.each(productionSources)('does not expose development language in %s', (sourceUrl) => {
    const source = readFileSync(sourceUrl, 'utf8');

    for (const phrase of developmentCopy) {
      expect(source).not.toContain(phrase);
    }
  });

  it('labels the active named OpenFootball squad source without Wyscout copy', () => {
    const source = readFileSync(productionSources[0], 'utf8');

    expect(source).toContain('OpenFootball England');
    expect(source).toContain('Premier League 2023/24');
    expect(source).toContain('Cards use real 2023/24 squad names and club membership');
    expect(source).toContain('not official player ratings');
    expect(source).not.toContain('Wyscout');
  });

  it('waits for live draft settings and presents a safe retry state', () => {
    const source = readFileSync(productionSources[0], 'utf8');

    expect(source).toContain('requestDraftChallenge(accessToken)');
    expect(source.indexOf('requestDraftChallenge(accessToken)')).toBeLessThan(
      source.indexOf('createGameSession(challenge)'),
    );
    expect(source).toContain('Starting draft…');
    expect(source).toContain('Draft settings are unavailable right now. Try starting again.');
    expect(source).not.toContain('activeDraftConfig');
  });

  it('announces delayed controls and guards rapid repeat actions', () => {
    const page = readFileSync(productionSources[0], 'utf8');
    const rooms = readFileSync(productionSources[1], 'utf8');
    const competition = readFileSync(productionSources[2], 'utf8');
    const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
    const interactiveSources = `${page}\n${rooms}\n${competition}`;

    for (const label of [
      'Starting draft…',
      'Retrying save…',
      'Verifying result…',
      'Creating room…',
      'Joining by code…',
      'Saving status…',
      'Starting round…',
      'Revoking code…',
      'Leaving…',
      'Publishing…',
      'Searching…',
      'Playing match…',
    ]) {
      expect(interactiveSources).toContain(label);
    }

    expect(interactiveSources.match(/aria-busy=/g)?.length).toBeGreaterThanOrEqual(12);
    expect(page).toContain('if (startBusyRef.current) return;');
    expect(page).toContain('if (rankingBusyRef.current) return;');
    expect(page).toContain('if (storageBusyRef.current) return;');
    expect(page).toContain("if (roomActionRef.current !== 'idle') return false;");
    expect(rooms).toContain('if (!room?.joinCode || copyBusyRef.current) return;');
    expect(competition).toContain("if (actionRef.current !== 'idle') return;");
    expect(styles).toContain("button[aria-busy='true']:disabled");
  });
});
