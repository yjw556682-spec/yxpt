import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api, ApiError } from '../api.js';
import { loadBotKey, saveBotKey, clearBotKey, DEFAULT_BOT_CODE } from '../storage.js';
import { examples, exampleById } from '../examples/index.js';
import type {
  BotKeyRecord,
  MatchSummary,
  SimulateResponse,
  ChallengeResponse,
} from '../types.js';

type EditorViewProps = {
  value: string;
  onChange: (v: string) => void;
};

function CodeEditor({ value, onChange }: EditorViewProps) {
  return (
    <div className="editor-host">
      <Editor
        height="100%"
        defaultLanguage="javascript"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          tabSize: 2,
          automaticLayout: true,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}

function describeResult(label: string, result: { winner: number | null; reason: string }): string {
  const winner = result.winner === null ? 'draw' : result.winner === 0 ? 'you' : 'opponent';
  return `${label}: ${winner} (reason: ${result.reason})`;
}

export function BotPlayPage() {
  const [bot, setBot] = useState<BotKeyRecord | null>(() => loadBotKey());
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState<string>(DEFAULT_BOT_CODE);
  const [exampleId, setExampleId] = useState<string>('');
  const [version, setVersion] = useState<number | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [lastSim, setLastSim] = useState<SimulateResponse | null>(null);
  const [lastChallenge, setLastChallenge] = useState<ChallengeResponse | null>(null);

  useEffect(() => {
    if (!bot) return;
    refreshMatches();
  }, [bot]);

  async function refreshMatches(): Promise<void> {
    if (!bot) return;
    try {
      const res = await api.listMatches(bot.botKey, 10);
      setMatches(res.matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!displayName.trim()) return;
    setBusy('create');
    setError(null);
    try {
      const res = await api.registerUser(displayName.trim());
      const rec: BotKeyRecord = {
        botId: res.botId,
        botKey: res.botKey,
        displayName: res.displayName,
        mode: res.modeId,
      };
      saveBotKey(rec);
      setBot(rec);
      setInfo(`Bot created. Save this key — shown only once: ${res.botKey}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function onSaveCode(): Promise<void> {
    if (!bot) return;
    setBusy('save');
    setError(null);
    try {
      const res = await api.publishCode(bot.botKey, code, 'human');
      setVersion(res.version);
      setInfo(`Saved code as version ${res.version}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function onSimulate(): Promise<void> {
    if (!bot) return;
    setBusy('simulate');
    setError(null);
    try {
      const res = await api.simulate(bot.botKey, 42);
      setLastSim(res);
      setInfo(describeResult(`Simulate vs ${res.opponent}`, res.result));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function onChallenge(): Promise<void> {
    if (!bot) return;
    setBusy('challenge');
    setError(null);
    try {
      const res = await api.challengeRandom(bot.botKey);
      setLastChallenge(res);
      setInfo(describeResult(`Challenge vs ${res.opponent.name}`, res.result));
      await refreshMatches();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setBusy(null);
    }
  }

  function onReset(): void {
    clearBotKey();
    setBot(null);
    setVersion(null);
    setLastSim(null);
    setLastChallenge(null);
    setMatches([]);
    setDisplayName('');
    setCode(DEFAULT_BOT_CODE);
    setExampleId('');
    setInfo(null);
    setError(null);
  }

  function onLoadExample(id: string): void {
    setExampleId(id);
    if (id === '') return;
    const entry = exampleById(id);
    if (entry) {
      setCode(entry.code);
      setInfo(`Loaded example: ${entry.name} (${entry.mode}). Click "Save code" to publish.`);
    }
  }

  if (!bot) {
    return (
      <main>
        <h1>Create your bot</h1>
        <p className="muted">You'll get an API key (shown once) to authenticate future requests.</p>
        <form onSubmit={onCreate} className="card" style={{ maxWidth: 480 }}>
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. alice"
            required
          />
          <div className="row" style={{ marginTop: 16 }}>
            <button
              type="submit"
              className="btn primary"
              disabled={busy === 'create' || !displayName.trim()}
            >
              {busy === 'create' ? 'Creating…' : 'Create bot'}
            </button>
          </div>
          {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
        </form>
      </main>
    );
  }

  const challengeReplayId = lastChallenge
    ? Number(lastChallenge.replayUrl.match(/\/matches\/(\d+)\//)?.[1] ?? 0) || null
    : null;

  return (
    <main>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Bot #{bot.botId} — {bot.displayName}</h1>
          <span className="muted">mode: {bot.mode}</span>
          {version !== null ? <span className="muted"> · code v{version}</span> : null}
        </div>
        <button className="btn danger" onClick={onReset}>Reset key</button>
      </div>

      <div className="card">
        <div className="row between">
          <h2 style={{ marginBottom: 0 }}>Strategy</h2>
          <div className="row" style={{ gap: 8 }}>
            <label htmlFor="example-select" style={{ margin: 0 }}>Load example</label>
            <select
              id="example-select"
              value={exampleId}
              onChange={(e) => onLoadExample(e.target.value)}
              style={{ width: 240 }}
              disabled={busy !== null}
            >
              <option value="">— choose —</option>
              {examples.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.mode})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <CodeEditor value={code} onChange={setCode} />
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={onSaveCode} disabled={busy !== null}>
            {busy === 'save' ? 'Saving…' : 'Save code'}
          </button>
          <button className="btn" onClick={onSimulate} disabled={busy !== null}>
            {busy === 'simulate' ? 'Simulating…' : 'Simulate (seed 42)'}
          </button>
          <button className="btn" onClick={onChallenge} disabled={busy !== null}>
            {busy === 'challenge' ? 'Challenging…' : 'Challenge random opponent'}
          </button>
        </div>
      </div>

      {info ? (
        <div className="card">
          <h2>Last result</h2>
          <div className="ok">{info}</div>
          {lastChallenge && challengeReplayId ? (
            <div style={{ marginTop: 8 }}>
              <Link to={`/replay/${challengeReplayId}`}>View replay →</Link>
            </div>
          ) : null}
          {lastSim && lastSim.replay.events.length > 0 ? (
            <details style={{ marginTop: 12 }}>
              <summary>Simulate events ({lastSim.replay.events.length})</summary>
              <pre style={{ maxHeight: 200, overflow: 'auto', fontSize: 12 }}>
                {JSON.stringify(lastSim.replay.events.slice(0, 50), null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="error">{error}</div> : null}

      <div className="card">
        <div className="row between">
          <h2 style={{ marginBottom: 0 }}>Recent matches</h2>
          <button className="btn" onClick={refreshMatches}>Refresh</button>
        </div>
        {matches.length === 0 ? (
          <p className="muted" style={{ marginTop: 8 }}>No matches yet. Challenge a bot to get started.</p>
        ) : (
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Match</th>
                <th>Mode</th>
                <th>Opponent</th>
                <th>Reason</th>
                <th>Outcome</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => {
                const opponentId = m.challengerBotId === bot.botId ? m.defenderBotId : m.challengerBotId;
                const won =
                  m.winnerBotId !== null &&
                  m.winnerBotId === bot.botId;
                const drew = m.winnerBotId === null;
                return (
                  <tr key={m.id}>
                    <td>#{m.id}</td>
                    <td>{m.modeId}</td>
                    <td>bot #{opponentId}</td>
                    <td>{m.reason}</td>
                    <td>
                      <span className={won ? 'ok' : drew ? 'muted' : 'error'}>
                        {drew ? 'draw' : won ? 'win' : 'loss'}
                      </span>
                    </td>
                    <td><Link to={`/replay/${m.id}`}>replay</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}