package service

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"mihombreng/internal/domain"
	"mihombreng/pkg/apperror"
	"mihombreng/pkg/config"
	"mihombreng/pkg/logger"

	"github.com/vishvananda/netlink"
)

type MihomoService struct {
	appConfig       *config.Config
	configPath      string
	nftablesService domain.NftablesService
	startTime       time.Time
}

func NewMihomoService(appConfig *config.Config, configPath string, nftablesService domain.NftablesService) *MihomoService {
	return &MihomoService{
		appConfig:       appConfig,
		configPath:      configPath,
		nftablesService: nftablesService,
	}
}

func (s *MihomoService) GetStatus() string {
	pidFile := filepath.Join(s.appConfig.Mihomo.WorkingDir, "mihomo.pid")
	pidData, err := os.ReadFile(pidFile)
	if err != nil {
		return "stopped"
	}

	var pid int
	_, err = fmt.Sscanf(string(pidData), "%d", &pid)
	if err != nil {
		return "stopped"
	}

	process, err := os.FindProcess(pid)
	if err != nil {
		return "stopped"
	}

	err = process.Signal(syscall.Signal(0))
	if err != nil {
		os.Remove(pidFile)
		return "stopped"
	}

	return "running"
}

func (s *MihomoService) GetUptime() int64 {
	if s.GetStatus() != "running" || s.startTime.IsZero() {
		return 0
	}
	return int64(time.Since(s.startTime).Seconds())
}

func (s *MihomoService) killExistingMihomo() error {
	pidFile := filepath.Join(s.appConfig.Mihomo.WorkingDir, "mihomo.pid")
	pidData, err := os.ReadFile(pidFile)
	if err != nil {
		logger.Debug("No existing mihomo PID file found")
		return nil
	}

	var pid int
	_, err = fmt.Sscanf(string(pidData), "%d", &pid)
	if err != nil {
		logger.Warnf("Invalid PID file format, removing: %v", err)
		os.Remove(pidFile)
		return nil
	}

	process, err := os.FindProcess(pid)
	if err != nil {
		logger.Debugf("Process %d not found, removing stale PID file", pid)
		os.Remove(pidFile)
		return nil
	}

	err = process.Signal(syscall.Signal(0))
	if err == nil {
		logger.Infof("Killing existing mihomo process (PID: %d)", pid)
		if err := process.Kill(); err != nil {
			return fmt.Errorf("failed to kill existing mihomo process: %w", err)
		}
		if err := os.Remove(pidFile); err != nil {
			return fmt.Errorf("failed to remove old pid file: %w", err)
		}
		logger.Info("Existing mihomo process killed successfully")
	}

	return nil
}

func (s *MihomoService) Start() error {
	logger.Info("Starting mihomo service")

	if err := s.killExistingMihomo(); err != nil {
		logger.Errorf("Failed to kill existing mihomo: %v", err)
		return fmt.Errorf("failed to kill existing mihomo: %w", err)
	}

	logger.Debug("Adjusting mihomo configuration")
	if err := s.adjustMihomoConfig(); err != nil {
		logger.Errorf("Failed to adjust mihomo config: %v", err)
		return fmt.Errorf("failed to adjust mihomo config: %w", err)
	}

	if s.appConfig.Mihomo.LogFile != "" {
		if _, err := os.Stat(s.appConfig.Mihomo.LogFile); err == nil {
			logger.Debug("Clearing old mihomo log file")
			if err := os.Remove(s.appConfig.Mihomo.LogFile); err != nil {
				logger.Warnf("Failed to clear old log file: %v", err)
				return fmt.Errorf("failed to clear old log file: %w", err)
			}
		}
	}

	shouldSetupRouting := s.shouldSetupRouting()

	logger.Debugf("Starting mihomo core: %s", s.appConfig.Mihomo.CorePath)
	cmd := exec.Command(s.appConfig.Mihomo.CorePath,
		"-d", s.appConfig.Mihomo.WorkingDir,
		"-f", s.appConfig.Mihomo.ConfigPath)

	if s.appConfig.Mihomo.LogFile != "" {
		logFile, err := os.OpenFile(s.appConfig.Mihomo.LogFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			logger.Errorf("Failed to open log file: %v", err)
			return fmt.Errorf("failed to open log file: %w", err)
		}
		cmd.Stdout = logFile
		cmd.Stderr = logFile
	}

	err := cmd.Start()
	if err != nil {
		logger.Errorf("Failed to start mihomo: %v", err)
		return fmt.Errorf("failed to start mihomo: %w", err)
	}

	s.startTime = time.Now()

	pidFile := filepath.Join(s.appConfig.Mihomo.WorkingDir, "mihomo.pid")
	if err = os.WriteFile(pidFile, []byte(fmt.Sprintf("%d", cmd.Process.Pid)), 0644); err != nil {
		cmd.Process.Kill()
		logger.Errorf("Failed to write PID file: %v", err)
		return fmt.Errorf("failed to write pid file: %w", err)
	}
	logger.Infof("Mihomo process started (PID: %d)", cmd.Process.Pid)

	if shouldSetupRouting {
		logger.Debug("Waiting for mihomo to be ready")
		if err := s.waitForMihomoReady(); err != nil {
			cmd.Process.Kill()
			os.Remove(pidFile)
			logger.Errorf("Mihomo not ready: %v", err)
			return fmt.Errorf("mihomo not ready: %w", err)
		}

		logger.Debug("Setting up routing")
		err = s.nftablesService.SetupRouting(s.appConfig.Mihomo.Routing)
		if err != nil {
			cmd.Process.Kill()
			os.Remove(pidFile)
			logger.Errorf("Failed to setup routing: %v", err)
			return fmt.Errorf("failed to setup routing: %w", err)
		}
	}

	s.appConfig.Mihomo.AutoStart = true
	if err := s.appConfig.Save(s.configPath); err != nil {
		logger.Warnf("Failed to save auto_start state: %v", err)
	}

	logger.Info("Mihomo service started successfully")
	return nil
}

func (s *MihomoService) Stop(saveState bool) error {
	return s.stopWithRoutingCleanup(saveState, s.appConfig.Mihomo.Routing)
}

func (s *MihomoService) stopWithRoutingCleanup(saveState bool, cleanupRouting config.RoutingConfig) error {
	logger.Info("Stopping mihomo service")

	if s.GetStatus() == "stopped" {
		logger.Warn("Mihomo is already stopped")
		return apperror.NotRunning("mihomo is not running")
	}

	pidFile := filepath.Join(s.appConfig.Mihomo.WorkingDir, "mihomo.pid")
	pidData, err := os.ReadFile(pidFile)
	if err != nil {
		logger.Errorf("Failed to read PID file: %v", err)
		return fmt.Errorf("failed to read pid file: %w", err)
	}

	var pid int
	_, err = fmt.Sscanf(string(pidData), "%d", &pid)
	if err != nil {
		logger.Errorf("Failed to parse PID: %v", err)
		return fmt.Errorf("failed to parse pid: %w", err)
	}

	process, err := os.FindProcess(pid)
	if err != nil {
		logger.Errorf("Failed to find process %d: %v", pid, err)
		return fmt.Errorf("failed to find process: %w", err)
	}

	logger.Debugf("Killing mihomo process (PID: %d)", pid)
	err = process.Kill()
	if err != nil {
		handled := errors.Is(err, os.ErrProcessDone) || errors.Is(err, syscall.ESRCH)

		var pathErr *os.PathError
		if !handled && errors.As(err, &pathErr) && errors.Is(pathErr.Err, syscall.ESRCH) {
			handled = true
		}
		var sysErr *os.SyscallError
		if !handled && errors.As(err, &sysErr) && errors.Is(sysErr.Err, syscall.ESRCH) {
			handled = true
		}
		if !handled {
			logger.Errorf("Failed to kill process: %v", err)
			return fmt.Errorf("failed to kill process: %w", err)
		}
	}

	err = os.Remove(pidFile)
	if err != nil {
		logger.Warnf("Failed to remove PID file: %v", err)
		return fmt.Errorf("failed to remove pid file: %w", err)
	}

	s.startTime = time.Time{}

	if shouldSetupRoutingFor(cleanupRouting) {
		logger.Debug("Cleaning up routing")
		s.nftablesService.CleanupAllRouting()
	}

	if saveState {
		logger.Debug("Saving auto_start state to config")
		s.appConfig.Mihomo.AutoStart = false
		if err := s.appConfig.Save(s.configPath); err != nil {
			logger.Warnf("Failed to save auto_start state: %v", err)
		}
	}

	logger.Info("Mihomo service stopped successfully")
	return nil
}

func (s *MihomoService) Restart() error {
	return s.RestartWithPreviousRouting(s.appConfig.Mihomo.Routing)
}

func (s *MihomoService) RestartWithPreviousRouting(previousRouting config.RoutingConfig) error {
	logger.Info("Restarting mihomo service")
	err := s.stopWithRoutingCleanup(false, previousRouting)
	if err != nil && s.GetStatus() != "stopped" {
		logger.Errorf("Failed to stop mihomo: %v", err)
		return fmt.Errorf("failed to stop mihomo: %w", err)
	}

	return s.Start()
}

func (s *MihomoService) GetAppConfig() *config.MihomoConfig {
	return &s.appConfig.Mihomo
}

func (s *MihomoService) UpdateAppConfig(newConfig *config.MihomoConfig) error {
	s.appConfig.Mihomo = *newConfig

	if s.GetStatus() == "running" {
		return s.Restart()
	}

	return nil
}

func (s *MihomoService) RestoreState() error {
	logger.Debug("Checking auto_start state")
	if s.appConfig.Mihomo.AutoStart {
		logger.Info("Auto-start is enabled, checking mihomo status")
		if s.GetStatus() == "stopped" {
			logger.Info("Mihomo is stopped, starting automatically")
			return s.Start()
		}
		logger.Info("Mihomo is already running")
	} else {
		logger.Debug("Auto-start is disabled")
	}
	return nil
}

func shouldSetupRoutingFor(routing config.RoutingConfig) bool {
	return routing.TCP != config.RoutingModeDisable || routing.UDP != config.RoutingModeDisable
}

func (s *MihomoService) shouldSetupRouting() bool {
	return shouldSetupRoutingFor(s.appConfig.Mihomo.Routing)
}

func (s *MihomoService) waitForMihomoReady() error {
	pidFile := filepath.Join(s.appConfig.Mihomo.WorkingDir, "mihomo.pid")
	maxWait := 10 * time.Second
	checkInterval := 500 * time.Millisecond
	elapsed := time.Duration(0)

	needTUN := s.appConfig.Mihomo.Routing.TCP == config.RoutingModeTUN ||
		s.appConfig.Mihomo.Routing.UDP == config.RoutingModeTUN

	if needTUN {
		logger.Debug("Waiting for TUN interface to be ready")
	} else {
		logger.Debug("Waiting for mihomo process to be ready")
	}

	for elapsed < maxWait {
		pidData, err := os.ReadFile(pidFile)
		if err == nil {
			var pid int
			if _, err := fmt.Sscanf(string(pidData), "%d", &pid); err == nil {
				process, err := os.FindProcess(pid)
				if err == nil {
					if err := process.Signal(syscall.Signal(0)); err == nil {
						if needTUN {
							tunDevice := s.appConfig.Mihomo.Routing.TunDevice
							if tunDevice == "" {
								tunDevice = "Meta"
							}
							_, err := netlink.LinkByName(tunDevice)
							if err == nil {
								logger.Info("TUN interface is ready")
								return nil
							}
							logger.Debugf("TUN interface not ready yet, elapsed: %v", elapsed)
						} else {
							logger.Info("Mihomo process is ready")
							return nil
						}
					} else {
						logger.Error("Mihomo process died unexpectedly")
						return fmt.Errorf("mihomo process died")
					}
				}
			}
		}

		time.Sleep(checkInterval)
		elapsed += checkInterval
	}

	if needTUN {
		logger.Error("Timeout waiting for TUN interface")
		return apperror.Timeout("timeout waiting for TUN interface")
	}
	logger.Error("Timeout waiting for mihomo to be ready")
	return apperror.Timeout("timeout waiting for mihomo to be ready")
}

func (s *MihomoService) adjustMihomoConfig() error {
	routing := s.appConfig.Mihomo.Routing
	needTUN := routing.TCP == config.RoutingModeTUN || routing.UDP == config.RoutingModeTUN

	configData, err := os.ReadFile(s.appConfig.Mihomo.ConfigPath)
	if err != nil {
		return fmt.Errorf("failed to read mihomo config: %w", err)
	}

	configStr := string(configData)

	if needTUN {
		tunDevice := s.appConfig.Mihomo.Routing.TunDevice
		if tunDevice == "" {
			tunDevice = "Meta"
		}
		configStr = ensureTUNEnabled(configStr, tunDevice)
	} else {
		configStr = ensureTUNDisabled(configStr)
	}

	err = os.WriteFile(s.appConfig.Mihomo.ConfigPath, []byte(configStr), 0644)
	if err != nil {
		return fmt.Errorf("failed to write mihomo config: %w", err)
	}

	return nil
}

func ensureTUNEnabled(config string, deviceName string) string {
	lines := strings.Split(config, "\n")
	var newLines []string
	inTunSection := false
	hasDeviceField := false
	tunSectionIndent := "  "

	tempInTun := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "tun:" {
			tempInTun = true
			continue
		}
		if tempInTun {
			if len(trimmed) > 0 {
				isIndented := len(line) > 0 && (line[0] == ' ' || line[0] == '\t')
				if !isIndented {
					tempInTun = false
				} else if strings.HasPrefix(trimmed, "device:") {
					hasDeviceField = true
				}
			}
		}
	}

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if trimmed == "tun:" {
			inTunSection = true
			newLines = append(newLines, line)
			continue
		}

		if inTunSection {
			if len(trimmed) > 0 {
				isIndented := len(line) > 0 && (line[0] == ' ' || line[0] == '\t')
				if !isIndented {
					inTunSection = false
				}
			}
		}

		if inTunSection {
			if strings.HasPrefix(trimmed, " ") {
				if len(line) > len(trimmed) {
					tunSectionIndent = line[:len(line)-len(trimmed)]
				}
			}

			if strings.HasPrefix(trimmed, "enable:") {
				if strings.Contains(line, "false") {
					newLines = append(newLines, strings.Replace(line, "enable: false", "enable: true", 1))
				} else {
					newLines = append(newLines, line)
				}

				if !hasDeviceField {
					newLines = append(newLines, tunSectionIndent+"device: "+deviceName)
					hasDeviceField = true
				}
				continue
			}

			if strings.HasPrefix(trimmed, "device:") {
				idx := strings.Index(line, ":")
				if idx != -1 {
					prefix := line[:idx+1]
					newLines = append(newLines, prefix+" "+deviceName)
				} else {
					newLines = append(newLines, line)
				}
				continue
			}
		}

		newLines = append(newLines, line)
	}
	return strings.Join(newLines, "\n")
}

func ensureTUNDisabled(config string) string {
	lines := strings.Split(config, "\n")
	inTunSection := false

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)

		if trimmed == "tun:" {
			inTunSection = true
			continue
		}

		if inTunSection && strings.HasPrefix(trimmed, "enable:") {
			lines[i] = strings.Replace(line, "enable: true", "enable: false", 1)
			inTunSection = false
		}

		if inTunSection && len(trimmed) > 0 && !strings.HasPrefix(trimmed, " ") && trimmed[0] != ' ' {
			inTunSection = false
		}
	}

	return strings.Join(lines, "\n")
}

func (s *MihomoService) GetLogs(lines int) ([]string, error) {
	if s.appConfig.Mihomo.LogFile == "" {
		return nil, apperror.NotConfigured("log file not configured")
	}

	data, err := os.ReadFile(s.appConfig.Mihomo.LogFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read log file: %w", err)
	}

	allLines := strings.Split(string(data), "\n")

	start := 0
	if len(allLines) > lines {
		start = len(allLines) - lines
	}

	return allLines[start:], nil
}

func (s *MihomoService) ClearLogs() error {
	if s.appConfig.Mihomo.LogFile == "" {
		return apperror.NotConfigured("log file not configured")
	}

	file, err := os.OpenFile(s.appConfig.Mihomo.LogFile, os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return apperror.Wrapf(err, apperror.KindInternal, "failed to clear log file")
	}
	defer file.Close()

	return nil
}
