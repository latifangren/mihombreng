package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// TokenAuth creates a Gin middleware for bearer token validation.
func TokenAuth(expectedToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// If no token is configured, skip authentication
		if expectedToken == "" {
			c.Next()
			return
		}

		var token string

		// 1. Try to get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				token = parts[1]
			}
		}

		// 2. Try WebSocket Sec-WebSocket-Protocol header
		if token == "" {
			secProtocol := c.GetHeader("Sec-WebSocket-Protocol")
			if secProtocol != "" {
				// The client might send: wss, token
				// Or just the token.
				// For safety, we can check if it matches the token exactly.
				// However, if the protocol list is comma-separated, it's better to split and trim.
				protos := strings.Split(secProtocol, ",")
				for _, p := range protos {
					pt := strings.TrimSpace(p)
					if pt == expectedToken {
						token = expectedToken
						break
					}
				}
			}
		}

		// 3. Try ?token=... query parameter
		if token == "" {
			token = c.Query("token")
		}

		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "unauthorized: missing token",
			})
			return
		}

		if token != expectedToken {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "unauthorized: invalid token",
			})
			return
		}

		c.Next()
	}
}
