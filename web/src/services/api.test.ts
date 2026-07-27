import { describe, it, expect, vi, beforeEach } from "vitest";
import { mihomoApi, configApi, normalizeAppConfig } from "./api";

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
});

