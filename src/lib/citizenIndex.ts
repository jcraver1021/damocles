// Citizen index (0-100), weighted by the user's priorities. Runs in the browser.

import type {CategoryKey, IssueScore, Rubric, Member} from '../types.ts';
import type {Priorities} from './priorities.ts';

export const MIN_SCORED_ISSUES = 3;
/** Members-elect rarely have votes, so any scored issue counts (shown provisional). */
export const MIN_SCORED_ISSUES_ELECT = 1;

export const minScoredIssues = (m: Pick<Member, 'status'>) =>
  m.status === 'elect' ? MIN_SCORED_ISSUES_ELECT : MIN_SCORED_ISSUES;

export interface CategoryIndex {
  category: CategoryKey;
  value: number | null;
  scoredIssues: number;
  totalIssues: number;
  aggregate: 'mean' | 'min';
}

export interface CitizenIndex {
  value: number | null;
  /** Majority of scored issues are words-only. */
  provisional: boolean;
  /** Share of priority weight that has a score. */
  coverage: number;
  scoredIssues: number;
  byCategory: CategoryIndex[];
}

export const toIndex = (score: number) => Math.round((score + 1) * 50);

export function citizenIndex(
  scores: IssueScore[],
  rubric: Rubric,
  priorities: Priorities,
  minScored = MIN_SCORED_ISSUES
): CitizenIndex {
  const byIssue = new Map(scores.map(s => [s.issue, s.score]));
  const provisionalIssues = new Set(
    scores.filter(s => s.provisional && s.score !== null).map(s => s.issue)
  );
  let provisionalScored = 0;
  let num = 0;
  let den = 0;
  let totalWeight = 0;
  let scored = 0;
  const byCategory: CategoryIndex[] = [];

  for (const cat of rubric.categories) {
    const issues = rubric.issues.filter(
      i => i.category === cat.key && (priorities[i.key] ?? 1) > 0
    );
    if (!issues.length) continue;
    const weight = (key: string) => priorities[key] ?? 1;
    const catWeight = issues.reduce((t, i) => t + weight(i.key), 0);
    totalWeight += catWeight;
    const withScores = issues.filter(
      i => byIssue.get(i.key) !== null && byIssue.get(i.key) !== undefined
    );
    scored += withScores.length;
    provisionalScored += withScores.filter(i =>
      provisionalIssues.has(i.key)
    ).length;

    let value: number | null = null;
    if (withScores.length) {
      if (cat.aggregate === 'min') {
        // One unit at the weakest score, with the category's full weight.
        const min = Math.min(...withScores.map(i => byIssue.get(i.key)!));
        value = min;
        num += catWeight * min;
        den += catWeight;
      } else {
        let cn = 0;
        let cd = 0;
        for (const i of withScores) {
          cn += weight(i.key) * byIssue.get(i.key)!;
          cd += weight(i.key);
        }
        value = cn / cd;
        num += cn;
        den += cd;
      }
    }
    byCategory.push({
      category: cat.key,
      value: value === null ? null : toIndex(value),
      scoredIssues: withScores.length,
      totalIssues: issues.length,
      aggregate: cat.aggregate ?? 'mean',
    });
  }

  return {
    value: scored >= minScored && den > 0 ? toIndex(num / den) : null,
    provisional: provisionalScored * 2 > scored,
    coverage: totalWeight > 0 ? den / totalWeight : 0,
    scoredIssues: scored,
    byCategory,
  };
}

export interface Band {
  key: 'strong-ally' | 'ally' | 'mixed' | 'opposed' | 'strongly-opposed';
  label: string;
  min: number;
}

export const BANDS: Band[] = [
  {key: 'strong-ally', label: 'Strong ally', min: 85},
  {key: 'ally', label: 'Ally', min: 65},
  {key: 'mixed', label: 'Mixed', min: 40},
  {key: 'opposed', label: 'Opposed', min: 20},
  {key: 'strongly-opposed', label: 'Strongly opposed', min: 0},
];

export const bandFor = (value: number) => BANDS.find(b => value >= b.min)!;
