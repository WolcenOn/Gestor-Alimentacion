package db

import (
	"context"
	"database/sql"
	"errors"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// Open creates a PostgreSQL connection pool from DATABASE_URL.
func Open(databaseURL string) (*sql.DB, error) {
	if databaseURL == "" {
		return nil, errors.New("DATABASE_URL is empty")
	}

	pool, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, err
	}

	pool.SetMaxOpenConns(10)
	pool.SetMaxIdleConns(5)
	pool.SetConnMaxIdleTime(5 * time.Minute)
	pool.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := pool.PingContext(ctx); err != nil {
		_ = pool.Close()
		return nil, err
	}

	return pool, nil
}

// Health reports whether PostgreSQL is reachable.
func Health(ctx context.Context, pool *sql.DB) string {
	if pool == nil {
		return "not_configured"
	}
	if err := pool.PingContext(ctx); err != nil {
		return "unreachable"
	}
	return "ok"
}
