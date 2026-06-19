package auth

// VerifyToken keeps call sites readable while delegating to ParseToken.
// The argument order matches handler usage: token first, secret second.
func VerifyToken(token, secret string) (Claims, error) {
	return ParseToken(secret, token)
}
