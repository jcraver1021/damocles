import {useEffect, useState} from 'react';
import {CampaignList} from './components/CampaignList.tsx';
import {CampaignPage} from './components/CampaignPage.tsx';
import {MemberList} from './components/MemberList.tsx';
import {MemberPage} from './components/MemberPage.tsx';
import {useCampaigns, useMembers, useRubric} from './data.ts';

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export default function App() {
  const route = useHashRoute();
  const members = useMembers();
  const rubric = useRubric();
  const campaigns = useCampaigns();
  const memberId = /^#\/member\/([A-Za-z0-9-]+)$/.exec(route)?.[1];
  const campaignId = /^#\/campaign\/([a-z0-9-]+)$/.exec(route)?.[1];
  const onCampaigns = route === '#/campaigns' || !!campaignId;

  let body;
  if (
    members.status === 'error' ||
    rubric.status === 'error' ||
    campaigns.status === 'error'
  ) {
    body = (
      <p>
        Couldn’t load data. Run <code>npm run ingest</code> to generate
        public/data/.
      </p>
    );
  } else if (
    members.status === 'loading' ||
    rubric.status === 'loading' ||
    campaigns.status === 'loading'
  ) {
    body = <p className="muted">Loading…</p>;
  } else if (memberId) {
    body = (
      <MemberPage
        id={memberId}
        rubric={rubric.data}
        members={members.data.members}
        campaigns={campaigns.data}
      />
    );
  } else if (campaignId) {
    const c = campaigns.data.find(x => x.id === campaignId);
    body = c ? (
      <CampaignPage c={c} members={members.data.members} />
    ) : (
      <p>No campaign “{campaignId}”.</p>
    );
  } else if (onCampaigns) {
    body = <CampaignList campaigns={campaigns.data} />;
  } else {
    body = <MemberList members={members.data.members} rubric={rubric.data} />;
  }

  return (
    <div className="app">
      <header className="site-header">
        <h1>
          <a href="#/">Damocles</a>
        </h1>
        <p className="muted">
          Where members of Congress stand, with the evidence.
        </p>
        <nav className="site-nav">
          <a href="#/" aria-current={!onCampaigns ? 'page' : undefined}>
            Members
          </a>
          <a href="#/campaigns" aria-current={onCampaigns ? 'page' : undefined}>
            Campaigns
          </a>
        </nav>
      </header>
      <main>{body}</main>
      <footer className="muted">
        {members.status === 'ok' && (
          <>Data generated {members.data.generatedAt.slice(0, 10)} · </>
        )}
        Rosters from{' '}
        <a
          href="https://github.com/unitedstates/congress-legislators"
          target="_blank"
          rel="noreferrer"
        >
          unitedstates/congress-legislators
        </a>
      </footer>
    </div>
  );
}
