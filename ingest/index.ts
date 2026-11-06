// npm run ingest: fetch sources, score evidence, write public/data/.

import {join} from 'node:path';
import {scoreAll} from '../src/lib/scoring.ts';
import type {
  Evidence,
  IndexedMember,
  MemberDetail,
  MembersIndex,
} from '../src/types.ts';
import {ingestBillAnchors} from './bills.ts';
import {addSmallDonorSplit, loadFecBulk} from './fec.ts';
import {ingestCampaigns} from './campaigns.ts';
import {ingestLegislators} from './legislators.ts';
import {PUBLIC_DATA_DIR, resetDir, writeJson} from './lib.ts';
import {ingestMembersElect} from './membersElect.ts';
import {loadRubric} from './rubric.ts';
import {applyTenure} from './tenure.ts';
import {ingestScorecards} from './scorecards.ts';
import {ingestStatements} from './statements.ts';
import {ingestAnchorVotes} from './voteview.ts';

const now = new Date();
const rubric = await loadRubric();
const records = await ingestLegislators();
applyTenure(records, now);

const fec = await loadFecBulk(2026);
for (const {member} of records) {
  const id = [...member.ids.fec].reverse().find(f => fec.totals.has(f));
  if (id) member.finance = fec.totals.get(id);
}

const elect = await ingestMembersElect(
  new Set(records.map(r => r.member.id)),
  fec
);
if (process.env.FEC_API_KEY) {
  for (const m of [...records.map(r => r.member), ...elect.members]) {
    if (m.finance) await addSmallDonorSplit(m.finance);
  }
}
for (const {member} of records) {
  member.departure = elect.departures.get(member.id);
}
const allRecords = [
  ...records,
  ...elect.members.map(member => ({member, terms: []})),
];

// Evidence sources.
const evidence: Evidence[] = [
  ...(await ingestAnchorVotes(rubric)),
  ...(await ingestScorecards(rubric, records, now)),
  ...(await ingestBillAnchors(rubric, records, now)),
  ...(await ingestStatements(
    rubric,
    new Set([...records.map(r => r.member.id), ...elect.members.map(m => m.id)])
  )),
];
const evidenceByMember = Map.groupBy(evidence, e => e.memberId);

await writeJson(join(PUBLIC_DATA_DIR, 'rubric.json'), rubric);

const memberDir = join(PUBLIC_DATA_DIR, 'members');
await resetDir(memberDir);
const indexed: IndexedMember[] = [];
for (const {member, terms} of allRecords) {
  const evidence = evidenceByMember.get(member.id) ?? [];
  const scores = scoreAll(rubric.issues, evidence, now);
  const detail: MemberDetail = {member, terms, evidence, scores};
  await writeJson(join(memberDir, `${member.id}.json`), detail);
  indexed.push({...member, scores});
}

const index: MembersIndex = {
  generatedAt: now.toISOString(),
  source: 'https://github.com/unitedstates/congress-legislators',
  members: indexed,
};
await writeJson(join(PUBLIC_DATA_DIR, 'members.json'), index);

const campaigns = await ingestCampaigns(allRecords.map(r => r.member));
await writeJson(join(PUBLIC_DATA_DIR, 'campaigns.json'), campaigns);
for (const c of campaigns) {
  console.log(
    `  campaign ${c.id}: audience ${c.audienceIds.length}, needs ${c.needed}, committed ${c.counts.committed}`
  );
}

const count = (c: string) => records.filter(r => r.member.chamber === c).length;
console.log(`${evidence.length} evidence items`);
console.log(`${elect.members.length} members-elect`);
console.log(
  `Wrote ${records.length} members (${count('senate')} senate, ${count('house')} house) to public/data/`
);
