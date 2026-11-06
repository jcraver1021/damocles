import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parse} from 'yaml';
import type {Chamber, Departure, Member} from '../src/types.ts';
import {type FecBulk, fecName, fecParty} from './fec.ts';
import {ROOT} from './lib.ts';

interface ElectEntry {
  fec: string;
  chamber: Chamber;
  state: string;
  district?: number;
  status: 'projected' | 'certified';
  sourceUrl: string;
  replaces?: string;
  departureReason?: Departure['reason'];
  bioguide?: string;
  name?: string;
  website?: string;
  priorOffice?: string;
  caucus?: string;
}

interface ElectFile {
  termStart: string;
  members: ElectEntry[] | null;
  uncalled?: {chamber: Chamber; state: string; district?: number}[];
  departing?: {member: string; reason: Departure['reason']; notes?: string}[];
}

const NON_VOTING = new Set(['DC', 'PR', 'GU', 'VI', 'AS', 'MP']);

export interface ElectResult {
  members: Member[];
  departures: Map<string, Departure>;
  uncalled: {chamber: Chamber; state: string; district?: number}[];
}

export async function ingestMembersElect(
  servingIds: Set<string>,
  fec: FecBulk
): Promise<ElectResult> {
  const file = parse(
    await readFile(join(ROOT, 'config', 'members-elect.yaml'), 'utf8')
  ) as ElectFile;
  const entries = file.members ?? [];
  const errors: string[] = [];
  const termStart = file.termStart;
  const members: Member[] = [];
  const departures = new Map<string, Departure>();

  for (const e of entries) {
    const where = `${e.fec} (${e.state})`;
    if (!/^[HSP]\d[A-Z]{2}\d{5}$/.test(e.fec))
      errors.push(`${where}: bad FEC id`);
    if (e.chamber !== 'house' && e.chamber !== 'senate') {
      errors.push(`${where}: chamber must be house|senate`);
    }
    if (e.chamber === 'house' && e.district === undefined) {
      errors.push(`${where}: House entries need a district`);
    }
    if (!e.sourceUrl) errors.push(`${where}: missing sourceUrl`);
    if (e.replaces && !servingIds.has(e.replaces)) {
      errors.push(`${where}: replaces unknown member ${e.replaces}`);
    }
    const cand = fec.candidates.get(e.fec);
    if (!cand) {
      errors.push(`${where}: not in the FEC candidate master file`);
    } else {
      const office = e.chamber === 'senate' ? 'S' : 'H';
      if (cand.office !== office || cand.state !== e.state) {
        errors.push(
          `${where}: FEC says ${cand.office}-${cand.state}, config says ${office}-${e.state}`
        );
      }
    }
    if (errors.length || !cand) continue;

    const finance = fec.totals.get(e.fec);
    const fromFec = fecName(cand.name);
    const [first, ...rest] = (e.name ?? '').split(' ');
    const name = e.name
      ? {first, last: rest.join(' '), full: e.name}
      : {...fromFec, full: `${fromFec.first} ${fromFec.last}`};

    const id = `elect-${e.fec}`;
    const termYears = e.chamber === 'senate' ? 6 : 2;
    members.push({
      id,
      status: 'elect',
      jurisdiction: 'us-federal',
      ids: {bioguide: e.bioguide, fec: [e.fec]},
      name,
      chamber: e.chamber,
      state: e.state,
      district: e.chamber === 'house' ? e.district : undefined,
      party: fecParty(cand.party),
      caucus: e.caucus ?? fecParty(cand.party),
      votingMember: !(e.chamber === 'house' && NON_VOTING.has(e.state)),
      termStart,
      termEnd: `${Number(termStart.slice(0, 4)) + termYears}-01-03`,
      replaces: e.replaces,
      priorOffice: e.priorOffice,
      electionSource: {status: e.status, url: e.sourceUrl},
      finance,
      website: e.website,
      photoUrl: e.bioguide
        ? `https://unitedstates.github.io/images/congress/225x275/${e.bioguide}.jpg`
        : undefined,
      social: {},
    });
    if (e.replaces) {
      departures.set(e.replaces, {
        reason: e.departureReason ?? 'other',
        successorId: id,
        effective: termStart,
      });
    }
  }

  for (const d of file.departing ?? []) {
    if (!servingIds.has(d.member)) {
      errors.push(`departing: unknown member ${d.member}`);
    } else if (departures.has(d.member)) {
      errors.push(`departing: ${d.member} already replaced by a member-elect`);
    } else {
      departures.set(d.member, {reason: d.reason, effective: termStart});
    }
  }

  if (errors.length) {
    throw new Error(
      `config/members-elect.yaml is invalid:\n  ${errors.join('\n  ')}`
    );
  }
  return {members, departures, uncalled: file.uncalled ?? []};
}
