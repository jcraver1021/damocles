// Scorecard CSVs (format in data/scorecards/README.md) -> "rating" evidence.

import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {
  Evidence,
  IssueKey,
  Member,
  Rubric,
  ScorecardSource,
  Term,
} from '../src/types.ts';
import {ROOT, parseCsv} from './lib.ts';

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const SUFFIX = /,?\s+(jr|sr|ii|iii|iv)\.?$/i;

/** Congress end date, capped at today. */
function congressEnd(congress: number, now: Date): string {
  const end = `${1789 + 2 * congress}-01-03`;
  const today = now.toISOString().slice(0, 10);
  return end < today ? end : today;
}

interface Row {
  chamber: string;
  state: string;
  district: string;
  last: string;
  first: string;
  congress: string;
  score: string;
  note?: string;
  page?: string;
}

/** Match by seat and last name; first name breaks ties. */
function makeMatcher(records: {member: Member; terms: Term[]}[]) {
  return (row: Row): Member | undefined => {
    const last = normalize(row.last.replace(SUFFIX, ''));
    const district = row.district === '' ? undefined : Number(row.district);
    const holdsSeat = (t: Term) =>
      t.chamber === row.chamber &&
      t.state === row.state &&
      (row.chamber === 'senate' || t.district === district);
    const nameMatches = (m: Member) => {
      const ours = normalize(m.name.last);
      return ours === last || ours.endsWith(last) || last.endsWith(ours);
    };
    const candidates = records.filter(
      r => r.terms.some(holdsSeat) && nameMatches(r.member)
    );
    if (candidates.length === 1) return candidates[0].member;
    const first = normalize(row.first.split(' ')[0]);
    return candidates.find(r => normalize(r.member.name.first) === first)
      ?.member;
  };
}

export async function ingestScorecards(
  rubric: Rubric,
  records: {member: Member; terms: Term[]}[],
  now: Date
): Promise<Evidence[]> {
  const match = makeMatcher(records);
  const evidence: Evidence[] = [];

  const sources: {issue: IssueKey; card: ScorecardSource}[] =
    rubric.issues.flatMap(i =>
      i.scorecards.filter(c => c.file).map(card => ({issue: i.key, card}))
    );

  for (const {issue, card} of sources) {
    let text: string;
    try {
      text = await readFile(join(ROOT, card.file!), 'utf8');
    } catch {
      console.warn(`  ${card.name}: ${card.file} not found; skipping`);
      continue;
    }
    const rows = parseCsv(text) as unknown as Row[];
    const unmatched = new Set<string>();
    let count = 0;
    for (const row of rows) {
      const member = match(row);
      if (!member) {
        unmatched.add(
          `${row.last}, ${row.first} (${row.chamber} ${row.state}${row.district ? `-${row.district}` : ''})`
        );
        continue;
      }
      const score = Number(row.score);
      const aligned = card.polarity === 'aligned' ? score : 100 - score;
      const congress = Number(row.congress);
      evidence.push({
        id: `rating:${card.key}:${congress}:${member.id}:${issue}`,
        memberId: member.id,
        issue,
        kind: 'rating',
        stance: (aligned / 50 - 1) * 2,
        summary: `${card.name}, ${congress}th Congress: ${score}/100${row.note ? ` (${row.note})` : ''}`,
        sourceUrl: card.dataUrl ?? card.url,
        sourceDate: congressEnd(congress, now),
        method: 'deterministic',
        confidence: 1,
        reviewed: true,
        rating: {
          source: card.name,
          congress,
          score,
          polarity: card.polarity,
        },
      });
      count++;
    }
    console.log(`  ${card.name}: ${count} ratings`);
    for (const u of unmatched) console.log(`    unmatched: ${u}`);
  }
  return evidence;
}
