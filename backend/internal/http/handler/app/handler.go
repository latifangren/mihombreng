package app

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"mihombreng/internal/domain"
	"mihombreng/pkg/apperror"
	"mihombreng/pkg/config"
	"mihombreng/pkg/logger"

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

// RecoverDiagnostics godoc
// @Summary Recover targeted diagnostics checks
// @Description Trigger actions to recover system issues reported in diagnostics (dns, firewall, mihomo)
// @Tags Mihombreng App
// @Accept json
// @Produce json
// @Param request body map[string]string true "Recovery target key"
// @Success 200 {object} map[string]interface{}
// @Router /app/diagnostics/recover [post]
func (h *AppHandler) RecoverDiagnostics(c *gin.Context) {
	var req struct {
		Target string `json:"target" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	logger.Infof("Triggering diagnostics recovery for target: %s", req.Target)

	switch req.Target {
	case "mihomo":
		if h.mihomoService.GetStatus() == "running" {
			if err := h.mihomoService.Restart(); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
				return
			}
		} else {
			if err := h.mihomoService.Start(); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Mihomo core process starting/restarting initiated"})

	case "firewall":
		err := h.mihomoService.RestartWithPreviousRouting(h.config.Mihomo.Routing)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Firewall status reloaded and routing setup completed"})

	case "dns":
		var err error
		if _, statErr := os.Stat("/etc/init.d/dnsmasq"); statErr == nil {
			cmd := exec.Command("/etc/init.d/dnsmasq", "restart")
			err = cmd.Run()
		} else if _, statErr := os.Stat("/usr/sbin/dnsmasq"); statErr == nil {
			cmd := exec.Command("service", "dnsmasq", "restart")
			err = cmd.Run()
		} else {
			logger.Warn("DNS recovery: dnsmasq not found, skipped restart command execution")
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "failed to restart DNS resolver: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "DNS resolver restart command executed successfully"})

	default:
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "unknown recovery target: " + req.Target})
	}
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

// GitHubRelease represents the subset of fields we need from the GitHub releases API.
type GitHubRelease struct {
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	HTMLURL     string `json:"html_url"`
	Body        string `json:"body"`
	PublishedAt string `json:"published_at"`
}

// CheckUpdate godoc
// @Summary Check for application updates
// @Description Compare the current version against the latest GitHub release
// @Tags Mihombreng App
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 502 {object} map[string]interface{}
// @Router /app/check-update [get]
func (h *AppHandler) CheckUpdate(c *gin.Context) {
	client := &http.Client{Timeout: 8 * time.Second}

	req, err := http.NewRequest("GET", "https://api.github.com/repos/latifangren/mihombreng/releases/latest", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create update check request",
		})
		return
	}
	req.Header.Set("User-Agent", "mihombreng/"+h.config.Version)

	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"error":   "Failed to reach GitHub API: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"error": fmt.Sprintf("GitHub API returned HTTP %d: %s",
				resp.StatusCode, strings.TrimSpace(string(bodyBytes))),
		})
		return
	}

	var release GitHubRelease
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64*1024)).Decode(&release); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"error":   "Failed to decode GitHub release response: " + err.Error(),
		})
		return
	}

	currentVersion := strings.TrimSpace(h.config.Version)
	latestVersion := strings.TrimPrefix(strings.TrimSpace(release.TagName), "v")

	hasUpdate := compareSemver(latestVersion, currentVersion) > 0

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"has_update":      hasUpdate,
			"current_version": currentVersion,
			"latest_version":  latestVersion,
			"release_name":    release.Name,
			"release_url":     release.HTMLURL,
			"changelog":       release.Body,
			"published_at":    release.PublishedAt,
			"backup_warning":  "Before upgrading, it is strongly recommended to create a manual backup from Backup & Sync to protect your configuration files. Upgrades may overwrite defaults and custom provider files.",
			"upgrade_hint":    "Use your system package manager to upgrade (opkg on OpenWrt, apt/dpkg on Debian/Ubuntu). Do not overwrite config files manually; let the package manager handle file conflicts safely.",
		},
	})
}

// compareSemver compares two semver strings (major.minor.patch).
// Returns >0 if a > b, <0 if a < b, 0 if equal.
// Falls back to string inequality if parsing fails.
func compareSemver(a, b string) int {
	aMaj, aMin, aPat := parseSemver(a)
	bMaj, bMin, bPat := parseSemver(b)

	// If any major segment failed to parse, fall back to string comparison.
	if aMaj == "" || bMaj == "" {
		if a > b {
			return 1
		} else if a < b {
			return -1
		}
		return 0
	}

	aMajN := toInt(aMaj)
	bMajN := toInt(bMaj)
	if aMajN != bMajN {
		return aMajN - bMajN
	}

	aMinN := toInt(aMin)
	bMinN := toInt(bMin)
	if aMinN != bMinN {
		return aMinN - bMinN
	}

	// Try numeric patch comparison first.
	aPatN, aErr := parseInt(aPat)
	bPatN, bErr := parseInt(bPat)
	if aErr == nil && bErr == nil {
		return aPatN - bPatN
	}

	// Fall back to string comparison for patch.
	if aPat > bPat {
		return 1
	} else if aPat < bPat {
		return -1
	}
	return 0
}

// toInt converts a digit string to int; returns 0 on empty or non-numeric input.
func toInt(s string) int {
	n, _ := parseInt(s)
	return n
}

func parseSemver(v string) (major, minor, patch string) {
	// Strip leading 'v'
	v = strings.TrimPrefix(v, "v")
	parts := strings.SplitN(v, ".", 3)
	if len(parts) == 3 {
		return parts[0], parts[1], parts[2]
	}
	if len(parts) == 2 {
		return parts[0], parts[1], ""
	}
	if len(parts) == 1 {
		return parts[0], "", ""
	}
	return "", "", ""
}

func parseInt(s string) (int, error) {
	n := 0
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return 0, fmt.Errorf("not an integer")
		}
		n = n*10 + int(ch-'0')
	}
	return n, nil
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
