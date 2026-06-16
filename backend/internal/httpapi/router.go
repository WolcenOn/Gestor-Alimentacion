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

const apiVersion = "0.5.0"
const accessTokenTTL = 12 * time.Hour
const inviteTTL = 7 * 24 * time.Hour

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
	mux.HandleFunc("GET /api/v1/households", listHouseholdsHandler(cfg, appStore))
	mux.HandleFunc("POST /api/v1/households", createHouseholdHandler(cfg, appStore))
	mux.HandleFunc("GET /api/v1/households/", householdByIDHandler(cfg, appStore))
	mux.HandleFunc("PATCH /api/v1/households/", householdByIDHandler(cfg, appStore))
	mux.HandleFunc("POST /api/v1/households/", householdByIDHandler(cfg, appStore))
	mux.HandleFunc("PUT /api/v1/households/", householdByIDHandler(cfg, appStore))
	mux.HandleFunc("DELETE /api/v1/households/", householdByIDHandler(cfg, appStore))
	mux.HandleFunc("POST /api/v1/invites/", acceptInviteHandler(cfg, appStore))
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
	Version int             `json:"version"`
	State   json.RawMessage `json:"state"`
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
			snapshot, err := appStore.SaveSyncSnapshot(r.Context(), claims.Subject, householdID, req.Version, req.State)
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

func parseHouseholdPath(path string) (householdID string, action string, ok bool) {
	prefix := "/api/v1/households/"
	if !strings.HasPrefix(path, prefix) {
		return "", "", false
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(path, prefix), "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		return "", "", false
	}
	if len(parts) == 1 {
		return parts[0], "", true
	}
	if len(parts) == 2 && (parts[1] == "invites" || parts[1] == "sync" || parts[1] == "members") {
		return parts[0], parts[1], true
	}
	if len(parts) == 3 && parts[1] == "members" && parts[2] != "" {
		return parts[0], "members/" + parts[2], true
	}
	return "", "", false
}

func parseInviteAcceptPath(path string) (token string, ok bool) {
	prefix := "/api/v1/invites/"
	if !strings.HasPrefix(path, prefix) {
		return "", false
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(path, prefix), "/"), "/")
	if len(parts) == 2 && parts[0] != "" && parts[1] == "accept" {
		return parts[0], true
	}
	return "", false
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

func writeStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden", "No tienes permisos para realizar esta acción.")
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found", "No se encontró el recurso solicitado.")
	case errors.Is(err, store.ErrInvalidInvite):
		writeError(w, http.StatusBadRequest, "invalid_invite", "La invitación no es válida o ha caducado.")
	case errors.Is(err, store.ErrLastOwner):
		writeError(w, http.StatusConflict, "last_owner", "El hogar necesita al menos una cuenta propietaria.")
	case errors.Is(err, store.ErrDatabaseRequired):
		writeError(w, http.StatusServiceUnavailable, "database_required", "La base de datos no está configurada.")
	default:
		writeError(w, http.StatusInternalServerError, "server_error", "No se pudo completar la operación.")
	}
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
