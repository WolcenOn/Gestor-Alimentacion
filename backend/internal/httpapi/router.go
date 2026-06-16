package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"time"

	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/config"
)

const apiVersion = "0.2.0"

// DBHealthChecker checks database availability for health responses.
type DBHealthChecker func(context.Context) string

// NewRouter builds the HTTP router for the API.
func NewRouter(cfg config.Config, dbHealth DBHealthChecker) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", healthHandler(cfg, dbHealth))
	mux.HandleFunc("GET /api/v1/version", versionHandler(cfg))
	return withCORS(cfg, mux)
}

func healthHandler(cfg config.Config, dbHealth DBHealthChecker) http.HandlerFunc {
	startedAt := time.Now().UTC()
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		database := "not_configured"
		if dbHealth != nil {
			database = dbHealth(ctx)
		}

		status := http.StatusOK
		if database == "unreachable" {
			status = http.StatusServiceUnavailable
		}

		writeJSON(w, status, map[string]any{
			"status":       statusText(status),
			"service":      "gestor-alimentacion-api",
			"environment":  cfg.AppEnv,
			"database":     database,
			"started_at":   startedAt.Format(time.RFC3339),
			"checked_at":   time.Now().UTC().Format(time.RFC3339),
			"backend_lang": "go",
		})
	}
}

func versionHandler(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"name":        "gestor-alimentacion-api",
			"version":     apiVersion,
			"environment": cfg.AppEnv,
		})
	}
}

func statusText(status int) string {
	if status >= 200 && status < 300 {
		return "ok"
	}
	return "error"
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func withCORS(cfg config.Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && slices.Contains(cfg.CORSAllowedOrigins, origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
