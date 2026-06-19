package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"
)

// SyncSnapshot is the whole frontend state saved for one household.
type SyncSnapshot struct {
	HouseholdID string          `json:"householdId"`
	Version     int             `json:"version"`
	State       json.RawMessage `json:"state"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

// GetSyncSnapshot returns the latest whole-state snapshot for a household.
func (s *Store) GetSyncSnapshot(ctx context.Context, userID, householdID string) (SyncSnapshot, error) {
	var snapshot SyncSnapshot
	if !s.Available() {
		return snapshot, ErrDatabaseRequired
	}
	if _, err := s.GetHouseholdForUser(ctx, userID, householdID); err != nil {
		return snapshot, err
	}

	row := s.db.QueryRowContext(ctx, `
		SELECT household_id, version, state, updated_at
		FROM household_sync_snapshots
		WHERE household_id = $1
	`, householdID)
	if err := row.Scan(&snapshot.HouseholdID, &snapshot.Version, &snapshot.State, &snapshot.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return SyncSnapshot{
				HouseholdID: householdID,
				Version:     1,
				State:       json.RawMessage(`{}`),
				UpdatedAt:   time.Time{},
			}, nil
		}
		return snapshot, err
	}
	return snapshot, nil
}

// SaveSyncSnapshot stores the whole frontend state for a household.
func (s *Store) SaveSyncSnapshot(ctx context.Context, userID, householdID string, version int, state json.RawMessage, expectedUpdatedAt ...*time.Time) (SyncSnapshot, error) {
	var snapshot SyncSnapshot
	_ = expectedUpdatedAt
	if !s.Available() {
		return snapshot, ErrDatabaseRequired
	}
	if err := s.requireHouseholdRole(ctx, userID, householdID, "owner", "admin", "member"); err != nil {
		return snapshot, err
	}
	if version <= 0 {
		version = 1
	}
	if len(state) == 0 {
		state = json.RawMessage(`{}`)
	}
	if !json.Valid(state) {
		return snapshot, ErrNotFound
	}

	row := s.db.QueryRowContext(ctx, `
		INSERT INTO household_sync_snapshots (household_id, state, version, updated_by, updated_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (household_id) DO UPDATE SET
			state = EXCLUDED.state,
			version = EXCLUDED.version,
			updated_by = EXCLUDED.updated_by,
			updated_at = now()
		RETURNING household_id, version, state, updated_at
	`, householdID, state, version, userID)
	if err := row.Scan(&snapshot.HouseholdID, &snapshot.Version, &snapshot.State, &snapshot.UpdatedAt); err != nil {
		return snapshot, err
	}
	return snapshot, nil
}
