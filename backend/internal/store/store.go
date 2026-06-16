package store

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

// Store wraps PostgreSQL queries used by the API.
type Store struct {
	db *sql.DB
}

// User is the public authenticated user model.
type User struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName,omitempty"`
}

// Household is a household visible to a user.
type Household struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Role string `json:"role"`
}

// RegisterResult contains the user and default household created on registration.
type RegisterResult struct {
	User      User      `json:"user"`
	Household Household `json:"household"`
}

var (
	ErrDatabaseRequired   = errors.New("database is required")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrEmailAlreadyExists = errors.New("email already exists")
)

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Available() bool {
	return s != nil && s.db != nil
}

func (s *Store) RegisterUser(ctx context.Context, email, passwordHash, displayName, householdName string) (RegisterResult, error) {
	var result RegisterResult
	if !s.Available() {
		return result, ErrDatabaseRequired
	}

	email = normalizeEmail(email)
	displayName = strings.TrimSpace(displayName)
	householdName = strings.TrimSpace(householdName)
	if householdName == "" {
		householdName = "Mi hogar"
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return result, err
	}
	defer tx.Rollback()

	row := tx.QueryRowContext(ctx, `
		INSERT INTO users (email, password_hash, display_name)
		VALUES ($1, $2, $3)
		ON CONFLICT (email) DO NOTHING
		RETURNING id, email, COALESCE(display_name, '')
	`, email, passwordHash, nullIfEmpty(displayName))
	if err := row.Scan(&result.User.ID, &result.User.Email, &result.User.DisplayName); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return result, ErrEmailAlreadyExists
		}
		return result, err
	}

	row = tx.QueryRowContext(ctx, `
		INSERT INTO households (name, owner_user_id)
		VALUES ($1, $2)
		RETURNING id, name
	`, householdName, result.User.ID)
	if err := row.Scan(&result.Household.ID, &result.Household.Name); err != nil {
		return result, err
	}
	result.Household.Role = "owner"

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO household_users (household_id, user_id, role)
		VALUES ($1, $2, 'owner')
	`, result.Household.ID, result.User.ID); err != nil {
		return result, err
	}

	if err := tx.Commit(); err != nil {
		return result, err
	}
	return result, nil
}

func (s *Store) FindUserForLogin(ctx context.Context, email string) (User, string, error) {
	var user User
	var passwordHash string
	if !s.Available() {
		return user, "", ErrDatabaseRequired
	}

	row := s.db.QueryRowContext(ctx, `
		SELECT id, email, COALESCE(display_name, ''), password_hash
		FROM users
		WHERE email = $1
	`, normalizeEmail(email))
	if err := row.Scan(&user.ID, &user.Email, &user.DisplayName, &passwordHash); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return user, "", ErrInvalidCredentials
		}
		return user, "", err
	}
	return user, passwordHash, nil
}

func (s *Store) GetUserByID(ctx context.Context, id string) (User, error) {
	var user User
	if !s.Available() {
		return user, ErrDatabaseRequired
	}

	row := s.db.QueryRowContext(ctx, `
		SELECT id, email, COALESCE(display_name, '')
		FROM users
		WHERE id = $1
	`, id)
	if err := row.Scan(&user.ID, &user.Email, &user.DisplayName); err != nil {
		return user, err
	}
	return user, nil
}

func (s *Store) ListHouseholdsForUser(ctx context.Context, userID string) ([]Household, error) {
	if !s.Available() {
		return nil, ErrDatabaseRequired
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT h.id, h.name, hu.role
		FROM households h
		JOIN household_users hu ON hu.household_id = h.id
		WHERE hu.user_id = $1
		ORDER BY h.created_at ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	households := []Household{}
	for rows.Next() {
		var household Household
		if err := rows.Scan(&household.ID, &household.Name, &household.Role); err != nil {
			return nil, err
		}
		households = append(households, household)
	}
	return households, rows.Err()
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func nullIfEmpty(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}
