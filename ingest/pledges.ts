// data/pledges/*.yaml -> "pledge" evidence, one item per signer.

import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {parse} from 'yaml';
import type {Evidence, Rubric} from '../src/types.ts';
import type {Identity} from './identity.ts';
import {ROOT} from './lib.ts';

interface Pledge {
  key: string;
  name: string;
  issue: string;
  stance: number;
  url: string;
  retrieved: string;
  description?: string;
  signers?: {
    member: string;
    name?: string;
    sourceUrl?: string;
    date?: string;
  }[];
}

const DIR = join(ROOT, 'data', 'pledges');

export async function ingestPledges(
  rubric: Rubric,
  identity: Identity
): Promise<Evidence[]> {
  const files = (await readdir(DIR).catch(() => [])).filter(f =>
    /\.ya?ml$/.test(f)
  );
  const issues = new Set(rubric.issues.map(i => i.key));
  const errors: string[] = [];
  const evidence: Evidence[] = [];

  for (const f of files.sort()) {
    const p = parse(await readFile(join(DIR, f), 'utf8')) as Pledge;
    if (!issues.has(p.issue)) errors.push(`${f}: unknown issue ${p.issue}`);
    if (!(p.stance >= -2 && p.stance <= 2))
      errors.push(`${f}: stance must be -2..2`);
    if (!p.url || !/^\d{4}-\d{2}-\d{2}$/.test(p.retrieved ?? '')) {
      errors.push(`${f}: needs url and retrieved (YYYY-MM-DD)`);
    }
    // Catch one person listed under two IDs (e.g. bioguide and FEC).
    const seen = new Map<string, string>();
    for (const s of p.signers ?? []) {
      const ids = identity.resolve(s.member);
      if (!ids.length) {
        errors.push(`${f}: unknown member ${s.member} (${s.name})`);
      }
      const dup = ids.find(id => seen.has(id));
      if (dup)
        errors.push(`${f}: ${s.member} and ${seen.get(dup)} are one person`);
      for (const id of ids) seen.set(id, s.member);
      evidence.push({
        id: `pledge:${p.key}:${s.member}`,
        memberId: s.member,
        issue: p.issue,
        kind: 'pledge',
        stance: p.stance,
        summary: `Signed the ${p.name}${p.description ? `: ${p.description}` : ''}`,
        sourceUrl: s.sourceUrl ?? p.url,
        sourceDate: s.date ?? p.retrieved,
        method: 'human',
        confidence: 1,
        reviewed: true,
      });
    }
    console.log(`  pledge ${p.key}: ${p.signers?.length ?? 0} signers`);
  }
  if (errors.length) {
    throw new Error(`data/pledges is invalid:\n  ${errors.join('\n  ')}`);
  }
  return evidence;
}
