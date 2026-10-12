package store_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/db"
	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/store"
)

// These tests run against a real PostgreSQL instance in CI. In local
// environments without TEST_DATABASE_URL, ordinary unit tests still run.
func syncTestStore(t *testing.T) (*store.Store, string, string) {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL is needed for PostgreSQL integration tests")
	}
	pool, err := db.Open(dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = pool.Close() })
	ctx := context.Background()
	if err := db.RunMigrations(ctx, pool); err != nil {
		t.Fatal(err)
	}

	appStore := store.New(pool)
	email := fmt.Sprintf("sync-cas-%d@example.test", time.Now().UnixNano())
	created, err := appStore.RegisterUser(ctx, email, "test-only-hash", "CAS Test", "CAS Test Home")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.ExecContext(context.Background(), "DELETE FROM households WHERE id = $1", created.Household.ID)
		_, _ = pool.ExecContext(context.Background(), "DELETE FROM users WHERE id = $1", created.User.ID)
	})
	return appStore, created.User.ID, created.Household.ID
}

func TestSnapshotCompareAndSwapPostgres(t *testing.T) {
	appStore, userID, householdID := syncTestStore(t)
	ctx := context.Background()

	empty, err := appStore.GetSyncSnapshot(ctx, userID, householdID)
	if err != nil {
		t.Fatal(err)
	}
	if empty.UpdatedAt != nil {
		t.Fatalf("new household must have a null updatedAt, got %v", empty.UpdatedAt)
	}

	initial := json.RawMessage(`{"device":"A","value":1}`)
	first, err := appStore.SaveSyncSnapshot(ctx, userID, householdID, 1, initial, nil)
	if err != nil || first.UpdatedAt == nil {
		t.Fatalf("create-only save failed: snapshot=%+v err=%v", first, err)
	}
	_, err = appStore.SaveSyncSnapshot(ctx, userID, householdID, 1, json.RawMessage(`{"device":"B"}`), nil)
	if !errors.Is(err, store.ErrConflict) {
		t.Fatalf("second create-only save must conflict, got %v", err)
	}

	next, err := appStore.SaveSyncSnapshot(ctx, userID, householdID, 1, json.RawMessage(`{"device":"A","value":2}`), first.UpdatedAt)
	if err != nil || next.UpdatedAt == nil {
		t.Fatalf("conditional update failed: snapshot=%+v err=%v", next, err)
	}
	if !next.UpdatedAt.After(*first.UpdatedAt) {
		t.Fatalf("each update must advance the token; first=%v next=%v", first.UpdatedAt, next.UpdatedAt)
	}

	_, err = appStore.SaveSyncSnapshot(ctx, userID, householdID, 1, json.RawMessage(`{"device":"B","value":999}`), first.UpdatedAt)
	if !errors.Is(err, store.ErrConflict) {
		t.Fatalf("stale write must return ErrConflict, got %v", err)
	}

	stored, err := appStore.GetSyncSnapshot(ctx, userID, householdID)
	if err != nil {
		t.Fatal(err)
	}
	if string(stored.State) != `{"device": "A", "value": 2}` {
		// PostgreSQL jsonb can reorder keys or whitespace; compare decoded values below.
		var payload struct {
			Device string `json:"device"`
			Value  int    `json:"value"`
		}
		if err := json.Unmarshal(stored.State, &payload); err != nil {
			t.Fatal(err)
		}
		if payload.Device != "A" || payload.Value != 2 {
			t.Fatalf("stale write changed stored data: %s", stored.State)
		}
	}
}

func TestSnapshotTwoDevicesRacePostgres(t *testing.T) {
	appStore, userID, householdID := syncTestStore(t)
	ctx := context.Background()
	first, err := appStore.SaveSyncSnapshot(ctx, userID, householdID, 1, json.RawMessage(`{"value":0}`), nil)
	if err != nil {
		t.Fatal(err)
	}

	start := make(chan struct{})
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, value := range []int{1, 2} {
		wg.Add(1)
		go func(value int) {
			defer wg.Done()
			<-start
			_, err := appStore.SaveSyncSnapshot(ctx, userID, householdID, 1,
				json.RawMessage(fmt.Sprintf(`{"value":%d}`, value)), first.UpdatedAt)
			results <- err
		}(value)
	}
	close(start)
	wg.Wait()
	close(results)

	successes, conflicts := 0, 0
	for err := range results {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, store.ErrConflict):
			conflicts++
		default:
			t.Fatalf("unexpected write error: %v", err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("two simultaneous writes: %d successes, %d conflicts; want 1 each", successes, conflicts)
	}

	stored, err := appStore.GetSyncSnapshot(ctx, userID, householdID)
	if err != nil {
		t.Fatal(err)
	}
	var payload struct{ Value int `json:"value"` }
	if err := json.Unmarshal(stored.State, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Value != 1 && payload.Value != 2 {
		t.Fatalf("unexpected winning snapshot: %s", stored.State)
	}
}
