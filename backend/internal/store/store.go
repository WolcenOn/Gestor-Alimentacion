package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"errors"
	"strings"
	"time"
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

// HouseholdInvite is an invitation to join a household.
type HouseholdInvite struct {
	ID           string    `json:"id"`
	HouseholdID  string    `json:"householdId"`
	InvitedEmail string    `json:"invitedEmail,omitempty"`
	Role         string    `json:"role"`
	Token        string    `json:"token,omitempty"`
	ExpiresAt    time.Time `json:"expiresAt"`
	CreatedAt    time.Time `json:"createdAt"`
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
	ErrForbidden          = errors.New("forbidden")
	ErrNotFound           = errors.New("not found")
	ErrInvalidInvite      = errors.New("invalid invite")
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

func (s *Store) CreateHousehold(ctx context.Context, userID, name string) (Household, error) {
	var household Household
	if !s.Available() {
		return household, ErrDatabaseRequired
	}
	name = strings.TrimSpace(name)
	if name == "" {
		name = "Mi hogar"
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return household, err
	}
	defer tx.Rollback()

	row := tx.QueryRowContext(ctx, `
		INSERT INTO households (name, owner_user_id)
		VALUES ($1, $2)
		RETURNING id, name
	`, name, userID)
	if err := row.Scan(&household.ID, &household.Name); err != nil {
		return household, err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO household_users (household_id, user_id, role)
		VALUES ($1, $2, 'owner')
	`, household.ID, userID); err != nil {
		return household, err
	}
	if err := tx.Commit(); err != nil {
		return household, err
	}
	household.Role = "owner"
	return household, nil
}

func (s *Store) GetHouseholdForUser(ctx context.Context, userID, householdID string) (Household, error) {
	var household Household
	if !s.Available() {
		return household, ErrDatabaseRequired
	}
	row := s.db.QueryRowContext(ctx, `
		SELECT h.id, h.name, hu.role
		FROM households h
		JOIN household_users hu ON hu.household_id = h.id
		WHERE h.id = $1 AND hu.user_id = $2
	`, householdID, userID)
	if err := row.Scan(&household.ID, &household.Name, &household.Role); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return household, ErrNotFound
		}
		return household, err
	}
	return household, nil
}

func (s *Store) UpdateHousehold(ctx context.Context, userID, householdID, name string) (Household, error) {
	if !s.Available() {
		return Household{}, ErrDatabaseRequired
	}
	if err := s.requireHouseholdRole(ctx, userID, householdID, "owner", "admin"); err != nil {
		return Household{}, err
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return Household{}, ErrNotFound
	}
	row := s.db.QueryRowContext(ctx, `
		UPDATE households
		SET name = $1, updated_at = now()
		WHERE id = $2
		RETURNING id, name
	`, name, householdID)
	var household Household
	if err := row.Scan(&household.ID, &household.Name); err != nil {
		return household, err
	}
	household.Role = "admin"
	if ownerErr := s.requireHouseholdRole(ctx, userID, householdID, "owner"); ownerErr == nil {
		household.Role = "owner"
	}
	return household, nil
}

func (s *Store) CreateInvite(ctx context.Context, userID, householdID, invitedEmail, role string, ttl time.Duration) (HouseholdInvite, error) {
	var invite HouseholdInvite
	if !s.Available() {
		return invite, ErrDatabaseRequired
	}
	if err := s.requireHouseholdRole(ctx, userID, householdID, "owner", "admin"); err != nil {
		return invite, err
	}
	role = normalizeInviteRole(role)
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}
	token, err := randomToken(32)
	if err != nil {
		return invite, err
	}
	tokenHash := hashToken(token)
	expiresAt := time.Now().UTC().Add(ttl)

	row := s.db.QueryRowContext(ctx, `
		INSERT INTO household_invites (household_id, invited_email, role, token_hash, created_by, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, household_id, COALESCE(invited_email, ''), role, expires_at, created_at
	`, householdID, nullIfEmpty(normalizeEmail(invitedEmail)), role, tokenHash, userID, expiresAt)
	if err := row.Scan(&invite.ID, &invite.HouseholdID, &invite.InvitedEmail, &invite.Role, &invite.ExpiresAt, &invite.CreatedAt); err != nil {
		return invite, err
	}
	invite.Token = token
	return invite, nil
}

func (s *Store) AcceptInvite(ctx context.Context, userID, token string) (Household, error) {
	var household Household
	if !s.Available() {
		return household, ErrDatabaseRequired
	}
	tokenHash := hashToken(strings.TrimSpace(token))
	if tokenHash == "" {
		return household, ErrInvalidInvite
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return household, err
	}
	defer tx.Rollback()

	var householdID, role string
	row := tx.QueryRowContext(ctx, `
		SELECT household_id, role
		FROM household_invites
		WHERE token_hash = $1
		  AND accepted_at IS NULL
		  AND expires_at > now()
		FOR UPDATE
	`, tokenHash)
	if err := row.Scan(&householdID, &role); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return household, ErrInvalidInvite
		}
		return household, err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO household_users (household_id, user_id, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (household_id, user_id) DO UPDATE SET role = EXCLUDED.role
	`, householdID, userID, role); err != nil {
		return household, err
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE household_invites
		SET accepted_at = now(), accepted_by = $1
		WHERE token_hash = $2
	`, userID, tokenHash); err != nil {
		return household, err
	}

	row = tx.QueryRowContext(ctx, `
		SELECT id, name
		FROM households
		WHERE id = $1
	`, householdID)
	if err := row.Scan(&household.ID, &household.Name); err != nil {
		return household, err
	}
	household.Role = role
	if err := tx.Commit(); err != nil {
		return household, err
	}
	return household, nil
}

func (s *Store) requireHouseholdRole(ctx context.Context, userID, householdID string, allowed ...string) error {
	var role string
	row := s.db.QueryRowContext(ctx, `
		SELECT role
		FROM household_users
		WHERE household_id = $1 AND user_id = $2
	`, householdID, userID)
	if err := row.Scan(&role); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrForbidden
		}
		return err
	}
	for _, candidate := range allowed {
		if role == candidate {
			return nil
		}
	}
	return ErrForbidden
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func normalizeInviteRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "admin", "viewer":
		return strings.ToLower(strings.TrimSpace(role))
	default:
		return "member"
	}
}

func nullIfEmpty(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func randomToken(byteLen int) (string, error) {
	b := make([]byte, byteLen)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashToken(token string) string {
	if strings.TrimSpace(token) == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(token))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}
