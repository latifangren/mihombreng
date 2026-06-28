package unlocktest

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"os"
	"testing"

	"mihombreng/pkg/config"
)

func TestServiceHTTP(t *testing.T) {
	targetServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Referred-Country", "ID")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("mocked netflix title page"))
	}))
	defer targetServer.Close()

	proxyServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodConnect {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		targetURL, _ := url.Parse(r.URL.String())
		director := func(req *http.Request) {
			req.URL = targetURL
			req.Host = targetURL.Host
		}
		rp := &httputil.ReverseProxy{Director: director}
		rp.ServeHTTP(w, r)
	}))
	defer proxyServer.Close()

	cfg := &config.Config{
		UnlockTest: config.UnlockTestConfig{
			Targets: []config.UnlockTestTargetConfig{
				{
					ID:       "mock-http",
					Name:     "Mock HTTP",
					URL:      targetServer.URL,
					Expected: 200,
					Type:     "http",
				},
			},
		},
	}

	service := NewService(cfg, "")
	
	proxyURL, _ := url.Parse(proxyServer.URL)
	tempFile, err := os.CreateTemp("", "mihome-test-*.yaml")
	if err != nil {
		t.Fatalf("Failed to create temp config file: %v", err)
	}
	defer os.Remove(tempFile.Name())

	configContent := "mixed-port: " + proxyURL.Port() + "\n"
	if _, err := tempFile.Write([]byte(configContent)); err != nil {
		t.Fatalf("Failed to write to temp config file: %v", err)
	}
	tempFile.Close()

	cfg.Mihomo.ConfigPath = tempFile.Name()
	service.configPath = tempFile.Name()

	res := service.RunTest(context.Background(), "mock-http")

	if res.Status != "Yes" {
		t.Errorf("Expected status 'Yes', got '%s' (message: %s)", res.Status, res.Message)
	}

	if res.Region != "ID" {
		t.Errorf("Expected region 'ID', got '%s'", res.Region)
	}
}
