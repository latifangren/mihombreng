import { describe, it, expect, vi, beforeEach } from "vitest";
import { mihomoApi, configApi, normalizeAppConfig, serializeAppConfig } from "./api";

describe("mihomoApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getStatus should return running status when success", async () => {
    const mockResponse = {
      success: true,
      data: { running: true, uptime: "2h", cpu: 0.1 },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    vi.stubGlobal("fetch", fetchMock);

    const status = await mihomoApi.getStatus();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/mihomo/status", expect.any(Object));
    expect(status).toEqual({ running: true, uptime: "2h", cpu: 0.1 });
  });

  it("getStatus should return false if response ok but missing data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: null }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const status = await mihomoApi.getStatus();
    expect(status).toEqual({ running: false });
  });

  it("getTraffic should return traffic info when success", async () => {
    const mockResponse = {
      success: true,
      data: { up: 1024, down: 2048 },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    vi.stubGlobal("fetch", fetchMock);

    const traffic = await mihomoApi.getTraffic();
    expect(traffic).toEqual({ up: 1024, down: 2048 });
  });
});

describe("normalizeAppConfig & configApi.getConfig", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should normalize snake_case/lowercase layout to PascalCase structures", async () => {
    const rawSnakeCase = {
      version: "1.0.0",
      environment: "production",
      server: {
        port: "9000",
        host: "127.0.0.1",
        mode: "standalone",
      },
      mihomo: {
        core_path: "/opt/mihomo",
        config_path: "/opt/config.yaml",
        working_dir: "/opt",
        auto_restart: true,
        auto_restart_opts: {
          on_crash: true,
          schedule_enabled: true,
          schedule_interval: "daily",
        },
        auto_start: false,
        log_file: "/opt/mihomo.log",
        api_url: "http://127.0.0.1:9090",
        api_secret: "mysecret",
        routing: {
          tcp: "tproxy",
          udp: "tun",
          tun_device: "utun",
          bypass_macs: ["00:11:22:33:44:55"],
        },
      },
      logging: {
        level: "debug",
        file: "/opt/app.log",
      },
      api: {
        rate_limit: 200,
        timeout: 60,
        enable_swagger: true,
        auth_token: "secrettoken",
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: rawSnakeCase }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const config = await configApi.getConfig();

    expect(config.server).toEqual({
      Port: "9000",
      Host: "127.0.0.1",
      Mode: "standalone",
    });

    expect(config.mihomo.CorePath).toBe("/opt/mihomo");
    expect(config.mihomo.ConfigPath).toBe("/opt/config.yaml");
    expect(config.mihomo.WorkingDir).toBe("/opt");
    expect(config.mihomo.AutoRestart).toBe(true);
    expect(config.mihomo.AutoStart).toBe(false);
    expect(config.mihomo.LogFile).toBe("/opt/mihomo.log");
    expect(config.mihomo.APIURL).toBe("http://127.0.0.1:9090");
    expect(config.mihomo.APISecret).toBe("mysecret");

    expect(config.mihomo.Routing).toEqual({
      TCP: "tproxy",
      UDP: "tun",
      TunDevice: "utun",
      TunStack: "system",
      BypassMACs: ["00:11:22:33:44:55"],
      BypassIPs: [],
      BypassIP6s: [],
    });

    expect(config.api).toEqual({
      RateLimit: 200,
      Timeout: 60,
      EnableSwagger: true,
      AuthToken: "secrettoken",
    });
  });

  it("should normalize PascalCase layout seamlessly", async () => {
    const rawPascalCase = {
      Version: "2.0.0",
      Environment: "development",
      Server: {
        Port: "8080",
        Host: "0.0.0.0",
        Mode: "embedded",
      },
      Mihomo: {
        CorePath: "/bin/mihomo",
        ConfigPath: "/etc/mihomo.yaml",
        WorkingDir: "/etc",
        AutoRestart: false,
        AutoStart: true,
        LogFile: "/var/log/mihomo.log",
        APIURL: "http://localhost:9090",
        APISecret: "",
        Routing: {
          TCP: "redirect",
          UDP: "tproxy",
          TunDevice: "Meta",
          TunStack: "system",
        },
      },
      API: {
        RateLimit: 100,
        Timeout: 30,
        EnableSwagger: false,
        AuthToken: "",
      },
    };

    const normalized = normalizeAppConfig(rawPascalCase);
    expect(normalized.server.Port).toBe("8080");
    expect(normalized.mihomo.CorePath).toBe("/bin/mihomo");
    expect(normalized.mihomo.Routing.TCP).toBe("redirect");
    expect(normalized.api.EnableSwagger).toBe(false);
  });

  it("should serialize AppConfig with dual-casing for nested parameters", () => {
    const inputConfig = {
      server: {
        Port: "8080",
        Host: "0.0.0.0",
        Mode: "standalone",
      },
      mihomo: {
        CorePath: "/usr/bin/mihomo",
        ConfigPath: "/etc/mihomo/config.yaml",
        WorkingDir: "/etc/mihomo",
        AutoRestart: true,
        auto_restart_opts: {
          on_crash: true,
          on_config_change: false,
          on_network_change: true,
          on_routing_failure: false,
          schedule_enabled: true,
          schedule_interval: "daily",
          schedule_time: "04:00",
        },
        AutoStart: true,
        LogFile: "/var/log/mihomo.log",
        APIURL: "http://127.0.0.1:9090",
        APISecret: "secret",
        Routing: {
          TCP: "tproxy",
          UDP: "tproxy",
          TunDevice: "Meta",
          TunStack: "system",
          BypassMACs: ["aa:bb:cc:dd:ee:ff"],
        },
      },
      logging: {
        level: "info",
        file: "/var/log/app.log",
        max_size: 100,
        max_backups: 3,
        max_age: 28,
      },
      api: {
        RateLimit: 100,
        Timeout: 30,
        EnableSwagger: true,
        AuthToken: "token",
      },
      backup: {
        auto_backup_enabled: true,
        max_backups: 10,
        max_age_days: 30,
        backup_dir: "/backups",
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serialized = serializeAppConfig(inputConfig) as Record<string, any>;

    // Server
    expect(serialized.server).toBeDefined();
    expect(serialized.Server).toBeDefined();
    expect(serialized.server.port).toBe("8080");
    expect(serialized.server.Port).toBe("8080");

    // Mihomo & Routing
    expect(serialized.mihomo).toBeDefined();
    expect(serialized.Mihomo).toBeDefined();
    expect(serialized.mihomo.core_path).toBe("/usr/bin/mihomo");
    expect(serialized.mihomo.CorePath).toBe("/usr/bin/mihomo");

    expect(serialized.mihomo.routing).toBeDefined();
    expect(serialized.mihomo.Routing).toBeDefined();
    expect(serialized.mihomo.routing.tcp).toBe("tproxy");
    expect(serialized.mihomo.routing.TCP).toBe("tproxy");
    expect(serialized.mihomo.routing.bypass_macs).toEqual(["aa:bb:cc:dd:ee:ff"]);
    expect(serialized.mihomo.routing.BypassMACs).toEqual(["aa:bb:cc:dd:ee:ff"]);

    // AutoRestartOpts
    expect(serialized.mihomo.auto_restart_opts).toBeDefined();
    expect(serialized.mihomo.AutoRestartOpts).toBeDefined();
    expect(serialized.mihomo.auto_restart_opts.on_crash).toBe(true);
    expect(serialized.mihomo.auto_restart_opts.OnCrash).toBe(true);

    // Logging
    expect(serialized.logging).toBeDefined();
    expect(serialized.Logging).toBeDefined();
    expect(serialized.logging.level).toBe("info");
    expect(serialized.logging.Level).toBe("info");

    // API
    expect(serialized.api).toBeDefined();
    expect(serialized.API).toBeDefined();
    expect(serialized.api.rate_limit).toBe(100);
    expect(serialized.api.RateLimit).toBe(100);

    // Backup
    expect(serialized.backup).toBeDefined();
    expect(serialized.Backup).toBeDefined();
    expect(serialized.backup.auto_backup_enabled).toBe(true);
    expect(serialized.backup.AutoBackupEnabled).toBe(true);
  });
});

