package domain

import "mihombreng/pkg/config"

// MihomoService defines the interface for mihomo core lifecycle operations.
type MihomoService interface {
	GetStatus() string
	GetUptime() int64
	Start() error
	Stop(saveState bool) error
	Restart() error
	RestartWithPreviousRouting(previousRouting config.RoutingConfig) error
	RestoreState() error
	GetAppConfig() *config.MihomoConfig
	UpdateAppConfig(*config.MihomoConfig) error
	GetLogs(lines int) ([]string, error)
	ClearLogs() error
}
