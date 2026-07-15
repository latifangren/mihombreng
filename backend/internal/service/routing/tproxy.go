package routing

import (
	"bytes"
	"fmt"
	"net"
	"sort"

	"mihombreng/pkg/config"
	"mihombreng/pkg/logger"

	"github.com/sagernet/nftables"
	"github.com/sagernet/nftables/expr"
	"github.com/vishvananda/netlink"
	"golang.org/x/sys/unix"
)

type TProxyService struct {
	conn          *nftables.Conn
	tproxyMark    uint32
	mihomoMark    uint32
	tproxyPort    uint16
	routeTable    int
	rulePref      int
	tproxyFwMask  uint32
	routingConfig config.RoutingConfig
}

func NewTProxyService() *TProxyService {
	return &TProxyService{
		tproxyMark:    0x80,
		mihomoMark:    0x100,
		tproxyPort:    7894,
		routeTable:    80,
		rulePref:      1024,
		tproxyFwMask:  0xFF,
		routingConfig: config.RoutingConfig{},
	}
}

func (tp *TProxyService) Setup(conn *nftables.Conn, routingConfig config.RoutingConfig) error {
	tp.conn = conn
	tp.routingConfig = routingConfig

	if err := tp.createRules(); err != nil {
		return fmt.Errorf("failed to create TPROXY rules: %w", err)
	}

	logger.Info("TPROXY setup successful")
	return nil
}

func (tp *TProxyService) Cleanup(_ *nftables.Conn) error {
	tp.deleteRules()
	tp.delPolicyRouting()
	logger.Info("TPROXY cleanup successful")
	return nil
}

func (tp *TProxyService) addPolicyRouting() error {
	lo, err := netlink.LinkByName("lo")
	if err != nil {
		return fmt.Errorf("failed to get lo interface: %w", err)
	}

	route4 := &netlink.Route{
		LinkIndex: lo.Attrs().Index,
		Scope:     netlink.SCOPE_HOST,
		Table:     tp.routeTable,
		Type:      unix.RTN_LOCAL,
		Dst: &net.IPNet{
			IP:   net.IPv4zero,
			Mask: net.CIDRMask(0, 32),
		},
	}
	netlink.RouteReplace(route4)

	rule4 := netlink.NewRule()
	rule4.Family = unix.AF_INET
	rule4.Table = tp.routeTable
	rule4.Mark = tp.tproxyMark
	mask := tp.tproxyFwMask
	rule4.Mask = &mask
	rule4.Priority = tp.rulePref

	netlink.RuleDel(rule4)
	netlink.RuleAdd(rule4)

	route6 := &netlink.Route{
		LinkIndex: lo.Attrs().Index,
		Scope:     netlink.SCOPE_HOST,
		Table:     tp.routeTable,
		Type:      unix.RTN_LOCAL,
		Dst: &net.IPNet{
			IP:   net.IPv6zero,
			Mask: net.CIDRMask(0, 128),
		},
	}
	netlink.RouteReplace(route6)

	rule6 := netlink.NewRule()
	rule6.Family = unix.AF_INET6
	rule6.Table = tp.routeTable
	rule6.Mark = tp.tproxyMark
	mask6 := tp.tproxyFwMask
	rule6.Mask = &mask6
	rule6.Priority = tp.rulePref

	netlink.RuleDel(rule6)
	netlink.RuleAdd(rule6)

	logger.Info("TPROXY policy routing configured successfully")
	return nil
}

func (tp *TProxyService) delPolicyRouting() error {
	rule4 := netlink.NewRule()
	rule4.Family = unix.AF_INET
	rule4.Table = tp.routeTable
	rule4.Mark = tp.tproxyMark
	mask4 := tp.tproxyFwMask
	rule4.Mask = &mask4
	rule4.Priority = tp.rulePref
	netlink.RuleDel(rule4)

	rule6 := netlink.NewRule()
	rule6.Family = unix.AF_INET6
	rule6.Table = tp.routeTable
	rule6.Mark = tp.tproxyMark
	mask6 := tp.tproxyFwMask
	rule6.Mask = &mask6
	rule6.Priority = tp.rulePref
	netlink.RuleDel(rule6)

	routes, _ := netlink.RouteListFiltered(unix.AF_INET, &netlink.Route{Table: tp.routeTable}, netlink.RT_FILTER_TABLE)
	for _, route := range routes {
		netlink.RouteDel(&route)
	}

	routes6, _ := netlink.RouteListFiltered(unix.AF_INET6, &netlink.Route{Table: tp.routeTable}, netlink.RT_FILTER_TABLE)
	for _, route := range routes6 {
		netlink.RouteDel(&route)
	}

	return nil
}

func (tp *TProxyService) createRules() error {
	logger.Debug("TPROXY: Creating table")
	table := tp.conn.AddTable(&nftables.Table{
		Family: nftables.TableFamilyINet,
		Name:   "mihombreng_tproxy",
	})

	logger.Debug("TPROXY: Creating reserved_ip set")
	reservedIPSet := &nftables.Set{
		Table:    table,
		Name:     "reserved_ip",
		KeyType:  nftables.TypeIPAddr,
		Interval: true,
	}
	if err := tp.conn.AddSet(reservedIPSet, nil); err != nil {
		logger.Errorf("TPROXY: Failed to add reserved_ip set: %v", err)
		return err
	}
	if err := tp.conn.SetAddElements(reservedIPSet, tp.getReservedIPv4()); err != nil {
		logger.Errorf("TPROXY: Failed to add reserved_ip elements: %v", err)
		return err
	}

	logger.Debug("TPROXY: Creating reserved_ip6 set")
	reservedIP6Set := &nftables.Set{
		Table:    table,
		Name:     "reserved_ip6",
		KeyType:  nftables.TypeIP6Addr,
		Interval: true,
	}
	if err := tp.conn.AddSet(reservedIP6Set, nil); err != nil {
		logger.Errorf("TPROXY: Failed to add reserved_ip6 set: %v", err)
		return err
	}
	if err := tp.conn.SetAddElements(reservedIP6Set, tp.getReservedIPv6()); err != nil {
		logger.Errorf("TPROXY: Failed to add reserved_ip6 elements: %v", err)
		return err
	}

	logger.Debug("TPROXY: Creating bypass_mac set")
	bypassMACSet := &nftables.Set{
		Table:   table,
		Name:    "bypass_mac",
		KeyType: nftables.TypeEtherAddr,
	}
	if err := tp.conn.AddSet(bypassMACSet, nil); err != nil {
		logger.Errorf("TPROXY: Failed to add bypass_mac set: %v", err)
		return err
	}
	var bypassMACElements []nftables.SetElement
	for _, macStr := range tp.routingConfig.BypassMACs {
		mac, err := net.ParseMAC(macStr)
		if err != nil {
			logger.Warnf("TPROXY: Invalid MAC address %s: %v", macStr, err)
			continue
		}
		bypassMACElements = append(bypassMACElements, nftables.SetElement{Key: mac})
	}
	if len(bypassMACElements) > 0 {
		if err := tp.conn.SetAddElements(bypassMACSet, bypassMACElements); err != nil {
			logger.Errorf("TPROXY: Failed to add bypass_mac elements: %v", err)
			return err
		}
	}

	logger.Debug("TPROXY: Creating bypass_ip set")
	bypassIPSet := &nftables.Set{
		Table:    table,
		Name:     "bypass_ip",
		KeyType:  nftables.TypeIPAddr,
		Interval: true,
	}
	if err := tp.conn.AddSet(bypassIPSet, nil); err != nil {
		logger.Errorf("TPROXY: Failed to add bypass_ip set: %v", err)
		return err
	}
	if len(tp.routingConfig.BypassIPs) > 0 {
		bypassIPElements := buildReservedSetElements(tp.routingConfig.BypassIPs, false)
		if len(bypassIPElements) > 0 {
			if err := tp.conn.SetAddElements(bypassIPSet, bypassIPElements); err != nil {
				logger.Errorf("TPROXY: Failed to add bypass_ip elements: %v", err)
				return err
			}
		}
	}

	logger.Debug("TPROXY: Creating bypass_ip6 set")
	bypassIP6Set := &nftables.Set{
		Table:    table,
		Name:     "bypass_ip6",
		KeyType:  nftables.TypeIP6Addr,
		Interval: true,
	}
	if err := tp.conn.AddSet(bypassIP6Set, nil); err != nil {
		logger.Errorf("TPROXY: Failed to add bypass_ip6 set: %v", err)
		return err
	}
	if len(tp.routingConfig.BypassIP6s) > 0 {
		bypassIP6Elements := buildReservedSetElements(tp.routingConfig.BypassIP6s, true)
		if len(bypassIP6Elements) > 0 {
			if err := tp.conn.SetAddElements(bypassIP6Set, bypassIP6Elements); err != nil {
				logger.Errorf("TPROXY: Failed to add bypass_ip6 elements: %v", err)
				return err
			}
		}
	}

	preroutingChain := tp.conn.AddChain(&nftables.Chain{
		Name:     "mangle_prerouting",
		Table:    table,
		Type:     nftables.ChainTypeFilter,
		Hooknum:  nftables.ChainHookPrerouting,
		Priority: nftables.ChainPriorityMangle,
	})

	outputChain := tp.conn.AddChain(&nftables.Chain{
		Name:     "mangle_output",
		Table:    table,
		Type:     nftables.ChainTypeRoute,
		Hooknum:  nftables.ChainHookOutput,
		Priority: nftables.ChainPriorityMangle,
	})

	tp.addPreroutingRules(table, preroutingChain, reservedIPSet, reservedIP6Set, bypassMACSet, bypassIPSet, bypassIP6Set)
	tp.addOutputRules(table, outputChain, reservedIPSet, reservedIP6Set, bypassIPSet, bypassIP6Set)

	// Intercept IPv6 DNS requests
	dnsPreroutingChain := tp.conn.AddChain(&nftables.Chain{
		Name:     "dns_prerouting",
		Table:    table,
		Type:     nftables.ChainTypeNAT,
		Hooknum:  nftables.ChainHookPrerouting,
		Priority: nftables.ChainPriorityRef(-100),
	})

	dnsOutputChain := tp.conn.AddChain(&nftables.Chain{
		Name:     "dns_output",
		Table:    table,
		Type:     nftables.ChainTypeNAT,
		Hooknum:  nftables.ChainHookOutput,
		Priority: nftables.ChainPriorityRef(-100),
	})

	dnsPortData := []byte{byte(1053 >> 8), byte(1053 & 0xFF)}

	// TCP IPv6 DNS redirect (prerouting)
	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: dnsPreroutingChain,
		Exprs: []expr.Any{
			&expr.Meta{Key: expr.MetaKeyNFPROTO, Register: 1},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{byte(unix.NFPROTO_IPV6)}},
			&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{unix.IPPROTO_TCP}},
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseTransportHeader, Offset: 2, Len: 2},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{0x00, 0x35}},
			&expr.Immediate{Register: 2, Data: dnsPortData},
			&expr.Redir{RegisterProtoMin: 2},
		},
	})

	// UDP IPv6 DNS redirect (prerouting)
	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: dnsPreroutingChain,
		Exprs: []expr.Any{
			&expr.Meta{Key: expr.MetaKeyNFPROTO, Register: 1},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{byte(unix.NFPROTO_IPV6)}},
			&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{unix.IPPROTO_UDP}},
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseTransportHeader, Offset: 2, Len: 2},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{0x00, 0x35}},
			&expr.Immediate{Register: 2, Data: dnsPortData},
			&expr.Redir{RegisterProtoMin: 2},
		},
	})

	// TCP IPv6 DNS redirect (output)
	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: dnsOutputChain,
		Exprs: []expr.Any{
			&expr.Meta{Key: expr.MetaKeyNFPROTO, Register: 1},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{byte(unix.NFPROTO_IPV6)}},
			&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{unix.IPPROTO_TCP}},
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseTransportHeader, Offset: 2, Len: 2},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{0x00, 0x35}},
			&expr.Immediate{Register: 2, Data: dnsPortData},
			&expr.Redir{RegisterProtoMin: 2},
		},
	})

	// UDP IPv6 DNS redirect (output)
	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: dnsOutputChain,
		Exprs: []expr.Any{
			&expr.Meta{Key: expr.MetaKeyNFPROTO, Register: 1},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{byte(unix.NFPROTO_IPV6)}},
			&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{unix.IPPROTO_UDP}},
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseTransportHeader, Offset: 2, Len: 2},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{0x00, 0x35}},
			&expr.Immediate{Register: 2, Data: dnsPortData},
			&expr.Redir{RegisterProtoMin: 2},
		},
	})

	logger.Info("TPROXY nftables rules created successfully")
	return nil
}

func (tp *TProxyService) addPreroutingRules(table *nftables.Table, chain *nftables.Chain, reservedIPSet, reservedIP6Set, bypassMACSet, bypassIPSet, bypassIP6Set *nftables.Set) {
	// Source MAC bypass
	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseLLHeader, Offset: 6, Len: 6},
			&expr.Lookup{SourceRegister: 1, SetName: bypassMACSet.Name, SetID: bypassMACSet.ID},
			&expr.Counter{},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	// Source IP (v4) bypass
	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseNetworkHeader, Offset: 12, Len: 4},
			&expr.Lookup{SourceRegister: 1, SetName: bypassIPSet.Name, SetID: bypassIPSet.ID},
			&expr.Counter{},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	// Source IP (v6) bypass
	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseNetworkHeader, Offset: 8, Len: 16},
			&expr.Lookup{SourceRegister: 1, SetName: bypassIP6Set.Name, SetID: bypassIP6Set.ID},
			&expr.Counter{},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	port443 := []byte{0x01, 0xBB}
	mihomoMarkData := []byte{0x00, 0x01, 0x00, 0x00}
	tproxyMarkData := []byte{byte(tp.tproxyMark), 0x00, 0x00, 0x00}
	maskData := []byte{byte(tp.tproxyFwMask), 0x00, 0x00, 0x00}
	portData := []byte{byte(tp.tproxyPort >> 8), byte(tp.tproxyPort)}

	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{unix.IPPROTO_UDP}},
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseTransportHeader, Offset: 2, Len: 2},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: port443},
			&expr.Reject{Type: unix.NFT_REJECT_ICMP_UNREACH, Code: unix.NFT_REJECT_ICMPX_PORT_UNREACH},
		},
	})

	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Meta{Key: expr.MetaKeyMARK, Register: 1},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: mihomoMarkData},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	if string(tp.routingConfig.TCP) == "tproxy" {
		tp.conn.AddRule(&nftables.Rule{
			Table: table,
			Chain: chain,
			Exprs: []expr.Any{
				&expr.Meta{Key: expr.MetaKeyIIFNAME, Register: 1},
				&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte("lo\x00")},
				&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
				&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{unix.IPPROTO_TCP}},
				&expr.Meta{Key: expr.MetaKeyMARK, Register: 1},
				&expr.Bitwise{SourceRegister: 1, DestRegister: 1, Len: 4, Mask: maskData, Xor: []byte{0, 0, 0, 0}},
				&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: tproxyMarkData},
				&expr.Immediate{Register: 2, Data: portData},
				&expr.TProxy{TableFamily: unix.NFPROTO_UNSPEC, RegPort: 2},
				&expr.Counter{},
				&expr.Verdict{Kind: expr.VerdictAccept},
			},
		})
	}

	if string(tp.routingConfig.UDP) == "tproxy" {
		tp.conn.AddRule(&nftables.Rule{
			Table: table,
			Chain: chain,
			Exprs: []expr.Any{
				&expr.Meta{Key: expr.MetaKeyIIFNAME, Register: 1},
				&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte("lo\x00")},
				&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
				&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{unix.IPPROTO_UDP}},
				&expr.Meta{Key: expr.MetaKeyMARK, Register: 1},
				&expr.Bitwise{SourceRegister: 1, DestRegister: 1, Len: 4, Mask: maskData, Xor: []byte{0, 0, 0, 0}},
				&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: tproxyMarkData},
				&expr.Immediate{Register: 2, Data: portData},
				&expr.TProxy{TableFamily: unix.NFPROTO_UNSPEC, RegPort: 2},
				&expr.Counter{},
				&expr.Verdict{Kind: expr.VerdictAccept},
			},
		})
	}

	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Ct{Register: 1, SourceRegister: false, Key: expr.CtKeyDIRECTION},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{1}},
			&expr.Counter{},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Fib{Register: 1, ResultADDRTYPE: true, FlagDADDR: true},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{unix.RTN_LOCAL, unix.RTN_BROADCAST, unix.RTN_ANYCAST, unix.RTN_MULTICAST}},
			&expr.Counter{},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseNetworkHeader, Offset: 16, Len: 4},
			&expr.Lookup{SourceRegister: 1, SetName: reservedIPSet.Name, SetID: reservedIPSet.ID},
			&expr.Counter{},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseNetworkHeader, Offset: 24, Len: 16},
			&expr.Lookup{SourceRegister: 1, SetName: reservedIP6Set.Name, SetID: reservedIP6Set.ID},
			&expr.Counter{},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	if string(tp.routingConfig.TCP) == "tproxy" {
		tp.conn.AddRule(&nftables.Rule{
			Table: table,
			Chain: chain,
			Exprs: []expr.Any{
				&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
				&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{unix.IPPROTO_TCP}},
				&expr.Counter{},
				&expr.Meta{Key: expr.MetaKeyMARK, Register: 1},
				&expr.Bitwise{SourceRegister: 1, DestRegister: 1, Len: 4, Mask: []byte{0x00, 0x00, 0x00, 0x00}, Xor: tproxyMarkData},
				&expr.Meta{Key: expr.MetaKeyMARK, SourceRegister: true, Register: 1},
				&expr.Immediate{Register: 2, Data: portData},
				&expr.TProxy{TableFamily: unix.NFPROTO_UNSPEC, RegPort: 2},
				&expr.Verdict{Kind: expr.VerdictAccept},
			},
		})
	}

	if string(tp.routingConfig.UDP) == "tproxy" {
		tp.conn.AddRule(&nftables.Rule{
			Table: table,
			Chain: chain,
			Exprs: []expr.Any{
				&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
				&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{unix.IPPROTO_UDP}},
				&expr.Counter{},
				&expr.Meta{Key: expr.MetaKeyMARK, Register: 1},
				&expr.Bitwise{SourceRegister: 1, DestRegister: 1, Len: 4, Mask: []byte{0x00, 0x00, 0x00, 0x00}, Xor: tproxyMarkData},
				&expr.Meta{Key: expr.MetaKeyMARK, SourceRegister: true, Register: 1},
				&expr.Immediate{Register: 2, Data: portData},
				&expr.TProxy{TableFamily: unix.NFPROTO_UNSPEC, RegPort: 2},
				&expr.Verdict{Kind: expr.VerdictAccept},
			},
		})
	}
}

func (tp *TProxyService) addOutputRules(table *nftables.Table, chain *nftables.Chain, reservedIPSet, reservedIP6Set, bypassIPSet, bypassIP6Set *nftables.Set) {
	// Source IP (v4) bypass
	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Meta{Key: expr.MetaKeyNFPROTO, Register: 1},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{byte(unix.NFPROTO_IPV4)}},
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseNetworkHeader, Offset: 12, Len: 4},
			&expr.Lookup{SourceRegister: 1, SetName: bypassIPSet.Name, SetID: bypassIPSet.ID},
			&expr.Counter{},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	// Source IP (v6) bypass
	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Meta{Key: expr.MetaKeyNFPROTO, Register: 1},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{byte(unix.NFPROTO_IPV6)}},
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseNetworkHeader, Offset: 8, Len: 16},
			&expr.Lookup{SourceRegister: 1, SetName: bypassIP6Set.Name, SetID: bypassIP6Set.ID},
			&expr.Counter{},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	port443 := []byte{0x01, 0xBB}
	mihomoMarkData := []byte{0x00, 0x01, 0x00, 0x00}
	tproxyMarkData := []byte{byte(tp.tproxyMark), 0x00, 0x00, 0x00}

	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{unix.IPPROTO_UDP}},
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseTransportHeader, Offset: 2, Len: 2},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: port443},
			&expr.Reject{Type: unix.NFT_REJECT_ICMP_UNREACH, Code: unix.NFT_REJECT_ICMPX_PORT_UNREACH},
		},
	})

	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Meta{Key: expr.MetaKeyMARK, Register: 1},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: mihomoMarkData},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Ct{Register: 1, SourceRegister: false, Key: expr.CtKeyDIRECTION},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{1}},
			&expr.Counter{},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Fib{Register: 1, ResultADDRTYPE: true, FlagDADDR: true},
			&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{unix.RTN_LOCAL, unix.RTN_BROADCAST, unix.RTN_ANYCAST, unix.RTN_MULTICAST}},
			&expr.Counter{},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseNetworkHeader, Offset: 16, Len: 4},
			&expr.Lookup{SourceRegister: 1, SetName: reservedIPSet.Name, SetID: reservedIPSet.ID},
			&expr.Counter{},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	tp.conn.AddRule(&nftables.Rule{
		Table: table,
		Chain: chain,
		Exprs: []expr.Any{
			&expr.Payload{DestRegister: 1, Base: expr.PayloadBaseNetworkHeader, Offset: 24, Len: 16},
			&expr.Lookup{SourceRegister: 1, SetName: reservedIP6Set.Name, SetID: reservedIP6Set.ID},
			&expr.Counter{},
			&expr.Verdict{Kind: expr.VerdictReturn},
		},
	})

	if string(tp.routingConfig.TCP) == "tproxy" {
		tp.conn.AddRule(&nftables.Rule{
			Table: table,
			Chain: chain,
			Exprs: []expr.Any{
				&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
				&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{unix.IPPROTO_TCP}},
				&expr.Counter{},
				&expr.Meta{Key: expr.MetaKeyMARK, Register: 1},
				&expr.Bitwise{SourceRegister: 1, DestRegister: 1, Len: 4, Mask: []byte{0x00, 0x00, 0x00, 0x00}, Xor: tproxyMarkData},
				&expr.Meta{Key: expr.MetaKeyMARK, SourceRegister: true, Register: 1},
				&expr.Verdict{Kind: expr.VerdictAccept},
			},
		})
	}

	if string(tp.routingConfig.UDP) == "tproxy" {
		tp.conn.AddRule(&nftables.Rule{
			Table: table,
			Chain: chain,
			Exprs: []expr.Any{
				&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
				&expr.Cmp{Op: expr.CmpOpEq, Register: 1, Data: []byte{unix.IPPROTO_UDP}},
				&expr.Counter{},
				&expr.Meta{Key: expr.MetaKeyMARK, Register: 1},
				&expr.Bitwise{SourceRegister: 1, DestRegister: 1, Len: 4, Mask: []byte{0x00, 0x00, 0x00, 0x00}, Xor: tproxyMarkData},
				&expr.Meta{Key: expr.MetaKeyMARK, SourceRegister: true, Register: 1},
				&expr.Verdict{Kind: expr.VerdictAccept},
			},
		})
	}
}

func (tp *TProxyService) getReservedIPv4() []nftables.SetElement {
	reservedNets := []string{
		"0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
		"169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24",
		"192.88.99.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24",
		"203.0.113.0/24", "224.0.0.0/3",
	}
	return buildReservedSetElements(reservedNets, false)
}

func (tp *TProxyService) getReservedIPv6() []nftables.SetElement {
	reservedNets := []string{
		"::/128", "::1/128", "::ffff:0:0/96", "64:ff9b::/96",
		"64:ff9b:1::/48", "100::/64", "2001::/32", "2001:20::/28",
		"2001:db8::/32", "2002::/16", "5f00::/16", "fc00::/7",
		"fe80::/10", "ff00::/8",
	}
	return buildReservedSetElements(reservedNets, true)
}

type ipInterval struct {
	start []byte
	end   []byte
}

func buildReservedSetElements(reserved []string, ipv6 bool) []nftables.SetElement {
	intervals := make([]ipInterval, 0, len(reserved))
	for _, cidr := range reserved {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			continue
		}

		var baseIP net.IP
		if ipv6 {
			baseIP = network.IP.To16()
		} else {
			baseIP = network.IP.To4()
		}
		if baseIP == nil {
			continue
		}

		mask := network.Mask
		if len(mask) != len(baseIP) {
			continue
		}

		start := append([]byte(nil), baseIP...)
		end := make([]byte, len(start))
		for i := range start {
			end[i] = start[i] | ^mask[i]
		}

		incrementIP(end)

		intervals = append(intervals, ipInterval{start: start, end: end})
	}

	sort.Slice(intervals, func(i, j int) bool {
		return bytes.Compare(intervals[i].start, intervals[j].start) < 0
	})

	merged := make([]ipInterval, 0, len(intervals))
	for _, interval := range intervals {
		if len(merged) == 0 {
			merged = append(merged, interval)
			continue
		}
		last := &merged[len(merged)-1]
		if bytes.Compare(interval.start, last.end) <= 0 {
			if bytes.Compare(interval.end, last.end) > 0 {
				last.end = interval.end
			}
			continue
		}
		merged = append(merged, interval)
	}

	elements := make([]nftables.SetElement, 0, len(merged)*2)
	for _, interval := range merged {
		elements = append(elements,
			nftables.SetElement{Key: interval.start},
			nftables.SetElement{Key: interval.end, IntervalEnd: true},
		)
	}

	return elements
}

func incrementIP(ip []byte) {
	for i := len(ip) - 1; i >= 0; i-- {
		ip[i]++
		if ip[i] != 0 {
			break
		}
	}
}

func (tp *TProxyService) deleteRules() error {
	nft, err := nftables.New()
	if err != nil {
		return err
	}

	nft.DelTable(&nftables.Table{
		Name:   "mihombreng_tproxy",
		Family: nftables.TableFamilyINet,
	})

	nft.Flush()
	return nil
}
