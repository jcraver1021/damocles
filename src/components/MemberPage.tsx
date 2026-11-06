import {useMemberDetail} from '../data.ts';
import {formatYear, formatYears, partyCode, seatLabel} from '../lib/format.ts';
import type {
  Evidence,
  IndexedMember,
  IssueRubric,
  Member,
  ResolvedCampaign,
  Rubric,
} from '../types.ts';
import {MemberCampaigns} from './MemberCampaigns.tsx';
import {FinancePanel} from './FinancePanel.tsx';
import {citizenIndex} from '../lib/citizenIndex.ts';
import {usePriorities} from '../lib/priorities.ts';
import {CategoryBars} from './CategoryBars.tsx';
import {IndexBadge} from './IndexBadge.tsx';
import {IssueBar} from './IssueBar.tsx';
import {MemberBadges} from './MemberBadges.tsx';
import {Photo} from './Photo.tsx';

const KIND_BADGES: Record<Evidence['kind'], string> = {
  vote: '🗳 Vote',
  sponsorship: '📜 Bill',
  statement: '💬 Statement',
  debate: '🎙 Debate',
  interview: '🎤 Interview',
  website: '🌐 Website',
  rating: '⭐ Rating',
  finance: '💵 Finance',
};

function externalLinks(m: Member): {label: string; href: string}[] {
  const links: {label: string; href: string}[] = [];
  if (m.website) {
    links.push({
      label: m.status === 'elect' ? 'Campaign site' : 'Official site',
      href: m.website,
    });
  }
  if (m.contactForm) links.push({label: 'Contact', href: m.contactForm});
  if (m.ids.bioguide) {
    links.push({
      label: 'Congress.gov',
      href: `https://www.congress.gov/member/${m.ids.bioguide}`,
    });
  }
  for (const fec of m.ids.fec.slice(-1)) {
    links.push({
      label: 'FEC',
      href: `https://www.fec.gov/data/candidate/${fec}/`,
    });
  }
  if (m.ids.opensecrets) {
    links.push({
      label: 'OpenSecrets',
      href: `https://www.opensecrets.org/members-of-congress/summary?cid=${m.ids.opensecrets}`,
    });
  }
  if (m.ids.ballotpedia) {
    links.push({
      label: 'Ballotpedia',
      href: `https://ballotpedia.org/${encodeURIComponent(m.ids.ballotpedia.replaceAll(' ', '_'))}`,
    });
  }
  if (m.ids.govtrack)
    links.push({
      label: 'GovTrack',
      href: `https://www.govtrack.us/congress/members/${m.ids.govtrack}`,
    });
  return links;
}

function IssueCard({
  issue,
  evidence,
  score,
}: {
  issue: IssueRubric;
  evidence: Evidence[];
  score: Parameters<typeof IssueBar>[0]['score'];
}) {
  const items = evidence
    .filter(e => e.issue === issue.key)
    .sort((a, b) => b.sourceDate.localeCompare(a.sourceDate));
  return (
    <section className="panel issue-card">
      <h3>{issue.title}</h3>
      <IssueBar label="Alignment" score={score} />
      <p className="muted">{issue.goal}</p>
      {items.length === 0 ? (
        <p className="empty-note">No evidence collected yet for this issue.</p>
      ) : (
        <details>
          <summary>
            {items.length} piece{items.length === 1 ? '' : 's'} of evidence
            {score && score.score === null && ' (not enough to score yet)'}
          </summary>
          <ol className="evidence">
            {items.map(e => (
              <li key={e.id}>
                <span className="badge">{KIND_BADGES[e.kind]}</span>
                <span className={`stance stance-${Math.sign(e.stance)}`}>
                  {e.absence
                    ? "Didn't sign on"
                    : e.stance > 0
                      ? 'Aligned'
                      : e.stance < 0
                        ? 'Opposed'
                        : 'Mixed'}
                </span>
                <span className="muted">{e.sourceDate}</span>
                <div>{e.summary}</div>
                {e.vote && (
                  <div className="muted vote-meta">
                    {e.vote.congress}th Congress, {e.vote.chamber} roll call{' '}
                    {e.vote.rollnumber} · {e.vote.question} · {e.vote.result} (
                    {e.vote.yea}–{e.vote.nay})
                    {e.weight !== undefined && e.weight !== 1 && (
                      <> · weight {e.weight}</>
                    )}
                  </div>
                )}
                {e.quote && <blockquote>“{e.quote}”</blockquote>}
                <a href={e.sourceUrl} target="_blank" rel="noreferrer">
                  Source
                </a>
                {e.kind === 'statement' && !e.reviewed && (
                  <span className="muted"> · quote not yet verified</span>
                )}
                {e.method === 'llm' && !e.reviewed && (
                  <span className="muted">
                    {' '}
                    · machine-extracted, unreviewed
                  </span>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

function MemberLink({id, all}: {id: string; all: IndexedMember[]}) {
  const other = all.find(x => x.id === id);
  return <a href={`#/member/${id}`}>{other ? other.name.full : id}</a>;
}

interface PageProps {
  id: string;
  rubric: Rubric;
  members: IndexedMember[];
  campaigns: ResolvedCampaign[];
}

export function MemberPage({id, rubric, members, campaigns}: PageProps) {
  const detail = useMemberDetail(id);
  const [priorities] = usePriorities();
  if (detail.status === 'loading') return <p className="muted">Loading…</p>;
  if (detail.status === 'error')
    return (
      <p>
        Couldn’t load member {id}: {detail.error}
      </p>
    );
  const {member: m, terms, evidence, scores} = detail.data;
  const index = citizenIndex(scores, rubric, priorities);

  return (
    <article>
      <a href="#/">← All members</a>
      <header className="member-header">
        <Photo member={m} width={120} height={146} />
        <div>
          <h2>
            {m.name.full}{' '}
            <span className={`party party-${partyCode(m.party)}`}>
              {m.party}
            </span>
          </h2>
          <div className="chips">
            <MemberBadges m={m} />
          </div>
          <p>
            {seatLabel(m)}
            {!m.votingMember && ' · non-voting delegate'}
            {m.status === 'elect'
              ? ` · term begins ${m.termStart}`
              : ` · current term ends ${m.termEnd}`}
          </p>
          {m.tenure && (
            <p>
              In the {m.chamber === 'senate' ? 'Senate' : 'House'} since{' '}
              {m.tenure.chamberSince.slice(0, 4)} (
              {formatYears(m.tenure.yearsInChamber)})
              {m.tenure.congressSince !== m.tenure.chamberSince &&
                `, in Congress since ${m.tenure.congressSince.slice(0, 4)} (${formatYears(m.tenure.yearsInCongress)})`}{' '}
              · seniority ~#{m.tenure.seniorityRank} of{' '}
              {
                members.filter(
                  x => x.status === 'serving' && x.chamber === m.chamber
                ).length
              }
            </p>
          )}
          {m.departure && (
            <p className="notice">
              {m.departure.reason === 'defeated'
                ? 'Lost re-election'
                : m.departure.reason === 'retiring'
                  ? 'Not seeking re-election'
                  : m.departure.reason === 'other-office'
                    ? 'Ran for another office'
                    : 'Leaving office'}
              ; term ends {m.departure.effective}.
              {m.departure.successorId && (
                <>
                  {' '}
                  Successor:{' '}
                  <MemberLink id={m.departure.successorId} all={members} />
                </>
              )}
            </p>
          )}
          {m.status === 'elect' && (
            <p className="notice">
              {m.electionSource?.status === 'certified'
                ? 'Election certified'
                : 'Race projected, not yet certified'}{' '}
              (
              <a href={m.electionSource?.url} target="_blank" rel="noreferrer">
                source
              </a>
              ).
              {m.replaces && (
                <>
                  {' '}
                  Replaces <MemberLink id={m.replaces} all={members} />.
                </>
              )}
              {m.priorOffice && <> Previously: {m.priorOffice}.</>}
            </p>
          )}
          {m.phone && (
            <p className="muted">
              {m.office} · {m.phone}
            </p>
          )}
          <ul className="links">
            {externalLinks(m).map(l => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </header>

      {m.status === 'elect' && (
        <p className="muted">
          No congressional voting record yet. Positions will come from campaign
          statements, debates, and interviews as those sources are added.
        </p>
      )}

      <section className="panel index-summary">
        <div className="index-summary-head">
          <IndexBadge index={index} large />
          <div>
            <h3>Citizen index</h3>
            <p className="muted">
              How friendly {m.name.first} {m.name.last} is to these positions,
              weighted by your priorities. {index.scoredIssues} of{' '}
              {rubric.issues.length} issues have enough evidence to score.
            </p>
          </div>
        </div>
        <CategoryBars index={index} rubric={rubric} />
      </section>

      {rubric.categories.map(cat => {
        const issues = rubric.issues.filter(i => i.category === cat.key);
        if (!issues.length) return null;
        return (
          <section key={cat.key} className="category-section">
            <h3 className="category-heading">{cat.title}</h3>
            {cat.description && <p className="muted">{cat.description}</p>}
            {cat.aggregate === 'min' && (
              <p className="muted">
                Weakest link: this category’s score is the lowest of its issues,
                so an ally has to be aligned on all of them. Issues without
                evidence are left out rather than counted against.
              </p>
            )}
            <div className="issue-grid">
              {issues.map(i => (
                <IssueCard
                  key={i.key}
                  issue={i}
                  evidence={evidence}
                  score={scores.find(s => s.issue === i.key)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <MemberCampaigns id={m.id} campaigns={campaigns} />

      {m.finance && <FinancePanel f={m.finance} />}

      {terms.length > 0 && (
        <section className="panel">
          <h3>Service history</h3>
          <ul className="terms">
            {[...terms].reverse().map(t => (
              <li key={t.start}>
                {formatYear(t.start)}–{formatYear(t.end)} · {seatLabel(t)} ·{' '}
                {t.party}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
