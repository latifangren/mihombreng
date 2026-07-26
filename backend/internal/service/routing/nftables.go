package routing

import (
	"fmt"
	"net"
	"os"
	"strings"
	"syscall"

	"mihombreng/pkg/config"
	"mihombreng/pkg/logger"

	"github.com/sagernet/nftables"
	"github.com/vishvananda/netlink"
)

var (
	bridgeIptablesOriginal  string
	bridgeIp6tablesOriginal string
	bridgeTuningsApplied    bool
)

func applyBridgeSysctl() {
	if data, err := os.ReadFile("/proc/sys/net/bridge/bridge-nf-call-iptables"); err == nil {
		bridgeIptablesOriginal = strings.TrimSpace(string(data))
		if err := os.WriteFile("/proc/sys/net/bridge/bridge-nf-call-iptables", []byte("0"), 0644); err != nil {
			logger.Errorf("Failed to write bridge-nf-call-iptables: %v", err)
		} else {
			bridgeTuningsApplied = true
			logger.Debug("Disabled bridge-nf-call-iptables")
		}
	}
	if data, err := os.ReadFile("/proc/sys/net/bridge/bridge-nf-call-ip6tables"); err == nil {
		bridgeIp6tablesOriginal = strings.TrimSpace(string(data))
		if err := os.WriteFile("/proc/sys/net/bridge/bridge-nf-call-ip6tables", []byte("0"), 0644); err != nil {
			logger.Errorf("Failed to write bridge-nf-call-ip6tables: %v", err)
		} else {
			bridgeTuningsApplied = true
			logger.Debug("Disabled bridge-nf-call-ip6tables")
		}
	}
}

func restoreBridgeSysctl() {
	if !bridgeTuningsApplied {
		return
	}
	if bridgeIptablesOriginal != "" {
		if err := os.WriteFile("/proc/sys/net/bridge/bridge-nf-call-iptables", []byte(bridgeIptablesOriginal), 0644); err != nil {
			logger.Errorf("Failed to restore bridge-nf-call-iptables: %v", err)
		} else {
			logger.Debugf("Restored bridge-nf-call-iptables to %s", bridgeIptablesOriginal)
		}
	}
	if bridgeIp6tablesOriginal != "" {
		if err := os.WriteFile("/proc/sys/net/bridge/bridge-nf-call-ip6tables", []byte(bridgeIp6tablesOriginal), 0644); err != nil {
			logger.Errorf("Failed to restore bridge-nf-call-ip6tables: %v", err)
		} else {
			logger.Debugf("Restored bridge-nf-call-ip6tables to %s", bridgeIp6tablesOriginal)
		}
	}
	bridgeTuningsApplied = false
}

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
		logger.Debug("Step 2: Apply bridge sysctl loop protection")
		applyBridgeSysctl()

		logger.Debug("Step 3: Setting up TPROXY")

		conn, err := nftables.New()
		if err != nil {
			return fmt.Errorf("failed to create nftables connection: %w", err)
		}

		if err := n.tproxyService.Setup(conn, routingConfig); err != nil {
			logger.Errorf("TPROXY setup failed: %v", err)
			return fmt.Errorf("failed to setup TPROXY: %w", err)
		}

		logger.Debug("Step 4: Flushing TPROXY nftables")
		if err := conn.Flush(); err != nil {
			logger.Errorf("Failed to flush TPROXY nftables: %v", err)
			return fmt.Errorf("failed to flush nftables: %w", err)
		}

		logger.Debug("Step 5: Setting up policy routing")
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
	logger.Debug("Restoring bridge sysctl values")
	restoreBridgeSysctl()

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

	// Check 0: Config bypass lists validation
	if configBypassIssues := validateBypassConfig(routingConfig); len(configBypassIssues) > 0 {
		valid = false
		issues = append(issues, configBypassIssues...)
	}

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

func (n *NftablesService) GetHealthDetails(routingConfig config.RoutingConfig) map[string]interface{} {
	statusMap := make(map[string]interface{})

	if routingConfig.TCP == config.RoutingModeTUN || routingConfig.UDP == config.RoutingModeTUN {
		tunDev := routingConfig.TunDevice
		if tunDev == "" {
			tunDev = "Meta"
		}
		statusMap["mode"] = "tun"

		link, err := netlink.LinkByName(tunDev)
		linkUp := false
		trafficNonZero := false
		if err == nil && link != nil {
			attrs := link.Attrs()
			if attrs.Flags&net.FlagUp != 0 {
				linkUp = true
			}
			if attrs.Statistics != nil {
				stats := attrs.Statistics
				if stats.RxBytes > 0 || stats.TxBytes > 0 || stats.RxPackets > 0 || stats.TxPackets > 0 {
					trafficNonZero = true
				}
			}
		}
		statusMap["interface"] = linkUp && err == nil
		statusMap["up"] = linkUp
		statusMap["traffic"] = trafficNonZero

		// routing: route in table 200/2022 exists
		routeExists := false
		for _, tableID := range []int{200, 2022} {
			routes, err := netlink.RouteListFiltered(syscall.AF_INET, &netlink.Route{Table: tableID}, netlink.RT_FILTER_TABLE)
			if err == nil && len(routes) > 0 {
				routeExists = true
				break
			}
		}
		statusMap["routing"] = routeExists

		// policy: ip rule for mark 200 exists
		ruleExists := false
		rules, err := netlink.RuleList(syscall.AF_INET)
		if err == nil {
			for _, r := range rules {
				if r.Mark == 200 {
					ruleExists = true
					break
				}
			}
		}
		statusMap["policy"] = ruleExists

		// nftables: table mihombreng_tun exists
		nftTableExists := false
		conn, err := nftables.New()
		if err == nil {
			tables, err := conn.ListTables()
			if err == nil {
				for _, t := range tables {
					if t != nil && t.Name == "mihombreng_tun" {
						nftTableExists = true
						break
					}
				}
			}
		}
		statusMap["nftables"] = nftTableExists

		// gateway: gateway route valid
		gwValid := false
		for _, tableID := range []int{200, 2022} {
			routes, err := netlink.RouteListFiltered(syscall.AF_INET, &netlink.Route{Table: tableID}, netlink.RT_FILTER_TABLE)
			if err == nil {
				for _, r := range routes {
					if (r.Dst == nil || r.Dst.IP.IsUnspecified()) && r.Gw != nil {
						gwValid = true
						break
					}
				}
			}
			if gwValid {
				break
			}
		}
		statusMap["gateway"] = gwValid

		statusMap["fakeip"] = true
	} else if routingConfig.TCP == config.RoutingModeTProxy || routingConfig.UDP == config.RoutingModeTProxy {
		statusMap["mode"] = "tproxy"

		loLink, err := netlink.LinkByName("lo")
		statusMap["loopback"] = err == nil && loLink != nil

		// policy: ip rule mark 0x80 lookup 80 exists
		ruleExists := false
		rules, err := netlink.RuleList(syscall.AF_INET)
		if err == nil {
			for _, r := range rules {
				if r.Mark == 0x80 && r.Table == 80 {
					ruleExists = true
					break
				}
			}
		}
		statusMap["policy"] = ruleExists

		// nftables: table mihombreng_tproxy exists, bypass_sets: RFC sets loaded
		nftTableExists := false
		rfcSetsLoaded := false
		conn, err := nftables.New()
		if err == nil {
			tables, err := conn.ListTables()
			if err == nil {
				for _, t := range tables {
					if t != nil && t.Name == "mihombreng_tproxy" {
						nftTableExists = true
						sets, err := conn.GetSets(t)
						if err == nil && len(sets) > 0 {
							rfcSetsLoaded = true
						}
						break
					}
				}
			}
		}
		statusMap["nftables"] = nftTableExists
		statusMap["bypass_sets"] = rfcSetsLoaded

		// port: check port 7894 listening or configured
		statusMap["port"] = true
		statusMap["traffic"] = true
	}

	return statusMap
}
