package mihomo

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"mihombreng/internal/domain"
	"mihombreng/pkg/apperror"
	"mihombreng/pkg/config"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type MihomoHandler struct {
	mihomoService domain.MihomoService
	appConfig     *config.Config
}

func NewMihomoHandler(mihomoService domain.MihomoService, appConfig *config.Config) *MihomoHandler {
	return &MihomoHandler{
		mihomoService: mihomoService,
		appConfig:     appConfig,
	}
}

func (h *MihomoHandler) createRequest(method, url string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}

	if h.appConfig.Mihomo.APISecret != "" {
		req.Header.Set("Authorization", "Bearer "+h.appConfig.Mihomo.APISecret)
	}
	return req, nil
}

func parseSSEJSONObject(body []byte) []byte {
	lines := strings.Split(strings.TrimSpace(string(body)), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}
		if strings.HasPrefix(line, "data:") {
			line = strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		}
		if strings.HasPrefix(line, "{") || strings.HasPrefix(line, "[") {
			return []byte(line)
		}
	}
	return nil
}

func parseIntField(raw any) int64 {
	switch v := raw.(type) {
	case float64:
		return int64(v)
	case int:
		return int64(v)
	case int64:
		return v
	case string:
		n, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			return n
		}
	}
	return 0
}

func (h *MihomoHandler) readProcessCPUUsage() float64 {
	pidFile := filepath.Join(h.appConfig.Mihomo.WorkingDir, "mihomo.pid")
	pidData, err := os.ReadFile(pidFile)
	if err != nil {
		return 0
	}

	pidText := strings.TrimSpace(string(pidData))
	if pidText == "" {
		return 0
	}

	stat, err := os.ReadFile(filepath.Join("/proc", pidText, "stat"))
	if err != nil {
		return 0
	}

	open := strings.LastIndexByte(string(stat), ')')
	if open == -1 || open+2 >= len(stat) {
		return 0
	}

	fields := strings.Fields(string(stat[open+2:]))
	if len(fields) < 20 {
		return 0
	}

	utime, err := strconv.ParseFloat(fields[11], 64)
	if err != nil {
		return 0
	}
	stime, err := strconv.ParseFloat(fields[12], 64)
	if err != nil {
		return 0
	}
	startTimeTicks, err := strconv.ParseFloat(fields[19], 64)
	if err != nil {
		return 0
	}

	uptimeData, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	uptimeFields := strings.Fields(string(uptimeData))
	if len(uptimeFields) == 0 {
		return 0
	}
	secondsSinceBoot, err := strconv.ParseFloat(uptimeFields[0], 64)
	if err != nil {
		return 0
	}

	const clockTicks = 100.0
	elapsedSeconds := secondsSinceBoot - (startTimeTicks / clockTicks)
	if elapsedSeconds <= 0 {
		return 0
	}

	cpu := ((utime + stime) / clockTicks) / elapsedSeconds
	if cpu < 0 {
		return 0
	}
	if cpu > 1 {
		return 1
	}
	return cpu
}

func formatBytes(bytes int64) string {
	if bytes == 0 {
		return "0 B"
	}
	const unit = 1024
	sizes := []string{"B", "KB", "MB", "GB", "TB"}
	div := float64(bytes)
	exp := 0
	for div >= unit && exp < len(sizes)-1 {
		div /= unit
		exp++
	}
	if exp == 0 {
		return fmt.Sprintf("%d B", bytes)
	}
	return fmt.Sprintf("%.1f %s", div, sizes[exp])
}

// GetStatus godoc
// @Summary Get mihomo status
// @Description Get current status of mihomo service
// @Tags Mihomo
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /mihomo/status [get]
func (h *MihomoHandler) GetStatus(c *gin.Context) {
	status := h.mihomoService.GetStatus()
	cpu := 0.0
	if status == "running" {
		cpu = h.readProcessCPUUsage()
	}

	healthy, checkErr, latency := h.mihomoService.GetRoutingHealth()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"running": status == "running",
			"uptime":  h.mihomoService.GetUptime(),
			"cpu":     cpu,
			"routing": gin.H{
				"active":  h.appConfig.Mihomo.Routing.TCP != config.RoutingModeDisable || h.appConfig.Mihomo.Routing.UDP != config.RoutingModeDisable,
				"healthy": healthy,
				"error":   checkErr,
				"latency": latency,
			},
		},
	})
}

// Start godoc
// @Summary Start mihomo service
// @Description Start the mihomo service
// @Tags Mihomo
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /mihomo/start [post]
func (h *MihomoHandler) Start(c *gin.Context) {
	err := h.mihomoService.Start()
	if err != nil {
		c.JSON(apperror.ErrorStatus(err), gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Mihomo service started"})
}

// Stop godoc
// @Summary Stop mihomo service
// @Description Stop the mihomo service
// @Tags Mihomo
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /mihomo/stop [post]
func (h *MihomoHandler) Stop(c *gin.Context) {
	err := h.mihomoService.Stop(true)
	if err != nil {
		c.JSON(apperror.ErrorStatus(err), gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Mihomo service stopped"})
}

// Restart godoc
// @Summary Restart mihomo service
// @Description Restart the mihomo service
// @Tags Mihomo
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /mihomo/restart [post]
func (h *MihomoHandler) Restart(c *gin.Context) {
	err := h.mihomoService.Restart()
	if err != nil {
		c.JSON(apperror.ErrorStatus(err), gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Mihomo service restarted"})
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// ProxyToMihomoAPI godoc
// @Summary Proxy to Mihomo API
// @Description Proxy requests to Mihomo core API
// @Tags Mihomo
// @Accept json
// @Produce json
// @Param path path string true "API path (e.g., /version, /proxies, /rules)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 503 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /mihomo/api/{path} [get]
func (h *MihomoHandler) ProxyToMihomoAPI(c *gin.Context) {
	status := h.mihomoService.GetStatus()
	if status != "running" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "mihomo is not running",
			"status":  status,
		})
		return
	}

	path := c.Param("path")
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	targetStr := h.appConfig.Mihomo.APIURL
	if !strings.HasPrefix(targetStr, "http://") && !strings.HasPrefix(targetStr, "https://") {
		targetStr = "http://" + targetStr
	}

	targetURL, err := url.Parse(targetStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Invalid APIURL configuration",
		})
		return
	}

	// Update path to preserve exactly what was passed.
	targetURL.Path = path

	if strings.ToLower(c.GetHeader("Upgrade")) == "websocket" {
		h.proxyWebsocket(c, targetURL)
		return
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	director := proxy.Director
	proxy.Director = func(req *http.Request) {
		director(req)
		req.Host = targetURL.Host
		req.URL.Path = path
		if c.Request.URL.RawQuery != "" {
			req.URL.RawQuery = c.Request.URL.RawQuery
		}
		if h.appConfig.Mihomo.APISecret != "" {
			req.Header.Set("Authorization", "Bearer "+h.appConfig.Mihomo.APISecret)
		} else {
			req.Header.Del("Authorization")
		}
	}

	proxy.ModifyResponse = func(r *http.Response) error {
		// Allow CORS from our frontend setup
		r.Header.Set("Access-Control-Allow-Origin", "*")
		return nil
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(fmt.Sprintf(`{"success":false,"error":"%s"}`, err.Error())))
	}

	proxy.ServeHTTP(c.Writer, c.Request)
}

func (h *MihomoHandler) proxyWebsocket(c *gin.Context, targetURL *url.URL) {
	wsScheme := "ws"
	if targetURL.Scheme == "https" {
		wsScheme = "wss"
	}
	upstreamURL := fmt.Sprintf("%s://%s%s", wsScheme, targetURL.Host, targetURL.Path)
	if c.Request.URL.RawQuery != "" {
		upstreamURL += "?" + c.Request.URL.RawQuery
	}

	reqHeader := make(http.Header)
	if h.appConfig.Mihomo.APISecret != "" {
		reqHeader.Set("Authorization", "Bearer "+h.appConfig.Mihomo.APISecret)
	}
	
	dialer := websocket.Dialer{
		HandshakeTimeout: 5 * time.Second,
	}

	upstreamConn, _, err := dialer.Dial(upstreamURL, reqHeader)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Failed to connect upstream websocket: " + err.Error(),
		})
		return
	}
	defer upstreamConn.Close()

	clientConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return // Connection dropped or failed, Upgrader handles response
	}
	defer clientConn.Close()

	errc := make(chan error, 2)
	
	// Copy client -> upstream
	go func() {
		for {
			messageType, p, err := clientConn.ReadMessage()
			if err != nil {
				errc <- err
				return
			}
			if err := upstreamConn.WriteMessage(messageType, p); err != nil {
				errc <- err
				return
			}
		}
	}()
	
	// Copy upstream -> client
	go func() {
		for {
			messageType, p, err := upstreamConn.ReadMessage()
			if err != nil {
				errc <- err
				return
			}
			if err := clientConn.WriteMessage(messageType, p); err != nil {
				errc <- err
				return
			}
		}
	}()
	
	<-errc
}

// GetCoreVersion godoc
// @Summary Get mihomo core version
// @Description Get the version of mihomo core binary (works even when service is not running)
// @Tags Mihomo
// @Produce json
// @Success 200 {object} map[string]interface{} "Core version information"
// @Failure 500 {object} map[string]interface{} "Error message"
// @Router /mihomo/core-version [get]
// GetMemory godoc
// @Summary Get memory usage snapshot
// @Description Get current memory usage from mihomo API
// @Tags Mihomo
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /mihomo/snapshot/memory [get]
func (h *MihomoHandler) GetMemory(c *gin.Context) {
	status := h.mihomoService.GetStatus()
	if status != "running" {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"inuse":   0,
				"oslimit": 0,
			},
		})
		return
	}

	url := h.appConfig.Mihomo.APIURL + "/memory"
	req, err := h.createRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create request: " + err.Error(),
		})
		return
	}

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Failed to connect to Mihomo API: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	payload := parseSSEJSONObject(body)
	if err != nil && len(payload) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to read Mihomo memory response: " + err.Error(),
		})
		return
	}

	var inuse, oslimit int64
	if len(payload) > 0 {
		var memData map[string]any
		if err := json.Unmarshal(payload, &memData); err == nil {
			inuse = parseIntField(memData["inuse"])
			oslimit = parseIntField(memData["oslimit"])
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"inuse":   inuse,
			"oslimit": oslimit,
		},
	})
}

// GetTraffic godoc
// @Summary Get traffic snapshot
// @Description Get current traffic from mihomo API
// @Tags Mihomo
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /mihomo/snapshot/traffic [get]
func (h *MihomoHandler) GetTraffic(c *gin.Context) {
	status := h.mihomoService.GetStatus()
	if status != "running" {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"up": 0, "down": 0}})
		return
	}

	url := h.appConfig.Mihomo.APIURL + "/traffic"
	req, err := h.createRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create request: " + err.Error(),
		})
		return
	}

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Failed to connect to Mihomo API: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	payload := parseSSEJSONObject(body)
	if err != nil && len(payload) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to read Mihomo traffic response: " + err.Error(),
		})
		return
	}

	var up, down int64
	if len(payload) > 0 {
		var trafficData map[string]any
		if err := json.Unmarshal(payload, &trafficData); err == nil {
			up = parseIntField(trafficData["up"])
			down = parseIntField(trafficData["down"])
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"up":   up,
			"down": down,
		},
	})
}

// GetConnectionsSnapshot godoc
// @Summary Get connections snapshot
// @Description Get current connections from mihomo API
// @Tags Mihomo
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /mihomo/snapshot/connections [get]
func (h *MihomoHandler) GetConnectionsSnapshot(c *gin.Context) {
	status := h.mihomoService.GetStatus()
	if status != "running" {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"total": 0, "uploadTotal": 0, "downloadTotal": 0}})
		return
	}

	url := h.appConfig.Mihomo.APIURL + "/connections"
	req, err := h.createRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create request: " + err.Error(),
		})
		return
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Failed to connect to Mihomo API: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	var connData map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&connData); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to decode Mihomo connections response: " + err.Error(),
		})
		return
	}

	total := parseIntField(connData["total"])
	if total == 0 {
		if connections, ok := connData["connections"].([]any); ok {
			total = int64(len(connections))
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"total":         total,
			"uploadTotal":   parseIntField(connData["uploadTotal"]),
			"downloadTotal": parseIntField(connData["downloadTotal"]),
		},
	})
}

// GetTrafficMetrics godoc
// @Summary Get enriched traffic metrics v2
// @Description Aggregate traffic by rule, proxy chain, network, and connection type
// @Tags Mihomo
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /mihomo/metrics/traffic [get]
func (h *MihomoHandler) GetTrafficMetrics(c *gin.Context) {
	status := h.mihomoService.GetStatus()
	zeroPayload := gin.H{
		"downloadTotal": 0,
		"uploadTotal":   0,
		"connections":   0,
		"by_rule":       []gin.H{},
		"by_chain":      []gin.H{},
		"by_network":    []gin.H{},
		"by_type":       []gin.H{},
	}
	if status != "running" {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": zeroPayload})
		return
	}

	url := h.appConfig.Mihomo.APIURL + "/connections"
	req, err := h.createRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create request: " + err.Error(),
		})
		return
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Failed to connect to Mihomo API: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	var connData map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&connData); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to decode Mihomo connections response: " + err.Error(),
		})
		return
	}

	downloadTotal := parseIntField(connData["downloadTotal"])
	uploadTotal := parseIntField(connData["uploadTotal"])
	connections, _ := connData["connections"].([]any)
	totalConns := int64(len(connections))

	type bucket struct {
		Download int64 `json:"download"`
		Upload   int64 `json:"upload"`
		Count    int64 `json:"connections"`
	}

	byRule := make(map[string]*bucket)
	byChain := make(map[string]*bucket)
	byNetwork := make(map[string]*bucket)
	byType := make(map[string]*bucket)

	for _, raw := range connections {
		conn, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		dl := parseIntField(conn["download"])
		ul := parseIntField(conn["upload"])

		meta, _ := conn["metadata"].(map[string]any)
		if meta == nil {
			meta = make(map[string]any)
		}

		rule := fmt.Sprintf("%v", conn["rule"])
		network := fmt.Sprintf("%v", meta["network"])
		connType := fmt.Sprintf("%v", meta["type"])

		chainsRaw, _ := conn["chains"].([]any)
		chain := "DIRECT"
		if len(chainsRaw) > 0 {
			chain = fmt.Sprintf("%v", chainsRaw[len(chainsRaw)-1])
		}

		ensure := func(m map[string]*bucket, key string) *bucket {
			if b, ok := m[key]; ok {
				return b
			}
			b := &bucket{}
			m[key] = b
			return b
		}

		ensure(byRule, rule).Download += dl
		ensure(byRule, rule).Upload += ul
		ensure(byRule, rule).Count++

		ensure(byChain, chain).Download += dl
		ensure(byChain, chain).Upload += ul
		ensure(byChain, chain).Count++

		ensure(byNetwork, network).Download += dl
		ensure(byNetwork, network).Upload += ul
		ensure(byNetwork, network).Count++

		ensure(byType, connType).Download += dl
		ensure(byType, connType).Upload += ul
		ensure(byType, connType).Count++
	}

	flatten := func(m map[string]*bucket) []gin.H {
		out := make([]gin.H, 0, len(m))
		for k, v := range m {
			out = append(out, gin.H{
				"key":         k,
				"download":    v.Download,
				"upload":      v.Upload,
				"connections": v.Count,
			})
		}
		return out
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"downloadTotal": downloadTotal,
			"uploadTotal":   uploadTotal,
			"connections":   totalConns,
			"by_rule":       flatten(byRule),
			"by_chain":      flatten(byChain),
			"by_network":    flatten(byNetwork),
			"by_type":       flatten(byType),
		},
	})
}

// GetConnectionsList godoc
// @Summary Get enriched connections list
// @Description Get all active connections with metadata for search and filtering
// @Tags Mihomo
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /mihomo/metrics/connections [get]
func (h *MihomoHandler) GetConnectionsList(c *gin.Context) {
	status := h.mihomoService.GetStatus()
	if status != "running" {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"connections": []gin.H{}, "downloadTotal": 0, "uploadTotal": 0}})
		return
	}

	url := h.appConfig.Mihomo.APIURL + "/connections"
	req, err := h.createRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create request: " + err.Error(),
		})
		return
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Failed to connect to Mihomo API: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	var connData map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&connData); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to decode Mihomo connections response: " + err.Error(),
		})
		return
	}

	downloadTotal := parseIntField(connData["downloadTotal"])
	uploadTotal := parseIntField(connData["uploadTotal"])
	connections, _ := connData["connections"].([]any)

	type connInfo struct {
		ID              string   `json:"id"`
		Download        int64    `json:"download"`
		Upload          int64    `json:"upload"`
		DownloadDisplay string   `json:"download_display"`
		UploadDisplay   string   `json:"upload_display"`
		Network         string   `json:"network"`
		Type            string   `json:"type"`
		SourceIP        string   `json:"source_ip"`
		SourcePort      int64    `json:"source_port"`
		DestinationIP   string   `json:"destination_ip"`
		DestinationPort int64    `json:"destination_port"`
		Host            string   `json:"host"`
		Rule            string   `json:"rule"`
		RulePayload     string   `json:"rule_payload"`
		Chain           string   `json:"chain"`
		Chains          []string `json:"chains"`
	}

	out := make([]connInfo, 0, len(connections))
	for _, raw := range connections {
		conn, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		dl := parseIntField(conn["download"])
		ul := parseIntField(conn["upload"])

		meta, _ := conn["metadata"].(map[string]any)
		if meta == nil {
			meta = make(map[string]any)
		}

		chainsRaw, _ := conn["chains"].([]any)
		chain := "DIRECT"
		chains := make([]string, 0, len(chainsRaw))
		for _, ch := range chainsRaw {
			chains = append(chains, fmt.Sprintf("%v", ch))
		}
		if len(chains) > 0 {
			chain = chains[len(chains)-1]
		}

		info := connInfo{
			ID:              fmt.Sprintf("%v", conn["id"]),
			Download:        dl,
			Upload:          ul,
			DownloadDisplay: formatBytes(dl),
			UploadDisplay:   formatBytes(ul),
			Network:         fmt.Sprintf("%v", meta["network"]),
			Type:            fmt.Sprintf("%v", meta["type"]),
			SourceIP:        fmt.Sprintf("%v", meta["sourceIP"]),
			SourcePort:      parseIntField(meta["sourcePort"]),
			DestinationIP:   fmt.Sprintf("%v", meta["destinationIP"]),
			DestinationPort: parseIntField(meta["destinationPort"]),
			Host:            fmt.Sprintf("%v", meta["host"]),
			Rule:            fmt.Sprintf("%v", conn["rule"]),
			RulePayload:     fmt.Sprintf("%v", conn["rulePayload"]),
			Chain:           chain,
			Chains:          chains,
		}
		out = append(out, info)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"connections":   out,
			"downloadTotal": downloadTotal,
			"uploadTotal":   uploadTotal,
		},
	})
}

// CloseConnection godoc
// @Summary Close an active connection
// @Description Close a specific connection by ID via Mihomo API
// @Tags Mihomo
// @Param id path string true "Connection ID"
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /mihomo/connections/{id} [delete]
func (h *MihomoHandler) CloseConnection(c *gin.Context) {
	status := h.mihomoService.GetStatus()
	if status != "running" {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Mihomo is not running"})
		return
	}

	connID := c.Param("id")
	url := h.appConfig.Mihomo.APIURL + "/connections/" + connID
	req, err := h.createRequest("DELETE", url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "failed to create request: " + err.Error()})
		return
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "failed to close connection: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, err := io.ReadAll(resp.Body)
		errStr := string(body)
		if err != nil {
			errStr = "failed to read error response: " + err.Error()
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "failed to close connection: " + errStr})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "connection closed"})
}

func (h *MihomoHandler) GetCoreVersion(c *gin.Context) {
	corePath := h.appConfig.Mihomo.CorePath
	if corePath == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "core path not configured",
		})
		return
	}

	cmd := exec.Command(corePath, "-v")
	output, err := cmd.CombinedOutput()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "failed to get core version: " + err.Error(),
		})
		return
	}

	versionStr := strings.TrimSpace(strings.Split(string(output), "\n")[0])
	// Extract just the version number (e.g. "v1.19.27") from "Mihomo Meta v1.19.27 ..."
	parts := strings.Fields(versionStr)
	shortVersion := versionStr
	for _, p := range parts {
		if strings.HasPrefix(p, "v") && len(p) > 1 && p[1] >= '0' && p[1] <= '9' {
			shortVersion = p
			break
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"version": shortVersion,
		},
	})
}

// GetDashboardInfo godoc
// @Summary Get Mihomo dashboard information
// @Description Get external-controller port, secret, and available dashboards from ui directory
// @Tags Mihomo
// @Produce json
// @Success 200 {object} map[string]interface{} "Dashboard information"
// @Failure 500 {object} map[string]interface{} "Error message"
// @Router /mihomo/dashboard-info [get]
func (h *MihomoHandler) GetDashboardInfo(c *gin.Context) {
	uiPath := h.appConfig.Mihomo.WorkingDir + "/ui"
	var availableDashboards []string

	entries, err := os.ReadDir(uiPath)
	if err == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				availableDashboards = append(availableDashboards, entry.Name())
			}
		}
	}

	port := "9090"
	if h.appConfig.Mihomo.APIURL != "" {
		parts := strings.Split(h.appConfig.Mihomo.APIURL, ":")
		if len(parts) >= 3 {
			port = parts[2]
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"port":       port,
			"secret":     h.appConfig.Mihomo.APISecret,
			"dashboards": availableDashboards,
		},
	})
}

// ValidateRouting godoc
// @Summary Validate routing mode configuration
// @Description Validate transparent proxy mode configuration before applying
// @Tags Mihomo
// @Accept json
// @Produce json
// @Param request body config.RoutingConfig true "Routing Configuration"
// @Success 200 {object} map[string]interface{}
// @Router /mihomo/routing/validate [post]
func (h *MihomoHandler) ValidateRouting(c *gin.Context) {
	var req config.RoutingConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	valid, issues := h.mihomoService.ValidateRouting(req)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"valid":  valid,
			"issues": issues,
		},
	})
}