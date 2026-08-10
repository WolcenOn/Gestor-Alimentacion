package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Claims contains the authenticated user identity stored in the token.
type Claims struct {
	Subject string `json:"sub"`
	Email   string `json:"email"`
	Name    string `json:"name,omitempty"`
	Issued  int64  `json:"iat"`
	Expires int64  `json:"exp"`
}

// IssueToken creates a signed JWT using HS256.
func IssueToken(secret string, claims Claims, ttl time.Duration) (string, error) {
	if strings.TrimSpace(secret) == "" {
		return "", errors.New("JWT_SECRET is not configured")
	}
	if claims.Subject == "" || claims.Email == "" {
		return "", errors.New("missing required token claims")
	}
	now := time.Now().UTC()
	claims.Issued = now.Unix()
	claims.Expires = now.Add(ttl).Unix()

	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	headerBytes, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	claimsBytes, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	unsigned := base64.RawURLEncoding.EncodeToString(headerBytes) + "." + base64.RawURLEncoding.EncodeToString(claimsBytes)
	signature := sign(unsigned, secret)
	return unsigned + "." + signature, nil
}

// ParseToken verifies a signed JWT and returns its claims.
func ParseToken(secret, token string) (Claims, error) {
	var claims Claims
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return claims, errors.New("invalid token format")
	}
	unsigned := parts[0] + "." + parts[1]
	if !hmac.Equal([]byte(sign(unsigned, secret)), []byte(parts[2])) {
		return claims, errors.New("invalid token signature")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return claims, err
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return claims, err
	}
	if claims.Expires <= time.Now().UTC().Unix() {
		return claims, errors.New("token expired")
	}
	if claims.Subject == "" || claims.Email == "" {
		return claims, errors.New("token missing identity")
	}
	return claims, nil
}

func sign(unsigned, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(unsigned))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// BearerToken extracts a token from the Authorization header.
func BearerToken(header string) (string, error) {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return "", fmt.Errorf("missing bearer token")
	}
	token := strings.TrimSpace(strings.TrimPrefix(header, prefix))
	if token == "" {
		return "", fmt.Errorf("empty bearer token")
	}
	return token, nil
}
