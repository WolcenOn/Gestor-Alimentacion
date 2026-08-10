package db

import (
	"context"
	"database/sql"
	"fmt"
)

var migrations = []struct {
	name string
	sql  string
}{
	{
		name: "001_init",
		sql: `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    display_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS households (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household_users (
    household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_household_users_user_id ON household_users(user_id);
CREATE INDEX IF NOT EXISTS idx_households_owner_user_id ON households(owner_user_id);
`,
	},
	{
		name: "002_household_invites",
		sql: `
CREATE TABLE IF NOT EXISTS household_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    invited_email text,
    role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    token_hash text NOT NULL UNIQUE,
    created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    accepted_by uuid REFERENCES users(id) ON DELETE SET NULL,
    expires_at timestamptz NOT NULL,
    accepted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_household_invites_household_id ON household_invites(household_id);
CREATE INDEX IF NOT EXISTS idx_household_invites_token_hash ON household_invites(token_hash);
`,
	},
	{
		name: "003_household_sync",
		sql: `
CREATE TABLE IF NOT EXISTS household_sync_snapshots (
    household_id uuid PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
    state jsonb NOT NULL DEFAULT '{}'::jsonb,
    version integer NOT NULL DEFAULT 1,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_household_sync_snapshots_updated_at ON household_sync_snapshots(updated_at);
`,
	},
	{
		name: "004_password_reset_tokens",
		sql: `
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
`,
	},
}

// RunMigrations applies the initial PostgreSQL schema. The statements are idempotent so startup redeploys are safe.
func RunMigrations(ctx context.Context, pool *sql.DB) error {
	if pool == nil {
		return nil
	}
	for _, migration := range migrations {
		if _, err := pool.ExecContext(ctx, migration.sql); err != nil {
			return fmt.Errorf("migration %s failed: %w", migration.name, err)
		}
	}
	return nil
}
