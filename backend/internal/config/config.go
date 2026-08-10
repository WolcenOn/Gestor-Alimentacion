package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
)

const minProductionJWTSecretLength = 32

// Config contains runtime configuration for the Railway Go API.
type Config struct {
	Port               string
	AppEnv             string
	DatabaseURL        string
	JWTSecret          string
	USDAAPIKey         string
	CORSAllowedOrigins []string
	SMTPHost           string
	SMTPPort           string
	SMTPUsername       string
	SMTPPassword       string
	SMTPFrom           string
	PasswordResetURL   string
}

// Load reads configuration from environment variables. It keeps safe defaults for local development.
func Load() Config {
	return Config{
		Port:               env("PORT", "8080"),
		AppEnv:             env("APP_ENV", "development"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
		USDAAPIKey:         os.Getenv("USDA_API_KEY"),
		CORSAllowedOrigins: splitCSV(env("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8080")),
		SMTPHost:           os.Getenv("SMTP_HOST"),
		SMTPPort:           env("SMTP_PORT", "587"),
		SMTPUsername:       os.Getenv("SMTP_USERNAME"),
		SMTPPassword:       os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:           os.Getenv("SMTP_FROM"),
		PasswordResetURL:   os.Getenv("PASSWORD_RESET_URL"),
	}
}

// ValidateProduction rejects unsafe production configuration before the API starts.
func (cfg Config) ValidateProduction() error {
	if !strings.EqualFold(cfg.AppEnv, "production") {
		return nil
	}

	if strings.TrimSpace(cfg.DatabaseURL) == "" {
		return errors.New("DATABASE_URL is required in production")
	}
	if len(strings.TrimSpace(cfg.JWTSecret)) < minProductionJWTSecretLength {
		return fmt.Errorf("JWT_SECRET must be at least %d characters in production", minProductionJWTSecretLength)
	}
	if len(cfg.CORSAllowedOrigins) == 0 {
		return errors.New("CORS_ALLOWED_ORIGINS must include at least one explicit origin in production")
	}
	for _, origin := range cfg.CORSAllowedOrigins {
		if origin == "*" {
			return errors.New("CORS_ALLOWED_ORIGINS cannot include wildcard '*' in production")
		}
	}
	return nil
}

func env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
