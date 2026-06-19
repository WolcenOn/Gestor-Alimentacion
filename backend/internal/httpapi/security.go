package httpapi

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	authRateLimitMaxAttempts = 10
	authRateLimitWindow      = 10 * time.Minute
)

type authRateLimiter struct {
	mu       sync.Mutex
	attempts map[string]rateLimitBucket
	now      func() time.Time
}

type rateLimitBucket struct {
	count      int
	resetAfter time.Time
}

func newAuthRateLimiter() *authRateLimiter {
	return &authRateLimiter{
		attempts: make(map[string]rateLimitBucket),
		now:      time.Now,
	}
}

func withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w, r)
		next.ServeHTTP(w, r)
	})
}

func setSecurityHeaders(w http.ResponseWriter, r *http.Request) {
	header := w.Header()
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("X-Frame-Options", "DENY")
	header.Set("Referrer-Policy", "no-referrer")
	header.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
	header.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")

	if r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		header.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
	}
}

func withAuthRateLimit(next http.Handler, limiter *authRateLimiter) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if limiter != nil && isAuthWriteEndpoint(r) {
			if retryAfter, allowed := limiter.allow(clientIP(r), r.URL.Path); !allowed {
				w.Header().Set("Retry-After", retryAfter.String())
				writeError(w, http.StatusTooManyRequests, "rate_limited", "Demasiados intentos. Espera unos minutos antes de volver a probar.")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func isAuthWriteEndpoint(r *http.Request) bool {
	return r.Method == http.MethodPost && (r.URL.Path == "/api/v1/auth/login" || r.URL.Path == "/api/v1/auth/register")
}

func (l *authRateLimiter) allow(ip, path string) (time.Duration, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	key := ip + "|" + path
	bucket := l.attempts[key]

	if bucket.resetAfter.IsZero() || now.After(bucket.resetAfter) {
		l.attempts[key] = rateLimitBucket{
			count:      1,
			resetAfter: now.Add(authRateLimitWindow),
		}
		return 0, true
	}

	if bucket.count >= authRateLimitMaxAttempts {
		return time.Until(bucket.resetAfter).Round(time.Second), false
	}

	bucket.count++
	l.attempts[key] = bucket
	return 0, true
}

func clientIP(r *http.Request) string {
	forwardedFor := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwardedFor != "" {
		if first, _, ok := strings.Cut(forwardedFor, ","); ok {
			return strings.TrimSpace(first)
		}
		return forwardedFor
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}
