package domain

import "mihombreng/pkg/config"

// NftablesService defines the interface for nftables-based routing operations.
type NftablesService interface {
	SetupRouting(routingConfig config.RoutingConfig) error
	CleanupAllRouting() error
	IsTUNRoutingActive() bool
	ValidateRouting(routingConfig config.RoutingConfig) (bool, []string)
}
