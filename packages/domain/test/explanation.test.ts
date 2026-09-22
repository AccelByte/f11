import { describe, expect, it } from 'vitest';

import { buildExplanation, type RosterAssessment } from '../src/index.js';

const assessment: RosterAssessment = {
  categories: {
    quality: 88,
    positioning: 82,
    chemistry: 61,
    tacticalBalance: 93,
    leadership: 78,
  },
  tacticalAxes: {
    width: { supply: 72, score: 100 },
    defensiveCover: { supply: 60, score: 86.96 },
  },
  composite: 81.2,
  units: { attack: 82, defence: 78, control: 80 },
};

describe('explanation-v1', () => {
  it('selects deterministic strongest, weakest, and material context facts', () => {
    const explanation = buildExplanation(assessment);
    expect(explanation.summary).toBe(
      'Strong tactical balance (93.0) led the XI, while chemistry (61.0) was its clearest limitation.',
    );
    expect(explanation.facts).toEqual([
      { key: 'category.tacticalBalance', value: 93, polarity: 'strength' },
      { key: 'category.chemistry', value: 61, polarity: 'weakness' },
      { key: 'category.positioning', value: 82, polarity: 'context' },
      { key: 'tactical.defensiveCover', value: 86.96, polarity: 'context' },
    ]);
  });

  it('breaks category and tactical ties by stable fact key', () => {
    const tied: RosterAssessment = {
      ...assessment,
      categories: {
        quality: 80,
        positioning: 80,
        chemistry: 80,
        tacticalBalance: 80,
        leadership: 80,
      },
      tacticalAxes: { width: { supply: 50, score: 75 }, aerialPresence: { supply: 50, score: 75 } },
    };
    const explanation = buildExplanation(tied);
    expect(explanation.facts[0]?.key).toBe('category.chemistry');
    expect(explanation.facts[1]?.key).toBe('category.tacticalBalance');
    expect(explanation.facts.at(-1)?.key).toBe('tactical.aerialPresence');
  });

  it('emits only fact keys whose values exist in retained assessment data', () => {
    const explanation = buildExplanation(assessment);
    for (const fact of explanation.facts) {
      const [group, key] = fact.key.split('.');
      const retained =
        group === 'category'
          ? assessment.categories[key as keyof typeof assessment.categories]
          : assessment.tacticalAxes[key ?? '']?.score;
      expect(fact.value).toBe(retained);
    }
  });
});
