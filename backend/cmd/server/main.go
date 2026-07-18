package main

import (
	"context"
	"flag"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	_ "mihombreng/docs"
	"mihombreng/internal/http/router"
	"mihombreng/internal/service"
	"mihombreng/internal/service/routing"
	"mihombreng/internal/subscription"
	"mihombreng/internal/ui"
	"mihombreng/pkg/config"
	"mihombreng/pkg/logger"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// @title Mihombreng API
// @version 1.0
// @description Backend API for the Mihombreng controller

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @BasePath /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
func main() {
	var configPath string
	flag.StringVar(&configPath, "config", "/etc/mihombreng/mihombreng.yaml", "Path to configuration file")
	flag.StringVar(&configPath, "c", "/etc/mihombreng/mihombreng.yaml", "Path to configuration file (shorthand)")
	flag.Parse()

	// Detect if user explicitly passed -c or --config
	explicitConfig := false
	flag.Visit(func(f *flag.Flag) {
		if f.Name == "c" || f.Name == "config" {
			explicitConfig = true
		}
	})

	if !explicitConfig {
		// System path was not explicitly requested — check if it's accessible
		systemPath := "/etc/mihombreng/mihombreng.yaml"
		if _, err := os.Stat(systemPath); os.IsNotExist(err) {
			// File doesn't exist — check if we can create the parent dir
			if mkdirErr := os.MkdirAll(filepath.Dir(systemPath), 0755); mkdirErr != nil {
				// Can't create /etc/mihombreng/ — fall back to user config
				homeDir, _ := os.UserHomeDir()
				userConfigPath := filepath.Join(homeDir, ".config", "mihombreng", "mihombreng.yaml")
				log.Printf("System config not accessible (%v), falling back to user config: %s", mkdirErr, userConfigPath)
				configPath = userConfigPath
			}
			// else: MkdirAll succeeded, configPath stays as system path
		}
		// else: file exists at system path, configPath stays as-is
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		log.Printf("Failed to load config from %s: %v", configPath, err)
		os.Exit(1)
	}

	if err := logger.Init(cfg.Logging.Level, cfg.Logging.File); err != nil {
		log.Printf("Failed to initialize logger: %v", err)
		os.Exit(1)
	}
	defer logger.Close()

	gin.SetMode(cfg.Server.Mode)
	app := gin.New()
	app.RedirectTrailingSlash = false
	app.RedirectFixedPath = false

	nftablesService := routing.NewNftablesService()
	logger.Info("Executing pre-startup routing cleanup...")
	if err := nftablesService.CleanupAllRouting(); err != nil {
		logger.Debugf("Pre-startup routing cleanup warning: %v (expected if not on a Linux system with nftables)", err)
	}

	mihomoService := service.NewMihomoService(cfg, configPath, nftablesService)
	subscriptionService := subscription.NewService(cfg.Mihomo.WorkingDir)
	subscriptionService.StartScheduler(context.Background())

	if err := mihomoService.RestoreState(); err != nil {
		log.Printf("Failed to restore mihomo state: %v", err)
	}

	router.Setup(app, mihomoService, cfg, configPath, subscriptionService)

	if cfg.API.EnableSwagger {
		app.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	}

	staticFS, err := ui.GetStaticFS()
	if err != nil {
		log.Printf("Warning: Failed to get embedded static files: %v", err)
	} else {
		indexFile, err := staticFS.Open("index.html")
		var indexBytes []byte
		if err == nil {
			indexBytes, _ = io.ReadAll(indexFile)
			indexFile.Close()
		} else {
			log.Printf("Error reading index.html: %v", err)
		}

		serveIndex := func(c *gin.Context) {
			c.Data(http.StatusOK, "text/html; charset=utf-8", indexBytes)
		}

		app.GET("/", serveIndex)

		app.NoRoute(func(c *gin.Context) {
			if !strings.HasPrefix(c.Request.URL.Path, "/api/") {
				serveIndex(c)
				return
			}
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		})

		app.GET("/assets/*filepath", func(c *gin.Context) {
			c.FileFromFS("assets"+c.Param("filepath"), http.FS(staticFS))
		})
		app.GET("/favicon.svg", func(c *gin.Context) {
			c.FileFromFS("favicon.svg", http.FS(staticFS))
		})
	}

	address := cfg.Server.Host + ":" + cfg.Server.Port
	log.Printf("Starting server on %s", address)

	server := &http.Server{
		Addr:    address,
		Handler: app,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("Failed to start server: %v", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	if mihomoService.GetStatus() == "running" {
		log.Println("Stopping mihomo service...")
		if err := mihomoService.Stop(false); err != nil {
			log.Printf("Failed to stop mihomo: %v", err)
		}
	}

	log.Println("Executing final routing cleanup on shutdown...")
	if err := nftablesService.CleanupAllRouting(); err != nil {
		log.Printf("Final routing cleanup warning: %v (expected if not on a Linux system with nftables)", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
