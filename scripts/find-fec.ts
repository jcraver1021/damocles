// npm run find:fec -- <name> [--state XX] [--office H|S] [--district N] [--cycle 2026]

import {loadFecBulk} from '../ingest/fec.ts';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const name = args.find(
  (a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')
);
if (!name) {
  console.error(
    'Usage: npm run find:fec -- <name> [--state XX] [--office H|S] [--district N] [--cycle 2026]'
  );
  process.exit(2);
}
const state = flag('state')?.toUpperCase();
const office = flag('office')?.toUpperCase();
const district = flag('district');
const cycle = Number(flag('cycle') ?? 2026);

const {candidates, totals} = await loadFecBulk(cycle);
const q = name.toLowerCase();
const matches = [...candidates.values()].filter(
  c =>
    c.name.toLowerCase().includes(q) &&
    (!state || c.state === state) &&
    (!office || c.office === office) &&
    (!district || c.district === Number(district))
);

const STATUS: Record<string, string> = {
  I: 'incumbent',
  C: 'challenger',
  O: 'open seat',
};
for (const c of matches.sort((a, b) => b.electionYear - a.electionYear)) {
  const raised = totals.get(c.id)?.receipts;
  const seat = `${c.office}-${c.state}${c.office === 'H' ? `-${c.district}` : ''}`;
  console.log(
    [
      c.id,
      c.name.padEnd(32),
      c.party.padEnd(4),
      seat.padEnd(9),
      String(c.electionYear),
      (STATUS[c.status] ?? c.status).padEnd(10),
      raised === undefined
        ? ''
        : `$${Math.round(raised).toLocaleString()} raised`,
    ].join('  ')
  );
}
if (!matches.length) console.log('No matches.');
