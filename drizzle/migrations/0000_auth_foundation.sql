CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(24) NOT NULL,
  email varchar(320) NOT NULL,
  email_verified_at timestamptz,
  password_hash text,
  nickname varchar(24) NOT NULL,
  avatar text NOT NULL DEFAULT '',
  role varchar(16) NOT NULL DEFAULT 'user',
  status varchar(16) NOT NULL DEFAULT 'active',
  exp integer NOT NULL DEFAULT 0,
  badges text[] NOT NULL DEFAULT ARRAY[]::text[],
  title varchar(80) NOT NULL DEFAULT '见习档案员',
  last_login_at timestamptz,
  last_login_ip varchar(64),
  last_daily_login varchar(10),
  last_check_in varchar(10),
  selected_badge varchar(80),
  avatar_frame varchar(120),
  card_background varchar(120),
  sakura_coins integer NOT NULL DEFAULT 0,
  exp_converted integer NOT NULL DEFAULT 0,
  theme_color varchar(32),
  theme_mode varchar(8),
  sakura_enabled boolean NOT NULL DEFAULT true,
  discoverable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_username_uq UNIQUE (username),
  CONSTRAINT users_email_uq UNIQUE (email),
  CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9_]{3,24}$'),
  CONSTRAINT users_role_check CHECK (role IN ('user','vip','admin')),
  CONSTRAINT users_status_check CHECK (status IN ('active','banned'))
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_sessions_token_hash_uq UNIQUE (token_hash)
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  code_hash text NOT NULL,
  purpose varchar(24) NOT NULL DEFAULT 'register',
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_email_idx ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS email_verification_expiry_idx ON email_verification_codes(expires_at);
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider varchar(24) NOT NULL CHECK (provider IN ('google','github')),
  provider_account_id varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_provider_account_uq UNIQUE(provider, provider_account_id)
);
CREATE INDEX IF NOT EXISTS oauth_accounts_user_id_idx ON oauth_accounts(user_id);

CREATE TABLE IF NOT EXISTS login_failures (
  key varchar(64) PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now()
);
