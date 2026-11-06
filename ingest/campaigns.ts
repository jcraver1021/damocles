import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parse} from 'yaml';
import type {
  Campaign,
  CampaignStance,
  Member,
  ResolvedCampaign,
} from '../src/types.ts';
import {ROOT} from './lib.ts';

const STANCES: CampaignStance[] = [
  'committed',
  'leaning',
  'undecided',
  'opposed',
];
const OUTCOMES = ['open', 'success', 'partial', 'failure'];
const MILESTONE_STATUSES = ['pending', 'met', 'missed'];

function inAudience(m: Member, c: Campaign): boolean {
  const a = c.audience;
  if (m.chamber !== a.chamber || m.caucus !== a.caucus) return false;
  if (a.session === 'current') return m.status === 'serving';
  return m.status === 'elect' || !m.departure;
}

function needed(c: Campaign, audience: Member[]): number {
  const voting = audience.filter(m => m.votingMember).length;
  if (c.threshold.kind === 'caucus-majority') {
    return Math.floor(voting / 2) + 1;
  }
  const size = c.threshold.chamberSize ?? 435;
  return Math.max(0, voting - Math.floor(size / 2));
}

export async function ingestCampaigns(
  members: Member[]
): Promise<ResolvedCampaign[]> {
  const file = parse(
    await readFile(join(ROOT, 'config', 'campaigns.yaml'), 'utf8')
  ) as {campaigns: Campaign[]};
  const errors: string[] = [];
  const byId = new Map(members.map(m => [m.id, m]));

  const resolved = file.campaigns.map(c => {
    c.positions ??= [];
    c.milestones ??= [];
    const audience = members.filter(m => inAudience(m, c));
    const audienceIds = new Set(audience.map(m => m.id));

    if (!OUTCOMES.includes(c.outcome)) errors.push(`${c.id}: bad outcome`);
    for (const ms of c.milestones) {
      if (!MILESTONE_STATUSES.includes(ms.status)) {
        errors.push(`${c.id}/${ms.id}: bad milestone status "${ms.status}"`);
      }
    }
    const seen = new Set<string>();
    for (const p of c.positions) {
      if (!byId.has(p.memberId))
        errors.push(`${c.id}: unknown member ${p.memberId}`);
      else if (!audienceIds.has(p.memberId)) {
        errors.push(`${c.id}: ${p.memberId} isn't in the audience`);
      }
      if (seen.has(p.memberId)) errors.push(`${c.id}: duplicate ${p.memberId}`);
      seen.add(p.memberId);
      if (!STANCES.includes(p.stance))
        errors.push(`${c.id}: bad stance ${p.stance}`);
      if (!p.sourceUrl) errors.push(`${c.id}: ${p.memberId} needs a sourceUrl`);
    }

    const counts = Object.fromEntries(STANCES.map(s => [s, 0])) as Record<
      CampaignStance,
      number
    >;
    for (const id of audienceIds) {
      counts[c.positions.find(p => p.memberId === id)?.stance ?? 'undecided']++;
    }
    const need = needed(c, audience);
    return {
      ...c,
      threshold: {
        ...c.threshold,
        partialAt: c.threshold.partialAt ?? Math.ceil(need / 2),
      },
      audienceIds: [...audienceIds],
      needed: need,
      counts,
    };
  });

  if (errors.length) {
    throw new Error(
      `config/campaigns.yaml is invalid:\n  ${errors.join('\n  ')}`
    );
  }
  return resolved;
}
