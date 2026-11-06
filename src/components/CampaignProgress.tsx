import type {ResolvedCampaign} from '../types.ts';

/** Committed + leaning vs. the threshold. */
export function CampaignProgress({c}: {c: ResolvedCampaign}) {
  const total = c.audienceIds.length || 1;
  const pct = (n: number) => `${(n / total) * 100}%`;
  if (c.needed === 0) {
    return (
      <p className="muted">
        The audience isn’t a majority of the chamber, so it can’t elect the
        target on its own.
      </p>
    );
  }
  return (
    <div className="campaign-progress">
      <div
        className="campaign-bar"
        role="img"
        aria-label={`${c.counts.committed} of ${c.needed} needed committed, ${c.counts.leaning} leaning`}
      >
        <span
          className="seg committed"
          style={{width: pct(c.counts.committed)}}
        />
        <span className="seg leaning" style={{width: pct(c.counts.leaning)}} />
        <span
          className="marker partial"
          style={{left: pct(c.threshold.partialAt ?? 0)}}
          title={`Partial: ${c.threshold.partialAt}`}
        />
        <span
          className="marker needed"
          style={{left: pct(c.needed)}}
          title={`Needed: ${c.needed}`}
        />
      </div>
      <p className="muted">
        <strong>{c.counts.committed}</strong> of {c.needed} needed committed
        {c.counts.leaning > 0 && `, ${c.counts.leaning} leaning`} · partial at{' '}
        {c.threshold.partialAt} · audience {c.audienceIds.length}
      </p>
    </div>
  );
}
