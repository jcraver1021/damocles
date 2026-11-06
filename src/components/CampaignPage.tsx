import {useMemo, useState} from 'react';
import {
  MILESTONE_ICONS,
  OUTCOME_LABELS,
  STANCE_LABELS,
} from '../lib/campaigns.ts';
import {partyCode, seatLabel} from '../lib/format.ts';
import type {
  CampaignPosition,
  CampaignStance,
  IndexedMember,
  ResolvedCampaign,
} from '../types.ts';
import {MemberBadges} from './MemberBadges.tsx';
import {CampaignProgress} from './CampaignProgress.tsx';

const ORDER: CampaignStance[] = [
  'committed',
  'leaning',
  'opposed',
  'undecided',
];

interface Props {
  c: ResolvedCampaign;
  members: IndexedMember[];
}

export function CampaignPage({c, members}: Props) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const byId = new Map(members.map(m => [m.id, m]));
    const positions = new Map(c.positions.map(p => [p.memberId, p]));
    const out = new Map<
      CampaignStance,
      {m: IndexedMember; p?: CampaignPosition}[]
    >(ORDER.map(s => [s, []]));
    for (const id of c.audienceIds) {
      const m = byId.get(id);
      if (!m) continue;
      const p = positions.get(id);
      out.get(p?.stance ?? 'undecided')!.push({m, p});
    }
    for (const list of out.values()) {
      list.sort(
        (a, b) =>
          a.m.state.localeCompare(b.m.state) ||
          (a.m.district ?? 0) - (b.m.district ?? 0)
      );
    }
    return out;
  }, [c, members]);

  const q = query.trim().toLowerCase();
  const matches = (m: IndexedMember) =>
    !q || m.name.full.toLowerCase().includes(q) || m.state.toLowerCase() === q;

  return (
    <article>
      <a href="#/campaigns">← All campaigns</a>
      <header className="campaign-header">
        <span className={`chip outcome-${c.outcome}`}>
          {OUTCOME_LABELS[c.outcome]}
        </span>
        <h2>{c.title}</h2>
        <p>
          <strong>Ask:</strong> {c.ask}
        </p>
        <p>
          <strong>Goal:</strong> {c.goal}
        </p>
        <p className="muted">
          Audience: {c.audience.description} ({c.audienceIds.length} members)
        </p>
        {c.outcomeNote && <p className="notice">{c.outcomeNote}</p>}
      </header>

      <section className="panel">
        <h3>Progress</h3>
        <CampaignProgress c={c} />
        <dl className="criteria">
          <dt>Success</dt>
          <dd>{c.successCriteria}</dd>
          <dt>Partial success</dt>
          <dd>{c.partialCriteria}</dd>
          <dt>Failure</dt>
          <dd>{c.failureCriteria}</dd>
        </dl>
      </section>

      <section className="panel">
        <h3>Milestones</h3>
        <ol className="milestones">
          {c.milestones.map(ms => (
            <li key={ms.id} className={`milestone milestone-${ms.status}`}>
              <span className="milestone-icon" aria-hidden="true">
                {MILESTONE_ICONS[ms.status]}
              </span>
              <div>
                <div>
                  {ms.title}
                  {ms.date && <span className="muted"> · {ms.date}</span>}
                  {ms.status !== 'pending' && (
                    <span className="muted"> · {ms.status}</span>
                  )}
                </div>
                {ms.description && (
                  <div className="muted">{ms.description}</div>
                )}
                {ms.sourceUrl && (
                  <a href={ms.sourceUrl} target="_blank" rel="noreferrer">
                    Source
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <h3>Where the audience stands</h3>
        <input
          type="search"
          className="campaign-search"
          placeholder="Filter by name or state (e.g. NY)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Filter audience"
        />
        {ORDER.map(stance => {
          const list = groups.get(stance)!.filter(x => matches(x.m));
          const body = (
            <ul className="stance-list">
              {list.map(({m, p}) => (
                <li key={m.id}>
                  <a href={`#/member/${m.id}`}>{m.name.full}</a>{' '}
                  <span className={`party party-${partyCode(m.party)}`}>
                    {partyCode(m.party)}
                  </span>{' '}
                  <span className="muted">{seatLabel(m)}</span>{' '}
                  <MemberBadges m={m} />
                  {p && (
                    <div className="muted">
                      {p.date}
                      {p.quote && <> · “{p.quote}”</>} ·{' '}
                      <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                        source
                      </a>
                      {p.quoteVerified === false && (
                        <span title="The quote couldn't be matched on the source page automatically; check it by hand">
                          {' '}
                          · unverified quote
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          );
          const heading = `${STANCE_LABELS[stance]} (${list.length})`;
          return stance === 'undecided' ? (
            <details key={stance} open={!!q}>
              <summary>{heading}</summary>
              {body}
            </details>
          ) : (
            <div key={stance}>
              <h4>{heading}</h4>
              {list.length > 0 ? body : <p className="muted">None yet.</p>}
            </div>
          );
        })}
      </section>

      {c.notes && <p className="muted">{c.notes}</p>}
    </article>
  );
}
