import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Shell } from "@/components/layout/shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";

const DashboardPage = lazy(() => import("@/app/page"));
const MihomoPage = lazy(() => import("@/app/mihomo/page"));
const ConfigEditorPage = lazy(() => import("@/app/mihomo/config/page"));
const ManagerPage = lazy(() => import("@/app/manager/page"));
const ProvidersPage = lazy(() => import("@/app/providers/page"));
const ProfilesPage = lazy(() => import("@/app/profiles/page"));
const LogsPage = lazy(() => import("@/app/logs/page"));
const ToolsPage = lazy(() => import("@/app/tools/page"));
const BackupPage = lazy(() => import("@/app/backup/page"));
const DiagnosticsPage = lazy(() => import("@/app/diagnostics/page"));
const SettingsPage = lazy(() => import("@/app/settings/page"));
const TrafficPage = lazy(() => import("@/app/traffic/page"));
const ConnectionsPage = lazy(() => import("@/app/connections/page"));

const Fallback = () => (
  <div className="flex items-center justify-center h-64">
    <Skeleton className="h-32 w-full max-w-md" />
  </div>
);

const Lazy = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<Fallback />}>{children}</Suspense>
);

const E = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Lazy>{children}</Lazy>
  </ErrorBoundary>
);

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#2a2a2a",
            color: "#f9f4da",
            border: "2px solid #000",
            borderRadius: "10px",
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: "13px",
          },
        }}
      />
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<E><DashboardPage /></E>} />
          <Route path="mihomo" element={<E><MihomoPage /></E>} />
          <Route path="mihomo/config" element={<E><ConfigEditorPage /></E>} />
          <Route path="manager" element={<E><ManagerPage /></E>} />
          <Route path="providers" element={<E><ProvidersPage /></E>} />
          <Route path="profiles" element={<E><ProfilesPage /></E>} />
          <Route path="logs" element={<E><LogsPage /></E>} />
          <Route path="tools" element={<E><ToolsPage /></E>} />
          <Route path="backup" element={<E><BackupPage /></E>} />
          <Route path="diagnostics" element={<E><DiagnosticsPage /></E>} />
          <Route path="settings" element={<E><SettingsPage /></E>} />
          <Route path="traffic" element={<E><TrafficPage /></E>} />
          <Route path="connections" element={<E><ConnectionsPage /></E>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
