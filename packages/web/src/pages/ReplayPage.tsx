import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, ApiError } from '../api.js';
import { GridDuelRenderer } from '../components/GridDuelRenderer.js';
import type { ReplayResponse } from '../types.js';

function winnerLabel(w: number | null, reason: string): string {
  if (w === null) return `Draw (${reason})`;
  return `Player ${w} won (${reason})`;
}

export function ReplayPage() {
  const { id } = useParams<{ id: string }>();
  const matchId = id ? Number(id) : NaN;
  const [data, setData] = useState<ReplayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (Number.isNaN(matchId)) {
      setError('invalid match id');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.replay(matchId)
      .then((res) => { if (!cancelled) { setData(res); setError(null); } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [matchId]);

  if (loading) return <main><p className="muted">Loading replay…</p></main>;
  if (error || !data) {
    return (
      <main>
        <h1>Replay</h1>
        <div className="error">{error ?? 'replay not found'}</div>
        <Link to="/play">← back to play</Link>
      </main>
    );
  }

  const mode = data.meta.modeId;

  return (
    <main>
      <h1>Replay #{data.match.id}</h1>
      <div className="muted" style={{ marginBottom: 12 }}>
        mode: {mode} · seed: {data.meta.seed} · {winnerLabel(data.result.winner, data.result.reason)}
      </div>

      {mode === 'grid-duel' ? (
        <GridDuelRenderer events={data.events} />
      ) : (
        <div className="card">
          <h2>Replay for {mode} not yet implemented</h2>
          <p className="muted">Phase 4 only renders grid-duel. Here's the raw event log:</p>
          <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 12 }}>
            {JSON.stringify(data.events, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Link to="/play">← back to play</Link>
      </div>
    </main>
  );
}