import {useMemo} from 'react';
import {usePriorities} from '../lib/priorities.ts';
import {BANDS, bandFor, citizenIndex} from '../lib/citizenIndex.ts';
import {formatYears, partyCode, seatLabel} from '../lib/format.ts';
import {useSessionState} from '../lib/sessionState.ts';
import type {Chamber, IndexedMember, Rubric} from '../types.ts';
import {CategoryBars} from './CategoryBars.tsx';
import {IndexBadge} from './IndexBadge.tsx';
import {MemberBadges} from './MemberBadges.tsx';
import {Photo} from './Photo.tsx';
import {PriorityPanel} from './PriorityPanel.tsx';

interface Props {
  members: IndexedMember[];
  rubric: Rubric;
}

type Sort = 'name' | 'state' | 'seniority' | 'index-desc' | 'index-asc';
/** incoming = next Congress: returning members plus members-elect. */
type StatusFilter = 'incoming' | 'serving' | 'elect' | '';

const matchesStatus = (m: IndexedMember, f: StatusFilter) =>
  f === 'incoming'
    ? m.status === 'elect' || !m.departure
    : !f || m.status === f;

export function MemberList({members, rubric}: Props) {
  const [query, setQuery] = useSessionState('filter.query', '');
  const [chamber, setChamber] = useSessionState<Chamber | ''>(
    'filter.chamber',
    ''
  );
  const [party, setParty] = useSessionState('filter.party', '');
  const [state, setState] = useSessionState('filter.state', '');
  const [status, setStatus] = useSessionState<StatusFilter>(
    'filter.status',
    'incoming'
  );
  const [band, setBand] = useSessionState('filter.band', '');
  const [sort, setSort] = useSessionState<Sort>('filter.sort', 'state');
  const [priorities, setPriority] = usePriorities();

  const states = useMemo(
    () => [...new Set(members.map(m => m.state))].sort(),
    [members]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = members
      .filter(m => matchesStatus(m, status))
      .filter(m => !chamber || m.chamber === chamber)
      .filter(m => !party || partyCode(m.party) === party)
      .filter(m => !state || m.state === state)
      .filter(m => !q || m.name.full.toLowerCase().includes(q))
      .map(m => ({m, index: citizenIndex(m.scores, rubric, priorities)}))
      .filter(
        ({index}) =>
          !band ||
          (band === 'none'
            ? index.value === null
            : index.value !== null && bandFor(index.value).key === band)
      );

    const byName = (a: IndexedMember, b: IndexedMember) =>
      a.name.last.localeCompare(b.name.last) ||
      a.name.first.localeCompare(b.name.first);
    return filtered.sort((a, b) => {
      if (sort === 'index-desc' || sort === 'index-asc') {
        // No index sorts last.
        const dir = sort === 'index-desc' ? 1 : -1;
        const av = a.index.value;
        const bv = b.index.value;
        if (av === null || bv === null) {
          return (
            (av === null ? 1 : 0) - (bv === null ? 1 : 0) || byName(a.m, b.m)
          );
        }
        return dir * (bv - av) || byName(a.m, b.m);
      }
      if (sort === 'seniority') {
        // Members-elect sort last.
        const since = (m: IndexedMember) => m.tenure?.chamberSince ?? '9999';
        return (
          since(a.m).localeCompare(since(b.m)) ||
          (b.m.tenure?.yearsInCongress ?? 0) -
            (a.m.tenure?.yearsInCongress ?? 0) ||
          byName(a.m, b.m)
        );
      }
      if (sort === 'state') {
        return (
          a.m.state.localeCompare(b.m.state) ||
          (a.m.chamber === b.m.chamber
            ? 0
            : a.m.chamber === 'senate'
              ? -1
              : 1) ||
          (a.m.district ?? 0) - (b.m.district ?? 0) ||
          byName(a.m, b.m)
        );
      }
      return byName(a.m, b.m);
    });
  }, [
    members,
    rubric,
    query,
    status,
    chamber,
    party,
    state,
    band,
    sort,
    priorities,
  ]);

  return (
    <>
      <div className="filters">
        <input
          type="search"
          placeholder="Search by name"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search by name"
        />
        <select
          value={status}
          onChange={e => setStatus(e.target.value as StatusFilter)}
          aria-label="Status"
        >
          <option value="incoming">Incoming Congress</option>
          <option value="serving">Serving now</option>
          <option value="elect">Members-elect only</option>
          <option value="">Everyone</option>
        </select>
        <select
          value={chamber}
          onChange={e => setChamber(e.target.value as Chamber | '')}
          aria-label="Chamber"
        >
          <option value="">Both chambers</option>
          <option value="senate">Senate</option>
          <option value="house">House</option>
        </select>
        <select
          value={party}
          onChange={e => setParty(e.target.value)}
          aria-label="Party"
        >
          <option value="">All parties</option>
          <option value="D">Democrat</option>
          <option value="R">Republican</option>
          <option value="I">Independent</option>
        </select>
        <select
          value={state}
          onChange={e => setState(e.target.value)}
          aria-label="State"
        >
          <option value="">All states</option>
          {states.map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={band}
          onChange={e => setBand(e.target.value)}
          aria-label="Citizen index band"
        >
          <option value="">Any index</option>
          {BANDS.map(b => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
          <option value="none">Not enough data</option>
        </select>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as Sort)}
          aria-label="Sort"
        >
          <option value="state">Sort: state</option>
          <option value="name">Sort: name</option>
          <option value="seniority">Sort: seniority</option>
          <option value="index-desc">Sort: citizen index, allies first</option>
          <option value="index-asc">
            Sort: citizen index, opponents first
          </option>
        </select>
      </div>

      <PriorityPanel
        rubric={rubric}
        priorities={priorities}
        onChange={setPriority}
      />

      <p className="muted">
        {rows.length} member{rows.length === 1 ? '' : 's'}
      </p>
      <ul className="member-grid">
        {rows.map(({m, index}) => (
          <li key={m.id}>
            <a className="member-card" href={`#/member/${m.id}`}>
              <Photo member={m} width={56} height={68} />
              <div className="member-card-body">
                <div className="member-card-name">
                  <span>
                    {m.name.first} {m.name.last}{' '}
                    <span className={`party party-${partyCode(m.party)}`}>
                      {partyCode(m.party)}
                    </span>
                  </span>
                  <IndexBadge index={index} />
                </div>
                <div className="muted">
                  {seatLabel(m)}
                  {!m.votingMember && ' · non-voting'}
                  {m.tenure && (
                    <>
                      {' '}
                      · since {m.tenure.chamberSince.slice(0, 4)} (
                      {formatYears(m.tenure.yearsInChamber)})
                    </>
                  )}
                </div>
                <div className="chips">
                  <MemberBadges m={m} />
                </div>
                <CategoryBars index={index} rubric={rubric} />
              </div>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
