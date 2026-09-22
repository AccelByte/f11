import type {
  CategoryScores,
  ExplanationFact,
  RosterAssessment,
  StructuredExplanation,
} from '../types.js';

const CATEGORY_LABELS: Record<keyof CategoryScores, string> = {
  quality: 'individual quality',
  positioning: 'positional fit',
  chemistry: 'chemistry',
  tacticalBalance: 'tactical balance',
  leadership: 'leadership',
};

function categoryEntries(assessment: RosterAssessment) {
  return (Object.entries(assessment.categories) as Array<[keyof CategoryScores, number]>).toSorted(
    ([leftKey, left], [rightKey, right]) => right - left || leftKey.localeCompare(rightKey),
  );
}

export function buildExplanation(assessment: RosterAssessment): StructuredExplanation {
  const ranked = categoryEntries(assessment);
  const strongest = ranked[0];
  const weakest = ranked.at(-1);
  if (!strongest || !weakest) return { summary: 'No assessment facts are available.', facts: [] };

  const facts: ExplanationFact[] = [
    { key: `category.${strongest[0]}`, value: strongest[1], polarity: 'strength' },
    { key: `category.${weakest[0]}`, value: weakest[1], polarity: 'weakness' },
  ];
  if (assessment.categories.positioning < 90 && weakest[0] !== 'positioning') {
    facts.push({
      key: 'category.positioning',
      value: assessment.categories.positioning,
      polarity: 'context',
    });
  }
  if (assessment.categories.chemistry < 70 && weakest[0] !== 'chemistry') {
    facts.push({
      key: 'category.chemistry',
      value: assessment.categories.chemistry,
      polarity: 'context',
    });
  }
  const tacticalWeakness = Object.entries(assessment.tacticalAxes).toSorted(
    ([leftKey, left], [rightKey, right]) =>
      left.score - right.score || leftKey.localeCompare(rightKey),
  )[0];
  if (tacticalWeakness && tacticalWeakness[1].score < 100) {
    facts.push({
      key: `tactical.${tacticalWeakness[0]}`,
      value: tacticalWeakness[1].score,
      polarity: 'context',
    });
  }

  return {
    summary: `Strong ${CATEGORY_LABELS[strongest[0]]} (${strongest[1].toFixed(1)}) led the XI, while ${CATEGORY_LABELS[weakest[0]]} (${weakest[1].toFixed(1)}) was its clearest limitation.`,
    facts,
  };
}
