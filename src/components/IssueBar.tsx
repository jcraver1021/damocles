import type {IssueScore} from '../types.ts';

interface Props {
  label: string;
  score: IssueScore | undefined;
  compact?: boolean;
}

/** Diverging bar; opacity shows coverage. */
export function IssueBar({label, score, compact}: Props) {
  const value = score?.score ?? null;
  const pct = value === null ? 0 : Math.abs(value) * 50;
  const title =
    value === null
      ? `${label}: not enough evidence yet`
      : `${label}: ${Math.round(value * 100)} (coverage ${Math.round((score?.coverage ?? 0) * 100)}%, ${score?.evidenceCount} items${score?.provisional ? '; provisional: words only' : ''})`;
  const provisional = value !== null && score?.provisional;

  return (
    <div className={`issue-bar${compact ? ' compact' : ''}`} title={title}>
      <span className="issue-bar-label">{label}</span>
      <span
        className={`issue-bar-track${value === null ? ' empty' : ''}${provisional ? ' provisional' : ''}`}
      >
        {value !== null && (
          <span
            className={`issue-bar-fill ${value >= 0 ? 'aligned' : 'opposed'}`}
            style={{
              width: `${pct}%`,
              [value >= 0 ? 'left' : 'right']: '50%',
              opacity: 0.35 + 0.65 * (score?.coverage ?? 0),
            }}
          />
        )}
        <span className="issue-bar-mid" />
      </span>
      {!compact && (
        <span className="issue-bar-value">
          {value === null ? 'No data' : Math.round(value * 100)}
          {provisional && (
            <span
              className="provisional-flag"
              title="Based only on statements or pledges, no votes or bills"
            >
              words only
            </span>
          )}
          {score?.saysVsDoesGap && (
            <span className="gap-flag" title="Statements and votes disagree">
              ⚠
            </span>
          )}
        </span>
      )}
    </div>
  );
}
