package stream

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"mihombreng/internal/domain"
	"mihombreng/pkg/apperror"
	"mihombreng/pkg/config"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type StreamHandler struct {
	config        *config.Config
	mihomoService domain.MihomoService
}

type LogStreamEvent struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	Source    string `json:"source"`
	Level     string `json:"level,omitempty"`
	Message   string `json:"message,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
	Raw       string `json:"raw,omitempty"`
	Status    string `json:"status,omitempty"`
	Code      string `json:"code,omitempty"`
}

var logEventCounter uint64

var (
	logLevelPattern   = regexp.MustCompile(`\blevel=("([^"]+)"|'([^']+)'|(\S+))`)
	logMessagePattern = regexp.MustCompile(`\bmsg=("([^"]+)"|'([^']+)'|(.*?))(?:\s+\w+=|$)`)
	logTimePattern    = regexp.MustCompile(`\btime=("([^"]+)"|'([^']+)'|(\S+))`)
)

func NewStreamHandler(cfg *config.Config, mihomoService domain.MihomoService) *StreamHandler {
	return &StreamHandler{
		config:        cfg,
		mihomoService: mihomoService,
	}
}

func (h *StreamHandler) StreamMihomoLogs(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	_ = h.writeStatus(conn, "mihomo", "connecting", "stream_open", "Connecting to Mihomo log stream")

	status := h.mihomoService.GetStatus()
	if status != "running" {
		_ = h.writeStatus(conn, "mihomo", "error", "mihomo_not_running", "Mihomo is not running")
		return
	}

	h.streamMihomoAPI(c, conn, "/logs", "mihomo")
}

func (h *StreamHandler) StreamAppLogs(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	_ = h.writeStatus(conn, "app", "connecting", "stream_open", "Connecting to application log stream")

	logFile := h.config.Logging.File
	h.streamLogFile(c, conn, logFile)
}

func (h *StreamHandler) ClearMihomoLogs(c *gin.Context) {
	if err := h.mihomoService.ClearLogs(); err != nil {
		c.JSON(apperror.ErrorStatus(err), gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Mihomo logs cleared successfully"})
}

func (h *StreamHandler) ClearAppLogs(c *gin.Context) {
	logFile := h.config.Logging.File
	if logFile == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "log file not configured"})
		return
	}

	file, err := os.OpenFile(logFile, os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to clear log file"})
		return
	}
	defer file.Close()

	c.JSON(http.StatusOK, gin.H{"message": "Application logs cleared successfully"})
}

func (h *StreamHandler) streamLogFile(c *gin.Context, conn *websocket.Conn, logFile string) {
	if logFile == "" {
		_ = h.writeStatus(conn, "app", "error", "log_file_not_configured", "Application log file is not configured")
		return
	}

	if _, err := os.Stat(logFile); os.IsNotExist(err) {
		_ = h.writeStatus(conn, "app", "error", "log_file_missing", "Application log file does not exist: "+logFile)
		return
	}

	file, err := os.Open(logFile)
	if err != nil {
		_ = h.writeStatus(conn, "app", "error", "log_file_open_failed", "Failed to open application log file: "+err.Error())
		return
	}
	defer file.Close()

	_ = h.writeStatus(conn, "app", "connected", "stream_ready", "Streaming application logs")

	stat, err := file.Stat()
	if err == nil {
		fileSize := stat.Size()
		startPos := int64(0)
		if fileSize > 4096 {
			startPos = fileSize - 4096
		}

		_, err = file.Seek(startPos, io.SeekStart)
		if err == nil {
			initialData := make([]byte, fileSize-startPos)
			n, err := file.Read(initialData)
			if err == nil && n > 0 {
				lines := strings.Split(string(initialData[:n]), "\n")
				startIdx := 0
				if startPos > 0 && len(lines) > 0 {
					startIdx = 1
				}

				for i := startIdx; i < len(lines); i++ {
					line := strings.TrimSpace(lines[i])
					if line != "" {
						if err := h.writeLogLine(conn, "app", line); err != nil {
							return
						}
					}
				}
			}
		}
	}

	currentSize, err := file.Seek(0, io.SeekEnd)
	if err != nil {
		return
	}

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			stat, err := file.Stat()
			if err != nil {
				_ = h.writeStatus(conn, "app", "error", "log_file_stat_failed", "Failed to stat application log file")
				return
			}

			if stat.Size() < currentSize {
				_, _ = file.Seek(0, io.SeekStart)
				currentSize = 0
				_ = h.writeStatus(conn, "app", "warning", "log_file_rotated", "Application log file rotated or truncated; resyncing stream")
			}

			if stat.Size() == currentSize {
				continue
			}

			newData := make([]byte, stat.Size()-currentSize)
			n, err := file.Read(newData)
			if err != nil && err != io.EOF {
				_ = h.writeStatus(conn, "app", "error", "log_file_read_failed", "Failed to read application log file")
				return
			}

			if n > 0 {
				lines := strings.Split(string(newData[:n]), "\n")
				for _, line := range lines {
					line = strings.TrimSpace(line)
					if line != "" {
						if err := h.writeLogLine(conn, "app", line); err != nil {
							return
						}
					}
				}
				currentSize = stat.Size()
			}

		case <-c.Request.Context().Done():
			return
		}
	}
}

func (h *StreamHandler) StreamTraffic(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	status := h.mihomoService.GetStatus()
	if status != "running" {
		_ = h.writeStatus(conn, "mihomo", "error", "mihomo_not_running", "Mihomo is not running")
		return
	}

	h.streamMihomoAPI(c, conn, "/traffic", "traffic")
}

func (h *StreamHandler) StreamMemory(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	status := h.mihomoService.GetStatus()
	if status != "running" {
		_ = h.writeStatus(conn, "mihomo", "error", "mihomo_not_running", "Mihomo is not running")
		return
	}

	h.streamMihomoAPI(c, conn, "/memory", "memory")
}

func (h *StreamHandler) StreamConnections(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	status := h.mihomoService.GetStatus()
	if status != "running" {
		conn.WriteMessage(websocket.TextMessage, []byte("ERROR: mihomo is not running"))
		return
	}

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			requestURL := h.withSecret(h.config.Mihomo.APIURL + "/connections")
			req, err := h.createRequest("GET", requestURL)
			if err != nil {
				continue
			}

			client := &http.Client{Timeout: 5 * time.Second}
			resp, err := client.Do(req)
			if err != nil {
				continue
			}

			body, err := io.ReadAll(resp.Body)
			resp.Body.Close()
			if err != nil {
				continue
			}

			if err := conn.WriteMessage(websocket.TextMessage, body); err != nil {
				return
			}

		case <-c.Request.Context().Done():
			return
		}
	}
}

func (h *StreamHandler) withSecret(rawURL string) string {
	if h.config.Mihomo.APISecret == "" {
		return rawURL
	}

	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}

	query := parsedURL.Query()
	query.Set("secret", h.config.Mihomo.APISecret)
	parsedURL.RawQuery = query.Encode()
	return parsedURL.String()
}

func (h *StreamHandler) createRequest(method, rawURL string) (*http.Request, error) {
	req, err := http.NewRequest(method, rawURL, nil)
	if err != nil {
		return nil, err
	}

	if h.config.Mihomo.APISecret != "" {
		req.Header.Set("Authorization", "Bearer "+h.config.Mihomo.APISecret)
	}
	return req, nil
}

func normalizeSSELine(line string) string {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, ":") {
		return ""
	}
	if strings.HasPrefix(line, "data:") {
		line = strings.TrimSpace(strings.TrimPrefix(line, "data:"))
	}
	return line
}

func splitStreamPayload(data []byte) []string {
	chunks := strings.FieldsFunc(string(data), func(r rune) bool {
		return r == '\n' || r == '\r'
	})
	lines := make([]string, 0, len(chunks))
	for _, chunk := range chunks {
		line := normalizeSSELine(chunk)
		if line != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

func eventID(prefix string) string {
	id := atomic.AddUint64(&logEventCounter, 1)
	return prefix + "-" + time.Now().UTC().Format("20060102T150405.000000000Z07:00") + "-" + strconv.FormatUint(id, 10)
}

func (h *StreamHandler) writeEvent(conn *websocket.Conn, event LogStreamEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		fallback := `{"kind":"status","source":"system","level":"error","message":"failed to encode stream event","status":"error","code":"encode_error"}`
		return conn.WriteMessage(websocket.TextMessage, []byte(fallback))
	}
	return conn.WriteMessage(websocket.TextMessage, payload)
}

func parseLogFields(raw string) (level string, message string, timestamp string) {
	trimmed := strings.TrimSpace(raw)
	level = "info"
	message = trimmed
	timestamp = time.Now().UTC().Format(time.RFC3339Nano)

	if trimmed == "" {
		return level, "", timestamp
	}

	if strings.HasPrefix(trimmed, "ERROR:") {
		return "error", trimmed, timestamp
	}

	levelMatch := logLevelPattern.FindStringSubmatch(trimmed)
	messageMatch := logMessagePattern.FindStringSubmatch(trimmed)
	timeMatch := logTimePattern.FindStringSubmatch(trimmed)

	if levelMatch != nil {
		for _, idx := range []int{2, 3, 4} {
			if idx < len(levelMatch) && levelMatch[idx] != "" {
				level = levelMatch[idx]
				break
			}
		}
	}

	if messageMatch != nil {
		for _, idx := range []int{2, 3, 4} {
			if idx < len(messageMatch) && strings.TrimSpace(messageMatch[idx]) != "" {
				message = strings.TrimSpace(messageMatch[idx])
				break
			}
		}
	}

	if timeMatch != nil {
		for _, idx := range []int{2, 3, 4} {
			if idx < len(timeMatch) && timeMatch[idx] != "" {
				timestamp = timeMatch[idx]
				break
			}
		}
	}

	return level, message, timestamp
}

func (h *StreamHandler) writeLogLine(conn *websocket.Conn, source string, raw string) error {
	level, message, timestamp := parseLogFields(raw)
	if strings.TrimSpace(message) == "" {
		return nil
	}

	return h.writeEvent(conn, LogStreamEvent{
		ID:        eventID(source),
		Kind:      "log",
		Source:    source,
		Level:     strings.ToLower(level),
		Message:   message,
		Timestamp: timestamp,
		Raw:       strings.TrimSpace(raw),
	})
}

func (h *StreamHandler) writeStatus(conn *websocket.Conn, source string, status string, code string, message string) error {
	return h.writeEvent(conn, LogStreamEvent{
		ID:        eventID(source),
		Kind:      "status",
		Source:    source,
		Level:     map[bool]string{true: "error", false: "info"}[status == "error"],
		Message:   message,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Status:    status,
		Code:      code,
	})
}

func (h *StreamHandler) streamMihomoAPI(c *gin.Context, conn *websocket.Conn, endpoint string, source string) {
	requestURL := h.withSecret(h.config.Mihomo.APIURL + endpoint)

	req, err := h.createRequest("GET", requestURL)
	if err != nil {
		_ = h.writeStatus(conn, source, "error", "request_create_failed", "Failed to create Mihomo stream request: "+err.Error())
		return
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		_ = h.writeStatus(conn, source, "error", "connect_failed", "Failed to connect to Mihomo API: "+err.Error())
		return
	}
	defer resp.Body.Close()

	_ = h.writeStatus(conn, source, "connected", "stream_ready", "Streaming Mihomo "+strings.TrimPrefix(endpoint, "/"))

	reader := io.Reader(resp.Body)
	buf := make([]byte, 4096)

	for {
		select {
		case <-c.Request.Context().Done():
			return
		default:
			n, err := reader.Read(buf)
			if err != nil {
				if err != io.EOF {
					_ = h.writeStatus(conn, source, "error", "stream_read_failed", "Failed to read from Mihomo stream")
				}
				return
			}

			if n > 0 {
				for _, line := range splitStreamPayload(buf[:n]) {
					if err := h.writeLogLine(conn, source, line); err != nil {
						return
					}
				}
			}
		}
	}
}
