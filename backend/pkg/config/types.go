package config

type Config struct {
	Version     string        `yaml:"version"`
	Environment string        `yaml:"environment"`
	Server      ServerConfig  `yaml:"server"`
	Mihomo      MihomoConfig  `yaml:"mihomo"`
	Logging     LoggingConfig `yaml:"logging"`
	API         APIConfig     `yaml:"api"`
	Backup      BackupConfig  `yaml:"backup"`
}

type ServerConfig struct {
	Port string `yaml:"port"`
	Host string `yaml:"host"`
	Mode string `yaml:"mode"`
}

type RoutingMode string

const (
	RoutingModeTUN      RoutingMode = "tun"
	RoutingModeTProxy   RoutingMode = "tproxy"
	RoutingModeRedirect RoutingMode = "redirect"
	RoutingModeDisable  RoutingMode = "disable"
)

type RoutingConfig struct {
	TCP       RoutingMode `yaml:"tcp"`
	UDP       RoutingMode `yaml:"udp"`
	TunDevice string      `yaml:"tun_device"`
}

type MihomoConfig struct {
	CorePath    string        `yaml:"core_path"`
	ConfigPath  string        `yaml:"config_path"`
	WorkingDir  string        `yaml:"working_dir"`
	AutoRestart bool          `yaml:"auto_restart"`
	AutoStart   bool          `yaml:"auto_start"`
	LogFile     string        `yaml:"log_file"`
	APIURL      string        `yaml:"api_url"`
	APISecret   string        `yaml:"api_secret"`
	Routing     RoutingConfig `yaml:"routing"`
}

type LoggingConfig struct {
	Level      string `yaml:"level"`
	File       string `yaml:"file"`
	MaxSize    int    `yaml:"max_size"`
	MaxBackups int    `yaml:"max_backups"`
	MaxAge     int    `yaml:"max_age"`
}

type APIConfig struct {
	RateLimit     int        `yaml:"rate_limit"`
	Timeout       int        `yaml:"timeout"`
	EnableSwagger bool       `yaml:"enable_swagger"`
	AuthToken     string     `yaml:"auth_token"`
	CORS          CORSConfig `yaml:"cors"`
}

type CORSConfig struct {
	Enabled          bool     `yaml:"enabled"`
	AllowedOrigins   []string `yaml:"allowed_origins"`
	AllowedMethods   []string `yaml:"allowed_methods"`
	AllowedHeaders   []string `yaml:"allowed_headers"`
	ExposeHeaders    []string `yaml:"expose_headers"`
	AllowCredentials bool     `yaml:"allow_credentials"`
	MaxAge           int      `yaml:"max_age"`
}

type BackupConfig struct {
	AutoBackupEnabled bool                 `yaml:"auto_backup_enabled"`
	MaxBackups        int                  `yaml:"max_backups"`
	MaxAgeDays        int                  `yaml:"max_age_days"`
	BackupDir         string               `yaml:"backup_dir"`
	Targets           []RemoteBackupTarget `yaml:"targets"`
}

type RemoteBackupTarget struct {
	Name     string `yaml:"name"`
	Type     string `yaml:"type"` // "webdav"
	URL      string `yaml:"url"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
	Enabled  bool   `yaml:"enabled"`
}
