import { Card } from "@/components/ui/card";
import { RetroBtn } from "@/components/ui/retro-btn";
import { BookOpen, Terminal, Info, ExternalLink, Settings } from "lucide-react";

export default function DocsPage() {
  const openWiki = () => {
    window.open("https://wiki.metacubex.one/en/config/", "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
        <div className="absolute right-[-60px] top-[-80px] h-44 w-44 rounded-full border-2 border-black bg-primary/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-heading text-2xl uppercase tracking-wide text-text">Documentation</h1>
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-text-muted">
              mihombreng configuration guide and command references
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Config Parameter Reference */}
        <Card title="Routing configuration reference" icon={<Settings className="h-4 w-4" />}>
          <div className="space-y-4">
            <p className="font-mono text-xs text-text-muted leading-relaxed">
              Below are the key transparent proxy fields configured in `mihombreng.yaml` used to build the netfilter tables:
            </p>
            <div className="space-y-3 font-mono text-[11px] leading-relaxed select-text">
              <div>
                <dt className="font-bold text-text uppercase tracking-wide">tcp / udp</dt>
                <dd className="mt-0.5 text-text-muted">
                  * <code className="text-primary font-bold">tproxy</code>: TCP/UDP policy redirect routing (IPv4/IPv6). Requires lo interface.
                  <br />
                  * <code className="text-primary font-bold">tun</code>: Direct virtual tunnel device interface (Meta).
                  <br />
                  * <code className="text-primary font-bold">redirect</code>: Simple TCP NAT redirect rules.
                </dd>
              </div>
              <hr className="border-black/25" />
              <div>
                <dt className="font-bold text-text uppercase tracking-wide">tun_device</dt>
                <dd className="mt-0.5 text-text-muted">
                  Virtual tun device created by the proxy core. Defaults to `Meta`.
                </dd>
              </div>
              <hr className="border-black/25" />
              <div>
                <dt className="font-bold text-text uppercase tracking-wide">bypass_macs</dt>
                <dd className="mt-0.5 text-text-muted">
                  List of client source MAC addresses (e.g. `00:11:22:33:44:55`) exempted from proxying completely.
                </dd>
              </div>
              <hr className="border-black/25" />
              <div>
                <dt className="font-bold text-text uppercase tracking-wide">bypass_ips / bypass_ip6s</dt>
                <dd className="mt-0.5 text-text-muted">
                  CIDR networks bypassed from nftables interception. Directs matching IP nodes directly to the WAN default link.
                </dd>
              </div>
            </div>
          </div>
        </Card>

        {/* CLI Reference & Logs */}
        <Card title="CLI Command & Logging Cheat-sheet" icon={<Terminal className="h-4 w-4" />}>
          <div className="space-y-4">
            <p className="font-mono text-xs text-text-muted leading-relaxed">
              Standard SSH terminal directories and commands for OpenWrt/Linux router operators:
            </p>
            <div className="space-y-3.5 font-mono text-[11px] leading-relaxed">
              <div>
                <span className="font-bold text-text block uppercase tracking-wide">System Daemon command (OpenWrt)</span>
                <pre className="mt-1 rounded border border-black/40 bg-black/15 p-2 font-mono text-xs text-text">
                  /etc/init.d/mihombreng status<br />
                  /etc/init.d/mihombreng restart
                </pre>
              </div>
              <div>
                <span className="font-bold text-text block uppercase tracking-wide">Systemd command (Debian/Ubuntu)</span>
                <pre className="mt-1 rounded border border-black/40 bg-black/15 p-2 font-mono text-xs text-text">
                  systemctl status mihombreng<br />
                  systemctl restart mihombreng
                </pre>
              </div>
              <div>
                <span className="font-bold text-text block uppercase tracking-wide">Logging paths</span>
                <ul className="list-disc list-inside mt-1 text-text-muted space-y-0.5">
                  <li>Mihombreng Admin panel: <code className="text-text">/var/log/mihombreng.log</code></li>
                  <li>Mihomo Core process: <code className="text-text">/var/log/mihomo.log</code></li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* External resources */}
      <Card title="Detailed Core Setup" icon={<BookOpen className="h-4 w-4" />}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between items-start gap-4">
          <div className="space-y-1.5 min-w-0">
            <p className="font-mono text-xs text-text-muted leading-relaxed">
              Mihombreng coordinates transparent routing tables, but core proxy features (Proxies, Proxy Groups, Rule Profiles) inside config files follow Mihomo standards.
            </p>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>For detailed configurations syntax of mihomo.yaml, refer directly to Metacubex documentation.</span>
            </div>
          </div>
          <RetroBtn variant="primary" size="sm" onClick={openWiki} className="flex-shrink-0">
            <ExternalLink className="h-3.5 w-3.5 mr-1.5 inline-block" />
            Open Mihomo Wiki
          </RetroBtn>
        </div>
      </Card>
    </div>
  );
}
