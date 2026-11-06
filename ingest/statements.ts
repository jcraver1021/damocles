// data/statements/*.yaml -> "statement" evidence. Apologies count half.

import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {parse} from 'yaml';
import type {Evidence, Rubric} from '../src/types.ts';
import {ROOT} from './lib.ts';

interface StatementEntry {
  memberId: string;
  issue: string;
  stance: number;
  date: string;
  sourceUrl: string;
  quote: string;
  summary: string;
  apologized?: boolean;
  apology?: string;
  quoteVerified?: boolean;
}

const DIR = join(ROOT, 'data', 'statements');

export async function ingestStatements(
  rubric: Rubric,
  memberIds: Set<string>
): Promise<Evidence[]> {
  const files = (await readdir(DIR).catch(() => [])).filter(f =>
    /\.ya?ml$/.test(f)
  );
  const issues = new Set(rubric.issues.map(i => i.key));
  const errors: string[] = [];
  const evidence: Evidence[] = [];

  for (const f of files.sort()) {
    const entries =
      (
        parse(await readFile(join(DIR, f), 'utf8')) as {
          statements?: StatementEntry[];
        }
      )?.statements ?? [];
    entries.forEach((s, n) => {
      const where = `${f}#${n + 1} (${s.memberId})`;
      if (!memberIds.has(s.memberId)) errors.push(`${where}: unknown member`);
      if (!issues.has(s.issue))
        errors.push(`${where}: unknown issue ${s.issue}`);
      if (!(s.stance >= -2 && s.stance <= 2))
        errors.push(`${where}: stance must be -2..2`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date))
        errors.push(`${where}: date must be YYYY-MM-DD`);
      if (!s.sourceUrl || !s.quote)
        errors.push(`${where}: needs sourceUrl and quote`);
      evidence.push({
        id: `statement:${f}:${n + 1}:${s.memberId}`,
        memberId: s.memberId,
        issue: s.issue,
        kind: 'statement',
        stance: s.stance,
        summary: s.apologized
          ? `${s.summary} (Later apologized${s.apology ? `: “${s.apology}”` : ''}.)`
          : s.summary,
        quote: s.quote,
        sourceUrl: s.sourceUrl,
        sourceDate: s.date,
        method: 'human',
        confidence: 1,
        weight: s.apologized ? 0.5 : 1,
        reviewed: s.quoteVerified === true,
      });
    });
  }
  if (errors.length) {
    throw new Error(`data/statements is invalid:\n  ${errors.join('\n  ')}`);
  }
  if (evidence.length) console.log(`  statements: ${evidence.length}`);
  return evidence;
}
