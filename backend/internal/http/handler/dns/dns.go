package dns

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type DNSHandler struct{}

func NewDNSHandler() *DNSHandler {
	return &DNSHandler{}
}

type LookupRequest struct {
	Domain string `json:"domain" binding:"required"`
}

type LookupResponse struct {
	Success bool     `json:"success"`
	Domain  string   `json:"domain"`
	IPv4    []string `json:"ipv4"`
	IPv6    []string `json:"ipv6"`
	Error   string   `json:"error,omitempty"`
	Reason  string   `json:"reason,omitempty"`
}

// LookupDomain godoc
// @Summary Lookup domain IP addresses
// @Description Resolve domain name to IPv4 and IPv6 addresses
// @Tags DNS
// @Accept json
// @Produce json
// @Param request body LookupRequest true "Domain to lookup"
// @Success 200 {object} LookupResponse
// @Failure 400 {object} LookupResponse
// @Failure 500 {object} LookupResponse
// @Router /dns/lookup [post]
func (h *DNSHandler) LookupDomain(c *gin.Context) {
	var req LookupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, LookupResponse{
			Success: false,
			Error:   "invalid request: " + err.Error(),
		})
		return
	}

	domain := strings.TrimSpace(req.Domain)
	ips, err := net.LookupIP(domain)
	if err != nil {
		statusCode, reason, message := classifyLookupError(domain, err)
		c.JSON(statusCode, LookupResponse{
			Success: false,
			Domain:  domain,
			Error:   message,
			Reason:  reason,
		})
		return
	}

	var ipv4List []string
	var ipv6List []string

	for _, ip := range ips {
		if ip.To4() != nil {
			ipv4List = append(ipv4List, ip.String())
		} else {
			ipv6List = append(ipv6List, ip.String())
		}
	}

	if len(ipv4List) == 0 && len(ipv6List) == 0 {
		c.JSON(http.StatusNotFound, LookupResponse{
			Success: false,
			Domain:  domain,
			Error:   "domain resolved but returned no A or AAAA records",
			Reason:  "no_records",
		})
		return
	}

	c.JSON(http.StatusOK, LookupResponse{
		Success: true,
		Domain:  domain,
		IPv4:    ipv4List,
		IPv6:    ipv6List,
	})
}

func classifyLookupError(domain string, err error) (int, string, string) {
	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		if dnsErr.IsNotFound {
			return http.StatusNotFound, "nxdomain", fmt.Sprintf("domain %q does not exist", domain)
		}
		if dnsErr.IsTimeout {
			return http.StatusGatewayTimeout, "timeout", fmt.Sprintf("DNS lookup for %q timed out", domain)
		}
		return http.StatusBadGateway, "resolver_error", fmt.Sprintf("DNS resolver failed for %q", domain)
	}

	return http.StatusInternalServerError, "lookup_failed", fmt.Sprintf("failed to lookup domain %q", domain)
}
