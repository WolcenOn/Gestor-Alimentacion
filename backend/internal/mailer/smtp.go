package mailer

import (
	"fmt"
	"net/smtp"
	"net/url"
	"strings"
)

// SMTPConfig contains the optional SMTP settings used for account recovery.
type SMTPConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
	ResetURL string
}

func (cfg SMTPConfig) Configured() bool {
	return strings.TrimSpace(cfg.Host) != "" &&
		strings.TrimSpace(cfg.Port) != "" &&
		strings.TrimSpace(cfg.From) != "" &&
		strings.TrimSpace(cfg.ResetURL) != ""
}

// SendPasswordReset sends a plain-text recovery email. The reset token is only
// placed in the outbound URL; callers should persist only a hash of the token.
func SendPasswordReset(cfg SMTPConfig, recipient, token string) error {
	if !cfg.Configured() {
		return fmt.Errorf("password reset email is not configured")
	}

	resetURL, err := url.Parse(strings.TrimSpace(cfg.ResetURL))
	if err != nil {
		return fmt.Errorf("invalid password reset URL: %w", err)
	}
	query := resetURL.Query()
	query.Set("reset-password", token)
	resetURL.RawQuery = query.Encode()

	from := strings.TrimSpace(cfg.From)
	to := strings.TrimSpace(recipient)
	message := strings.Join([]string{
		"From: " + from,
		"To: " + to,
		"Subject: Recupera tu contrasena - Gestor de Alimentacion",
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		"Hemos recibido una solicitud para cambiar la contrasena de tu cuenta.",
		"",
		"Abre este enlace para elegir una nueva contrasena:",
		resetURL.String(),
		"",
		"El enlace caduca en 30 minutos y solo puede utilizarse una vez.",
		"Si no has solicitado este cambio, puedes ignorar este mensaje.",
		"",
	}, "\r\n")

	address := strings.TrimSpace(cfg.Host) + ":" + strings.TrimSpace(cfg.Port)
	var auth smtp.Auth
	if strings.TrimSpace(cfg.Username) != "" {
		auth = smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
	}
	if err := smtp.SendMail(address, auth, from, []string{to}, []byte(message)); err != nil {
		return fmt.Errorf("send password reset email: %w", err)
	}
	return nil
}
