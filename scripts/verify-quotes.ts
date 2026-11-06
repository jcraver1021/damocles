// Checks campaign-position and statement quotes appear on their source pages,
// ignoring punctuation and markup; "..." and [brackets] skip text.
// `-- --write` updates quoteVerified. Blocked pages report as unreachable.

import {execFileSync} from 'node:child_process';
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseDocument, isMap, isSeq, type Document, type YAMLMap} from 'yaml';
import {ROOT} from '../ingest/lib.ts';

const write = process.argv.includes('--write');

export function normalize(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    )
    .replace(/\\u([0-9a-f]{4})/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    )
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/g, "'")
    .toLowerCase()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const pages = new Map<string, {text?: string; error?: string}>();
function page(url: string) {
  if (!pages.has(url)) {
    try {
      // curl: some sites serve fetch() a different page.
      const out = execFileSync(
        'curl',
        ['-sL', '-A', 'Mozilla/5.0', '-m', '25', '-w', '\n%{http_code}', url],
        {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024}
      );
      const i = out.lastIndexOf('\n');
      const code = out.slice(i + 1);
      pages.set(
        url,
        code === '200'
          ? {text: normalize(out.slice(0, i))}
          : {error: `HTTP ${code}`}
      );
    } catch (e) {
      pages.set(url, {error: (e as Error).message.split('\n')[0]});
    }
  }
  return pages.get(url)!;
}

type Result = 'ok' | 'mismatch' | 'unreachable';
export function check(
  quote: string,
  url: string
): {result: Result; detail?: string} {
  const p = page(url);
  if (p.error) return {result: 'unreachable', detail: p.error};
  const fragments = quote
    .split(/\.\.\.|…|\[[^\]]*\]/)
    .map(normalize)
    .filter(f => f.length > 8);
  const ok = fragments.length > 0 && fragments.every(f => p.text!.includes(f));
  return ok
    ? {result: 'ok'}
    : {result: 'mismatch', detail: 'quote not found on page'};
}

const counts: Record<Result, number> = {ok: 0, mismatch: 0, unreachable: 0};

function verifyItems(doc: Document, items: YAMLMap[], where: string) {
  for (const item of items) {
    const quote = item.get('quote') as string | undefined;
    const url = item.get('sourceUrl') as string | undefined;
    const who = item.get('memberId');
    if (!quote || !url) continue;
    const {result, detail} = check(quote, url);
    counts[result]++;
    if (result !== 'ok')
      console.log(
        `${result.toUpperCase().padEnd(11)} ${where} ${who}: ${detail} (${url})`
      );
    if (write && result !== 'unreachable')
      item.set('quoteVerified', result === 'ok');
  }
  return doc;
}

function seqItems(node: unknown): YAMLMap[] {
  return isSeq(node) ? (node.items.filter(isMap) as YAMLMap[]) : [];
}

const campaignsPath = join(ROOT, 'config', 'campaigns.yaml');
const campaigns = parseDocument(readFileSync(campaignsPath, 'utf8'));
for (const c of seqItems(campaigns.get('campaigns'))) {
  verifyItems(
    campaigns,
    seqItems(c.get('positions')),
    `campaign ${c.get('id')}`
  );
}
if (write) writeFileSync(campaignsPath, campaigns.toString({lineWidth: 0}));

const dir = join(ROOT, 'data', 'statements');
for (const f of readdirSync(dir).filter(f => /\.ya?ml$/.test(f))) {
  const path = join(dir, f);
  const doc = parseDocument(readFileSync(path, 'utf8'));
  verifyItems(doc, seqItems(doc.get('statements')), f);
  if (write) writeFileSync(path, doc.toString({lineWidth: 0}));
}

console.log(
  `Quotes: ${counts.ok} verified, ${counts.mismatch} not found on their page, ${counts.unreachable} unreachable.`
);
if (write)
  console.log(
    'Updated quoteVerified fields; run `npm run format` and review the diff.'
  );
if (counts.mismatch) process.exit(1);
