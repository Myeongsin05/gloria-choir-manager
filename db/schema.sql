PRAGMA foreign_keys = ON;

CREATE TABLE choirs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  choir_id TEXT REFERENCES choirs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('director', 'officer', 'member', 'guest')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permission_rules (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('director', 'officer', 'member', 'guest')),
  permission_key TEXT NOT NULL,
  is_allowed INTEGER NOT NULL DEFAULT 0 CHECK (is_allowed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (role, permission_key)
);

CREATE TABLE song_books (
  id TEXT PRIMARY KEY,
  choir_id TEXT NOT NULL REFERENCES choirs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  publisher TEXT,
  volume TEXT,
  total_stock INTEGER NOT NULL DEFAULT 0 CHECK (total_stock >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  storage_location TEXT,
  note TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (choir_id, title, volume)
);

CREATE TABLE song_book_items (
  id TEXT PRIMARY KEY,
  song_book_id TEXT NOT NULL REFERENCES song_books(id) ON DELETE CASCADE,
  item_no INTEGER,
  title TEXT NOT NULL,
  composer TEXT,
  arranger TEXT,
  lyricist TEXT,
  page_start INTEGER,
  page_end INTEGER,
  tags_json TEXT NOT NULL DEFAULT '[]',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (song_book_id, item_no),
  UNIQUE (song_book_id, title)
);

CREATE TABLE weekly_songs (
  id TEXT PRIMARY KEY,
  choir_id TEXT NOT NULL REFERENCES choirs(id) ON DELETE CASCADE,
  service_date TEXT NOT NULL,
  service_name TEXT NOT NULL DEFAULT '',
  week_slot TEXT NOT NULL DEFAULT 'current' CHECK (week_slot IN ('current', 'next', 'scheduled', 'done')),
  title TEXT NOT NULL,
  song_book_id TEXT REFERENCES song_books(id) ON DELETE SET NULL,
  song_book_item_id TEXT REFERENCES song_book_items(id) ON DELETE SET NULL,
  book_title_snapshot TEXT,
  page_text TEXT,
  preview_url TEXT,
  folder_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'done', 'archived')),
  access_level TEXT NOT NULL DEFAULT 'members' CHECK (access_level IN ('all', 'members', 'leaders', 'director')),
  note TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (choir_id, service_date, service_name, title)
);

CREATE TABLE score_assets (
  id TEXT PRIMARY KEY,
  weekly_song_id TEXT NOT NULL REFERENCES weekly_songs(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('choir_score', 'chamber_score', 'accompaniment', 'reference', 'other')),
  original_file_name TEXT,
  stored_file_name TEXT,
  mime_type TEXT,
  file_size_bytes INTEGER CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  storage_path TEXT,
  external_url TEXT,
  version_label TEXT NOT NULL DEFAULT 'v1.0',
  access_level TEXT NOT NULL DEFAULT 'members' CHECK (access_level IN ('all', 'members', 'leaders', 'director')),
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT,
  CHECK (storage_path IS NOT NULL OR external_url IS NOT NULL)
);

CREATE TABLE song_history (
  id TEXT PRIMARY KEY,
  choir_id TEXT NOT NULL REFERENCES choirs(id) ON DELETE CASCADE,
  weekly_song_id TEXT REFERENCES weekly_songs(id) ON DELETE SET NULL,
  song_book_item_id TEXT REFERENCES song_book_items(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  performed_date TEXT NOT NULL,
  service_name TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  note TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE song_book_inventory_events (
  id TEXT PRIMARY KEY,
  song_book_id TEXT NOT NULL REFERENCES song_books(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('initial', 'purchase', 'loss', 'discard', 'adjustment')),
  quantity_delta INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
  reason TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE password_reset_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  temporary_password_hash TEXT,
  token_hash TEXT,
  expires_at TEXT,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mail_outbox (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  provider_message_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT
);

CREATE INDEX idx_users_choir_id ON users(choir_id);
CREATE INDEX idx_song_book_items_title ON song_book_items(title);
CREATE INDEX idx_weekly_songs_date ON weekly_songs(choir_id, service_date);
CREATE INDEX idx_weekly_songs_status ON weekly_songs(status);
CREATE INDEX idx_score_assets_weekly_song ON score_assets(weekly_song_id, asset_type);
CREATE INDEX idx_song_history_title_date ON song_history(title, performed_date);
CREATE INDEX idx_inventory_events_book ON song_book_inventory_events(song_book_id, created_at);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

INSERT INTO choirs (id, name, sort_order, is_primary) VALUES
  ('choir-peniel', '브니엘', 1, 0),
  ('choir-immanuel', '임마누엘', 2, 0),
  ('choir-hallelujah', '할렐루야', 3, 0),
  ('choir-gloria', '글로리아', 4, 1);

INSERT INTO permission_rules (id, role, permission_key, is_allowed) VALUES
  ('perm-director-scores', 'director', 'manageScores', 1),
  ('perm-director-books', 'director', 'manageBooks', 1),
  ('perm-director-history', 'director', 'manageHistory', 1),
  ('perm-director-permissions', 'director', 'managePermissions', 1),
  ('perm-officer-scores', 'officer', 'manageScores', 1),
  ('perm-officer-books', 'officer', 'manageBooks', 1),
  ('perm-officer-history', 'officer', 'manageHistory', 1),
  ('perm-officer-permissions', 'officer', 'managePermissions', 0),
  ('perm-member-scores', 'member', 'manageScores', 0),
  ('perm-member-books', 'member', 'manageBooks', 0),
  ('perm-member-history', 'member', 'manageHistory', 0),
  ('perm-member-permissions', 'member', 'managePermissions', 0),
  ('perm-guest-scores', 'guest', 'manageScores', 0),
  ('perm-guest-books', 'guest', 'manageBooks', 0),
  ('perm-guest-history', 'guest', 'manageHistory', 0),
  ('perm-guest-permissions', 'guest', 'managePermissions', 0);
