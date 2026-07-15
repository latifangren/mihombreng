import { AlertTriangle, ArrowUpRight, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { AppUpdateCheck } from "@/types";
import { RetroBtn } from "@/components/ui/retro-btn";

function previewChangelog(changelog: string) {
  return changelog
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.match(/^#+\s*$/))
    .slice(0, 4);
}

export function UpdateWarningBanner({ update }: { update: AppUpdateCheck | null }) {
  const navigate = useNavigate();
  const changelogPreview = useMemo(() => previewChangelog(update?.changelog || ""), [update?.changelog]);

  if (!update?.has_update) return null;

  return (
    <div className="relative overflow-hidden rounded-[14px] border-2 border-warning bg-warning/10 p-4 shadow-[6px_6px_0_#000]">
      <div className="absolute right-[-40px] top-[-50px] h-28 w-28 rounded-full border-2 border-black bg-danger/10" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border-2 border-black bg-warning/20">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-sm uppercase tracking-wide text-warning">Update available</p>
              <p className="mt-1 font-mono text-xs leading-relaxed text-text">
                Mihombreng {update.latest_version || "latest"} is available. You are running {update.current_version || "an older version"}.
                Create a manual backup in Backup &amp; Sync before upgrading so configuration and provider files can be restored if anything goes sideways.
              </p>
            </div>
          </div>

          {(update.backup_warning || update.upgrade_hint) && (
            <div className="rounded-[10px] border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[11px] leading-relaxed text-text">
              <ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 text-danger" />
              {update.backup_warning || "Manual backup strongly recommended before upgrade."}
              {update.upgrade_hint && <span className="block pt-1 text-text-muted">{update.upgrade_hint}</span>}
            </div>
          )}

          {changelogPreview.length > 0 && (
            <div className="rounded-[10px] border border-black/50 bg-black/10 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Changelog preview</p>
              <ul className="mt-1 space-y-1 font-mono text-[11px] leading-relaxed text-text-muted">
                {changelogPreview.map((line) => (
                  <li key={line} className="truncate">
                    {line.replace(/^[-*]\s*/, "")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <RetroBtn size="sm" variant="primary" onClick={() => navigate("/backup")}>
            Create Manual Backup
          </RetroBtn>
          {update.release_url && (
            <a href={update.release_url} target="_blank" rel="noreferrer">
              <RetroBtn size="sm" variant="ghost">
                Release Notes
                <ArrowUpRight className="ml-1.5 inline h-3.5 w-3.5" />
              </RetroBtn>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
