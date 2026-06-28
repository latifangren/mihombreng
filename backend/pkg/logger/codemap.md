# pkg/logger/

## Responsibility
Package-level logging facade that wraps Go's standard `log` package. Provides leveled logging (debug/info/warn/error/fatal) with optional dual output to stdout and a log file. Manages log file lifecycle (creation, directory setup, closure).

## Design
- **Package-level state**: `logFile *os.File` and `logLevel string` are module-scoped globals. Not a struct — logger is a singleton initialized once at startup.
- **Dual output**: `io.MultiWriter(os.Stdout, logFile)` tees log output to both console and file when a log path is configured.
- **Level filtering**: `shouldLog(targetLevel)` compares numeric severity levels (debug=0, info=1, warn=2, error=3). Messages below the configured threshold are suppressed.
- **Leveled API pairs**: Each level has a plain string variant (`Info(msg)`) and a printf-style variant (`Infof(format, args...)`). `Fatal`/`Fatalf` delegate to `log.Fatalf` which calls `os.Exit(1)`.
- **Directory auto-creation**: `Init` calls `os.MkdirAll` on the log file's parent directory before opening.

## Flow
```
cmd/server/main.go
  → logger.Init(level, logPath)
    ├── os.MkdirAll(logDir)
    ├── os.OpenFile(logPath, CREATE|WRONLY|APPEND)
    ├── io.MultiWriter(stdout, logFile) → log.SetOutput
    └── log level validation + initial message
  → logger.Info("message") — called throughout application
    └── shouldLog("info") → level check → log.Printf("[INFO] message")
  → logger.Close()
    └── logFile.Close()
```

## Integration
| Dependency | Direction | Purpose |
|---|---|---|
| `cmd/server/main.go` | consumed by | `Init` and `Close` at startup/shutdown |
| `internal/service/*` | consumed by | `Infof`, `Errorf`, `Warnf` for operational logging |
| stdlib `log` | wraps | Core logging output |
| stdlib `os` | uses | Log file creation and management |
