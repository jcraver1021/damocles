import {bandFor, type CitizenIndex} from '../lib/citizenIndex.ts';

export function IndexBadge({
  index,
  large,
}: {
  index: CitizenIndex;
  large?: boolean;
}) {
  if (index.value === null) {
    return (
      <span
        className={`index-badge none${large ? ' large' : ''}`}
        title="Not enough scored issues for an index yet"
      >
        <span className="index-value">–</span>
        <span className="index-label">Not enough data</span>
      </span>
    );
  }
  const band = bandFor(index.value);
  return (
    <span
      className={`index-badge band-${band.key}${large ? ' large' : ''}`}
      title={`Citizen index ${index.value}/100 · ${index.scoredIssues} issues scored · ${Math.round(index.coverage * 100)}% of priority weight covered${index.provisional ? ' · provisional: mostly statements and pledges, few votes or bills' : ''}`}
    >
      <span className="index-value">{index.value}</span>
      <span className="index-label">{band.label}</span>
      {index.provisional && (
        <span className="index-provisional">
          Provisional
          {index.scoredIssues < 3 &&
            ` · ${index.scoredIssues} issue${index.scoredIssues === 1 ? '' : 's'}`}
        </span>
      )}
    </span>
  );
}
