package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// visitor tracks rate limiting per IP address
type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type rateLimiter struct {
	visitors    map[string]*visitor
	mu          sync.Mutex
	rate        rate.Limit
	burst       int
	lastCleanup time.Time
}

// newRateLimiter creates a new rate limiter
func newRateLimiter(r rate.Limit, b int) *rateLimiter {
	return &rateLimiter{
		visitors:    make(map[string]*visitor),
		rate:        r,
		burst:       b,
		lastCleanup: time.Now(),
	}
}

// getVisitor returns the rate limiter for the given IP address
func (rl *rateLimiter) getVisitor(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	// Inline cleanup stale entries at most once per minute
	now := time.Now()
	if now.Sub(rl.lastCleanup) > time.Minute {
		for staleIP, v := range rl.visitors {
			if now.Sub(v.lastSeen) > 3*time.Minute {
				delete(rl.visitors, staleIP)
			}
		}
		rl.lastCleanup = now
	}

	v, exists := rl.visitors[ip]
	if !exists {
		limiter := rate.NewLimiter(rl.rate, rl.burst)
		rl.visitors[ip] = &visitor{
			limiter:  limiter,
			lastSeen: now,
		}
		return limiter
	}

	v.lastSeen = now
	return v.limiter
}

// RateLimit creates a Gin middleware for rate limiting
func RateLimit(reqsPerSec int) gin.HandlerFunc {
	// If rate limit is 0 or negative, disable it
	if reqsPerSec <= 0 {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	rl := newRateLimiter(rate.Limit(reqsPerSec), reqsPerSec)

	return func(c *gin.Context) {
		limiter := rl.getVisitor(c.ClientIP())
		if !limiter.Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "too many requests",
			})
			return
		}
		c.Next()
	}
}
