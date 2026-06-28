package backup

import (
	"fmt"
	"io"
	"time"
)

// Target defines the interface for remote backup targets
type Target interface {
	Name() string
	Type() string
	TestConnection() error
	Upload(filename string, reader io.Reader) error
	List() ([]RemoteEntry, error)
	Delete(filename string) error
	GetLastSync() SyncStatus
}

type RemoteEntry struct {
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
	Modified string `json:"modified"`
}

type SyncStatus struct {
	LastSyncTime  string `json:"last_sync_time"`
	LastSyncError string `json:"last_sync_error"`
	SyncCount     int    `json:"sync_count"`
	TotalUploaded int64  `json:"total_uploaded"`
}

type TargetConfig struct {
	Name     string `yaml:"name"`
	Type     string `yaml:"type"`
	URL      string `yaml:"url"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
	Enabled  bool   `yaml:"enabled"`
}

func NewTarget(cfg TargetConfig) (Target, error) {
	switch cfg.Type {
	case "webdav":
		return NewWebDAVTarget(cfg), nil
	default:
		return nil, fmt.Errorf("unsupported target type: %s", cfg.Type)
	}
}

// SyncRecord tracks sync operations for reporting
type SyncRecord struct {
	StartTime  time.Time
	EndTime    time.Time
	Filename   string
	Bytes      int64
	Error      error
}
