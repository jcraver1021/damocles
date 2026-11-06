import {OUTCOME_LABELS} from '../lib/campaigns.ts';
import type {ResolvedCampaign} from '../types.ts';
import {CampaignProgress} from './CampaignProgress.tsx';

export function CampaignList({campaigns}: {campaigns: ResolvedCampaign[]}) {
  return (
    <>
      <h2>Citizen campaigns</h2>
      <p className="muted">
        Goals aimed at specific lawmakers, tracked through their public
        positions.
      </p>
      <div className="campaign-grid">
        {campaigns.map(c => (
          <a
            key={c.id}
            className="panel campaign-card"
            href={`#/campaign/${c.id}`}
          >
            <span className={`chip outcome-${c.outcome}`}>
              {OUTCOME_LABELS[c.outcome]}
            </span>
            <h3>{c.title}</h3>
            <p>{c.ask}</p>
            <p className="muted">{c.audience.description}</p>
            <CampaignProgress c={c} />
          </a>
        ))}
      </div>
    </>
  );
}
