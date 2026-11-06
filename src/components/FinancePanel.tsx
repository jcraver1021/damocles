import {formatPct, formatUsd} from '../lib/format.ts';
import type {FinanceSummary} from '../types.ts';

export function FinancePanel({f}: {f: FinanceSummary}) {
  const split =
    f.individualUnitemized !== undefined && f.individualItemized !== undefined;
  const rows = [
    ...(split
      ? [
          {label: 'Small donors (under $200)', value: f.individualUnitemized!},
          {label: 'Larger individual donors', value: f.individualItemized!},
        ]
      : [{label: 'Individual donors', value: f.individualTotal}]),
    {label: 'PACs and other committees', value: f.pacContributions},
    {label: 'Party committees', value: f.partyContributions},
    {label: 'Self-funding', value: f.candidateSelfFunding},
  ];
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <section className="panel">
      <h3>
        Campaign money, {f.cycle - 1}–{f.cycle} cycle
      </h3>
      <p className="muted">
        {formatUsd(f.receipts)} raised through {f.coverageEnd}.{' '}
        {split &&
          f.individualTotal > 0 &&
          `${formatPct(f.individualUnitemized! / f.individualTotal)} of individual money came from small donors.`}
        {f.receipts > 0 &&
          ` ${formatPct(f.pacContributions / f.receipts)} came from PACs.`}
      </p>
      <dl className="finance">
        {rows.map(r => (
          <div key={r.label} className="finance-row">
            <dt>{r.label}</dt>
            <dd>
              <span
                className="finance-bar"
                style={{width: `${(r.value / max) * 100}%`}}
              />
              <span className="finance-value">{formatUsd(r.value)}</span>
            </dd>
          </div>
        ))}
      </dl>
      <a href={f.sourceUrl} target="_blank" rel="noreferrer">
        FEC filing data
      </a>
    </section>
  );
}
