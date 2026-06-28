import { describe, it, expect, vi, beforeEach } from "vitest";
import { mihomoApi } from "./api";

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
