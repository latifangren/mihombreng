package backup

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"mihombreng/pkg/config"
	"mihombreng/pkg/logger"
)

type BackupEntry struct {
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
	Created  string `json:"created"`
	Source   string `json:"source"` // "manual", "auto", "remote"
}

type BackupStatus struct {
	LastBackupTime   string `json:"last_backup_time"`
	LastBackupSource string `json:"last_backup_source"`
	BackupCount      int    `json:"backup_count"`
	TotalSizeBytes   int64  `json:"total_size_bytes"`
	RetentionApplied bool   `json:"retention_applied"`
}

type Service struct {
	config     *config.Config
	configPath string
	mu         sync.Mutex
	status     BackupStatus
	targets    map[string]Target
}

func NewService(cfg *config.Config, configPath string) *Service {
	s := &Service{
		config:     cfg,
		configPath: configPath,
		targets:    make(map[string]Target),
	}
	s.initializeTargets()
	return s
}

func (s *Service) initializeTargets() {
	if s.config == nil {
		return
	}
	for _, tc := range s.config.Backup.Targets {
		target, err := NewTarget(TargetConfig{
			Name:     tc.Name,
			Type:     tc.Type,
			URL:      tc.URL,
			Username: tc.Username,
			Password: tc.Password,
			Enabled:  tc.Enabled,
		})
		if err != nil {
			logger.Errorf("Failed to initialize remote backup target %s: %v", tc.Name, err)
			continue
		}
		s.targets[tc.Name] = target
	}
}

func (s *Service) CreateBackup(source string) (*BackupEntry, int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	timestamp := time.Now().Format("20060102-150405")
	backupFilename := fmt.Sprintf("mihombreng-backup-%s.tar.gz", timestamp)

	backupDir := s.getBackupDir()
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return nil, 0, fmt.Errorf("failed to create backup directory: %w", err)
	}

	backupPath := filepath.Join(backupDir, backupFilename)
	file, err := os.Create(backupPath)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create backup file: %w", err)
	}
	defer file.Close()

	gzipWriter := gzip.NewWriter(file)
	defer gzipWriter.Close()

	tarWriter := tar.NewWriter(gzipWriter)
	defer tarWriter.Close()

	for _, item := range s.backupItems() {
		if err := s.addBackupItem(tarWriter, item); err != nil {
			os.Remove(backupPath)
			return nil, 0, fmt.Errorf("failed to create backup archive: %w", err)
		}
	}

	tarWriter.Close()
	gzipWriter.Close()
	file.Close()

	info, err := os.Stat(backupPath)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to stat backup: %w", err)
	}

	entry := &BackupEntry{
		Filename: backupFilename,
		Size:     info.Size(),
		Created:  info.ModTime().UTC().Format(time.RFC3339),
		Source:   source,
	}

	s.status.LastBackupTime = entry.Created
	s.status.LastBackupSource = source
	s.status.BackupCount++
	s.status.TotalSizeBytes += info.Size()

	deleted, err := s.applyRetentionLocked()
	if err != nil {
		logger.Errorf("Failed to automatically apply backup retention: %v", err)
	}

	return entry, deleted, nil
}

func (s *Service) ListBackups() ([]BackupEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	backupDir := s.getBackupDir()
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []BackupEntry{}, nil
		}
		return nil, fmt.Errorf("failed to list backups: %w", err)
	}

	backups := make([]BackupEntry, 0)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".tar.gz") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		backups = append(backups, BackupEntry{
			Filename: entry.Name(),
			Size:     info.Size(),
			Created:  info.ModTime().UTC().Format(time.RFC3339),
			Source:   "manual",
		})
	}

	sort.Slice(backups, func(i, j int) bool {
		if backups[i].Created == backups[j].Created {
			return backups[i].Filename < backups[j].Filename
		}
		return backups[i].Created > backups[j].Created
	})

	totalSize := int64(0)
	for _, b := range backups {
		totalSize += b.Size
	}
	s.status.BackupCount = len(backups)
	s.status.TotalSizeBytes = totalSize

	return backups, nil
}

func (s *Service) DeleteBackup(filename string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	filename = filepath.Base(filename)
	if !strings.HasSuffix(filename, ".tar.gz") {
		return fmt.Errorf("invalid backup filename")
	}

	backupDir := s.getBackupDir()
	targetPath := filepath.Join(backupDir, filename)
	if err := os.Remove(targetPath); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("backup file not found")
		}
		return fmt.Errorf("failed to delete backup: %w", err)
	}
	return nil
}

func (s *Service) RestoreFromHistory(filename string) error {
	backupDir := s.getBackupDir()
	filename = filepath.Base(filename)
	sourcePath := filepath.Join(backupDir, filename)

	if _, err := os.Stat(sourcePath); err != nil {
		return fmt.Errorf("backup file not found")
	}

	return s.restoreFromPath(sourcePath)
}

func (s *Service) RestoreFromUpload(tmpPath string) error {
	return s.restoreFromPath(tmpPath)
}

func (s *Service) GetStatus() BackupStatus {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status
}

func (s *Service) ApplyRetention() (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.applyRetentionLocked()
}

func (s *Service) applyRetentionLocked() (int, error) {
	cfg := s.config.Backup
	maxBackups := cfg.MaxBackups
	maxAgeDays := cfg.MaxAgeDays

	if maxBackups <= 0 && maxAgeDays <= 0 {
		return 0, nil
	}

	backupDir := s.getBackupDir()
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, fmt.Errorf("failed to read backup dir: %w", err)
	}

	type backupInfo struct {
		name    string
		modTime time.Time
		size    int64
	}

	var backups []backupInfo
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".tar.gz") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		backups = append(backups, backupInfo{
			name:    entry.Name(),
			modTime: info.ModTime(),
			size:    info.Size(),
		})
	}

	sort.Slice(backups, func(i, j int) bool {
		return backups[i].modTime.After(backups[j].modTime)
	})

	deleted := 0
	now := time.Now()

	// Remove by age
	if maxAgeDays > 0 {
		cutoff := now.AddDate(0, 0, -maxAgeDays)
		remaining := make([]backupInfo, 0)
		for _, b := range backups {
			if b.modTime.Before(cutoff) {
				if err := os.Remove(filepath.Join(backupDir, b.name)); err != nil {
					logger.Errorf("Failed to remove backup by age policy %s: %v", b.name, err)
					remaining = append(remaining, b)
				} else {
					deleted++
				}
			} else {
				remaining = append(remaining, b)
			}
		}
		backups = remaining
	}

	// Remove by count
	if maxBackups > 0 && len(backups) > maxBackups {
		remaining := make([]backupInfo, 0)
		remaining = append(remaining, backups[:maxBackups]...)
		for _, b := range backups[maxBackups:] {
			if err := os.Remove(filepath.Join(backupDir, b.name)); err != nil {
				logger.Errorf("Failed to remove backup by count policy %s: %v", b.name, err)
				remaining = append(remaining, b)
			} else {
				deleted++
			}
		}
		backups = remaining
	}

	totalSize := int64(0)
	for _, b := range backups {
		totalSize += b.size
	}
	s.status.BackupCount = len(backups)
	s.status.TotalSizeBytes = totalSize

	s.status.RetentionApplied = deleted > 0
	return deleted, nil
}

func (s *Service) getBackupDir() string {
	if s.config.Backup.BackupDir != "" {
		return s.config.Backup.BackupDir
	}
	return filepath.Join(s.config.Mihomo.WorkingDir, "backups")
}

type backupItem struct {
	sourcePath        string
	archiveDir        string
	required          bool
	skipBackupStorage bool
}

func (s *Service) runtimeRoot() string {
	if strings.TrimSpace(s.configPath) != "" {
		return filepath.Clean(filepath.Dir(s.configPath))
	}
	if strings.TrimSpace(s.config.Mihomo.ConfigPath) != "" {
		return filepath.Clean(filepath.Dir(s.config.Mihomo.ConfigPath))
	}
	return filepath.Clean(s.config.Mihomo.WorkingDir)
}

func (s *Service) backupItems() []backupItem {
	runtimeRoot := s.runtimeRoot()
	workingDir := filepath.Clean(s.config.Mihomo.WorkingDir)
	items := []backupItem{{sourcePath: runtimeRoot, archiveDir: "root", required: true, skipBackupStorage: true}}

	for _, name := range []string{"configs", "proxy_providers", "rule_providers"} {
		path := filepath.Join(workingDir, name)
		if samePath(path, runtimeRoot) || isPathWithin(path, runtimeRoot) {
			continue
		}
		items = append(items, backupItem{sourcePath: path, archiveDir: filepath.ToSlash(filepath.Join("working_dir", name)), required: false, skipBackupStorage: true})
	}

	return items
}

func (s *Service) addBackupItem(tarWriter *tar.Writer, item backupItem) error {
	if strings.TrimSpace(item.sourcePath) == "" {
		if item.required {
			return fmt.Errorf("required backup source is not configured")
		}
		return nil
	}

	sourcePath := filepath.Clean(item.sourcePath)
	info, err := os.Stat(sourcePath)
	if err != nil {
		if os.IsNotExist(err) && !item.required {
			return nil
		}
		return fmt.Errorf("failed to access %s: %w", sourcePath, err)
	}

	if info.IsDir() {
		return filepath.Walk(sourcePath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if item.skipBackupStorage && s.shouldSkipBackupPath(path, info) {
				if info.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if info.IsDir() {
				return nil
			}
			relPath, err := filepath.Rel(sourcePath, path)
			if err != nil {
				return err
			}
			archivePath := filepath.ToSlash(filepath.Join(item.archiveDir, relPath))
			return writeBackupFile(tarWriter, path, info, archivePath)
		})
	}

	archivePath := filepath.ToSlash(filepath.Join(item.archiveDir, filepath.Base(sourcePath)))
	return writeBackupFile(tarWriter, sourcePath, info, archivePath)
}

func samePath(a, b string) bool {
	return strings.EqualFold(filepath.Clean(a), filepath.Clean(b))
}

func isPathWithin(path, root string) bool {
	rel, err := filepath.Rel(filepath.Clean(root), filepath.Clean(path))
	if err != nil {
		return false
	}
	return rel == "." || (!strings.HasPrefix(rel, "..") && rel != "")
}

func (s *Service) shouldSkipBackupPath(path string, info os.FileInfo) bool {
	cleanPath := filepath.Clean(path)
	backupDir := filepath.Clean(s.getBackupDir())

	if samePath(cleanPath, backupDir) || isPathWithin(cleanPath, backupDir) {
		return true
	}

	if info.IsDir() {
		base := filepath.Base(cleanPath)
		if strings.EqualFold(base, filepath.Base(backupDir)) || strings.EqualFold(base, "backups") {
			return true
		}
	}

	return false
}

func writeBackupFile(tarWriter *tar.Writer, sourcePath string, info os.FileInfo, archivePath string) error {
	header, err := tar.FileInfoHeader(info, "")
	if err != nil {
		return err
	}
	header.Name = archivePath
	if err := tarWriter.WriteHeader(header); err != nil {
		return err
	}
	srcFile, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	_, err = io.Copy(tarWriter, srcFile)
	closeErr := srcFile.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return nil
}

func (s *Service) restoreFromPath(backupPath string) error {
	srcFile, err := os.Open(backupPath)
	if err != nil {
		return fmt.Errorf("failed to open backup file")
	}
	defer srcFile.Close()

	gzipReader, err := gzip.NewReader(srcFile)
	if err != nil {
		return fmt.Errorf("invalid gzip file")
	}
	defer gzipReader.Close()

	tarReader := tar.NewReader(gzipReader)
	runtimeRoot := s.runtimeRoot()
	workingDir := filepath.Clean(s.config.Mihomo.WorkingDir)

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read tar file")
		}
		if header.Typeflag != tar.TypeReg {
			continue
		}

		targetPath, err := s.resolveRestoreTargetPath(header.Name, runtimeRoot, workingDir)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return fmt.Errorf("failed to create directory")
		}
		dstFile, err := os.Create(targetPath)
		if err != nil {
			return fmt.Errorf("failed to create file")
		}
		if _, err := io.Copy(dstFile, tarReader); err != nil {
			dstFile.Close()
			return fmt.Errorf("failed to extract file")
		}
		if err := dstFile.Close(); err != nil {
			return fmt.Errorf("failed to finalize restored file")
		}
	}
	return nil
}

func (s *Service) resolveRestoreTargetPath(archiveName, runtimeRoot, workingDir string) (string, error) {
	cleanName := filepath.Clean(filepath.FromSlash(archiveName))
	if cleanName == "." || cleanName == "" {
		return "", fmt.Errorf("backup contains invalid path")
	}

	parts := strings.Split(filepath.ToSlash(cleanName), "/")
	if len(parts) < 2 {
		return "", fmt.Errorf("backup contains invalid path")
	}

	switch parts[0] {
	case "root":
		targetPath := filepath.Join(runtimeRoot, filepath.Join(parts[1:]...))
		if !strings.HasPrefix(filepath.Clean(targetPath), runtimeRoot) {
			return "", fmt.Errorf("backup contains invalid path")
		}
		return targetPath, nil
	case "working_dir":
		targetPath := filepath.Join(workingDir, filepath.Join(parts[1:]...))
		if !strings.HasPrefix(filepath.Clean(targetPath), workingDir) {
			return "", fmt.Errorf("backup contains invalid path")
		}
		return targetPath, nil
	default:
		return "", fmt.Errorf("backup contains invalid path")
	}
}

// Remote target methods

func (s *Service) GetRemoteTargets() []TargetConfig {
	if s.config == nil {
		return nil
	}
	var result []TargetConfig
	for _, tc := range s.config.Backup.Targets {
		result = append(result, TargetConfig{
			Name:     tc.Name,
			Type:     tc.Type,
			URL:      tc.URL,
			Username: tc.Username,
			Password: tc.Password,
			Enabled:  tc.Enabled,
		})
	}
	return result
}

func (s *Service) TestRemoteTarget(name string) (string, error) {
	target, exists := s.targets[name]
	if !exists {
		return "", fmt.Errorf("target not found: %s", name)
	}
	if err := target.TestConnection(); err != nil {
		return fmt.Sprintf("Connection failed: %s", err.Error()), err
	}
	return "Connection successful", nil
}

func (s *Service) SyncToRemote(name string, filename string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	target, exists := s.targets[name]
	if !exists {
		return "", fmt.Errorf("target not found: %s", name)
	}

	// If no filename specified, use latest backup
	if filename == "" {
		backups, err := s.ListBackups()
		if err != nil {
			return "", fmt.Errorf("failed to list backups: %w", err)
		}
		if len(backups) == 0 {
			return "", fmt.Errorf("no backups available")
		}
		filename = backups[0].Filename
	}

	// Open the backup file
	backupDir := s.getBackupDir()
	backupPath := filepath.Join(backupDir, filename)
	file, err := os.Open(backupPath)
	if err != nil {
		return "", fmt.Errorf("failed to open backup file: %w", err)
	}
	defer file.Close()

	// Upload to remote
	if err := target.Upload(filename, file); err != nil {
		return "", fmt.Errorf("failed to upload: %w", err)
	}

	return filename, nil
}

func (s *Service) GetRemoteSyncStatus(name string) (SyncStatus, error) {
	target, exists := s.targets[name]
	if !exists {
		return SyncStatus{}, fmt.Errorf("target not found: %s", name)
	}
	return target.GetLastSync(), nil
}

func (s *Service) GetBackupDir() string {
	return s.getBackupDir()
}

func (s *Service) GetBackupPath(filename string) (string, error) {
	filename = filepath.Base(filename)
	if !strings.HasSuffix(filename, ".tar.gz") {
		return "", fmt.Errorf("invalid backup filename")
	}

	backupPath := filepath.Join(s.getBackupDir(), filename)
	if _, err := os.Stat(backupPath); err != nil {
		if os.IsNotExist(err) {
			return "", fmt.Errorf("backup file not found")
		}
		return "", fmt.Errorf("failed to access backup file: %w", err)
	}
	return backupPath, nil
}

func (s *Service) UploadToRemote(name string, filename string, reader io.Reader) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	target, exists := s.targets[name]
	if !exists {
		return fmt.Errorf("target not found: %s", name)
	}

	if err := target.Upload(filename, reader); err != nil {
		return fmt.Errorf("failed to upload: %w", err)
	}
	return nil
}
