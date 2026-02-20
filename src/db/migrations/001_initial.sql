-- Sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Agents
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  personality TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  avatar_seed TEXT NOT NULL,
  is_preset INTEGER NOT NULL DEFAULT 0,
  creator_session TEXT,
  creator_user TEXT,
  play_count INTEGER NOT NULL DEFAULT 0,
  win_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_agents_preset ON agents(is_preset) WHERE is_preset = 1;
CREATE INDEX idx_agents_creator ON agents(creator_session);

-- Games
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'cancelled')),
  mode TEXT NOT NULL CHECK (mode IN ('elimination', 'round_robin')),
  visibility TEXT NOT NULL DEFAULT 'public',
  current_round INTEGER NOT NULL DEFAULT 0,
  total_rounds INTEGER,
  winner_agent_id TEXT REFERENCES agents(id),
  creator_session TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_created ON games(created_at DESC);

-- Game-Agent junction
CREATE TABLE game_agents (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  final_score REAL,
  eliminated_round INTEGER,
  placement INTEGER,
  PRIMARY KEY (game_id, agent_id)
);

-- Replay events
CREATE TABLE replay_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  data TEXT NOT NULL,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(game_id, sequence)
);
CREATE INDEX idx_replay_game ON replay_events(game_id, sequence);

-- Leaderboard
CREATE TABLE leaderboard (
  agent_id TEXT PRIMARY KEY REFERENCES agents(id),
  total_games INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_score REAL NOT NULL DEFAULT 0,
  elo_rating REAL NOT NULL DEFAULT 1000,
  last_played_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_leaderboard_elo ON leaderboard(elo_rating DESC);

-- Rate limits
CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);
