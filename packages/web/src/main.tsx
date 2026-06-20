import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { Landing } from './pages/Landing.js';
import { BotPlayPage } from './pages/BotPlayPage.js';
import { ReplayPage } from './pages/ReplayPage.js';
import { LeaderboardPage } from './pages/LeaderboardPage.js';
import { Guide } from './pages/Guide.js';
import './styles.css';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="layout">
      <nav className="nav">
        <Link to="/" className="brand">yxpt</Link>
        <NavLink to="/play" className={({ isActive }) => (isActive ? 'active' : '')}>Play</NavLink>
        <NavLink to="/leaderboard" className={({ isActive }) => (isActive ? 'active' : '')}>Leaderboard</NavLink>
        <NavLink to="/guide" className={({ isActive }) => (isActive ? 'active' : '')}>Agent Guide</NavLink>
      </nav>
      {children}
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/play" element={<BotPlayPage />} />
          <Route path="/replay/:id" element={<ReplayPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/guide" element={<Guide />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);