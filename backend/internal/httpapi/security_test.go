package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/config"
)

func TestSecurityHeadersOnHealth(t *testing.T) {
	router := NewRouter(testConfig(), nil, nil)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	request.Header.Set("X-Forwarded-Proto", "https")

	router.ServeHTTP(recorder, request)

	assertHeader(t, recorder, "X-Content-Type-Options", "nosniff")
	assertHeader(t, recorder, "X-Frame-Options", "DENY")
	assertHeader(t, recorder, "Referrer-Policy", "no-referrer")
	assertHeader(t, recorder, "Strict-Transport-Security", "max-age=31536000; includeSubDomains")
	if recorder.Header().Get("Content-Security-Policy") == "" {
		t.Fatal("expected Content-Security-Policy header")
	}
}

func TestCORSAllowsOnlyConfiguredOrigin(t *testing.T) {
	router := NewRouter(testConfig(), nil, nil)

	allowed := httptest.NewRecorder()
	allowedRequest := httptest.NewRequest(http.MethodOptions, "/api/v1/version", nil)
	allowedRequest.Header.Set("Origin", "https://app.example.com")
	router.ServeHTTP(allowed, allowedRequest)

	if allowed.Code != http.StatusNoContent {
		t.Fatalf("expected allowed preflight %d, got %d", http.StatusNoContent, allowed.Code)
	}
	assertHeader(t, allowed, "Access-Control-Allow-Origin", "https://app.example.com")

	blocked := httptest.NewRecorder()
	blockedRequest := httptest.NewRequest(http.MethodOptions, "/api/v1/version", nil)
	blockedRequest.Header.Set("Origin", "https://evil.example.com")
	router.ServeHTTP(blocked, blockedRequest)

	if blocked.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("unexpected CORS allow header for blocked origin")
	}
}

func TestAuthRateLimit(t *testing.T) {
	router := NewRouter(testConfig(), nil, nil)

	for i := 0; i < authRateLimitMaxAttempts; i++ {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
		request.RemoteAddr = "203.0.113.10:1234"
		router.ServeHTTP(recorder, request)

		if recorder.Code == http.StatusTooManyRequests {
			t.Fatalf("request %d was rate limited too early", i+1)
		}
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
	request.RemoteAddr = "203.0.113.10:1234"
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusTooManyRequests {
		t.Fatalf("expected rate limit status %d, got %d", http.StatusTooManyRequests, recorder.Code)
	}
	if recorder.Header().Get("Retry-After") == "" {
		t.Fatal("expected Retry-After header")
	}
}

func testConfig() config.Config {
	return config.Config{
		AppEnv:             "test",
		CORSAllowedOrigins: []string{"https://app.example.com"},
	}
}

func assertHeader(t *testing.T, recorder *httptest.ResponseRecorder, key, expected string) {
	t.Helper()
	if got := recorder.Header().Get(key); got != expected {
		t.Fatalf("expected %s header %q, got %q", key, expected, got)
	}
}
