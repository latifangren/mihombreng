// Package apperror defines typed errors with HTTP status mapping.
// Services return AppError values; handlers use ErrorStatus to pick the right HTTP code.
package apperror

import (
	"errors"
	"fmt"
	"net/http"
)

// Kind classifies an error for status-code mapping and caller inspection.
type Kind int

const (
	KindInternal      Kind = iota // internal/unexpected failure
	KindNotRunning                // service is not running
	KindNotConfigured             // required configuration missing
	KindTimeout                   // operation timed out
)

// AppError is a structured error with a Kind for programmatic handling.
type AppError struct {
	Kind    Kind
	Message string
	Err     error // optional wrapped error
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

func (e *AppError) Unwrap() error { return e.Err }

// ErrorStatus maps an error to an HTTP status code.
// Returns 500 for unmapped errors.
func ErrorStatus(err error) int {
	var ae *AppError
	if errors.As(err, &ae) {
		switch ae.Kind {
		case KindNotRunning:
			return http.StatusConflict
		case KindNotConfigured:
			return http.StatusBadRequest
		case KindTimeout:
			return http.StatusGatewayTimeout
		case KindInternal:
			return http.StatusInternalServerError
		}
	}
	return http.StatusInternalServerError
}

// --- Constructors ---

func NotRunning(msg string) error {
	return &AppError{Kind: KindNotRunning, Message: msg}
}

func NotConfigured(msg string) error {
	return &AppError{Kind: KindNotConfigured, Message: msg}
}

func Timeout(msg string) error {
	return &AppError{Kind: KindTimeout, Message: msg}
}

// Wrapf wraps an existing error with a message and kind. If err is nil, returns nil.
func Wrapf(err error, kind Kind, format string, args ...any) error {
	if err == nil {
		return nil
	}
	return &AppError{Kind: kind, Message: fmt.Sprintf(format, args...), Err: err}
}
