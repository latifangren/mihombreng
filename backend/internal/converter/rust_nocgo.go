//go:build !cgo

package converter

import "fmt"

func ParseSubscriptionRust(content string) ([]*Proxy, error) {
	return nil, fmt.Errorf("rust parser unavailable in non-cgo build")
}

func IsRustAvailable() bool {
	return false
}
