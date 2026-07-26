package mihomo

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"mihombreng/pkg/config"

	"github.com/gin-gonic/gin"
)

type MockMihomoService struct{}

func (m *MockMihomoService) Start() error                                            { return nil }
func (m *MockMihomoService) Stop(saveState bool) error                               { return nil }
func (m *MockMihomoService) Restart() error                                          { return nil }
func (m *MockMihomoService) RestartWithPreviousRouting(r config.RoutingConfig) error { return nil }
func (m *MockMihomoService) RestoreState() error                                    { return nil }
func (m *MockMihomoService) GetAppConfig() *config.MihomoConfig                      { return nil }
func (m *MockMihomoService) UpdateAppConfig(c *config.MihomoConfig) error             { return nil }
func (m *MockMihomoService) GetStatus() string                                       { return "stopped" }
func (m *MockMihomoService) GetUptime() int64                                        { return 0 }
func (m *MockMihomoService) GetLogs(lines int) ([]string, error)                     { return nil, nil }
func (m *MockMihomoService) ClearLogs() error                                        { return nil }
func (m *MockMihomoService) ValidateRouting(r config.RoutingConfig) (bool, []string) { return true, nil }
func (m *MockMihomoService) GetRoutingHealth() (bool, string, int64)                 { return true, "", 0 }
func (m *MockMihomoService) GetDetailedHealth() map[string]interface{}               { return nil }

func TestGetFiles(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tempDir, err := os.MkdirTemp("", "mihombreng-files-test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	configsDir := filepath.Join(tempDir, "configs")
	if err := os.MkdirAll(configsDir, 0755); err != nil {
		t.Fatalf("failed to create configs dir: %v", err)
	}

	dummyFile := filepath.Join(configsDir, "test-config.yaml")
	if err := os.WriteFile(dummyFile, []byte("port: 7890"), 0644); err != nil {
		t.Fatalf("failed to create dummy file: %v", err)
	}

	cfg := &config.Config{
		Mihomo: config.MihomoConfig{
			WorkingDir: tempDir,
		},
	}

	mockService := &MockMihomoService{}
	handler := NewMihomoFilesHandler(mockService, cfg, "")

	router := gin.New()
	router.GET("/mihomo/:dir", handler.GetFiles)

	req, _ := http.NewRequest("GET", "/mihomo/configs", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	vars := make(map[string]any)
	if err := json.Unmarshal(w.Body.Bytes(), &vars); err != nil {
		t.Fatalf("failed to parse response json: %v", err)
	}

	success, ok := vars["success"].(bool)
	if !ok || !success {
		t.Error("expected success to be true")
	}

	data, ok := vars["data"].([]any)
	if !ok || len(data) != 1 || data[0] != "test-config.yaml" {
		t.Errorf("expected data to contain ['test-config.yaml'], got %v", vars["data"])
	}

	reqInvalid, _ := http.NewRequest("GET", "/mihomo/invalid_dir_name", nil)
	wInvalid := httptest.NewRecorder()
	router.ServeHTTP(wInvalid, reqInvalid)

	if wInvalid.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for invalid dir, got %d", wInvalid.Code)
	}
}

func TestAutoFixConfig(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cfg := &config.Config{}
	mockService := &MockMihomoService{}
	handler := NewMihomoFilesHandler(mockService, cfg, "")

	router := gin.New()
	router.POST("/mihomo/configs/autofix", handler.AutoFixConfig)

	body := `{"content": "port: 7890\nproxies: []"}`
	req, _ := http.NewRequest("POST", "/mihomo/configs/autofix", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var res struct {
		Success bool `json:"success"`
		Data    struct {
			Content      string   `json:"content"`
			AppliedFixes []string `json:"applied_fixes"`
		} `json:"data"`
	}

	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if !res.Success {
		t.Error("expected success to be true")
	}

	if len(res.Data.AppliedFixes) != 3 {
		t.Errorf("expected 3 applied fixes, got %d: %v", len(res.Data.AppliedFixes), res.Data.AppliedFixes)
	}

	if !strings.Contains(res.Data.Content, "external-controller: 127.0.0.1:9090") {
		t.Errorf("expected content to contain external-controller, got:\n%s", res.Data.Content)
	}
	if !strings.Contains(res.Data.Content, "mode: rule") {
		t.Errorf("expected content to contain mode, got:\n%s", res.Data.Content)
	}
}
