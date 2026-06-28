package unlocktest

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"mihombreng/pkg/config"
	"mihombreng/pkg/logger"

	"golang.org/x/net/proxy"
	"gopkg.in/yaml.v3"
)

type UnlockResult struct {
	ID        string    `json:"id"`
	Status    string    `json:"status"` // "Yes", "No", "Failed"
	Region    string    `json:"region,omitempty"`
	CheckedAt time.Time `json:"checked_at"`
	Message   string    `json:"message,omitempty"`
}

type Service struct {
	mu         sync.RWMutex
	appConfig  *config.Config
	configPath string
	results    map[string]UnlockResult
}

func NewService(cfg *config.Config, configPath string) *Service {
	return &Service{
		appConfig:  cfg,
		configPath: configPath,
		results:    make(map[string]UnlockResult),
	}
}

func (s *Service) GetTargets() []config.UnlockTestTargetConfig {
	if s.appConfig == nil {
		return nil
	}
	return s.appConfig.UnlockTest.Targets
}

func (s *Service) RunAll(ctx context.Context) ([]UnlockResult, error) {
	targets := s.GetTargets()
	results := make([]UnlockResult, len(targets))
	
	var wg sync.WaitGroup
	for i, t := range targets {
		wg.Add(1)
		go func(idx int, target config.UnlockTestTargetConfig) {
			defer wg.Done()
			res := s.RunTest(ctx, target.ID)
			results[idx] = res
		}(i, t)
	}
	wg.Wait()
	return results, nil
}

func (s *Service) RunTest(ctx context.Context, id string) UnlockResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	var target config.UnlockTestTargetConfig
	found := false
	for _, t := range s.GetTargets() {
		if t.ID == id {
			target = t
			found = true
			break
		}
	}

	if !found {
		res := UnlockResult{
			ID:        id,
			Status:    "Failed",
			CheckedAt: time.Now(),
			Message:   "Target config not found",
		}
		s.results[id] = res
		return res
	}

	proxyStr := s.getProxyAddr()
	proxyURL, err := url.Parse(proxyStr)
	if err != nil {
		logger.Errorf("UnlockTest: invalid proxy addr: %v", err)
		proxyURL, _ = url.Parse("http://127.0.0.1:7890")
	}

	var res UnlockResult
	switch target.Type {
	case "http", "":
		res = s.probeHTTP(ctx, target, proxyURL)
	case "tcp":
		res = s.probeTCP(ctx, target, proxyURL)
	case "dns":
		res = s.probeDNS(ctx, target, proxyURL)
	default:
		res = UnlockResult{
			ID:        id,
			Status:    "Failed",
			CheckedAt: time.Now(),
			Message:   fmt.Sprintf("unsupported test type: %s", target.Type),
		}
	}

	s.results[id] = res
	return res
}

func (s *Service) getProxyAddr() string {
	if s.appConfig == nil {
		return "http://127.0.0.1:7890"
	}
	return getMihomoProxyURL(s.appConfig.Mihomo.ConfigPath)
}

func (s *Service) probeHTTP(ctx context.Context, target config.UnlockTestTargetConfig, proxyURL *url.URL) UnlockResult {
	transport := &http.Transport{
		Proxy:           http.ProxyURL(proxyURL),
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		DialContext: (&net.Dialer{
			Timeout:   5 * time.Second,
			KeepAlive: 5 * time.Second,
		}).DialContext,
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   6 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}

	req, err := http.NewRequestWithContext(ctx, "GET", target.URL, nil)
	if err != nil {
		return UnlockResult{
			ID:        target.ID,
			Status:    "Failed",
			CheckedAt: time.Now(),
			Message:   err.Error(),
		}
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")

	resp, err := client.Do(req)
	if err != nil {
		return UnlockResult{
			ID:        target.ID,
			Status:    "Failed",
			CheckedAt: time.Now(),
			Message:   err.Error(),
		}
	}
	defer resp.Body.Close()

	expectedCode := target.Expected
	if expectedCode == 0 {
		expectedCode = 200
	}

	status := "No"
	if resp.StatusCode == expectedCode || (expectedCode == 200 && resp.StatusCode >= 200 && resp.StatusCode < 400) {
		status = "Yes"
	}

	if target.ID == "netflix" {
		if resp.StatusCode == 200 {
			status = "Yes"
		} else if resp.StatusCode == 404 || resp.StatusCode == 403 {
			status = "No"
		}
	}

	region := extractRegionCode(resp, req.URL.String())

	return UnlockResult{
		ID:        target.ID,
		Status:    status,
		Region:    region,
		CheckedAt: time.Now(),
		Message:   fmt.Sprintf("HTTP %d", resp.StatusCode),
	}
}

func (s *Service) probeTCP(ctx context.Context, target config.UnlockTestTargetConfig, proxyURL *url.URL) UnlockResult {
	host := target.Host
	if host == "" {
		return UnlockResult{
			ID:        target.ID,
			Status:    "Failed",
			CheckedAt: time.Now(),
			Message:   "Host parameter required for TCP test",
		}
	}

	var conn net.Conn
	var err error

	dialerCtx := &net.Dialer{Timeout: 5 * time.Second}

	if proxyURL.Scheme == "socks5" {
		var socksDialer proxy.Dialer
		socksDialer, err = proxy.SOCKS5("tcp", proxyURL.Host, nil, proxy.Direct)
		if err == nil {
			conn, err = socksDialer.Dial("tcp", host)
		}
	} else {
		conn, err = dialHTTPProxy(proxyURL.Host, host)
	}

	if err != nil {
		conn, err = dialerCtx.DialContext(ctx, "tcp", host)
		if err != nil {
			return UnlockResult{
				ID:        target.ID,
				Status:    "No",
				CheckedAt: time.Now(),
				Message:   err.Error(),
			}
		}
		defer conn.Close()
		return UnlockResult{
			ID:        target.ID,
			Status:    "Yes",
			CheckedAt: time.Now(),
			Message:   "Connected (direct fallback)",
		}
	}
	defer conn.Close()

	return UnlockResult{
		ID:        target.ID,
		Status:    "Yes",
		CheckedAt: time.Now(),
		Message:   "Connected",
	}
}

func (s *Service) probeDNS(ctx context.Context, target config.UnlockTestTargetConfig, proxyURL *url.URL) UnlockResult {
	host := target.Host
	if host == "" {
		host = "8.8.8.8:53"
	}
	if !strings.Contains(host, ":") {
		host = host + ":53"
	}

	var conn net.Conn
	var err error

	if proxyURL.Scheme == "socks5" {
		var socksDialer proxy.Dialer
		socksDialer, err = proxy.SOCKS5("tcp", proxyURL.Host, nil, proxy.Direct)
		if err == nil {
			conn, err = socksDialer.Dial("tcp", host)
		}
	} else {
		conn, err = dialHTTPProxy(proxyURL.Host, host)
	}

	if err != nil {
		return UnlockResult{
			ID:        target.ID,
			Status:    "No",
			CheckedAt: time.Now(),
			Message:   err.Error(),
		}
	}
	defer conn.Close()

	return UnlockResult{
		ID:        target.ID,
		Status:    "Yes",
		CheckedAt: time.Now(),
		Message:   "DNS TCP Connected",
	}
}

func dialHTTPProxy(proxyHost, targetHost string) (net.Conn, error) {
	conn, err := net.DialTimeout("tcp", proxyHost, 5*time.Second)
	if err != nil {
		return nil, err
	}

	reqStr := fmt.Sprintf("CONNECT %s HTTP/1.1\r\nHost: %s\r\n\r\n", targetHost, targetHost)
	if _, err := conn.Write([]byte(reqStr)); err != nil {
		conn.Close()
		return nil, err
	}

	respBuf := make([]byte, 1024)
	n, err := conn.Read(respBuf)
	if err != nil {
		conn.Close()
		return nil, err
	}

	respStr := string(respBuf[:n])
	if !strings.Contains(respStr, "200 Connection established") && !strings.Contains(respStr, "200 OK") {
		conn.Close()
		return nil, fmt.Errorf("proxy connection failed: %s", strings.Split(respStr, "\r\n")[0])
	}

	return conn, nil
}

func extractRegionCode(resp *http.Response, finalURL string) string {
	for _, h := range []string{"X-Referred-Country", "CF-IPCountry", "X-Country-Code", "X-CDN-Geo"} {
		if val := resp.Header.Get(h); val != "" {
			return strings.ToUpper(val)
		}
	}

	locationURL := resp.Header.Get("Location")
	if locationURL != "" {
		if code := parseURLRegion(locationURL); code != "" {
			return code
		}
	}

	return parseURLRegion(finalURL)
}

func parseURLRegion(uri string) string {
	path := strings.ToLower(uri)
	re := regexp.MustCompile(`/([a-z]{2})(?:-[a-z]{2})?/`)
	matches := re.FindStringSubmatch(path)
	if len(matches) > 1 {
		code := strings.ToUpper(matches[1])
		if code == "TV" || code == "EN" || code == "ES" || code == "RU" {
			return ""
		}
		return code
	}
	return ""
}

func getMihomoProxyURL(configPath string) string {
	if configPath == "" {
		return "http://127.0.0.1:7890"
	}
	data, err := os.ReadFile(configPath)
	if err != nil {
		return "http://127.0.0.1:7890"
	}
	var m map[string]interface{}
	if err := yaml.Unmarshal(data, &m); err != nil {
		return "http://127.0.0.1:7890"
	}

	if mp, ok := m["mixed-port"]; ok {
		if portVal, err := getPortString(mp); err == nil {
			return "http://127.0.0.1:" + portVal
		}
	}
	if p, ok := m["port"]; ok {
		if portVal, err := getPortString(p); err == nil {
			return "http://127.0.0.1:" + portVal
		}
	}
	if sp, ok := m["socks-port"]; ok {
		if portVal, err := getPortString(sp); err == nil {
			return "socks5://127.0.0.1:" + portVal
		}
	}
	return "http://127.0.0.1:7890"
}

func getPortString(v interface{}) (string, error) {
	switch val := v.(type) {
	case int:
		return fmt.Sprintf("%d", val), nil
	case float64:
		return fmt.Sprintf("%d", int(val)), nil
	case string:
		return val, nil
	default:
		return "", fmt.Errorf("invalid type")
	}
}
