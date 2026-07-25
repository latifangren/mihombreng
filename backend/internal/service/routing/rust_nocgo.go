//go:build !cgo || !rust_ffi

package routing

import (
	"fmt"

	"github.com/sagernet/nftables"
)

func ParseAndMergeCIDRsRust(cidrs []string, ipv6 bool) ([]nftables.SetElement, error) {
	return nil, fmt.Errorf("rust cidr merger unavailable")
}

func IsRustCIDRMergerAvailable() bool {
	return false
}
