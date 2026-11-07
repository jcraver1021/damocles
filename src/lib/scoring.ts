// Evidence -> per-issue scores. Shared by ingest and the app.

import type {Evidence, EvidenceKind, IssueKey, IssueScore} from '../types.ts';

/** Actions outweigh words. */
export const KIND_WEIGHTS: Record<EvidenceKind, number> = {
  vote: 1.0,
  sponsorship: 0.8,
  rating: 0.7,
  finance: 0.6,
  pledge: 0.6,
  debate: 0.5,
  interview: 0.5,
  statement: 0.4,
  website: 0.4,
};

const ACTION_KINDS: ReadonlySet<EvidenceKind> = new Set([
  'vote',
  'sponsorship',
]);
const WORD_KINDS: ReadonlySet<EvidenceKind> = new Set([
  'pledge',
  'statement',
  'debate',
  'interview',
  'website',
]);

/** Years for evidence to lose half its weight. Words fade faster: positions shift. */
export const RECENCY_HALF_LIFE_YEARS = 6;
export const WORDS_HALF_LIFE_YEARS = 2;
export const MIN_WEIGHT_FOR_SCORE = 1;
/** Words-only issues (e.g. members-elect) score at this lower threshold, flagged provisional. */
export const PROVISIONAL_MIN_WEIGHT = 0.4;

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

export interface IssueScoring {
  kindWeights?: Partial<Record<EvidenceKind, number>>;
  minEvidenceWeight?: number;
}

export function evidenceWeight(
  e: Evidence,
  now: Date,
  opts: IssueScoring = {}
): number {
  const ageYears = Math.max(
    0,
    (now.getTime() - Date.parse(e.sourceDate)) / MS_PER_YEAR
  );
  const halfLife = WORD_KINDS.has(e.kind)
    ? WORDS_HALF_LIFE_YEARS
    : RECENCY_HALF_LIFE_YEARS;
  const recency = Math.pow(0.5, ageYears / halfLife);
  const kind = opts.kindWeights?.[e.kind] ?? KIND_WEIGHTS[e.kind];
  return kind * (e.weight ?? 1) * e.confidence * recency;
}

function weightedMean(
  items: Evidence[],
  now: Date,
  opts: IssueScoring = {}
): {mean: number; weight: number} {
  let num = 0;
  let den = 0;
  for (const e of items) {
    const w = evidenceWeight(e, now, opts);
    num += w * (e.stance / 2);
    den += w;
  }
  return {mean: den > 0 ? num / den : 0, weight: den};
}

export function scoreIssue(
  issue: IssueKey,
  evidence: Evidence[],
  now: Date,
  opts: IssueScoring = {}
): IssueScore {
  const items = evidence.filter(e => e.issue === issue);
  const {mean, weight} = weightedMean(items, now, opts);

  const actions = items.filter(e => ACTION_KINDS.has(e.kind));
  const words = items.filter(e => WORD_KINDS.has(e.kind));
  let saysVsDoesGap = false;
  if (actions.length >= 2 && words.length >= 2) {
    const a = weightedMean(actions, now, opts).mean;
    const w = weightedMean(words, now, opts).mean;
    saysVsDoesGap = Math.sign(a) !== Math.sign(w) && Math.abs(a - w) >= 0.75;
  }

  const provisional =
    items.length > 0 && items.every(e => WORD_KINDS.has(e.kind));
  const min = opts.minEvidenceWeight ?? MIN_WEIGHT_FOR_SCORE;
  return {
    issue,
    score:
      weight >= (provisional ? Math.min(min, PROVISIONAL_MIN_WEIGHT) : min)
        ? mean
        : null,
    provisional,
    coverage: 1 - Math.exp(-weight / 3),
    evidenceCount: items.length,
    saysVsDoesGap,
  };
}

export function scoreAll(
  issues: ({key: IssueKey} & IssueScoring)[],
  evidence: Evidence[],
  now: Date
): IssueScore[] {
  return issues.map(i => scoreIssue(i.key, evidence, now, i));
}
