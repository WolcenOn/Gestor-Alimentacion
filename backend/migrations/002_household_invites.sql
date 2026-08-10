-- 002_household_invites.sql
-- Household invitations for account synchronization.

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
