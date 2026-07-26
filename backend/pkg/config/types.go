package config

type Config struct {
	Version    string           `yaml:"version" json:"version"`
	Environment string          `yaml:"environment" json:"environment"`
	Server     ServerConfig     `yaml:"server" json:"server"`
	Mihomo     MihomoConfig     `yaml:"mihomo" json:"mihomo"`
	Logging    LoggingConfig    `yaml:"logging" json:"logging"`
	API        APIConfig        `yaml:"api" json:"api"`
	Backup     BackupConfig     `yaml:"backup" json:"backup"`
	UnlockTest UnlockTestConfig `yaml:"unlock_test" json:"unlock_test"`
}

type ServerConfig struct {
	Port string `yaml:"port" json:"port"`
	Host string `yaml:"host" json:"host"`
	Mode string `yaml:"mode" json:"mode"`
}

type RoutingMode string

const (
	RoutingModeTUN      RoutingMode = "tun"
	RoutingModeTProxy   RoutingMode = "tproxy"
	RoutingModeRedirect RoutingMode = "redirect"
	RoutingModeDisable  RoutingMode = "disable"
)

type RoutingConfig struct {
	TCP            RoutingMode `yaml:"tcp" json:"tcp"`
	UDP            RoutingMode `yaml:"udp" json:"udp"`
	TunDevice      string      `yaml:"tun_device" json:"tun_device"`
	BypassMACs     []string    `yaml:"bypass_macs" json:"bypass_macs"`
	BypassIPs      []string    `yaml:"bypass_ips" json:"bypass_ips"`
	BypassIP6s     []string    `yaml:"bypass_ip6s" json:"bypass_ip6s"`
}

type AutoRestartSettings struct {
	OnCrash          bool   `yaml:"on_crash" json:"on_crash"`
	OnConfigChange   bool   `yaml:"on_config_change" json:"on_config_change"`
	OnNetworkChange  bool   `yaml:"on_network_change" json:"on_network_change"`
	OnRoutingFailure bool   `yaml:"on_routing_failure" json:"on_routing_failure"`
	ScheduleEnabled  bool   `yaml:"schedule_enabled" json:"schedule_enabled"`
	ScheduleInterval string `yaml:"schedule_interval" json:"schedule_interval"` // "daily", "weekly"
	ScheduleTime     string `yaml:"schedule_time" json:"schedule_time"`         // e.g., "04:00"
}

type MihomoConfig struct {
	CorePath        string              `yaml:"core_path" json:"core_path"`
	ConfigPath      string              `yaml:"config_path" json:"config_path"`
	WorkingDir      string              `yaml:"working_dir" json:"working_dir"`
	AutoRestart     bool                `yaml:"auto_restart" json:"auto_restart"`
	AutoRestartOpts AutoRestartSettings `yaml:"auto_restart_opts" json:"auto_restart_opts"`
	AutoStart       bool                `yaml:"auto_start" json:"auto_start"`
	LogFile         string              `yaml:"log_file" json:"log_file"`
	APIURL          string              `yaml:"api_url" json:"api_url"`
	APISecret       string              `yaml:"api_secret" json:"api_secret"`
	Routing         RoutingConfig       `yaml:"routing" json:"routing"`
}

type LoggingConfig struct {
	Level      string `yaml:"level" json:"level"`
	File       string `yaml:"file" json:"file"`
	MaxSize    int    `yaml:"max_size" json:"max_size"`
	MaxBackups int    `yaml:"max_backups" json:"max_backups"`
	MaxAge     int    `yaml:"max_age" json:"max_age"`
}

type APIConfig struct {
	RateLimit     int        `yaml:"rate_limit" json:"rate_limit"`
	Timeout       int        `yaml:"timeout" json:"timeout"`
	EnableSwagger bool       `yaml:"enable_swagger" json:"enable_swagger"`
	AuthToken     string     `yaml:"auth_token" json:"auth_token"`
	CORS          CORSConfig `yaml:"cors" json:"cors"`
}

type CORSConfig struct {
	Enabled          bool     `yaml:"enabled" json:"enabled"`
	AllowedOrigins   []string `yaml:"allowed_origins" json:"allowed_origins"`
	AllowedMethods   []string `yaml:"allowed_methods" json:"allowed_methods"`
	AllowedHeaders   []string `yaml:"allowed_headers" json:"allowed_headers"`
	ExposeHeaders    []string `yaml:"expose_headers" json:"expose_headers"`
	AllowCredentials bool     `yaml:"allow_credentials" json:"allow_credentials"`
	MaxAge           int      `yaml:"max_age" json:"max_age"`
}

type BackupConfig struct {
	AutoBackupEnabled bool                 `yaml:"auto_backup_enabled" json:"auto_backup_enabled"`
	MaxBackups        int                  `yaml:"max_backups" json:"max_backups"`
	MaxAgeDays        int                  `yaml:"max_age_days" json:"max_age_days"`
	BackupDir         string               `yaml:"backup_dir" json:"backup_dir"`
	Targets           []RemoteBackupTarget `yaml:"targets" json:"targets"`
}

type RemoteBackupTarget struct {
	Name     string `yaml:"name" json:"name"`
	Type     string `yaml:"type" json:"type"` // "webdav"
	URL      string `yaml:"url" json:"url"`
	Username string `yaml:"username" json:"username"`
	Password string `yaml:"password" json:"password"`
	Enabled  bool   `yaml:"enabled" json:"enabled"`
}

type UnlockTestConfig struct {
	Targets []UnlockTestTargetConfig `yaml:"targets" json:"targets"`
}

type UnlockTestTargetConfig struct {
	ID       string `yaml:"id" json:"id"`
	Name     string `yaml:"name" json:"name"`
	URL      string `yaml:"url,omitempty" json:"url,omitempty"`
	Host     string `yaml:"host,omitempty" json:"host,omitempty"`
	Expected int    `yaml:"expected,omitempty" json:"expected,omitempty"`
	Type     string `yaml:"type" json:"type"` // "http", "tcp", "dns"
}
