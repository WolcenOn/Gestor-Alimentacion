package httpapi

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/auth"
	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/config"
	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/mailer"
	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/store"
)

const passwordResetTTL = 30 * time.Minute

const passwordResetGenericMessage = "Si existe una cuenta con ese email, recibirás instrucciones para cambiar la contraseña."

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

type resetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

func registerPasswordResetRoutes(mux *http.ServeMux, cfg config.Config, appStore *store.Store) {
	mux.HandleFunc("POST /api/v1/auth/forgot-password", forgotPasswordHandler(cfg, appStore))
	mux.HandleFunc("POST /api/v1/auth/reset-password", resetPasswordHandler(appStore))
}

func forgotPasswordHandler(cfg config.Config, appStore *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !storeAvailable(w, appStore) {
			return
		}

		var req forgotPasswordRequest
		if !decodeJSON(w, r, &req) {
			return
		}
		email := strings.ToLower(strings.TrimSpace(req.Email))
		if email == "" || !strings.Contains(email, "@") {
			writeError(w, http.StatusBadRequest, "invalid_email", "Introduce un email válido.")
			return
		}

		mailConfig := mailer.SMTPConfig{
			Host:     cfg.SMTPHost,
			Port:     cfg.SMTPPort,
			Username: cfg.SMTPUsername,
			Password: cfg.SMTPPassword,
			From:     cfg.SMTPFrom,
			ResetURL: cfg.PasswordResetURL,
		}
		if !mailConfig.Configured() {
			writeError(w, http.StatusServiceUnavailable, "password_recovery_unavailable", "La recuperación de contraseña no está configurada todavía.")
			return
		}

		reset, err := appStore.CreatePasswordReset(r.Context(), email, passwordResetTTL)
		if err == nil {
			if sendErr := mailer.SendPasswordReset(mailConfig, reset.Email, reset.Token); sendErr != nil {
				// Never expose mail/provider details or whether this email exists.
				log.Printf("password reset email failed: %v", sendErr)
			}
		} else if !errors.Is(err, store.ErrNotFound) {
			// Keep the public response generic to prevent account enumeration.
			log.Printf("password reset creation failed: %v", err)
		}

		writeJSON(w, http.StatusOK, map[string]any{"message": passwordResetGenericMessage})
	}
}

func resetPasswordHandler(appStore *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !storeAvailable(w, appStore) {
			return
		}

		var req resetPasswordRequest
		if !decodeJSON(w, r, &req) {
			return
		}
		token := strings.TrimSpace(req.Token)
		if token == "" {
			writeError(w, http.StatusBadRequest, "invalid_reset_token", "El enlace de recuperación no es válido o ha caducado.")
			return
		}

		passwordHash, err := auth.HashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_password", err.Error())
			return
		}
		if err := appStore.ResetPassword(r.Context(), token, passwordHash); err != nil {
			if errors.Is(err, store.ErrInvalidPasswordReset) {
				writeError(w, http.StatusBadRequest, "invalid_reset_token", "El enlace de recuperación no es válido o ha caducado.")
				return
			}
			writeError(w, http.StatusInternalServerError, "password_reset_failed", "No se pudo cambiar la contraseña.")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"message": "Contraseña actualizada correctamente."})
	}
}
