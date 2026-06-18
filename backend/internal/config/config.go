package config

import (
	"os"
	"strings"
)

// Config contains runtime configuration for the Railway Go API.
type Config struct {
	Port               string
	AppEnv             string
	DatabaseURL        string
	JWTSecret          string
	USDAAPIKey         string
	CORSAllowedOrigins []string
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
	}
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
