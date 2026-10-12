package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"
)

// ErrConflict indicates that a conditional write is based on stale data.
var ErrConflict = errors.New("conflict")

// SyncSnapshot is the whole frontend state saved for one household.
type SyncSnapshot struct {
	HouseholdID string          `json:"householdId"`
	Version     int             `json:"version"`
	State       json.RawMessage `json:"state"`
	UpdatedAt   *time.Time      `json:"updatedAt"`
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
	var updatedAt time.Time
	if err := row.Scan(&snapshot.HouseholdID, &snapshot.Version, &snapshot.State, &updatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return SyncSnapshot{
				HouseholdID: householdID,
				Version:     1,
				State:       json.RawMessage(`{}`),
				UpdatedAt:   nil,
			}, nil
		}
		return snapshot, err
	}
	snapshot.UpdatedAt = &updatedAt
	return snapshot, nil
}

// SaveSyncSnapshot uses atomic compare-and-swap so an outdated device never
// silently replaces a newer household state. A nil precondition may only
// create a snapshot; an existing snapshot requires its exact updatedAt value.
// This also protects the race between two devices creating the first snapshot.
func (s *Store) SaveSyncSnapshot(ctx context.Context, userID, householdID string, version int, state json.RawMessage, expectedUpdatedAt *time.Time) (SyncSnapshot, error) {
	var snapshot SyncSnapshot
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

	var row *sql.Row
	if expectedUpdatedAt == nil {
		row = s.db.QueryRowContext(ctx, `
			INSERT INTO household_sync_snapshots (household_id, state, version, updated_by, updated_at)
			VALUES ($1, $2, $3, $4, clock_timestamp())
			ON CONFLICT (household_id) DO NOTHING
			RETURNING household_id, version, state, updated_at
		`, householdID, state, version, userID)
	} else {
		row = s.db.QueryRowContext(ctx, `
			UPDATE household_sync_snapshots
			SET state = $1,
				version = $2,
				updated_by = $3,
				updated_at = GREATEST(clock_timestamp(), updated_at + interval '1 microsecond')
			WHERE household_id = $4
			  AND updated_at = $5
			RETURNING household_id, version, state, updated_at
		`, state, version, userID, householdID, expectedUpdatedAt.UTC())
	}
	var updatedAt time.Time
	if err := row.Scan(&snapshot.HouseholdID, &snapshot.Version, &snapshot.State, &updatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return snapshot, ErrConflict
		}
		return snapshot, err
	}
	snapshot.UpdatedAt = &updatedAt
	return snapshot, nil
}
