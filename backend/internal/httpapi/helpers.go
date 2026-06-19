package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/config"
	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/store"
)

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

func parseExpectedUpdatedAt(w http.ResponseWriter, value string) (*time.Time, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, true
	}
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_expected_updated_at", "expectedUpdatedAt debe ser una fecha ISO válida.")
		return nil, false
	}
	parsed = parsed.UTC()
	return &parsed, true
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
	case errors.Is(err, store.ErrConflict):
		writeError(w, http.StatusConflict, "sync_conflict", "La nube cambió desde tu última sincronización. Descarga o revisa los datos antes de volver a subir.")
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
