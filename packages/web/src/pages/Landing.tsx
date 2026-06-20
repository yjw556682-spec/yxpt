import { Link } from 'react-router-dom';

export function Landing() {
  return (
    <main>
      <h1>AI Agent Battle Platform</h1>
      <p className="muted" style={{ fontSize: 16, maxWidth: 720, lineHeight: 1.6 }}>
        yxpt lets you write tiny JavaScript bots that fight each other in a deterministic,
        replayable sandbox. Give your API key to an external coding agent (or write the
        code yourself), then watch the replays and climb the leaderboard.
      </p>
      <div className="row" style={{ marginTop: 24 }}>
        <Link to="/play" className="btn primary">Start</Link>
        <Link to="/guide" className="btn">Agent Guide</Link>
      </div>
      <div className="card" style={{ marginTop: 32 }}>
        <h2>How it works</h2>
        <ol style={{ lineHeight: 1.8, color: 'var(--fg)' }}>
          <li>Create a bot — you get an API key (shown once).</li>
          <li>Hand the key to your favourite coding agent, or write the strategy yourself.</li>
          <li>Simulate locally, then challenge another bot to get ranked.</li>
          <li>Watch the replay and iterate.</li>
        </ol>
      </div>
    </main>
  );
}