// FEC data. Bulk files (no key) give candidates and cycle totals; the
// small-donor split needs the API and FEC_API_KEY.

import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import type {FinanceSummary} from '../src/types.ts';
import {RAW_DIR, fetchJsonSnapshot} from './lib.ts';

const SOURCE = 'fec';
const BULK = 'https://www.fec.gov/files/bulk-downloads';
const API = 'https://api.open.fec.gov/v1';

export interface FecCandidate {
  id: string;
  name: string;
  party: string;
  electionYear: number;
  state: string;
  office: 'H' | 'S' | 'P';
  district: number;
  /** I incumbent, C challenger, O open seat */
  status: string;
}

export interface FecBulk {
  candidates: Map<string, FecCandidate>;
  totals: Map<string, FinanceSummary>;
}

async function bulkFile(cycle: number, name: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const zipPath = join(RAW_DIR, SOURCE, today, `${name}.zip`);
  if (process.env.REFRESH || !existsSync(zipPath)) {
    const res = await fetch(`${BULK}/${cycle}/${name}.zip`);
    if (!res.ok) throw new Error(`FEC bulk ${name}: ${res.status}`);
    mkdirSync(dirname(zipPath), {recursive: true});
    writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  }
  return execFileSync('unzip', ['-p', zipPath], {
    maxBuffer: 256 * 1024 * 1024,
    encoding: 'utf8',
  });
}

const rows = (text: string) =>
  text
    .split('\n')
    .filter(Boolean)
    .map(l => l.split('|'));

const num = (s: string) => (s ? Number(s) : 0);

const isoDate = (s: string) =>
  s ? `${s.slice(6, 10)}-${s.slice(0, 2)}-${s.slice(3, 5)}` : '';

export async function loadFecBulk(cycle: number): Promise<FecBulk> {
  const yy = String(cycle).slice(2);
  const [cn, weball] = await Promise.all([
    bulkFile(cycle, `cn${yy}`),
    bulkFile(cycle, `weball${yy}`),
  ]);

  // cn: ID|NAME|PARTY|ELECTION_YR|STATE|OFFICE|DISTRICT|ICI|...
  const candidates = new Map<string, FecCandidate>();
  for (const r of rows(cn)) {
    candidates.set(r[0], {
      id: r[0],
      name: r[1],
      party: r[2],
      electionYear: num(r[3]),
      state: r[4],
      office: r[5] as FecCandidate['office'],
      district: num(r[6]),
      status: r[7],
    });
  }

  // weball columns: 5 receipts, 11 candidate, 17 individuals, 25 PACs,
  // 26 party, 27 coverage end.
  const totals = new Map<string, FinanceSummary>();
  for (const r of rows(weball)) {
    totals.set(r[0], {
      cycle,
      candidateId: r[0],
      receipts: num(r[5]),
      individualTotal: num(r[17]),
      pacContributions: num(r[25]),
      partyContributions: num(r[26]),
      candidateSelfFunding: num(r[11]),
      coverageEnd: isoDate(r[27]),
      sourceUrl: `https://www.fec.gov/data/candidate/${r[0]}/?cycle=${cycle}`,
    });
  }
  return {candidates, totals};
}

interface ApiTotals {
  individual_itemized_contributions: number;
  individual_unitemized_contributions: number;
}

export async function addSmallDonorSplit(f: FinanceSummary): Promise<void> {
  const key = process.env.FEC_API_KEY;
  if (!key) return;
  const r = await fetchJsonSnapshot<{results: ApiTotals[]}>(
    SOURCE,
    `${API}/candidate/${f.candidateId}/totals/?cycle=${f.cycle}&api_key=${key}`,
    // Keep the key out of the snapshot name.
    `totals-${f.candidateId}-${f.cycle}.json`
  );
  const t = r.results[0];
  if (!t) return;
  f.individualItemized = t.individual_itemized_contributions;
  f.individualUnitemized = t.individual_unitemized_contributions;
}

/** "EL-SAYED, ABDUL M" -> {first: "Abdul", last: "El-Sayed"} */
export function fecName(raw: string): {first: string; last: string} {
  const title = (s: string) =>
    s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, c => c.toUpperCase());
  const [last, rest = ''] = raw.split(',').map(s => s.trim());
  const first = rest.split(/\s+/)[0] ?? '';
  return {first: title(first), last: title(last)};
}

export function fecParty(code: string): string {
  // DFL: Minnesota Democrats.
  if (code === 'DEM' || code === 'DFL' || /democrat/i.test(code)) {
    return 'Democrat';
  }
  if (code === 'REP' || /republican/i.test(code)) return 'Republican';
  return 'Independent';
}
