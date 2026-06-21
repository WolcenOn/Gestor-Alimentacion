package main

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/config"
	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/db"
	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/httpapi"
	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/store"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	if err := cfg.ValidateProduction(); err != nil {
		logger.Error("unsafe production configuration", "error", err)
		os.Exit(1)
	}

	if cfg.JWTSecret == "" {
		logger.Warn("JWT_SECRET is not configured; auth endpoints will fail until it is set")
	}

	var database *sql.DB
	if cfg.DatabaseURL == "" {
		logger.Warn("DATABASE_URL is not configured; database health will be not_configured")
	} else {
		pool, err := db.Open(cfg.DatabaseURL)
		if err != nil {
			logger.Error("database connection failed", "error", err)
			os.Exit(1)
		}
		database = pool
		defer database.Close()

		migrationCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		if err := db.RunMigrations(migrationCtx, database); err != nil {
			cancel()
			logger.Error("database migrations failed", "error", err)
			os.Exit(1)
		}
		cancel()
		logger.Info("database connection and migrations ready")
	}

	appStore := store.New(database)
	server := &http.Server{
		Addr: ":" + cfg.Port,
		Handler: httpapi.NewRouter(cfg, func(ctx context.Context) string {
			return db.Health(ctx, database)
		}, appStore),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		logger.Info("starting gestor-alimentacion api", "port", cfg.Port, "env", cfg.AppEnv)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	logger.Info("shutting down api")
	if err := server.Shutdown(ctx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
		os.Exit(1)
	}
}
