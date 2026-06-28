package backup

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"mihombreng/pkg/config"
)

func TestApplyRetentionByCount(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "mihombreng-backups-test-count")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{
		Backup: config.BackupConfig{
			BackupDir:  tempDir,
			MaxBackups: 2,
			MaxAgeDays: 0,
		},
	}

	service := NewService(cfg, "")

	files := []string{
		"mihombreng-backup-1.tar.gz",
		"mihombreng-backup-2.tar.gz",
		"mihombreng-backup-3.tar.gz",
	}

	now := time.Now()
	for i, name := range files {
		path := filepath.Join(tempDir, name)
		if err := os.WriteFile(path, []byte("test"), 0644); err != nil {
			t.Fatalf("failed to write dummy file: %v", err)
		}
		// Newer files have higher i (newer modTime)
		mtime := now.Add(time.Duration(i) * time.Minute)
		if err := os.Chtimes(path, mtime, mtime); err != nil {
			t.Fatalf("failed to change times: %v", err)
		}
	}

	deleted, err := service.ApplyRetention()
	if err != nil {
		t.Fatalf("ApplyRetention failed: %v", err)
	}

	if deleted != 1 {
		t.Errorf("expected 1 deleted file, got %d", deleted)
	}

	// Verify that the oldest file (mihombreng-backup-1.tar.gz) was removed
	if _, err := os.Stat(filepath.Join(tempDir, "mihombreng-backup-1.tar.gz")); !os.IsNotExist(err) {
		t.Error("expected oldest file to be deleted")
	}

	// Verify that the newer files (2 and 3) remain
	if _, err := os.Stat(filepath.Join(tempDir, "mihombreng-backup-2.tar.gz")); err != nil {
		t.Error("expected backup-2 to exist")
	}
	if _, err := os.Stat(filepath.Join(tempDir, "mihombreng-backup-3.tar.gz")); err != nil {
		t.Error("expected backup-3 to exist")
	}
}

func TestApplyRetentionByAge(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "mihombreng-backups-test-age")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{
		Backup: config.BackupConfig{
			BackupDir:  tempDir,
			MaxBackups: 0,
			MaxAgeDays: 2,
		},
	}

	service := NewService(cfg, "")

	now := time.Now()

	// 1. Fresh backup (1 hour old)
	freshPath := filepath.Join(tempDir, "mihombreng-backup-fresh.tar.gz")
	if err := os.WriteFile(freshPath, []byte("fresh"), 0644); err != nil {
		t.Fatalf("failed to write fresh file: %v", err)
	}
	mtime1 := now.Add(-1 * time.Hour)
	os.Chtimes(freshPath, mtime1, mtime1)

	// 2. Expired backup (5 days old)
	oldPath := filepath.Join(tempDir, "mihombreng-backup-old.tar.gz")
	if err := os.WriteFile(oldPath, []byte("old"), 0644); err != nil {
		t.Fatalf("failed to write old file: %v", err)
	}
	mtime2 := now.Add(-5 * 24 * time.Hour)
	os.Chtimes(oldPath, mtime2, mtime2)

	deleted, err := service.ApplyRetention()
	if err != nil {
		t.Fatalf("ApplyRetention failed: %v", err)
	}

	if deleted != 1 {
		t.Errorf("expected 1 deleted file, got %d", deleted)
	}

	// Verify that the expired file was deleted
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Error("expected old backup to be deleted")
	}

	// Verify that the fresh file remains
	if _, err := os.Stat(freshPath); err != nil {
		t.Error("expected fresh backup to remain")
	}
}
