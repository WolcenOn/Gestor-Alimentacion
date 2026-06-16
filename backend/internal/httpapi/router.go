package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/auth"
	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/config"
	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/store"
)

const apiVersion = "0.3.0"
const accessTokenTTL = 12 * time.Hour

// DBHealthChecker checks database availability for health responses.
type DBHealthChecker func(context.Context) string

// NewRouter builds the HTTP router for the API.
func NewRouter(cfg config.Config, dbHealth DBHealthChecker, appStore *store.Store) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", healthHandler(cfg, dbHealth))
	mux.HandleFunc("GET /api/v1/version", versionHandler(cfg))
	mux.HandleFunc("POST /api/v1/auth/register", registerHandler(cfg, appStore))
	mux.HandleFunc("POST /api/v1/auth/login", loginHandler(cfg, appStore))
	mux.HandleFunc("GET /api/v1/me", meHandler(cfg, appStore))
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

func loginHandler(cfg config.Config, appStore *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !storeAvailable(w, appStore) {
			return
		}
		var req loginRequest
		if !decodeJSON(w, r, &req) {
			return
		}
		user, passwordHash, err := appStore.FindUserForLogin(r.Context(), req.Email)
		if err != nil || !auth.VerifyPassword(passwordHash, req.Password) {
			writeError(w, http.StatusUnauthorized, "invalid_credentials", "Email o contraseña incorrectos.")
			return
		}
		token, err := issueUserToken(cfg, user)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "token_failed", "No se pudo crear la sesión.")
			return
		}
		households, err := appStore.ListHouseholdsForUser(r.Context(), user.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "households_failed", "No se pudieron cargar los hogares.")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"accessToken": token,
			"tokenType":   "Bearer",
			"expiresIn":   int(accessTokenTTL.Seconds()),
			"user":        user,
			"households":  households,
		})
	}
}

func meHandler(cfg config.Config, appStore *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !storeAvailable(w, appStore) {
			return
		}
		claims, ok := requireAuth(w, r, cfg)
		if !ok {
			return
		}
		user, err := appStore.GetUserByID(r.Context(), claims.Subject)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid_session", "La sesión no es válida.")
			return
		}
		households, err := appStore.ListHouseholdsForUser(r.Context(), user.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "households_failed", "No se pudieron cargar los hogares.")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"user":       user,
			"households": households,
		})
	}
}

func issueUserToken(cfg config.Config, user store.User) (string, error) {
	return auth.IssueToken(cfg.JWTSecret, auth.Claims{
		Subject: user.ID,
		Email:   user.Email,
		Name:    user.DisplayName,
	}, accessTokenTTL)
}

func requireAuth(w http.ResponseWriter, r *http.Request, cfg config.Config) (auth.Claims, bool) {
	var empty auth.Claims
	token, err := auth.BearerToken(r.Header.Get("Authorization"))
	if err != nil {
		writeError(w, http.StatusUnauthorized, "missing_token", "Falta el token de sesión.")
		return empty, false
	}
	claims, err := auth.ParseToken(cfg.JWTSecret, token)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_token", "Token inválido o caducado.")
		return empty, false
	}
	return claims, true
}

func storeAvailable(w http.ResponseWriter, appStore *store.Store) bool {
	if appStore == nil || !appStore.Available() {
		writeError(w, http.StatusServiceUnavailable, "database_required", "La base de datos no está configurada.")
		return false
	}
	return true
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "JSON inválido.")
		return false
	}
	return true
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

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
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
