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
	router := NewRouter(config.Config{AppEnv: "test"}, func(context.Context) string {
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
	} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("expected response body to contain %s, got %s", fragment, body)
		}
	}
}
