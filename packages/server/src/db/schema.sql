CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bots (
  id SERIAL PRIMARY KEY,
  owner_id INT REFERENCES users(id),
  name TEXT NOT NULL,
  mode_id TEXT NOT NULL,
  bot_key_hash TEXT NOT NULL,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS code_versions (
  id SERIAL PRIMARY KEY,
  bot_id INT REFERENCES bots(id),
  version INT NOT NULL,
  code TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bot_id, version)
);

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  mode_id TEXT NOT NULL,
  seed INT NOT NULL,
  challenger_bot_id INT REFERENCES bots(id),
  defender_bot_id INT REFERENCES bots(id),
  winner_bot_id INT REFERENCES bots(id),
  reason TEXT NOT NULL,
  excitement INT DEFAULT 0,
  is_ranked BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS replays (
  match_id INT PRIMARY KEY REFERENCES matches(id),
  meta JSONB NOT NULL,
  events JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS rankings (
  bot_id INT PRIMARY KEY REFERENCES bots(id),
  mode_id TEXT NOT NULL,
  score INT DEFAULT 1000,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  draws INT DEFAULT 0
);
