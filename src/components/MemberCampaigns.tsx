import {STANCE_LABELS} from '../lib/campaigns.ts';
import type {ResolvedCampaign} from '../types.ts';

export function MemberCampaigns({
  id,
  campaigns,
}: {
  id: string;
  campaigns: ResolvedCampaign[];
}) {
  const mine = campaigns.filter(c => c.audienceIds.includes(id));
  if (!mine.length) return null;
  return (
    <section className="panel">
      <h3>Citizen campaigns</h3>
      <ul className="member-campaigns">
        {mine.map(c => {
          const p = c.positions.find(x => x.memberId === id);
          return (
            <li key={c.id}>
              <a href={`#/campaign/${c.id}`}>{c.title}</a>
              <div className="muted">
                {STANCE_LABELS[p?.stance ?? 'undecided']}
                {p && (
                  <>
                    {' '}
                    ·{' '}
                    <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                      source
                    </a>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
