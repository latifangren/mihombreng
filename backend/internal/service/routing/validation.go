package routing

import (
	"fmt"
	"net"
	"strings"

	"mihombreng/pkg/config"
)

func validateBypassConfig(routingConfig config.RoutingConfig) []string {
	var issues []string

	for _, mac := range routingConfig.BypassMACs {
		if strings.TrimSpace(mac) == "" {
			continue
		}
		if _, err := net.ParseMAC(mac); err != nil {
			issues = append(issues, fmt.Sprintf("invalid bypass MAC address: '%s', error: %v", mac, err))
		}
	}

	for _, ipStr := range routingConfig.BypassIPs {
		if strings.TrimSpace(ipStr) == "" {
			continue
		}
		if _, _, err := net.ParseCIDR(ipStr); err != nil {
			if net.ParseIP(ipStr) == nil {
				issues = append(issues, fmt.Sprintf("invalid bypass IPv4 address or CIDR: '%s'", ipStr))
			}
		}
	}

	for _, ipStr := range routingConfig.BypassIP6s {
		if strings.TrimSpace(ipStr) == "" {
			continue
		}
		if _, _, err := net.ParseCIDR(ipStr); err != nil {
			if net.ParseIP(ipStr) == nil {
				issues = append(issues, fmt.Sprintf("invalid bypass IPv6 address or CIDR: '%s'", ipStr))
			}
		}
	}

	return issues
}
