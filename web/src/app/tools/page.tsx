"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { RetroBtn } from "@/components/ui/retro-btn";
import { DataState } from "@/components/ui/data-state";
import { Badge } from "@/components/ui/badge";
import { dnsApi, converterApi } from "@/services/api";
import type { ProxyNode } from "@/types";
import {
  AlertTriangle,
  Copy,
  Download,
  Globe,
  Info,
  Repeat,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) throw new Error("Clipboard command was rejected");
  } finally {
    document.body.removeChild(textarea);
  }
}

/* ── helpers ────────────────────────────────────────────── */

function proxyTypeBadgeVariant(type: string): "success" | "info" | "warning" | "danger" | "default" {
  switch (type) {
    case "vmess":
      return "info";
    case "vless":
      return "success";
    case "trojan":
      return "warning";
    case "ss":
      return "danger";
    default:
      return "default";
  }
}

function buildProxyLink(p: ProxyNode): string {
  if (p.raw?.trim()) return p.raw.trim();

  switch (p.type) {
    case "vmess":
      return buildVmessLink(p);
    case "vless":
      return buildVlessLink(p);
    case "trojan":
      return buildTrojanLink(p);
    case "ss":
      return buildSsLink(p);
    default:
      return "";
  }
}

function buildVmessLink(p: ProxyNode): string {
  const obj: Record<string, unknown> = {
    v: "2",
    ps: p.name,
    add: p.server,
    port: p.port,
    id: p.uuid,
    aid: 0,
    net: p.network || "tcp",
    type: "none",
    host: "",
    path: p["ws-path"] || "",
    tls: p.tls ? "tls" : "",
  };
  if (p.sni) obj.sni = p.sni;
  return "vmess://" + btoa(JSON.stringify(obj));
}

function buildVlessLink(p: ProxyNode): string {
  const params = new URLSearchParams();
  if (p.tls) params.set("security", "tls");
  if (p.sni) params.set("sni", p.sni);
  if (p.network) params.set("type", p.network);
  if (p["ws-path"]) params.set("path", p["ws-path"]);
  const qs = params.toString();
  return `vless://${p.uuid}@${p.server}:${p.port}#${encodeURIComponent(p.name)}${qs ? "?" + qs : ""}`;
}

function buildTrojanLink(p: ProxyNode): string {
  const params = new URLSearchParams();
  if (p.tls) params.set("security", "tls");
  if (p.sni) params.set("sni", p.sni);
  if (p.network) params.set("type", p.network);
  if (p["ws-path"]) params.set("path", p["ws-path"]);
  const qs = params.toString();
  return `trojan://${p.password}@${p.server}:${p.port}#${encodeURIComponent(p.name)}${qs ? "?" + qs : ""}`;
}

function buildSsLink(p: ProxyNode): string {
  const userinfo = btoa(`${p.cipher}:${p.password}`);
  return `ss://${userinfo}@${p.server}:${p.port}#${encodeURIComponent(p.name)}`;
}

function yamlQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function proxiesToYaml(proxies: ProxyNode[]): string {
  let out = "proxies:\n";
  for (const p of proxies) {
    out += `  - name: ${yamlQuote(p.name)}\n`;
    out += `    type: ${p.type}\n`;
    out += `    server: ${yamlQuote(p.server)}\n`;
    out += `    port: ${p.port}\n`;
    if (p.uuid) out += `    uuid: ${yamlQuote(p.uuid)}\n`;
    if (p.password) out += `    password: ${yamlQuote(p.password)}\n`;
    if (p.cipher) out += `    cipher: ${yamlQuote(p.cipher)}\n`;
    if (p.tls) out += `    tls: true\n`;
    if (p.sni) out += `    sni: ${yamlQuote(p.sni)}\n`;
    if (p.network) out += `    network: ${p.network}\n`;
    if (p["ws-path"]) out += `    ws-path: ${yamlQuote(p["ws-path"])}\n`;
    if (p["grpc-service-name"]) out += `    grpc-service-name: ${yamlQuote(p["grpc-service-name"])}\n`;
    if (p.flow) out += `    flow: ${yamlQuote(p["flow"])}\n`;
    if (p.alpn && p.alpn.length) out += `    alpn:\n${p.alpn.map((a) => `      - ${yamlQuote(a)}`).join("\n")}\n`;
  }
  return out;
}

/* ── main page ──────────────────────────────────────────── */

export default function ToolsPage() {
  /* converter state */
  const [subInput, setSubInput] = useState("");
  const [proxies, setProxies] = useState<ProxyNode[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);

  /* dns state */
  const [domain, setDomain] = useState("");
  const [ipv4, setIpv4] = useState<string[]>([]);
  const [ipv6, setIpv6] = useState<string[]>([]);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsError, setDnsError] = useState<string | null>(null);

  /* ── converter handlers ─────────────────────────────── */

  const handleParse = async () => {
    const input = subInput.trim();
    if (!input) return;
    setConvLoading(true);
    setConvError(null);
    setProxies([]);

    try {
      const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const singleLine = lines.length === 1 ? lines[0] : "";
      const isSubscriptionUrl = /^https?:\/\//i.test(singleLine);
      const isSingleProxyLink = /^(vmess|vless|trojan|ss):\/\//i.test(singleLine);

      if (isSubscriptionUrl || isSingleProxyLink) {
        const result = await converterApi.parseUrl(singleLine);
        if (result.success && result.proxies) {
          setProxies(result.proxies);
        } else {
          setConvError(result.error || "Parse failed");
        }
      } else {
        const allLinks = lines.filter((l) => /^(vmess|vless|trojan|ss):\/\//i.test(l));
        const otherLines = lines.filter((l) => !/^(vmess|vless|trojan|ss):\/\//i.test(l));

        if (allLinks.length > 0) {
          const results = await Promise.all(allLinks.map((link) => converterApi.parseUrl(link)));
          const allProxies = results.flatMap((r) => (r.success && r.proxies) || []);
          if (allProxies.length > 0) {
            setProxies(allProxies);
          } else {
            setConvError("No valid proxy links found");
          }
        } else if (otherLines.length > 0) {
          const joined = otherLines.join("\n");
          const result = await converterApi.parseContent(joined);
          if (result.success && result.proxies) {
            setProxies(result.proxies);
          } else {
            setConvError(result.error || "No valid proxies found in content");
          }
        } else {
          setConvError("No valid proxy links found");
        }
      }
    } catch (err) {
      setConvError(err instanceof Error ? err.message : "Conversion failed");
    } finally {
      setConvLoading(false);
    }
  };

  const copyLink = async (p: ProxyNode) => {
    const link = buildProxyLink(p);
    if (!link) {
      toast.error(`Unsupported proxy type: ${p.type}`);
      return;
    }
    try {
      await writeClipboardText(link);
      toast.success(`Copied ${p.type} link for ${p.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Copy failed");
    }
  };

  const copyAllLinks = async () => {
    const links = proxies.map((p) => buildProxyLink(p)).filter(Boolean).join("\n");
    if (!links) {
      toast.error("No proxy links available to copy");
      return;
    }
    try {
      await writeClipboardText(links);
      toast.success(`Copied ${proxies.length} proxy links`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Copy failed");
    }
  };

  const downloadYaml = () => {
    const yaml = proxiesToYaml(proxies);
    const blob = new Blob([yaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proxies-${new Date().toISOString().slice(0, 10)}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("YAML file downloaded");
  };

  /* ── dns handlers ───────────────────────────────────── */

  const handleDnsLookup = async () => {
    const d = domain.trim();
    if (!d) return;
    setDnsLoading(true);
    setDnsError(null);
    setIpv4([]);
    setIpv6([]);

    try {
      const result = await dnsApi.lookup(d);
      if (result.success) {
        setIpv4(result.ipv4 || []);
        setIpv6(result.ipv6 || []);
        if ((result.ipv4 || []).length === 0 && (result.ipv6 || []).length === 0) {
          setDnsError("No A or AAAA records found");
        }
      } else {
        setDnsError(result.error || "Lookup failed");
      }
    } catch (err) {
      setDnsError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setDnsLoading(false);
    }
  };

  const copyIp = async (ip: string) => {
    try {
      await writeClipboardText(ip);
      toast.success(`Copied ${ip}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Copy failed");
    }
  };

  const totalIps = ipv4.length + ipv6.length;

  /* ── render ──────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
        <div className="absolute right-[-60px] top-[-80px] h-44 w-44 rounded-full border-2 border-black bg-primary/10" />
        <div className="relative">
          <h1 className="font-heading text-2xl uppercase tracking-wide text-text">Tools</h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-text-muted">
            Subscription converter, proxy parser, and DNS lookup utilities
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-[6px] border-2 border-black bg-black/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
              <Repeat className="h-3 w-3" />
              Subscription Converter
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-[6px] border-2 border-black bg-black/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
              <Search className="h-3 w-3" />
              DNS Lookup
            </span>
          </div>
        </div>
      </div>

      {/* ── Subscription Converter ─────────────────────── */}
      <Card title="Subscription Converter" icon={<Repeat className="h-4 w-4" />}>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Parse subscription URLs, individual proxy links, or base64-encoded content into structured proxy nodes
        </p>
        <div className="space-y-3">
          <textarea
            value={subInput}
            onChange={(e) => setSubInput(e.target.value)}
            placeholder={"Paste subscription URL, proxy links, or base64 content...\n\nSupported formats:\n  https://example.com/sub\n  vmess://...  vless://...  trojan://...  ss://...\n\nOne per line for multiple links"}
            rows={6}
            className="w-full rounded-[10px] border-2 border-black bg-background px-4 py-3 font-mono text-sm text-text outline-none placeholder:text-text-muted focus:border-primary resize-y"
          />

          <div className="flex items-center gap-3">
            <RetroBtn size="sm" onClick={handleParse} disabled={convLoading || !subInput.trim()} loading={convLoading}>
              <Repeat className="mr-1.5 inline-block h-3.5 w-3.5" />
              {convLoading ? "Parsing..." : "Parse"}
            </RetroBtn>

            {proxies.length > 0 && (
              <>
                <RetroBtn size="sm" variant="ghost" onClick={copyAllLinks}>
                  <Copy className="mr-1.5 inline-block h-3.5 w-3.5" />
                  Copy All
                </RetroBtn>
                <RetroBtn size="sm" variant="ghost" onClick={downloadYaml}>
                  <Download className="mr-1.5 inline-block h-3.5 w-3.5" />
                  Export YAML
                </RetroBtn>
              </>
            )}
          </div>

          {/* Error */}
          {convError && (
            <DataState
              tone="danger"
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Parse failed"
              message={convError}
            />
          )}

          {/* Results */}
          {proxies.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  {proxies.length} proxy {proxies.length === 1 ? "node" : "nodes"} parsed
                </p>
                <div className="flex gap-1.5">
                  {(["vmess", "vless", "trojan", "ss"] as const).map((type) => {
                    const count = proxies.filter((p) => p.type === type).length;
                    if (count === 0) return null;
                    return (
                      <Badge key={type} variant={proxyTypeBadgeVariant(type)}>
                        {count} {type}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                {proxies.map((p) => (
                  <div
                    key={`${p.name}-${p.server}-${p.port}`}
                    className="flex items-center gap-3 rounded-[10px] border-2 border-black bg-black/15 px-4 py-2.5 shadow-[3px_3px_0_#000]"
                  >
                    <Badge variant={proxyTypeBadgeVariant(p.type)}>{p.type}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm text-text">{p.name}</p>
                      <p className="font-mono text-[10px] text-text-muted">
                        {p.server}:{p.port}
                        {p.tls && <span className="ml-1.5 text-primary">TLS</span>}
                        {p.network && <span className="ml-1.5">{p.network}</span>}
                      </p>
                    </div>
                    <RetroBtn size="sm" variant="ghost" onClick={() => copyLink(p)}>
                      <Copy className="h-3 w-3" />
                    </RetroBtn>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!convLoading && !convError && proxies.length === 0 && subInput.trim() === "" && (
            <DataState
              tone="neutral"
              icon={<Info className="h-4 w-4" />}
              title="Enter subscription data above"
              message="Paste a subscription URL, one or more proxy links (vmess://, vless://, trojan://, ss://), or base64-encoded content."
            />
          )}
        </div>
      </Card>

      {/* ── DNS Lookup ─────────────────────────────────── */}
      <Card title="DNS Lookup" icon={<Search className="h-4 w-4" />}>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Resolve a domain name to its IPv4 and IPv6 addresses
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDnsLookup()}
            placeholder="Enter domain name (e.g. example.com)..."
            className="w-full rounded-[10px] border-2 border-black bg-background px-4 py-2.5 font-mono text-sm text-text outline-none placeholder:text-text-muted focus:border-primary"
          />

          <div className="flex items-center gap-3">
            <RetroBtn size="sm" onClick={handleDnsLookup} disabled={dnsLoading || !domain.trim()} loading={dnsLoading}>
              <Search className="mr-1.5 inline-block h-3.5 w-3.5" />
              {dnsLoading ? "Resolving..." : "Lookup"}
            </RetroBtn>
          </div>

          {/* Error */}
          {dnsError && (
            <DataState
              tone={ipv4.length === 0 && ipv6.length === 0 ? "danger" : "warning"}
              icon={<AlertTriangle className="h-4 w-4" />}
              title={totalIps === 0 ? "No records found" : "Partial results"}
              message={dnsError}
            />
          )}

          {/* Results */}
          {totalIps > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  {totalIps} {totalIps === 1 ? "record" : "records"} found
                </p>
                {domain.trim() && (
                  <span className="rounded-[4px] border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                    {domain.trim()}
                  </span>
                )}
              </div>

              {ipv4.length > 0 && (
                <div>
                  <p className="mb-2 font-heading text-xs font-semibold uppercase tracking-wider text-text-muted">
                    IPv4
                  </p>
                  <div className="space-y-1">
                    {ipv4.map((ip) => (
                      <div
                        key={ip}
                        className="flex items-center justify-between rounded-[10px] border-2 border-black bg-black/15 px-4 py-2 shadow-[3px_3px_0_#000]"
                      >
                        <span className="font-mono text-sm text-text">{ip}</span>
                        <RetroBtn size="sm" variant="ghost" onClick={() => copyIp(ip)}>
                          <Copy className="h-3 w-3" />
                        </RetroBtn>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ipv6.length > 0 && (
                <div>
                  <p className="mb-2 font-heading text-xs font-semibold uppercase tracking-wider text-text-muted">
                    IPv6
                  </p>
                  <div className="space-y-1">
                    {ipv6.map((ip) => (
                      <div
                        key={ip}
                        className="flex items-center justify-between rounded-[10px] border-2 border-black bg-black/15 px-4 py-2 shadow-[3px_3px_0_#000]"
                      >
                        <span className="font-mono text-sm text-text">{ip}</span>
                        <RetroBtn size="sm" variant="ghost" onClick={() => copyIp(ip)}>
                          <Copy className="h-3 w-3" />
                        </RetroBtn>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!dnsLoading && !dnsError && ipv4.length === 0 && ipv6.length === 0 && domain.trim() === "" && (
            <DataState
              tone="neutral"
              icon={<Globe className="h-4 w-4" />}
              title="Enter a domain to resolve"
              message="Type a domain name and press Enter or click Lookup to resolve its IPv4 and IPv6 addresses."
            />
          )}
        </div>
      </Card>
    </div>
  );
}
