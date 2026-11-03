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
  badges jsonb NOT NULL DEFAULT '[]'::jsonb,
  title varchar(80) NOT NULL DEFAULT '见习档案员',
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
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
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
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
CREATE INDEX IF NOT EXISTS email_verification_email_idx ON email_verification_codes(email);
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

CREATE TABLE IF NOT EXISTS app_state (
  id varchar(32) PRIMARY KEY,
  data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
