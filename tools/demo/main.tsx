import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Brand, DraftScreen, ResultScreen } from '../../apps/web/app/page';
import { createGameSession } from '../../apps/web/src/game/session';
import { soloDraftChallenge } from '../../apps/web/src/test/draftChallenge';
import '../../apps/web/app/globals.css';

const seed = new URLSearchParams(location.search).get('seed') || 'football11-demo-v1';
const begin = () => createGameSession(soloDraftChallenge(seed));
const noop = () => {};

function Demo() {
  const [session, setSession] = useState(begin);
  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>
          LOCAL GAMEPLAY DEMO · No online verification
        </span>
      </header>
      {session.resolved ? (
        <ResultScreen
          result={session.resolved.result}
          onAgain={() => setSession(begin())}
          persistenceMessage={null}
          persistenceError={false}
          canRetryCloud={false}
          onRetryCloud={noop}
          rankingStatus="idle"
          ranking={null}
          rankingMessage={null}
          canRank={false}
          onRank={noop}
          onCompetition={noop}
          canCompete={false}
          startBusy={false}
          startMessage={null}
          storageBusy={false}
        />
      ) : (
        <DraftScreen session={session} onChange={setSession} />
      )}
      <output id="demo-evidence" hidden>
        {JSON.stringify({
          seed,
          actions: session.actions,
          result: session.resolved?.result ?? null,
        })}
      </output>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Demo />);
