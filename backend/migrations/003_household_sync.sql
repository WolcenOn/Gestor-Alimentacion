-- 003_household_sync.sql
-- Initial whole-state synchronization per household.

CREATE TABLE IF NOT EXISTS household_sync_snapshots (
    household_id uuid PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
    state jsonb NOT NULL DEFAULT '{}'::jsonb,
    version integer NOT NULL DEFAULT 1,
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_household_sync_snapshots_updated_at ON household_sync_snapshots(updated_at);
