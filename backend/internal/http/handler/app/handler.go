package app

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"mihombreng/internal/domain"
	"mihombreng/pkg/apperror"
	"mihombreng/pkg/config"

	"github.com/gin-gonic/gin"
)

type AppHandler struct {
	config        *config.Config
	mihomoService domain.MihomoService
	configPath    string
}

func NewAppHandler(cfg *config.Config, mihomoService domain.MihomoService, configPath string) *AppHandler {
	return &AppHandler{
		config:        cfg,
		mihomoService: mihomoService,
		configPath:    configPath,
	}
}

// GeoIPResponse represents geolocation data for an IP address.
type GeoIPResponse struct {
	IP           string  `json:"ip"`
	Country      string  `json:"country"`
	CountryCode  string  `json:"country_code"`
	Region       string  `json:"region"`
	RegionCode   string  `json:"region_code"`
	City         string  `json:"city"`
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	Timezone     string  `json:"timezone"`
	ASN          int     `json:"asn"`
	Organization string  `json:"organization"`
	ISP          string  `json:"isp"`
}

type DiagnosticsCheck struct {
	ID       string `json:"id"`
	Label    string `json:"label"`
	Category string `json:"category"`
	Severity string `json:"severity"`
	Summary  string `json:"summary"`
	Details  string `json:"details,omitempty"`
	Value    string `json:"value,omitempty"`
	Action   string `json:"action,omitempty"`
}

func decodeGeoIPResponse(resp *http.Response) (GeoIPResponse, error) {
	var geoData GeoIPResponse

	contentType := strings.ToLower(resp.Header.Get("Content-Type"))
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if err != nil {
		return geoData, fmt.Errorf("failed to read geo response")
	}

	bodyText := strings.TrimSpace(string(body))
	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusForbidden {
			return geoData, fmt.Errorf("geo provider rejected this server IP (HTTP 403)")
		}
		return geoData, fmt.Errorf("geo provider returned HTTP %d", resp.StatusCode)
	}

	if bodyText == "" {
		return geoData, fmt.Errorf("geo provider returned empty response")
	}
	if contentType != "" && !strings.Contains(contentType, "json") {
		return geoData, fmt.Errorf("geo provider returned non-JSON response")
	}
	if strings.HasPrefix(bodyText, "<") {
		return geoData, fmt.Errorf("geo provider returned non-JSON response")
	}
	if err := json.Unmarshal(body, &geoData); err != nil {
		return geoData, fmt.Errorf("geo provider returned invalid JSON")
	}
	if geoData.IP == "" && geoData.Country == "" && geoData.Organization == "" {
		return geoData, fmt.Errorf("geo provider returned incomplete data")
	}

	return geoData, nil
}

// GetConfig godoc
// @Summary Get application configuration
// @Description Get current Mihombreng application configuration
// @Tags Mihombreng App
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /app/config [get]
func (h *AppHandler) GetConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"version":     h.config.Version,
			"environment": h.config.Environment,
			"server":      h.config.Server,
			"mihomo":      h.mihomoService.GetAppConfig(),
			"logging": gin.H{
				"level": h.config.Logging.Level,
			},
			"api": h.config.API,
		},
	})
}

// GetIPv4 godoc
// @Summary Get IPv4 address
// @Description Get current IPv4 address
// @Tags Mihombreng App
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Failure 503 {object} map[string]interface{}
// @Router /app/ipv4 [get]
func (h *AppHandler) GetIPv4(c *gin.Context) {
	h.getIP(c, "https://api-ipv4.ip.sb/ip", "IPv4")
}

// GetIPv6 godoc
// @Summary Get IPv6 address
// @Description Get current IPv6 address
// @Tags Mihombreng App
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Failure 503 {object} map[string]interface{}
// @Router /app/ipv6 [get]
func (h *AppHandler) GetIPv6(c *gin.Context) {
	h.getIP(c, "https://api-ipv6.ip.sb/ip", "IPv6")
}

func (h *AppHandler) getIP(c *gin.Context, url, ipVersion string) {
	client := &http.Client{}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create request",
		})
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Failed to get " + ipVersion + " address",
		})
		return
	}
	defer resp.Body.Close()

	var ip string
	scanner := bufio.NewScanner(resp.Body)
	if scanner.Scan() {
		ip = scanner.Text()
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"ip": ip,
		},
	})
}

// GetGeoIPv4 godoc
// @Summary Get IPv4 geolocation
// @Description Get IPv4 address with geolocation information
// @Tags Mihombreng App
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Failure 503 {object} map[string]interface{}
// @Router /app/geo/ipv4 [get]
func (h *AppHandler) GetGeoIPv4(c *gin.Context) {
	h.getGeoIP(c, "https://api-ipv4.ip.sb/geoip", "IPv4")
}

// GetGeoIPv6 godoc
// @Summary Get IPv6 geolocation
// @Description Get IPv6 address with geolocation information
// @Tags Mihombreng App
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Failure 503 {object} map[string]interface{}
// @Router /app/geo/ipv6 [get]
func (h *AppHandler) GetGeoIPv6(c *gin.Context) {
	h.getGeoIP(c, "https://api-ipv6.ip.sb/geoip", "IPv6")
}

func (h *AppHandler) getGeoIP(c *gin.Context, url, ipVersion string) {
	client := &http.Client{Timeout: 4 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create request",
		})
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Failed to get " + ipVersion + " geolocation",
		})
		return
	}
	defer resp.Body.Close()

	geoData, err := decodeGeoIPResponse(resp)
	if err != nil {
		statusCode := http.StatusBadGateway
		if resp.StatusCode == http.StatusOK {
			statusCode = http.StatusServiceUnavailable
		}
		c.JSON(statusCode, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    geoData,
	})
}

func (h *AppHandler) Diagnostics(c *gin.Context) {
	checks := make([]DiagnosticsCheck, 0, 8)
	generatedAt := time.Now().UTC().Format(time.RFC3339)

	status := h.mihomoService.GetStatus()
	checks = append(checks, DiagnosticsCheck{
		ID:       "mihomo-status",
		Label:    "Mihomo runtime",
		Category: "runtime",
		Severity: map[bool]string{true: "success", false: "failure"}[status == "running"],
		Summary:  map[bool]string{true: "Mihomo core is running", false: "Mihomo core is not running"}[status == "running"],
		Value:    status,
		Action:   map[bool]string{true: "Logs and connections should be reachable", false: "Start Mihomo before troubleshooting runtime traffic"}[status == "running"],
	})

	checks = append(checks, h.checkFilesystemPath("working-dir", "Working directory", h.config.Mihomo.WorkingDir, false))
	checks = append(checks, h.checkFilesystemPath("active-config", "Active config path", h.config.Mihomo.ConfigPath, true))
	checks = append(checks, h.checkFilesystemPath("core-binary", "Mihomo core binary", h.config.Mihomo.CorePath, true))
	checks = append(checks, h.checkFilesystemPath("app-log", "Application log file", h.config.Logging.File, true))

	if host := strings.TrimSpace(h.extractHost(h.config.Mihomo.APIURL)); host != "" {
		checks = append(checks, h.checkTCPReachability("mihomo-api", "Mihomo API reachability", host))
	} else {
		checks = append(checks, DiagnosticsCheck{
			ID:       "mihomo-api",
			Label:    "Mihomo API reachability",
			Category: "network",
			Severity: "failure",
			Summary:  "Mihomo API URL is not configured",
			Action:   "Set mihomo.api_url in settings before using runtime diagnostics",
		})
	}

	checks = append(checks, h.checkOutboundGeo("outbound-ipv4", "Outbound IPv4 / geo", "https://api-ipv4.ip.sb/geoip"))
	checks = append(checks, h.checkDNS("dns-lookup", "DNS lookup", "cloudflare.com"))

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"generated_at": generatedAt,
		"checks":       checks,
	})
}

func (h *AppHandler) checkFilesystemPath(id, label, path string, expectFile bool) DiagnosticsCheck {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return DiagnosticsCheck{ID: id, Label: label, Category: "filesystem", Severity: "failure", Summary: label + " is not configured", Action: "Set path in settings before using related workflows"}
	}

	info, err := os.Stat(trimmed)
	if err != nil {
		return DiagnosticsCheck{ID: id, Label: label, Category: "filesystem", Severity: "failure", Summary: label + " is missing", Details: err.Error(), Value: trimmed, Action: "Verify path exists and permissions are correct"}
	}

	severity := "success"
	summary := label + " is accessible"
	if expectFile && info.IsDir() {
		severity = "warning"
		summary = label + " points to a directory"
	}

	return DiagnosticsCheck{ID: id, Label: label, Category: "filesystem", Severity: severity, Summary: summary, Value: trimmed}
}

func (h *AppHandler) checkTCPReachability(id, label, host string) DiagnosticsCheck {
	conn, err := net.DialTimeout("tcp", host, 2*time.Second)
	if err != nil {
		return DiagnosticsCheck{ID: id, Label: label, Category: "network", Severity: "failure", Summary: "Cannot reach " + host, Details: err.Error(), Value: host, Action: "Check mihomo.api_url, firewall, and service status"}
	}
	_ = conn.Close()
	return DiagnosticsCheck{ID: id, Label: label, Category: "network", Severity: "success", Summary: "TCP connection to " + host + " succeeded", Value: host}
}

func (h *AppHandler) checkOutboundGeo(id, label, target string) DiagnosticsCheck {
	client := &http.Client{Timeout: 4 * time.Second}
	resp, err := client.Get(target)
	if err != nil {
		return DiagnosticsCheck{ID: id, Label: label, Category: "network", Severity: "warning", Summary: "Outbound geo lookup failed", Details: err.Error(), Action: "Verify server outbound internet access"}
	}
	defer resp.Body.Close()

	geoData, err := decodeGeoIPResponse(resp)
	if err != nil {
		action := "Verify server outbound internet access or retry when geo provider is healthy"
		summary := "Outbound geo lookup unavailable"
		if resp.StatusCode == http.StatusForbidden {
			summary = "Outbound geo provider rejected this server IP"
			action = "Use another geo provider or test from a different outbound IP"
		}
		return DiagnosticsCheck{ID: id, Label: label, Category: "network", Severity: "warning", Summary: summary, Details: err.Error(), Action: action}
	}

	value := strings.TrimSpace(fmt.Sprintf("%s · %s · %s", geoData.IP, geoData.Country, geoData.Organization))
	return DiagnosticsCheck{ID: id, Label: label, Category: "network", Severity: "success", Summary: "Outbound IPv4 lookup succeeded", Value: value}
}

func (h *AppHandler) checkDNS(id, label, domain string) DiagnosticsCheck {
	ips, err := net.LookupHost(domain)
	if err != nil {
		return DiagnosticsCheck{ID: id, Label: label, Category: "dns", Severity: "failure", Summary: "DNS lookup failed", Details: err.Error(), Value: domain, Action: "Check resolver configuration and upstream DNS reachability"}
	}
	return DiagnosticsCheck{ID: id, Label: label, Category: "dns", Severity: "success", Summary: "DNS lookup succeeded", Value: fmt.Sprintf("%s -> %s", domain, strings.Join(ips, ", "))}
}

func (h *AppHandler) extractHost(rawURL string) string {
	trimmed := strings.TrimSpace(rawURL)
	trimmed = strings.TrimPrefix(trimmed, "http://")
	trimmed = strings.TrimPrefix(trimmed, "https://")
	trimmed = strings.TrimSuffix(trimmed, "/")
	if strings.Contains(trimmed, "/") {
		trimmed = strings.Split(trimmed, "/")[0]
	}
	if trimmed == "" {
		return ""
	}
	return trimmed
}

// UpdateConfig godoc
// @Summary Update application configuration
// @Description Update Mihombreng application configuration
// @Tags Mihombreng App
// @Accept json
// @Produce json
// @Param config body map[string]interface{} true "Configuration to update"
// @Success 200 {object} map[string]interface{} "Success message"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /app/config [put]
func (h *AppHandler) UpdateConfig(c *gin.Context) {
	var req struct {
		Mihomo  *config.MihomoConfig `json:"mihomo"`
		Logging *struct {
			Level string `json:"level"`
		} `json:"logging"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	needsRestart := false
	previousRouting := h.config.Mihomo.Routing

	if req.Mihomo != nil {
		h.config.Mihomo.CorePath = req.Mihomo.CorePath
		h.config.Mihomo.ConfigPath = req.Mihomo.ConfigPath
		h.config.Mihomo.WorkingDir = req.Mihomo.WorkingDir
		h.config.Mihomo.AutoRestart = req.Mihomo.AutoRestart
		h.config.Mihomo.LogFile = req.Mihomo.LogFile
		h.config.Mihomo.APIURL = req.Mihomo.APIURL
		h.config.Mihomo.APISecret = req.Mihomo.APISecret
		h.config.Mihomo.Routing = req.Mihomo.Routing
		needsRestart = req.Mihomo.AutoRestart && h.mihomoService.GetStatus() == "running"
	}

	if req.Logging != nil && req.Logging.Level != "" {
		h.config.Logging.Level = req.Logging.Level
	}

	if err := h.config.Save(h.configPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "failed to save config: " + err.Error(),
		})
		return
	}

	if needsRestart {
		if err := h.mihomoService.RestartWithPreviousRouting(previousRouting); err != nil {
			c.JSON(apperror.ErrorStatus(err), gin.H{
				"success": false,
				"error":   "config updated but failed to restart mihomo: " + err.Error(),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Configuration updated and mihomo restarted successfully",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Configuration updated successfully. Restart application to apply logging changes.",
	})
}
