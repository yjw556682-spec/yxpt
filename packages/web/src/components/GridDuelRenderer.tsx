import { useEffect, useRef, useState } from 'react';
import type { TickEvent } from '@yxpt/shared-types';

export const GRID = 11;

interface Tank {
  x: number;
  y: number;
  dir: number;
  alive: boolean;
}

interface Bullet {
  player: number;
  x: number;
  y: number;
}

interface RendererState {
  players: [Tank, Tank];
  star: { x: number; y: number } | null;
  bullets: Bullet[];
}

function initState(): RendererState {
  return {
    players: [
      { x: 0, y: 0, dir: 1, alive: true },
      { x: 10, y: 10, dir: 3, alive: true },
    ],
    star: null,
    bullets: [],
  };
}

function applyEvent(state: RendererState, ev: TickEvent): RendererState {
  const players = state.players.map((p) => ({ ...p })) as [Tank, Tank];
  const bullets: Bullet[] = [];
  let star = state.star;

  switch (ev.type) {
    case 'move': {
      const i = ev.player as number;
      const pos = ev.position as [number, number];
      if (players[i]) {
        players[i].x = pos[0];
        players[i].y = pos[1];
      }
      break;
    }
    case 'turn': {
      const i = ev.player as number;
      if (players[i]) players[i].dir = ev.direction as number;
      break;
    }
    case 'fire': {
      const i = ev.player as number;
      const p = players[i];
      if (!p) break;
      const dx = [0, 1, 0, -1][p.dir] ?? 0;
      const dy = [-1, 0, 1, 0][p.dir] ?? 0;
      bullets.push({ player: i, x: p.x + dx, y: p.y + dy });
      break;
    }
    case 'bullet_miss': {
      break;
    }
    case 'destroyed': {
      const i = ev.player as number;
      if (players[i]) players[i].alive = false;
      break;
    }
    case 'collect': {
      const i = ev.player as number;
      const p = players[i];
      if (p) star = null;
      break;
    }
    case 'spawn_star': {
      const pos = ev.position as [number, number];
      star = { x: pos[0], y: pos[1] };
      break;
    }
    default:
      break;
  }

  return { players, star, bullets };
}

function drawTriangle(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: number, color: string, size: number) {
  const dx = [0, 1, 0, -1][dir] ?? 0;
  const dy = [-1, 0, 1, 0][dir] ?? 0;
  // Perpendicular offsets for the triangle base
  const px = -dy;
  const py = dx;
  const tipX = cx + dx * size * 0.7;
  const tipY = cy + dy * size * 0.7;
  const base1X = cx - dx * size * 0.3 + px * size * 0.5;
  const base1Y = cy - dy * size * 0.3 + py * size * 0.5;
  const base2X = cx - dx * size * 0.3 - px * size * 0.5;
  const base2Y = cy - dy * size * 0.3 - py * size * 0.5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(base1X, base1Y);
  ctx.lineTo(base2X, base2Y);
  ctx.closePath();
  ctx.fill();
}

export function GridDuelRenderer({
  events,
  width = 440,
}: {
  events: TickEvent[];
  width?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);

  const cellSize = width / GRID;
  const height = cellSize * GRID;

  // Build state by replaying events up to `tick`
  const state: RendererState = (() => {
    let s = initState();
    for (let i = 0; i < events.length && i <= tick; i++) {
      s = applyEvent(s, events[i]);
    }
    return s;
  })();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // grid
    ctx.strokeStyle = '#2c313d';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(width, i * cellSize);
      ctx.stroke();
    }

    // ground (dark)
    ctx.fillStyle = '#14171f';
    ctx.fillRect(0, 0, width, height);

    // star
    if (state.star) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(
        state.star.x * cellSize + cellSize / 2,
        state.star.y * cellSize + cellSize / 2,
        cellSize * 0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // bullets — we don't keep them across ticks in applyEvent, but
    // for a quick visualisation we draw circles if any 'fire' events
    // happened this tick. Otherwise bullets are silent (consistent with
    // event-only replay).
    // (Per-tick bullets are intentionally not persisted between ticks in
    // this minimal renderer — they're visible only on the fire event tick.)

    // tanks
    const colors = ['#60a5fa', '#f87171'];
    for (let i = 0; i < 2; i++) {
      const p = state.players[i];
      if (!p.alive) continue;
      drawTriangle(
        ctx,
        p.x * cellSize + cellSize / 2,
        p.y * cellSize + cellSize / 2,
        p.dir,
        colors[i],
        cellSize * 0.6,
      );
    }
  }, [state, cellSize, width, height]);

  useEffect(() => {
    if (!playing) return;
    if (tick >= events.length - 1) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setTick((t) => Math.min(events.length - 1, t + 1)), 200);
    return () => window.clearTimeout(id);
  }, [playing, tick, events.length]);

  return (
    <div>
      <canvas ref={canvasRef} width={width} height={height} className="replay-canvas" />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button className="btn" onClick={() => { setTick(0); setPlaying(false); }}>Reset</button>
        <input
          type="range"
          min={0}
          max={Math.max(0, events.length - 1)}
          value={tick}
          onChange={(e) => { setTick(Number(e.target.value)); setPlaying(false); }}
          style={{ flex: 1 }}
        />
        <span className="muted">tick {tick} / {Math.max(0, events.length - 1)}</span>
      </div>
    </div>
  );
}