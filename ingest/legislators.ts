// Current members and cross-source IDs from unitedstates/congress-legislators.

import type {Chamber, Member, Term} from '../src/types.ts';
import {fetchJsonSnapshot} from './lib.ts';

const BASE = 'https://unitedstates.github.io/congress-legislators';
const PHOTO_BASE = 'https://unitedstates.github.io/images/congress/225x275';
const SOURCE = 'congress-legislators';

/** Non-voting delegates. */
const NON_VOTING = new Set(['DC', 'PR', 'GU', 'VI', 'AS', 'MP']);

interface RawTerm {
  type: 'rep' | 'sen';
  start: string;
  end: string;
  state: string;
  district?: number;
  class?: number;
  party: string;
  caucus?: string;
  url?: string;
  contact_form?: string;
  phone?: string;
  office?: string;
  address?: string;
}

interface RawLegislator {
  id: {
    bioguide: string;
    fec?: string[];
    opensecrets?: string;
    votesmart?: number;
    govtrack?: number;
    icpsr?: number;
    lis?: string;
    ballotpedia?: string;
    wikipedia?: string;
    wikidata?: string;
  };
  name: {
    first: string;
    last: string;
    official_full?: string;
    nickname?: string;
  };
  terms: RawTerm[];
}

interface RawSocial {
  id: {bioguide: string};
  social: {
    twitter?: string;
    facebook?: string;
    youtube?: string;
    youtube_id?: string;
    instagram?: string;
  };
}

const chamberOf = (t: RawTerm): Chamber =>
  t.type === 'sen' ? 'senate' : 'house';

function toTerm(t: RawTerm): Term {
  return {
    chamber: chamberOf(t),
    start: t.start,
    end: t.end,
    state: t.state,
    district: t.type === 'rep' ? t.district : undefined,
    senateClass: t.class,
    party: t.party,
  };
}

export interface LegislatorRecord {
  member: Member;
  terms: Term[];
}

export async function ingestLegislators(): Promise<LegislatorRecord[]> {
  const [current, social] = await Promise.all([
    fetchJsonSnapshot<RawLegislator[]>(
      SOURCE,
      `${BASE}/legislators-current.json`
    ),
    fetchJsonSnapshot<RawSocial[]>(
      SOURCE,
      `${BASE}/legislators-social-media.json`
    ),
  ]);
  const socialById = new Map(social.map(s => [s.id.bioguide, s.social]));

  return current.map(raw => {
    const t = raw.terms[raw.terms.length - 1];
    const s = socialById.get(raw.id.bioguide) ?? {};
    const chamber = chamberOf(t);
    const member: Member = {
      id: raw.id.bioguide,
      status: 'serving',
      jurisdiction: 'us-federal',
      ids: {
        bioguide: raw.id.bioguide,
        fec: raw.id.fec ?? [],
        opensecrets: raw.id.opensecrets,
        votesmart: raw.id.votesmart,
        govtrack: raw.id.govtrack,
        icpsr: raw.id.icpsr,
        lis: raw.id.lis,
        ballotpedia: raw.id.ballotpedia,
        wikipedia: raw.id.wikipedia,
        wikidata: raw.id.wikidata,
      },
      name: {
        first: raw.name.nickname ?? raw.name.first,
        last: raw.name.last,
        full: raw.name.official_full ?? `${raw.name.first} ${raw.name.last}`,
      },
      chamber,
      state: t.state,
      district: chamber === 'house' ? t.district : undefined,
      party: t.party,
      caucus: t.caucus ?? t.party,
      votingMember: !(chamber === 'house' && NON_VOTING.has(t.state)),
      termStart: t.start,
      termEnd: t.end,
      website: t.url,
      contactForm: t.contact_form,
      phone: t.phone,
      office: t.office ?? t.address,
      photoUrl: `${PHOTO_BASE}/${raw.id.bioguide}.jpg`,
      social: {
        x: s.twitter,
        facebook: s.facebook,
        youtube: s.youtube ?? s.youtube_id,
        instagram: s.instagram,
      },
    };
    return {member, terms: raw.terms.map(toTerm)};
  });
}
