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
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

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
		logger.Info("database connection ready")
	}

	server := &http.Server{
		Addr: ":" + cfg.Port,
		Handler: httpapi.NewRouter(cfg, func(ctx context.Context) string {
			return db.Health(ctx, database)
		}),
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
