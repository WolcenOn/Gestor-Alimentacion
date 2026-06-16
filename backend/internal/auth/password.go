package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"hash"
	"strconv"
	"strings"
)

const (
	passwordAlgorithm = "pbkdf2_sha256"
	passwordIterations = 210000
	passwordSaltBytes = 16
	passwordKeyBytes = 32
)

// HashPassword returns an encoded PBKDF2-HMAC-SHA256 password hash.
func HashPassword(password string) (string, error) {
	if len(password) < 8 {
		return "", errors.New("password must have at least 8 characters")
	}

	salt := make([]byte, passwordSaltBytes)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	key := pbkdf2Key([]byte(password), salt, passwordIterations, passwordKeyBytes, sha256.New)
	return fmt.Sprintf(
		"%s$%d$%s$%s",
		passwordAlgorithm,
		passwordIterations,
		base64.RawURLEncoding.EncodeToString(salt),
		base64.RawURLEncoding.EncodeToString(key),
	), nil
}

// VerifyPassword checks a password against the encoded hash.
func VerifyPassword(encodedHash, password string) bool {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 4 || parts[0] != passwordAlgorithm {
		return false
	}

	iterations, err := strconv.Atoi(parts[1])
	if err != nil || iterations < 100000 {
		return false
	}

	salt, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return false
	}

	expected, err := base64.RawURLEncoding.DecodeString(parts[3])
	if err != nil {
		return false
	}

	actual := pbkdf2Key([]byte(password), salt, iterations, len(expected), sha256.New)
	return subtle.ConstantTimeCompare(actual, expected) == 1
}

func pbkdf2Key(password, salt []byte, iterations, keyLen int, h func() hash.Hash) []byte {
	prf := hmac.New(h, password)
	hLen := prf.Size()
	numBlocks := (keyLen + hLen - 1) / hLen
	var output []byte
	var blockIndex [4]byte

	for block := 1; block <= numBlocks; block++ {
		blockIndex[0] = byte(block >> 24)
		blockIndex[1] = byte(block >> 16)
		blockIndex[2] = byte(block >> 8)
		blockIndex[3] = byte(block)

		prf.Reset()
		_, _ = prf.Write(salt)
		_, _ = prf.Write(blockIndex[:])
		u := prf.Sum(nil)
		t := append([]byte(nil), u...)

		for i := 1; i < iterations; i++ {
			prf.Reset()
			_, _ = prf.Write(u)
			u = prf.Sum(nil)
			for j := range t {
				t[j] ^= u[j]
			}
		}
		output = append(output, t...)
	}

	return output[:keyLen]
}
