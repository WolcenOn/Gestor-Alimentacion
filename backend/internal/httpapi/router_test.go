package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/config"
)

func TestHealthHandlerWithoutDatabase(t *testing.T) {
	router := NewRouter(config.Config{AppEnv: "test", ReleaseCommit: "test-sha"}, func(context.Context) string {
		return "not_configured"
	}, nil)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/health", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}

	body := recorder.Body.String()
	for _, fragment := range []string{
		`"status":"ok"`,
		`"service":"gestor-alimentacion-api"`,
		`"environment":"test"`,
		`"database":"not_configured"`,
		`"release_commit":"test-sha"`,
	} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("expected response body to contain %s, got %s", fragment, body)
		}
	}
}

func TestReadinessRequiresDatabaseOK(t *testing.T) {
	router := NewRouter(config.Config{AppEnv: "test"}, func(context.Context) string {
		return "unreachable"
	}, nil)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/ready", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, recorder.Code)
	}
	body := recorder.Body.String()
	for _, fragment := range []string{
		`"status":"error"`,
		`"database":"unreachable"`,
	} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("expected response body to contain %s, got %s", fragment, body)
		}
	}
}

func TestReadinessOKWhenDatabaseOK(t *testing.T) {
	router := NewRouter(config.Config{AppEnv: "test"}, func(context.Context) string {
		return "ok"
	}, nil)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/ready", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}
	if body := recorder.Body.String(); !strings.Contains(body, `"database":"ok"`) {
		t.Fatalf("expected database ok in response, got %s", body)
	}
}

func TestVersionIncludesReleaseMetadata(t *testing.T) {
	router := NewRouter(config.Config{AppEnv: "test", ReleaseCommit: "abc123", BuildTime: "2026-06-19T17:30:00Z"}, nil, nil)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/version", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}
	body := recorder.Body.String()
	for _, fragment := range []string{
		`"version":"0.5.0"`,
		`"release_commit":"abc123"`,
		`"build_time":"2026-06-19T17:30:00Z"`,
	} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("expected response body to contain %s, got %s", fragment, body)
		}
	}
}
