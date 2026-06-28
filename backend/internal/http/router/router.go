package router

import (
	"mihombreng/internal/domain"
	"mihombreng/internal/http/handler/app"
	"mihombreng/internal/http/handler/backup"
	"mihombreng/internal/http/handler/converter"
	"mihombreng/internal/http/handler/dns"
	"mihombreng/internal/http/handler/mihomo"
	"mihombreng/internal/http/handler/stream"
	subhandler "mihombreng/internal/http/handler/subscription"
	"mihombreng/internal/http/middleware"
	subdomain "mihombreng/internal/subscription"
	"mihombreng/pkg/config"

	"github.com/gin-gonic/gin"
)

func Setup(r *gin.Engine, mihomoService domain.MihomoService, cfg *config.Config, configPath string, subscriptionService *subdomain.Service) {
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORS(&cfg.API.CORS))
	r.Use(middleware.RateLimit(cfg.API.RateLimit))

	mihomoHandler := mihomo.NewMihomoHandler(mihomoService, cfg)
	appHandler := app.NewAppHandler(cfg, mihomoService, configPath)
	mihomoFilesHandler := mihomo.NewMihomoFilesHandler(mihomoService, cfg, configPath)
	streamHandler := stream.NewStreamHandler(cfg, mihomoService)
	backupHandler := backup.NewBackupHandler(cfg, configPath)
	converterHandler := converter.NewConverterHandler()
	dnsHandler := dns.NewDNSHandler()
	subscriptionHandler := subhandler.NewHandler(subscriptionService)

	api := r.Group("/api/v1")
	api.Use(middleware.TokenAuth(cfg.API.AuthToken))
	{
		backupGroup := api.Group("/backup")
		{
			backupGroup.GET("/list", backupHandler.ListBackups)
			backupGroup.POST("/create", backupHandler.CreateBackup)
			backupGroup.GET("/download/:filename", backupHandler.DownloadBackup)
			backupGroup.POST("/restore", backupHandler.RestoreBackup)
			backupGroup.POST("/restore/:filename", backupHandler.RestoreBackupFromHistory)
			backupGroup.DELETE("/:filename", backupHandler.DeleteBackup)
			backupGroup.GET("/status", backupHandler.GetBackupStatus)
			backupGroup.POST("/retention", backupHandler.ApplyRetention)
		}

		remoteTargetHandler := backup.NewRemoteTargetHandler(cfg, configPath)
		remoteBackupGroup := api.Group("/backup/remote")
		{
			remoteBackupGroup.GET("/list", remoteTargetHandler.ListTargets)
			remoteBackupGroup.POST("/test/:name", remoteTargetHandler.TestTarget)
			remoteBackupGroup.POST("/sync/:name", remoteTargetHandler.SyncToRemote)
			remoteBackupGroup.GET("/status/:name", remoteTargetHandler.GetSyncStatus)
			remoteBackupGroup.POST("/upload/:name/:filename", remoteTargetHandler.UploadToRemote)
		}

		converterGroup := api.Group("/converter")
		{
			converterGroup.POST("/parse", converterHandler.ParseProxies)
		}

		dnsGroup := api.Group("/dns")
		{
			dnsGroup.POST("/lookup", dnsHandler.LookupDomain)
		}

		subscriptionGroup := api.Group("/subscriptions")
		{
			subscriptionGroup.GET("", subscriptionHandler.List)
			subscriptionGroup.GET("/:id", subscriptionHandler.Get)
			subscriptionGroup.POST("", subscriptionHandler.Create)
			subscriptionGroup.PUT("/:id", subscriptionHandler.Update)
			subscriptionGroup.DELETE("/:id", subscriptionHandler.Delete)
			subscriptionGroup.POST("/:id/refresh", subscriptionHandler.Refresh)
		}

		mihomoGroup := api.Group("/mihomo")
		{
			mihomoGroup.GET("/status", mihomoHandler.GetStatus)
			mihomoGroup.POST("/start", mihomoHandler.Start)
			mihomoGroup.POST("/stop", mihomoHandler.Stop)
			mihomoGroup.POST("/restart", mihomoHandler.Restart)
			mihomoGroup.POST("/routing/validate", mihomoHandler.ValidateRouting)
			mihomoGroup.GET("/logs", streamHandler.StreamMihomoLogs)
			mihomoGroup.DELETE("/logs", streamHandler.ClearMihomoLogs)
			mihomoGroup.GET("/memory", streamHandler.StreamMemory)
			mihomoGroup.GET("/traffic", streamHandler.StreamTraffic)
			mihomoGroup.GET("/connections", streamHandler.StreamConnections)
			mihomoGroup.GET("/core-version", mihomoHandler.GetCoreVersion)
			mihomoGroup.GET("/dashboard-info", mihomoHandler.GetDashboardInfo)
			mihomoGroup.GET("/snapshot/memory", mihomoHandler.GetMemory)
			mihomoGroup.GET("/snapshot/traffic", mihomoHandler.GetTraffic)
			mihomoGroup.GET("/snapshot/connections", mihomoHandler.GetConnectionsSnapshot)
			mihomoGroup.GET("/metrics/traffic", mihomoHandler.GetTrafficMetrics)
			mihomoGroup.GET("/metrics/connections", mihomoHandler.GetConnectionsList)
			mihomoGroup.DELETE("/connections/:id", mihomoHandler.CloseConnection)
			mihomoGroup.Any("/api/*path", mihomoHandler.ProxyToMihomoAPI)

			mihomoGroup.GET("/configs", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "configs"})
				mihomoFilesHandler.GetFiles(c)
			})
			mihomoGroup.GET("/configs/:filename", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "configs"})
				mihomoFilesHandler.GetFileContent(c)
			})
			mihomoGroup.GET("/configs/:filename/download", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "configs"})
				mihomoFilesHandler.DownloadFile(c)
			})
			mihomoGroup.POST("/configs", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "configs"})
				mihomoFilesHandler.CreateFile(c)
			})
			mihomoGroup.POST("/configs/validate", mihomoFilesHandler.ValidateConfig)
			mihomoGroup.POST("/configs/upload", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "configs"})
				mihomoFilesHandler.UploadFile(c)
			})
			mihomoGroup.PUT("/configs/:filename", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "configs"})
				mihomoFilesHandler.UpdateFile(c)
			})
			mihomoGroup.PUT("/configs/:filename/rename", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "configs"})
				mihomoFilesHandler.RenameFile(c)
			})
			mihomoGroup.DELETE("/configs/:filename", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "configs"})
				mihomoFilesHandler.DeleteFile(c)
			})
			mihomoGroup.GET("/active-config", mihomoFilesHandler.GetActiveConfigPath)
			mihomoGroup.PUT("/active-config", mihomoFilesHandler.SetActiveConfigPath)
			mihomoGroup.POST("/providers/sync", mihomoFilesHandler.SyncProvider)

			mihomoGroup.GET("/proxy-providers", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "proxy_providers"})
				mihomoFilesHandler.GetFiles(c)
			})
			mihomoGroup.GET("/proxy-providers/:filename", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "proxy_providers"})
				mihomoFilesHandler.GetFileContent(c)
			})
			mihomoGroup.GET("/proxy-providers/:filename/download", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "proxy_providers"})
				mihomoFilesHandler.DownloadFile(c)
			})
			mihomoGroup.POST("/proxy-providers", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "proxy_providers"})
				mihomoFilesHandler.CreateFile(c)
			})
			mihomoGroup.POST("/proxy-providers/upload", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "proxy_providers"})
				mihomoFilesHandler.UploadFile(c)
			})
			mihomoGroup.PUT("/proxy-providers/:filename", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "proxy_providers"})
				mihomoFilesHandler.UpdateFile(c)
			})
			mihomoGroup.PUT("/proxy-providers/:filename/rename", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "proxy_providers"})
				mihomoFilesHandler.RenameFile(c)
			})
			mihomoGroup.DELETE("/proxy-providers/:filename", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "proxy_providers"})
				mihomoFilesHandler.DeleteFile(c)
			})

			mihomoGroup.GET("/rule-providers", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "rule_providers"})
				mihomoFilesHandler.GetFiles(c)
			})
			mihomoGroup.GET("/rule-providers/:filename", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "rule_providers"})
				mihomoFilesHandler.GetFileContent(c)
			})
			mihomoGroup.GET("/rule-providers/:filename/download", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "rule_providers"})
				mihomoFilesHandler.DownloadFile(c)
			})
			mihomoGroup.POST("/rule-providers", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "rule_providers"})
				mihomoFilesHandler.CreateFile(c)
			})
			mihomoGroup.POST("/rule-providers/upload", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "rule_providers"})
				mihomoFilesHandler.UploadFile(c)
			})
			mihomoGroup.PUT("/rule-providers/:filename", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "rule_providers"})
				mihomoFilesHandler.UpdateFile(c)
			})
			mihomoGroup.PUT("/rule-providers/:filename/rename", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "rule_providers"})
				mihomoFilesHandler.RenameFile(c)
			})
			mihomoGroup.DELETE("/rule-providers/:filename", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "dir", Value: "rule_providers"})
				mihomoFilesHandler.DeleteFile(c)
			})
		}

		appGroup := api.Group("/app")
		{
			appGroup.GET("/config", appHandler.GetConfig)
			appGroup.PUT("/config", appHandler.UpdateConfig)
			appGroup.GET("/logs", streamHandler.StreamAppLogs)
			appGroup.DELETE("/logs", streamHandler.ClearAppLogs)
			appGroup.GET("/diagnostics", appHandler.Diagnostics)
			appGroup.POST("/diagnostics/recover", appHandler.RecoverDiagnostics)
			appGroup.GET("/ipv4", appHandler.GetIPv4)
			appGroup.GET("/ipv6", appHandler.GetIPv6)
			appGroup.GET("/geo/ipv4", appHandler.GetGeoIPv4)
			appGroup.GET("/geo/ipv6", appHandler.GetGeoIPv6)
		}
	}
}
