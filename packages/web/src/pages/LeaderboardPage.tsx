import { useEffect, useState } from 'react';
import { api, ApiError } from '../api.js';
import type { LeaderboardResponse, Ranking } from '../types.js';

const MODES = [
  { id: 'grid-duel', label: 'Grid Duel' },
  { id: 'territory', label: 'Territory' },
];

function skillIcon(score: number): string {
  if (score >= 1100) return '★';
  if (score >= 1050) return '◆';
  if (score >= 1000) return '●';
  if (score >= 950) return '○';
  return '·';
}

export function LeaderboardPage() {
  const [mode, setMode] = useState<string>('grid-duel');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.leaderboard(mode)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode]);

  return (
    <main>
      <div className="row between">
        <h1>Leaderboard</h1>
        <div className="row">
          <label htmlFor="mode" style={{ margin: 0 }}>Mode</label>
          <select
            id="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{ width: 'auto' }}
          >
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? <p className="muted">Loading…</p> : null}
      {error ? <div className="error">{error}</div> : null}

      {data ? (
        data.rankings.length === 0 ? (
          <p className="muted">No rankings yet for {data.mode}.</p>
        ) : (
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Bot</th>
                <th>Owner</th>
                <th>Score</th>
                <th>W</th>
                <th>L</th>
                <th>D</th>
                <th>Skill</th>
              </tr>
            </thead>
            <tbody>
              {data.rankings.map((r: Ranking, idx: number) => (
                <tr key={r.botId}>
                  <td>{idx + 1}</td>
                  <td>{r.botName ?? `bot #${r.botId}`}</td>
                  <td className="muted">—</td>
                  <td>{r.score}</td>
                  <td>{r.wins}</td>
                  <td>{r.losses}</td>
                  <td>{r.draws}</td>
                  <td title={`score ${r.score}`}>{skillIcon(r.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}
    </main>
  );
}