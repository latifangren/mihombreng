package routing

import (
	"fmt"
	"syscall"

	"mihombreng/pkg/config"
	"mihombreng/pkg/logger"

	"github.com/sagernet/nftables"
	"github.com/vishvananda/netlink"
)

type NftablesService struct {
	conn            *nftables.Conn
	tunService      *TUNService
	tproxyService   *TProxyService
	redirectService *RedirectService
}

func NewNftablesService() *NftablesService {
	return &NftablesService{
		tunService:      NewTUNService(),
		tproxyService:   NewTProxyService(),
		redirectService: NewRedirectService(),
	}
}

func (n *NftablesService) withConn(fn func() error) error {
	conn, err := nftables.New()
	if err != nil {
		return fmt.Errorf("failed to create nftables connection: %w", err)
	}
	n.conn = conn
	defer func() {
		n.conn = nil
	}()
	return fn()
}

func (n *NftablesService) SetupRouting(routingConfig config.RoutingConfig) error {
	logger.Debug("Starting SetupRouting")
	logger.Debugf("Routing config - TCP: %s, UDP: %s", routingConfig.TCP, routingConfig.UDP)

	logger.Debug("Step 1: Cleanup existing rules")
	n.tunService.Cleanup(nil)
	n.tproxyService.Cleanup(nil)
	n.redirectService.Cleanup(nil)

	if routingConfig.TCP == config.RoutingModeTProxy || routingConfig.UDP == config.RoutingModeTProxy {
		logger.Debug("Step 2: Setting up TPROXY")

		conn, err := nftables.New()
		if err != nil {
			return fmt.Errorf("failed to create nftables connection: %w", err)
		}

		tcpMode := string(routingConfig.TCP)
		udpMode := string(routingConfig.UDP)

		if err := n.tproxyService.Setup(conn, tcpMode, udpMode); err != nil {
			logger.Errorf("TPROXY setup failed: %v", err)
			return fmt.Errorf("failed to setup TPROXY: %w", err)
		}

		logger.Debug("Step 3: Flushing TPROXY nftables")
		if err := conn.Flush(); err != nil {
			logger.Errorf("Failed to flush TPROXY nftables: %v", err)
			return fmt.Errorf("failed to flush nftables: %w", err)
		}

		logger.Debug("Step 4: Setting up policy routing")
		n.tproxyService.addPolicyRouting()

		logger.Info("TPROXY routing setup completed")
	}

	if routingConfig.TCP == config.RoutingModeTUN || routingConfig.UDP == config.RoutingModeTUN {
		logger.Debug("Setting up TUN")

		conn, err := nftables.New()
		if err != nil {
			return fmt.Errorf("failed to create nftables connection: %w", err)
		}

		if err := n.tunService.Setup(conn, routingConfig); err != nil {
			logger.Errorf("TUN setup failed: %v", err)
			return fmt.Errorf("failed to setup TUN: %w", err)
		}

		if err := conn.Flush(); err != nil {
			logger.Errorf("Failed to flush TUN nftables: %v", err)
			return fmt.Errorf("failed to flush nftables: %w", err)
		}

		logger.Info("TUN routing setup completed")
	}

	if routingConfig.TCP == config.RoutingModeRedirect {
		logger.Debug("Setting up REDIRECT")

		conn, err := nftables.New()
		if err != nil {
			return fmt.Errorf("failed to create nftables connection: %w", err)
		}

		if err := n.redirectService.Setup(conn); err != nil {
			logger.Errorf("REDIRECT setup failed: %v", err)
			return fmt.Errorf("failed to setup REDIRECT: %w", err)
		}

		if err := conn.Flush(); err != nil {
			logger.Errorf("Failed to flush REDIRECT nftables: %v", err)
			return fmt.Errorf("failed to flush nftables: %w", err)
		}

		logger.Info("REDIRECT routing setup completed")
	}

	logger.Debug("SetupRouting completed successfully")
	return nil
}

func (n *NftablesService) CleanupAllRouting() error {
	return n.withConn(func() error {
		n.tunService.Cleanup(n.conn)
		n.tproxyService.Cleanup(n.conn)
		n.redirectService.Cleanup(n.conn)
		return n.conn.Flush()
	})
}

func (n *NftablesService) IsTUNRoutingActive() bool {
	return n.tunService.IsActive()
}

func (n *NftablesService) ValidateRouting(routingConfig config.RoutingConfig) (bool, []string) {
	var issues []string
	valid := true

	// Check 1: Check for general privileges/nftables accessibility
	conn, err := nftables.New()
	if err != nil {
		valid = false
		issues = append(issues, fmt.Sprintf("nftables is not accessible (requires root/CAP_NET_ADMIN): %v", err))
	} else {
		// Just verify the connection
		_ = conn
	}

	// Check 2: Check for routing table or interface conflicts if TUN is requested
	if routingConfig.TCP == config.RoutingModeTUN || routingConfig.UDP == config.RoutingModeTUN {
		// Check table 200 routes
		routes, err := netlink.RouteList(nil, syscall.AF_INET)
		if err == nil {
			for _, r := range routes {
				if r.Table == 200 {
					issues = append(issues, "routing table 200 (TUN routing table) has existing OS routes, which may cause conflicts")
					break
				}
			}
		}
	}

	// Check 3: Check for routing table or interface checks if TProxy is requested
	if routingConfig.TCP == config.RoutingModeTProxy || routingConfig.UDP == config.RoutingModeTProxy {
		// Check table 80 routes
		routes, err := netlink.RouteList(nil, syscall.AF_INET)
		if err == nil {
			for _, r := range routes {
				if r.Table == 80 {
					issues = append(issues, "routing table 80 (TProxy routing table) has existing OS routes, which may cause conflicts")
					break
				}
			}
		}

		// Check if 'lo' interface exists
		_, err = netlink.LinkByName("lo")
		if err != nil {
			valid = false
			issues = append(issues, "loopback interface 'lo' not found, which is required for TProxy redirection")
		}
	}

	return valid, issues
}
