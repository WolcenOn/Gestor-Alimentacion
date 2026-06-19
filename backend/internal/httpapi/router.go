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

		checks := map[string]string{
			"database": database,
		}
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

func listHouseholdsHandler(cfg config.Config, appStore *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := authenticatedStore(w, r, cfg, appStore)
		if !ok {
			return
		}
		households, err := appStore.ListHouseholdsForUser(r.Context(), claims.Subject)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "households_failed", "No se pudieron cargar los hogares.")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"households": households})
	}
}

func createHouseholdHandler(cfg config.Config, appStore *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := authenticatedStore(w, r, cfg, appStore)
		if !ok {
			return
		}
		var req householdRequest
		if !decodeJSON(w, r, &req) {
			return
		}
		household, err := appStore.CreateHousehold(r.Context(), claims.Subject, req.Name)
		if err != nil {
			writeStoreError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"household": household})
	}
}

func householdByIDHandler(cfg config.Config, appStore *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := authenticatedStore(w, r, cfg, appStore)
		if !ok {
			return
		}
		householdID, action, ok := parseHouseholdPath(r.URL.Path)
		if !ok {
			writeError(w, http.StatusNotFound, "not_found", "Ruta de hogar no encontrada.")
			return
		}
		switch {
		case r.Method == http.MethodGet && action == "":
			household, err := appStore.GetHouseholdForUser(r.Context(), claims.Subject, householdID)
			if err != nil {
				writeStoreError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"household": household})
		case r.Method == http.MethodPatch && action == "":
			var req householdRequest
			if !decodeJSON(w, r, &req) {
				return
			}
			household, err := appStore.UpdateHousehold(r.Context(), claims.Subject, householdID, req.Name)
			if err != nil {
				writeStoreError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"household": household})
		case r.Method == http.MethodGet && action == "members":
			members, err := appStore.ListHouseholdMembers(r.Context(), claims.Subject, householdID)
			if err != nil {
				writeStoreError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"members": members})
		case r.Method == http.MethodPatch && strings.HasPrefix(action, "members/"):
			targetUserID := strings.TrimPrefix(action, "members/")
			var req memberRoleRequest
			if !decodeJSON(w, r, &req) {
				return
			}
			member, err := appStore.UpdateHouseholdMemberRole(r.Context(), claims.Subject, householdID, targetUserID, req.Role)
			if err != nil {
				writeStoreError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"member": member})
		case r.Method == http.MethodDelete && strings.HasPrefix(action, "members/"):
			targetUserID := strings.TrimPrefix(action, "members/")
			if err := appStore.RemoveHouseholdMember(r.Context(), claims.Subject, householdID, targetUserID); err != nil {
				writeStoreError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"removed": true})
		case r.Method == http.MethodPost && action == "invites":
			var req inviteRequest
			if !decodeJSON(w, r, &req) {
				return
			}
			invite, err := appStore.CreateInvite(r.Context(), claims.Subject, householdID, req.Email, req.Role, inviteTTL)
			if err != nil {
				writeStoreError(w, err)
				return
			}
			writeJSON(w, http.StatusCreated, map[string]any{"invite": invite})
		case r.Method == http.MethodGet && action == "sync":
			snapshot, err := appStore.GetSyncSnapshot(r.Context(), claims.Subject, householdID)
			if err != nil {
				writeStoreError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"sync": snapshot})
		case r.Method == http.MethodPut && action == "sync":
			var req syncRequest
			if !decodeJSON(w, r, &req) {
				return
			}
			expectedUpdatedAt, ok := parseExpectedUpdatedAt(w, req.ExpectedUpdatedAt)
			if !ok {
				return
			}
			snapshot, err := appStore.SaveSyncSnapshot(r.Context(), claims.Subject, householdID, req.Version, req.State, expectedUpdatedAt)
			if err != nil {
				writeStoreError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"sync": snapshot})
		default:
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Método no permitido para esta ruta.")
		}
	}
}

func acceptInviteHandler(cfg config.Config, appStore *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := authenticatedStore(w, r, cfg, appStore)
		if !ok {
			return
		}
		token, ok := parseInviteAcceptPath(r.URL.Path)
		if !ok {
			writeError(w, http.StatusNotFound, "not_found", "Invitación no encontrada.")
			return
		}
		household, err := appStore.AcceptInvite(r.Context(), claims.Subject, token)
		if err != nil {
			writeStoreError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"household": household})
	}
}

func usdaSearchHandler(cfg config.Config) http.HandlerFunc {
	client := nutrition.NewUSDAClient(cfg.USDAAPIKey)
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := requireAuth(w, r, cfg); !ok {
			return
		}
		query := strings.TrimSpace(r.URL.Query().Get("q"))
		if query == "" {
			writeError(w, http.StatusBadRequest, "missing_query", "Introduce un alimento para buscar.")
			return
		}
		if !client.Configured() {
			writeError(w, http.StatusServiceUnavailable, "usda_not_configured", "La clave USDA_API_KEY no está configurada en el servidor.")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		result, err := client.SearchFoods(ctx, query, 12)
		if err != nil {
			writeError(w, http.StatusBadGateway, "usda_error", "No se pudo consultar USDA FoodData Central.")
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}

func issueUserToken(cfg config.Config, user store.User) (string, error) {
	return auth.IssueToken(cfg.JWTSecret, auth.Claims{
		Subject: user.ID,
		Email:   user.Email,
		Name:    user.DisplayName,
	}, accessTokenTTL)
}

func authenticatedStore(w http.ResponseWriter, r *http.Request, cfg config.Config, appStore *store.Store) (auth.Claims, bool) {
	var empty auth.Claims
	if !storeAvailable(w, appStore) {
		return empty, false
	}
	return requireAuth(w, r, cfg)
}

func requireAuth(w http.ResponseWriter, r *http.Request, cfg config.Config) (auth.Claims, bool) {
	var empty auth.Claims
	token, err := auth.BearerToken(r.Header.Get("Authorization"))
	if err != nil {
		writeError(w, http.StatusUnauthorized, "missing_token", "Falta el token de sesión.")
		return empty, false
	}
	claims, err := auth.VerifyToken(token, cfg.JWTSecret)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_token", "La sesión ha caducado o no es válida.")
		return empty, false
	}
	return claims, true
}
