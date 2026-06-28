package backup

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	backupservice "mihombreng/internal/service/backup"
	"mihombreng/pkg/config"

	"github.com/gin-gonic/gin"
)

type BackupHandler struct {
	config  *config.Config
	service *backupservice.Service
}

func NewBackupHandler(cfg *config.Config, configPath string) *BackupHandler {
	return &BackupHandler{
		config:  cfg,
		service: backupservice.NewService(cfg, configPath),
	}
}

// CreateBackup godoc
// @Summary Create backup
// @Description Create a tar.gz backup of the entire working directory
// @Tags Backup
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /backup/create [post]
func (h *BackupHandler) CreateBackup(c *gin.Context) {
	entry, deleted, err := h.service.CreateBackup("manual")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    entry,
		"retention": gin.H{
			"deleted": deleted,
		},
	})
}

// DownloadBackup godoc
// @Summary Download backup archive
// @Description Download a previously created tar.gz backup file
// @Tags Backup
// @Produce application/gzip
// @Param filename path string true "Backup filename"
// @Success 200 {file} binary
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /backup/download/{filename} [get]
func (h *BackupHandler) DownloadBackup(c *gin.Context) {
	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid backup filename"})
		return
	}

	backupPath, err := h.service.GetBackupPath(filename)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else if strings.Contains(err.Error(), "invalid") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.Header("Content-Disposition", "attachment; filename="+filepath.Base(backupPath))
	c.File(backupPath)
}

// ListBackups godoc
// @Summary List backups
// @Description List available backup files
// @Tags Backup
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /backup/list [get]
func (h *BackupHandler) ListBackups(c *gin.Context) {
	entries, err := h.service.ListBackups()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    entries,
	})
}

// RestoreBackup godoc
// @Summary Restore backup
// @Description Restore configuration from uploaded tar.gz backup file
// @Tags Backup
// @Accept multipart/form-data
// @Produce json
// @Param backup formData file true "Backup file (.tar.gz)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /backup/restore [post]
func (h *BackupHandler) RestoreBackup(c *gin.Context) {
	file, err := c.FormFile("backup")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no backup file provided"})
		return
	}

	// Pre-create backup before restore
	_, _, _ = h.service.CreateBackup("pre-restore")

	tmpFile := filepath.Join(os.TempDir(), file.Filename)
	if err := c.SaveUploadedFile(file, tmpFile); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save uploaded file"})
		return
	}
	defer os.Remove(tmpFile)

	if err := h.service.RestoreFromUpload(tmpFile); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Backup restored successfully",
	})
}

// RestoreBackupFromHistory godoc
// @Summary Restore from history
// @Description Restore configuration from a backup in history
// @Tags Backup
// @Produce json
// @Param filename path string true "Backup filename"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /backup/restore/{filename} [post]
func (h *BackupHandler) RestoreBackupFromHistory(c *gin.Context) {
	filename := filepath.Base(c.Param("filename"))
	if filename == "" || !strings.HasSuffix(filename, ".tar.gz") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid backup filename"})
		return
	}

	// Pre-create backup before restore
	_, _, _ = h.service.CreateBackup("pre-restore")

	if err := h.service.RestoreFromHistory(filename); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Backup restored successfully",
	})
}

// DeleteBackup godoc
// @Summary Delete backup
// @Description Delete a backup file
// @Tags Backup
// @Produce json
// @Param filename path string true "Backup filename"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /backup/{filename} [delete]
func (h *BackupHandler) DeleteBackup(c *gin.Context) {
	filename := filepath.Base(c.Param("filename"))
	if filename == "" || !strings.HasSuffix(filename, ".tar.gz") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid backup filename"})
		return
	}

	if err := h.service.DeleteBackup(filename); err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Backup deleted successfully",
	})
}

// GetBackupStatus godoc
// @Summary Get backup status
// @Description Get current backup status and metrics
// @Tags Backup
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /backup/status [get]
func (h *BackupHandler) GetBackupStatus(c *gin.Context) {
	// Refresh list to update counts
	h.service.ListBackups()
	status := h.service.GetStatus()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    status,
	})
}

// ApplyRetention godoc
// @Summary Apply retention policy
// @Description Manually trigger retention cleanup
// @Tags Backup
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /backup/retention [post]
func (h *BackupHandler) ApplyRetention(c *gin.Context) {
	deleted, err := h.service.ApplyRetention()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"deleted": deleted,
	})
}
