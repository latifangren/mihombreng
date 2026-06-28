package mihomo

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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
