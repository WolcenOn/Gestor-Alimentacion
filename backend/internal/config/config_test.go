package config

import "testing"

func TestValidateProductionAllowsDevelopmentDefaults(t *testing.T) {
	cfg := Config{AppEnv: "development"}
	if err := cfg.ValidateProduction(); err != nil {
		t.Fatalf("development config should not fail production validation: %v", err)
	}
}

func TestValidateProductionRequiresDatabaseURL(t *testing.T) {
	cfg := Config{
		AppEnv:             "production",
		JWTSecret:          "unit-test-secret-value-with-enough-length",
		CORSAllowedOrigins: []string{"https://app.example.test"},
	}
	if err := cfg.ValidateProduction(); err == nil {
		t.Fatal("expected missing database URL to fail")
	}
}

func TestValidateProductionRequiresStrongJWTSecret(t *testing.T) {
	cfg := Config{
		AppEnv:             "production",
		DatabaseURL:        "db-url-for-unit-test",
		JWTSecret:          "short",
		CORSAllowedOrigins: []string{"https://app.example.test"},
	}
	if err := cfg.ValidateProduction(); err == nil {
		t.Fatal("expected weak signing secret to fail")
	}
}

func TestValidateProductionRejectsWildcardCORS(t *testing.T) {
	cfg := Config{
		AppEnv:             "production",
		DatabaseURL:        "db-url-for-unit-test",
		JWTSecret:          "unit-test-secret-value-with-enough-length",
		CORSAllowedOrigins: []string{"*"},
	}
	if err := cfg.ValidateProduction(); err == nil {
		t.Fatal("expected wildcard CORS origin to fail")
	}
}

func TestValidateProductionAcceptsSafeConfig(t *testing.T) {
	cfg := Config{
		AppEnv:             "production",
		DatabaseURL:        "db-url-for-unit-test",
		JWTSecret:          "unit-test-secret-value-with-enough-length",
		CORSAllowedOrigins: []string{"https://app.example.test"},
	}
	if err := cfg.ValidateProduction(); err != nil {
		t.Fatalf("expected safe production config, got %v", err)
	}
}
