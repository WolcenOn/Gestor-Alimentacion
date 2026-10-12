package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/store"
)

func TestParseExpectedUpdatedAt(t *testing.T) {
	recorder := httptest.NewRecorder()
	parsed, ok := parseExpectedUpdatedAt(recorder, json.RawMessage(`"2026-08-21T15:00:00.123456Z"`))
	if !ok || parsed == nil {
		t.Fatal("expected valid timestamp")
	}
	want, err := time.Parse(time.RFC3339Nano, "2026-08-21T15:00:00.123456Z")
	if err != nil {
		t.Fatal(err)
	}
	if !parsed.Equal(want) {
		t.Fatalf("parsed timestamp = %s, want %s", parsed, want)
	}

	recorder = httptest.NewRecorder()
	parsed, ok = parseExpectedUpdatedAt(recorder, json.RawMessage("null"))
	if !ok || parsed != nil {
		t.Fatalf("null means create-only, got parsed=%v ok=%v", parsed, ok)
	}

	recorder = httptest.NewRecorder()
	parsed, ok = parseExpectedUpdatedAt(recorder, nil)
	if ok || parsed != nil || recorder.Code != http.StatusPreconditionRequired {
		t.Fatalf("missing precondition must return 428, got parsed=%v ok=%v status=%d", parsed, ok, recorder.Code)
	}

	for _, raw := range []json.RawMessage{
		json.RawMessage(`""`),
		json.RawMessage(`"not-a-date"`),
		json.RawMessage("123"),
		json.RawMessage(`"0001-01-01T00:00:00Z"`),
	} {
		recorder = httptest.NewRecorder()
		parsed, ok = parseExpectedUpdatedAt(recorder, raw)
		if ok || parsed != nil || recorder.Code != http.StatusBadRequest {
			t.Errorf("invalid precondition %s: parsed=%v ok=%v status=%d", raw, parsed, ok, recorder.Code)
		}
	}
}

func TestWriteStoreErrorSyncConflict(t *testing.T) {
	recorder := httptest.NewRecorder()
	writeStoreError(recorder, store.ErrConflict)
	if recorder.Code != http.StatusConflict {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusConflict)
	}

	var payload struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Error.Code != "sync_conflict" {
		t.Fatalf("code = %q, want sync_conflict", payload.Error.Code)
	}
}
