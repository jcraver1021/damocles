// npm run ingest: fetch sources, score evidence, write public/data/.

import {join} from 'node:path';
import {scoreAll} from '../src/lib/scoring.ts';
import type {
  Evidence,
  IndexedMember,
  MemberDetail,
  MembersIndex,
} from '../src/types.ts';
import {ingestBillAnchors, type Person} from './bills.ts';
import {addSmallDonorSplit, loadFecBulk} from './fec.ts';
import {ingestCampaigns} from './campaigns.ts';
import {Identity} from './identity.ts';
import {ingestLegislators, loadHistoricalTerms} from './legislators.ts';
import {PUBLIC_DATA_DIR, resetDir, writeJson} from './lib.ts';
import {ingestMembersElect} from './membersElect.ts';
import {ingestPledges} from './pledges.ts';
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
// Members-elect who served before keep their record: terms from the current
// roster (e.g. a House member elected to the Senate) or the historical one.
const termsByBioguide = new Map(records.map(r => [r.member.id, r.terms]));
const formerIds = new Set(
  elect.members
    .map(m => m.ids.bioguide)
    .filter((b): b is string => !!b && !termsByBioguide.has(b))
);
for (const [b, terms] of await loadHistoricalTerms(formerIds)) {
  termsByBioguide.set(b, terms);
}
const allRecords = [
  ...records,
  ...elect.members.map(member => ({
    member,
    terms: termsByBioguide.get(member.ids.bioguide ?? '') ?? [],
  })),
];
const identity = new Identity(allRecords.map(r => r.member));
const people: Person[] = [...termsByBioguide].map(([bioguide, terms]) => ({
  bioguide,
  terms,
}));

// Evidence sources. memberId may be any alias; identity routes it.
const evidence: Evidence[] = [
  ...(await ingestAnchorVotes(rubric)),
  ...(await ingestScorecards(rubric, records, now)),
  ...(await ingestBillAnchors(rubric, people, now)),
  ...(await ingestStatements(rubric, identity)),
  ...(await ingestPledges(rubric, identity)),
];
const evidenceByMember = new Map<string, Evidence[]>();
for (const e of evidence) {
  for (const id of identity.resolve(e.memberId)) {
    evidenceByMember.set(id, [...(evidenceByMember.get(id) ?? []), e]);
  }
}

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

const campaigns = await ingestCampaigns(
  allRecords.map(r => r.member),
  identity
);
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
