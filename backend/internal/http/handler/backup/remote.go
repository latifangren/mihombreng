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

type RemoteTargetHandler struct {
	config  *config.Config
	service *backupservice.Service
}

func NewRemoteTargetHandler(cfg *config.Config, configPath string) *RemoteTargetHandler {
	return &RemoteTargetHandler{
		config:  cfg,
		service: backupservice.NewService(cfg, configPath),
	}
}

// ListTargets godoc
// @Summary List remote backup targets
// @Description List configured remote backup targets
// @Tags RemoteBackup
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /backup/remote/list [get]
func (h *RemoteTargetHandler) ListTargets(c *gin.Context) {
	targets := h.service.GetRemoteTargets()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    targets,
	})
}

// TestTarget godoc
// @Summary Test remote backup target
// @Description Test connectivity to a remote backup target
// @Tags RemoteBackup
// @Produce json
// @Param name path string true "Target name"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /backup/remote/test/{name} [post]
func (h *RemoteTargetHandler) TestTarget(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "target name required"})
		return
	}

	result, err := h.service.TestRemoteTarget(name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
			"result":  result,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"result":  result,
	})
}

// SyncToRemote godoc
// @Summary Sync backup to remote target
// @Description Sync the latest backup to a remote target
// @Tags RemoteBackup
// @Produce json
// @Param name path string true "Target name"
// @Param body body object true "Sync options"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /backup/remote/sync/{name} [post]
func (h *RemoteTargetHandler) SyncToRemote(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "target name required"})
		return
	}

	var req struct {
		Filename string `json:"filename"` // optional: specific file to sync
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Filename = "" // use latest
	}

	filename, err := h.service.SyncToRemote(name, req.Filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"filename": filename,
	})
}

// GetSyncStatus godoc
// @Summary Get sync status for remote target
// @Description Get the last sync status for a remote target
// @Tags RemoteBackup
// @Produce json
// @Param name path string true "Target name"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /backup/remote/status/{name} [get]
func (h *RemoteTargetHandler) GetSyncStatus(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "target name required"})
		return
	}

	status, err := h.service.GetRemoteSyncStatus(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    status,
	})
}

// UploadToRemote godoc
// @Summary Upload backup to remote target
// @Description Upload a specific backup file to remote target
// @Tags RemoteBackup
// @Produce json
// @Param name path string true "Target name"
// @Param filename path string true "Backup filename"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /backup/remote/upload/{name}/{filename} [post]
func (h *RemoteTargetHandler) UploadToRemote(c *gin.Context) {
	name := c.Param("name")
	filename := filepath.Base(c.Param("filename"))
	if name == "" || filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "target name and filename required"})
		return
	}
	if !strings.HasSuffix(filename, ".tar.gz") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid backup filename"})
		return
	}

	// Find the backup file locally
	backupDir := h.service.GetBackupDir()
	backupPath := filepath.Join(backupDir, filename)
	if _, err := os.Stat(backupPath); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "backup file not found locally"})
		return
	}

	file, err := os.Open(backupPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to open backup file"})
		return
	}
	defer file.Close()

	if err := h.service.UploadToRemote(name, filename, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"filename": filename,
	})
}
