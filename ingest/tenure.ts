import type {Chamber, Member, Term, Tenure} from '../src/types.ts';

const DAY = 24 * 3600 * 1000;
const YEAR = 365.25 * DAY;
const MAX_GAP_DAYS = 90;

const years = (from: string, now: Date) =>
  Math.max(0, (now.getTime() - Date.parse(from)) / YEAR);

function sumServiceYears(terms: Term[], now: Date): number {
  return terms.reduce((total, t) => {
    const end = Math.min(Date.parse(t.end), now.getTime());
    return total + Math.max(0, end - Date.parse(t.start)) / YEAR;
  }, 0);
}

function chamberSince(terms: Term[], chamber: Chamber): string {
  let since = terms[terms.length - 1].start;
  for (let i = terms.length - 2; i >= 0; i--) {
    const t = terms[i];
    const gap = (Date.parse(since) - Date.parse(t.end)) / DAY;
    if (t.chamber !== chamber || gap > MAX_GAP_DAYS) break;
    since = t.start;
  }
  return since;
}

/** Rank by continuous service, then total service, then name (approximate). */
export function applyTenure(
  records: {member: Member; terms: Term[]}[],
  now: Date
): void {
  const tenures = new Map<string, Omit<Tenure, 'seniorityRank'>>();
  for (const {member, terms} of records) {
    const since = chamberSince(terms, member.chamber);
    tenures.set(member.id, {
      chamberSince: since,
      congressSince: terms[0].start,
      yearsInChamber: Math.round(years(since, now) * 10) / 10,
      yearsInCongress: Math.round(sumServiceYears(terms, now) * 10) / 10,
      freshman: since === member.termStart,
    });
  }

  for (const chamber of ['house', 'senate'] as const) {
    const ranked = records
      .map(r => r.member)
      .filter(m => m.chamber === chamber)
      .sort((a, b) => {
        const ta = tenures.get(a.id)!;
        const tb = tenures.get(b.id)!;
        return (
          ta.chamberSince.localeCompare(tb.chamberSince) ||
          tb.yearsInCongress - ta.yearsInCongress ||
          a.name.last.localeCompare(b.name.last)
        );
      });
    ranked.forEach((m, i) => {
      m.tenure = {...tenures.get(m.id)!, seniorityRank: i + 1};
    });
  }
}
