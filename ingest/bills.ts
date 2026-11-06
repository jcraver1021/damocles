// Sponsors/cosponsors from GovInfo bill status -> evidence for `bill:` anchors.
//
// For "yes" bills, members of the chamber who didn't sign on get weak "not
// aligned" evidence: that separates members within a party. It's -2, not 0,
// so it never raises an opposed member's score.

import type {Chamber, Evidence, Member, Rubric, Term} from '../src/types.ts';
import {fetchTextSnapshot} from './lib.ts';

const SOURCE = 'govinfo-billstatus';
const NON_COSPONSOR_WEIGHT = 0.25;
/** Below this, not signing says little; sponsors still get credit. */
const MIN_SIGNERS_FOR_ABSENCE = 10;

interface BillRef {
  ref: string;
  type: string;
  number: number;
  congress: number;
}

export function parseBillRef(ref: string): BillRef | null {
  const m = /^bill:([a-z]+)(\d+)-(\d+)$/.exec(ref);
  return m
    ? {ref, type: m[1], number: Number(m[2]), congress: Number(m[3])}
    : null;
}

const CONGRESS_GOV_TYPE: Record<string, string> = {
  hr: 'house-bill',
  s: 'senate-bill',
  hres: 'house-resolution',
  sres: 'senate-resolution',
  hjres: 'house-joint-resolution',
  sjres: 'senate-joint-resolution',
  hconres: 'house-concurrent-resolution',
  sconres: 'senate-concurrent-resolution',
};

const chamberOf = (type: string): Chamber =>
  type.startsWith('h') ? 'house' : 'senate';

const congressEnd = (congress: number) => `${1789 + 2 * congress}-01-03`;

const tag = (xml: string, name: string) =>
  new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1];

function items(xml: string, section: string): string[] {
  const block = new RegExp(`<${section}>([\\s\\S]*?)</${section}>`).exec(
    xml
  )?.[1];
  return block
    ? [...block.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1])
    : [];
}

export interface Bill {
  title: string;
  introduced: string;
  sponsor?: {bioguide: string; date: string};
  cosponsors: {bioguide: string; date: string}[];
}

export async function loadBill(b: BillRef): Promise<Bill> {
  const file = `BILLSTATUS-${b.congress}${b.type}${b.number}.xml`;
  const raw = await fetchTextSnapshot(
    SOURCE,
    `https://www.govinfo.gov/bulkdata/BILLSTATUS/${b.congress}/${b.type}/${file}`
  );
  // Drop nested sections that carry their own titles and sponsors.
  const xml = raw.replace(
    /<(relatedBills|amendments|committeeReports|cboCostEstimates|laws)>[\s\S]*?<\/\1>/g,
    ''
  );
  const introduced = tag(xml, 'introducedDate') ?? '';
  const sponsorItem = items(xml, 'sponsors')[0];
  return {
    title: tag(xml, 'title') ?? b.ref,
    introduced,
    sponsor: sponsorItem
      ? {bioguide: tag(sponsorItem, 'bioguideId')!, date: introduced}
      : undefined,
    cosponsors: items(xml, 'cosponsors')
      .filter(i => !tag(i, 'sponsorshipWithdrawnDate'))
      .map(i => ({
        bioguide: tag(i, 'bioguideId')!,
        date: tag(i, 'sponsorshipDate') ?? introduced,
      })),
  };
}

const servedIn = (terms: Term[], chamber: Chamber, from: string, to: string) =>
  terms.some(t => t.chamber === chamber && t.start < to && t.end > from);

export async function ingestBillAnchors(
  rubric: Rubric,
  records: {member: Member; terms: Term[]}[],
  now: Date
): Promise<Evidence[]> {
  const evidence: Evidence[] = [];
  const today = now.toISOString().slice(0, 10);
  const byBioguide = new Map(records.map(r => [r.member.id, r]));

  for (const issue of rubric.issues) {
    for (const anchor of issue.anchors) {
      const b = parseBillRef(anchor.ref);
      if (!b) continue;
      const bill = await loadBill(b);
      const chamber = chamberOf(b.type);
      const url = `https://www.congress.gov/bill/${b.congress}th-congress/${CONGRESS_GOV_TYPE[b.type] ?? b.type}/${b.number}/cosponsors`;
      const aligned = anchor.alignedPosition === 'yes';
      const signers = new Map<string, {date: string; role: string}>();
      if (bill.sponsor) {
        signers.set(bill.sponsor.bioguide, {
          date: bill.sponsor.date,
          role: 'Sponsored',
        });
      }
      for (const c of bill.cosponsors) {
        if (!signers.has(c.bioguide))
          signers.set(c.bioguide, {date: c.date, role: 'Cosponsored'});
      }

      for (const [bioguide, s] of signers) {
        if (!byBioguide.has(bioguide)) continue; // no longer serving
        evidence.push({
          id: `${anchor.ref}:${bioguide}:${issue.key}`,
          memberId: bioguide,
          issue: issue.key,
          kind: 'sponsorship',
          stance: aligned ? 2 : -2,
          summary: `${s.role} ${anchor.label}`,
          sourceUrl: url,
          sourceDate: s.date,
          method: 'deterministic',
          confidence: 1,
          weight: anchor.weight,
          reviewed: true,
        });
      }

      if (
        !aligned ||
        issue.nonCosponsorEvidence === false ||
        signers.size < MIN_SIGNERS_FOR_ABSENCE
      ) {
        continue;
      }
      const closes =
        congressEnd(b.congress) < today ? congressEnd(b.congress) : today;
      for (const {member, terms} of records) {
        if (signers.has(member.id) || member.chamber !== chamber) continue;
        if (!servedIn(terms, chamber, bill.introduced, closes)) continue;
        evidence.push({
          id: `${anchor.ref}:${member.id}:${issue.key}:absent`,
          memberId: member.id,
          issue: issue.key,
          kind: 'sponsorship',
          stance: -2,
          absence: true,
          summary: `Didn't sign on to ${anchor.label}`,
          sourceUrl: url,
          sourceDate: closes,
          method: 'deterministic',
          confidence: 1,
          weight: (anchor.weight ?? 1) * NON_COSPONSOR_WEIGHT,
          reviewed: true,
        });
      }
      console.log(
        `  ${anchor.ref} "${bill.title}": ${signers.size} sponsors/cosponsors`
      );
    }
  }
  return evidence;
}
