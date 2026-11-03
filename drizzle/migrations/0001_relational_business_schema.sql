-- V2.6 relational application schema. No legacy JSON snapshot or imported business data.
CREATE TABLE IF NOT EXISTS games (
  id varchar(80) PRIMARY KEY,
  name varchar(200) NOT NULL,
  slug varchar(220) NOT NULL,
  cover text NOT NULL DEFAULT '',
  genre varchar(100) NOT NULL DEFAULT '',
  platforms text[] NOT NULL DEFAULT ARRAY[]::text[],
  status varchar(20) NOT NULL,
  latest_version varchar(80) NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  views integer NOT NULL DEFAULT 0,
  favorites integer NOT NULL DEFAULT 0,
  minimum_config text,
  recommended_config text,
  CONSTRAINT games_slug_uq UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS game_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id varchar(80) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS game_updates (
  id varchar(80) PRIMARY KEY,
  game_id varchar(80) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  contributor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  contributor_name varchar(120),
  date varchar(40) NOT NULL,
  version varchar(80) NOT NULL,
  title varchar(240) NOT NULL,
  notes text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS game_files (
  id varchar(80) PRIMARY KEY,
  game_id varchar(80) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name varchar(240) NOT NULL,
  version varchar(80) NOT NULL,
  size varchar(40) NOT NULL,
  checksum varchar(255) NOT NULL,
  date varchar(40) NOT NULL,
  notes text NOT NULL DEFAULT '',
  url text
);

CREATE TABLE IF NOT EXISTS guides (
  id varchar(80) PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  author varchar(120),
  game_id varchar(80) REFERENCES games(id) ON DELETE SET NULL,
  game_name varchar(200),
  title varchar(240) NOT NULL,
  category varchar(100) NOT NULL,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  date varchar(40) NOT NULL,
  content text NOT NULL,
  cover text,
  body_image text,
  status varchar(20) NOT NULL DEFAULT 'pending',
  updated_at timestamptz,
  views integer NOT NULL DEFAULT 0,
  favorites integer NOT NULL DEFAULT 0,
  reward_granted boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS guide_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id varchar(80) NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS guide_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id varchar(80) NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  status varchar(24) NOT NULL,
  reply text NOT NULL DEFAULT '',
  at timestamptz NOT NULL DEFAULT now(),
  by varchar(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
  id varchar(80) PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  username varchar(24),
  title varchar(240) NOT NULL,
  cover text NOT NULL DEFAULT '',
  game_id varchar(80) NOT NULL REFERENCES games(id),
  game_name varchar(200) NOT NULL,
  version varchar(80) NOT NULL,
  description text NOT NULL,
  scope text NOT NULL,
  install text NOT NULL,
  url text NOT NULL,
  tutorial text NOT NULL,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  views integer NOT NULL DEFAULT 0,
  favorites integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS resource_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id varchar(80) NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS feedback (
  id varchar(80) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  username varchar(24) NOT NULL,
  title varchar(240) NOT NULL,
  type varchar(80) NOT NULL,
  game_id varchar(80) NOT NULL DEFAULT '',
  description text NOT NULL,
  image text NOT NULL DEFAULT '',
  status varchar(24) NOT NULL DEFAULT 'pending',
  reply text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  bug_severity varchar(16),
  reward_granted boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS feedback_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id varchar(80) NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS feedback_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id varchar(80) NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  status varchar(24) NOT NULL,
  reply text NOT NULL DEFAULT '',
  at timestamptz NOT NULL DEFAULT now(),
  by varchar(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS notices (
  id varchar(80) PRIMARY KEY,
  title varchar(240) NOT NULL,
  subtitle varchar(240) NOT NULL DEFAULT '',
  cover text NOT NULL DEFAULT '',
  content text NOT NULL,
  date varchar(40) NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  updated_by varchar(120) NOT NULL,
  updated_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS notice_history (
  id varchar(80) PRIMARY KEY,
  notice_id varchar(80) NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  date varchar(40) NOT NULL,
  content text NOT NULL,
  title varchar(240) NOT NULL,
  subtitle varchar(240) NOT NULL,
  cover text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS collections (
  id varchar(80) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type varchar(20) NOT NULL,
  target_id varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collections_target_uq UNIQUE(user_id, target_type, target_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id varchar(80) PRIMARY KEY,
  target_type varchar(20) NOT NULL,
  target_id varchar(80) NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  parent_id varchar(80),
  pinned boolean NOT NULL DEFAULT false,
  deleted boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id varchar(80) NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT comment_likes_uq UNIQUE(comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS photos (
  id varchar(80) PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  username varchar(24),
  title varchar(240) NOT NULL,
  description text NOT NULL,
  image text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  downloads integer NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[]
);
CREATE TABLE IF NOT EXISTS shop_products (
  id varchar(80) PRIMARY KEY,
  name varchar(160) NOT NULL,
  description text NOT NULL,
  image text NOT NULL DEFAULT '',
  category varchar(40) NOT NULL,
  price integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  stock integer,
  effect_value varchar(160),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inventory (
  id varchar(80) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id varchar(80) NOT NULL REFERENCES shop_products(id),
  product_name varchar(160) NOT NULL,
  category varchar(40) NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  price integer NOT NULL
);
CREATE TABLE IF NOT EXISTS coin_transactions (
  id varchar(80) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar(32) NOT NULL,
  amount integer NOT NULL,
  balance_before integer NOT NULL,
  balance_after integer NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  related_id varchar(80)
);
CREATE TABLE IF NOT EXISTS login_logs (
  id varchar(80) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username varchar(24) NOT NULL,
  ip varchar(64) NOT NULL,
  date timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS direct_messages (
  id varchar(80) PRIMARY KEY,
  from_id uuid NOT NULL REFERENCES users(id),
  to_id uuid NOT NULL REFERENCES users(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE TABLE IF NOT EXISTS friendships (
  id varchar(80) PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES users(id),
  addressee_id uuid NOT NULL REFERENCES users(id),
  status varchar(16) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
  id varchar(80) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar(24) NOT NULL,
  title varchar(240) NOT NULL,
  body text NOT NULL,
  href text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS contributors (
  id varchar(80) PRIMARY KEY,
  name varchar(160) NOT NULL,
  role varchar(120) NOT NULL,
  description text NOT NULL,
  kind varchar(24) NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  avatar text,
  exp integer NOT NULL DEFAULT 0,
  badges text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS site_settings (
  key varchar(100) PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_updates_game_idx ON game_updates(game_id);
CREATE INDEX IF NOT EXISTS game_files_game_idx ON game_files(game_id);
CREATE INDEX IF NOT EXISTS guides_user_idx ON guides(user_id);
CREATE INDEX IF NOT EXISTS guides_game_idx ON guides(game_id);
CREATE INDEX IF NOT EXISTS resources_game_idx ON resources(game_id);
CREATE INDEX IF NOT EXISTS feedback_user_idx ON feedback(user_id);
CREATE INDEX IF NOT EXISTS collections_user_idx ON collections(user_id);
CREATE INDEX IF NOT EXISTS comments_target_idx ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS messages_inbox_idx ON direct_messages(to_id, created_at);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);
