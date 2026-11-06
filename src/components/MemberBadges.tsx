import type {Member} from '../types.ts';

export function MemberBadges({m}: {m: Member}) {
  return (
    <>
      {m.status === 'elect' && (
        <span className="chip chip-elect">
          Member-elect
          {m.electionSource?.status === 'projected' && ' (projected)'}
        </span>
      )}
      {m.departure && (
        <span className="chip chip-leaving">
          Leaving {m.departure.effective.slice(0, 4)}
          {m.departure.reason === 'defeated'
            ? ' · defeated'
            : m.departure.reason === 'retiring'
              ? ' · retiring'
              : m.departure.reason === 'other-office'
                ? ' · other office'
                : ''}
        </span>
      )}
      {m.status === 'serving' && m.tenure?.freshman && (
        <span className="chip">First term</span>
      )}
    </>
  );
}
