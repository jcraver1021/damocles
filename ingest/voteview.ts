// Voteview roll calls -> evidence for `vote:` anchors.

import type {Chamber, Evidence, Rubric, VoteDetail} from '../src/types.ts';
import {fetchTextSnapshot, parseCsv} from './lib.ts';

const BASE = 'https://voteview.com/static/data/out';
const SOURCE = 'voteview';

interface VoteRef {
  ref: string;
  congress: number;
  chamber: Chamber;
  rollnumber: number;
}

export function parseVoteRef(ref: string): VoteRef | null {
  const m = /^vote:(\d+)-(house|senate)-(\d+)$/.exec(ref);
  if (!m) return null;
  return {
    ref,
    congress: Number(m[1]),
    chamber: m[2] as Chamber,
    rollnumber: Number(m[3]),
  };
}

const fileKey = (chamber: Chamber, congress: number) =>
  `${chamber === 'house' ? 'H' : 'S'}${congress}`;

export function voteviewUrl(v: VoteRef): string {
  const n = String(v.rollnumber).padStart(4, '0');
  return `https://voteview.com/rollcall/R${fileKey(v.chamber, v.congress)}${n}`;
}

/** Cast codes: 1-3 Yea, 4-6 Nay, 7-9 present/not voting. */
function position(castCode: string): 'Yea' | 'Nay' | null {
  const c = Number(castCode);
  if (c >= 1 && c <= 3) return 'Yea';
  if (c >= 4 && c <= 6) return 'Nay';
  return null;
}

export async function ingestAnchorVotes(rubric: Rubric): Promise<Evidence[]> {
  const anchors = rubric.issues.flatMap(issue =>
    issue.anchors
      .map(a => ({issue: issue.key, anchor: a, vote: parseVoteRef(a.ref)}))
      .filter(x => x.vote !== null)
      .map(x => ({...x, vote: x.vote!}))
  );

  const files = [
    ...new Set(anchors.map(a => fileKey(a.vote.chamber, a.vote.congress))),
  ];
  const errors: string[] = [];
  const evidence: Evidence[] = [];

  for (const key of files) {
    const [rollcallsCsv, votesCsv, membersCsv] = await Promise.all(
      ['rollcalls', 'votes', 'members'].map(kind =>
        fetchTextSnapshot(SOURCE, `${BASE}/${kind}/${key}_${kind}.csv`)
      )
    );
    const rollcalls = new Map(
      parseCsv(rollcallsCsv).map(r => [Number(r.rollnumber), r])
    );
    const bioguideByIcpsr = new Map(
      parseCsv(membersCsv)
        // Skip the President's position, which Voteview lists as a vote.
        .filter(m => m.bioguide_id && m.chamber !== 'President')
        .map(m => [m.icpsr, m.bioguide_id])
    );

    const here = anchors.filter(
      a => fileKey(a.vote.chamber, a.vote.congress) === key
    );
    const wanted = new Map<number, typeof here>();
    for (const a of here) {
      if (!rollcalls.has(a.vote.rollnumber)) {
        errors.push(
          `${a.anchor.ref} (${a.anchor.label}) not found in Voteview`
        );
        continue;
      }
      wanted.set(a.vote.rollnumber, [
        ...(wanted.get(a.vote.rollnumber) ?? []),
        a,
      ]);
    }

    for (const v of parseCsv(votesCsv)) {
      const matches = wanted.get(Number(v.rollnumber));
      if (!matches) continue;
      const pos = position(v.cast_code);
      const memberId = bioguideByIcpsr.get(v.icpsr);
      if (!pos || !memberId) continue;
      const rc = rollcalls.get(Number(v.rollnumber))!;

      for (const {issue, anchor, vote} of matches) {
        const aligned = (pos === 'Yea') === (anchor.alignedPosition === 'yes');
        const detail: VoteDetail = {
          ref: anchor.ref,
          chamber: vote.chamber,
          congress: vote.congress,
          rollnumber: vote.rollnumber,
          question: rc.vote_question,
          position: pos,
          result: rc.vote_result,
          yea: Number(rc.yea_count),
          nay: Number(rc.nay_count),
        };
        evidence.push({
          id: `${anchor.ref}:${memberId}:${issue}`,
          memberId,
          issue,
          kind: 'vote',
          stance: aligned ? 2 : -2,
          summary: `Voted ${pos} on ${anchor.label}`,
          sourceUrl: voteviewUrl(vote),
          sourceDate: rc.date,
          method: 'deterministic',
          confidence: 1,
          weight: anchor.weight,
          reviewed: true,
          vote: detail,
        });
      }
    }
  }

  if (errors.length) {
    throw new Error(
      `Anchor votes failed to resolve:\n  ${errors.join('\n  ')}`
    );
  }
  return evidence;
}
