package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/auth"
	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/config"
	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/nutrition"
	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/store"
)

const apiVersion = "0.5.0"
const accessTokenTTL = 12 * time.Hour
const inviteTTL = 7 * 24 * time.Hour

type DBHealthChecker func(context.Context) string

func NewRouter(cfg config.Config, dbHealth DBHealthChecker, appStore *store.Store) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", healthHandler(cfg, dbHealth))
	mux.HandleFunc("GET /ready", readinessHandler(cfg, dbHealth))
	mux.HandleFunc("GET /api/v1/version", versionHandler(cfg))
	mux.HandleFunc("POST /api/v1/auth/register", registerHandler(cfg, appStore))
	mux.HandleFunc("POST /api/v1/auth/login", loginHandler(cfg, appStore))
	mux.HandleFunc("GET /api/v1/me", meHandler(cfg, appStore))
	mux.HandleFunc("GET /api/v1/households", listHouseholdsHandler(cfg, appStore))
	mux.HandleFunc("POST /api/v1/households", createHouseholdHandler(cfg, appStore))
	mux.HandleFunc("GET /api/v1/households/", householdByIDHandler(cfg, appStore))
	mux.HandleFunc("PATCH /api/v1/households/", householdByIDHandler(cfg, appStore))
	mux.HandleFunc("POST /api/v1/households/", householdByIDHandler(cfg, appStore))
	mux.HandleFunc("PUT /api/v1/households/", householdByIDHandler(cfg, appStore))
	mux.HandleFunc("DELETE /api/v1/households/", householdByIDHandler(cfg, appStore))
	mux.HandleFunc("POST /api/v1/invites/", acceptInviteHandler(cfg, appStore))
	mux.HandleFunc("GET /api/v1/nutrition/usda/search", usdaSearchHandler(cfg))
	return withSecurityHeaders(withCORS(cfg, withNoStoreForAPI(withAuthRateLimit(mux, newAuthRateLimiter()))))
}

func withNoStoreForAPI(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("Pragma", "no-cache")
		}
		next.ServeHTTP(w, r)
	})
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
			"status":         statusText(status),
			"service":        "gestor-alimentacion-api",
			"environment":    cfg.AppEnv,
			"database":       database,
			"started_at":     startedAt.Format(time.RFC3339),
			"checked_at":     time.Now().UTC().Format(time.RFC3339),
			"backend_lang":   "go",
			"release_commit": cfg.ReleaseCommit,
		})
	}
}

func readinessHandler(cfg config.Config, dbHealth DBHealthChecker) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		database := "not_configured"
		if dbHealth != nil {
			database = dbHealth(ctx)
		}

		checks := map[string]string{"database": database}
		status := http.StatusOK
		if database != "ok" {
			status = http.StatusServiceUnavailable
		}

		writeJSON(w, status, map[string]any{
			"status":      statusText(status),
			"service":     "gestor-alimentacion-api",
			"environment": cfg.AppEnv,
			"checks":      checks,
			"checked_at":  time.Now().UTC().Format(time.RFC3339),
		})
	}
}

func versionHandler(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"name":           "gestor-alimentacion-api",
			"version":        apiVersion,
			"environment":    cfg.AppEnv,
			"release_commit": cfg.ReleaseCommit,
			"build_time":     cfg.BuildTime,
		})
	}
}

type registerRequest struct {
	Email         string `json:"email"`
	Password      string `json:"password"`
	DisplayName   string `json:"displayName"`
	HouseholdName string `json:"householdName"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type householdRequest struct {
	Name string `json:"name"`
}

type inviteRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

type memberRoleRequest struct {
	Role string `json:"role"`
}

type syncRequest struct {
	Version           int             `json:"version"`
	State             json.RawMessage `json:"state"`
	ExpectedUpdatedAt string          `json:"expectedUpdatedAt"`
}

func registerHandler(cfg config.Config, appStore *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !storeAvailable(w, appStore) {
			return
		}
		var req registerRequest
		if !decodeJSON(w, r, &req) {
			return
		}
		req.Email = strings.ToLower(strings.TrimSpace(req.Email))
		if req.Email == "" || !strings.Contains(req.Email, "@") {
			writeError(w, http.StatusBadRequest, "invalid_email", "Introduce un email válido.")
			return
		}
		passwordHash, err := auth.HashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_password", err.Error())
			return
		}
		result, err := appStore.RegisterUser(r.Context(), req.Email, passwordHash, req.DisplayName, req.HouseholdName)
		if err != nil {
			if errors.Is(err, store.ErrEmailAlreadyExists) {
				writeError(w, http.StatusConflict, "email_exists", "Ya existe una cuenta con ese email.")
				return
			}
			writeError(w, http.StatusInternalServerError, "register_failed", "No se pudo crear la cuenta.")
			return
		}
		token, err := issueUserToken(cfg, result.User)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "token_failed", "No se pudo crear la sesión.")
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"accessToken": token,
			"tokenType":   "Bearer",
			"expiresIn":   int(accessTokenTTL.Seconds()),
			"user":        result.User,
			"households":  []store.Household{result.Household},
		})
	}
}
