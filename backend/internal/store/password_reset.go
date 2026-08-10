package store

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"
)

var ErrInvalidPasswordReset = errors.New("invalid password reset")

// PasswordReset contains the one-time token returned only when a reset is created.
type PasswordReset struct {
	Token     string
	Email     string
	ExpiresAt time.Time
}

// CreatePasswordReset creates a single-use reset token for an existing user.
// A missing email is reported as ErrNotFound so the HTTP layer can keep a
// generic response and avoid account enumeration.
func (s *Store) CreatePasswordReset(ctx context.Context, email string, ttl time.Duration) (PasswordReset, error) {
	var reset PasswordReset
	if !s.Available() {
		return reset, ErrDatabaseRequired
	}
	if ttl <= 0 {
		ttl = 30 * time.Minute
	}

	var userID string
	normalizedEmail := normalizeEmail(email)
	row := s.db.QueryRowContext(ctx, `
		SELECT id, email
		FROM users
		WHERE email = $1
	`, normalizedEmail)
	if err := row.Scan(&userID, &reset.Email); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return reset, ErrNotFound
		}
		return reset, err
	}

	token, err := randomToken(32)
	if err != nil {
		return reset, err
	}
	reset.Token = token
	reset.ExpiresAt = time.Now().UTC().Add(ttl)
	tokenHash := hashToken(token)

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return PasswordReset{}, err
	}
	defer tx.Rollback()

	// Invalidate any previous unused reset for this user before creating a new one.
	if _, err := tx.ExecContext(ctx, `
		UPDATE password_reset_tokens
		SET used_at = now()
		WHERE user_id = $1 AND used_at IS NULL
	`, userID); err != nil {
		return PasswordReset{}, err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, tokenHash, reset.ExpiresAt); err != nil {
		return PasswordReset{}, err
	}

	if err := tx.Commit(); err != nil {
		return PasswordReset{}, err
	}
	return reset, nil
}

// ResetPassword consumes a valid token and updates the password atomically.
func (s *Store) ResetPassword(ctx context.Context, token, passwordHash string) error {
	if !s.Available() {
		return ErrDatabaseRequired
	}
	tokenHash := hashToken(strings.TrimSpace(token))
	if tokenHash == "" || strings.TrimSpace(passwordHash) == "" {
		return ErrInvalidPasswordReset
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var resetID, userID string
	row := tx.QueryRowContext(ctx, `
		SELECT id, user_id
		FROM password_reset_tokens
		WHERE token_hash = $1
		  AND used_at IS NULL
		  AND expires_at > now()
		FOR UPDATE
	`, tokenHash)
	if err := row.Scan(&resetID, &userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrInvalidPasswordReset
		}
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE users
		SET password_hash = $1, updated_at = now()
		WHERE id = $2
	`, passwordHash, userID); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE password_reset_tokens
		SET used_at = now()
		WHERE id = $1
	`, resetID); err != nil {
		return err
	}

	// Any other outstanding reset links for the same user become invalid too.
	if _, err := tx.ExecContext(ctx, `
		UPDATE password_reset_tokens
		SET used_at = now()
		WHERE user_id = $1 AND used_at IS NULL
	`, userID); err != nil {
		return err
	}

	return tx.Commit()
}
