"use client";

import { Component, type ReactNode } from "react";
import { RetroBtn } from "@/components/ui/retro-btn";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="max-w-md text-center">
            {/* Error icon */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[14px] border-2 border-danger bg-surface">
              <span className="font-heading text-2xl text-danger">!</span>
            </div>

            <h2 className="font-heading text-xl uppercase tracking-wide text-text">
              Something Broke
            </h2>

            <div className="mt-3 rounded-[10px] border-2 border-border bg-surface p-4 text-left">
              <div className="font-mono text-[11px] text-text-muted">Error:</div>
              <div className="mt-1 font-mono text-xs text-danger break-words">
                {this.state.error?.message || "Unknown error"}
              </div>
            </div>

            <div className="mt-6 flex justify-center gap-3">
              <RetroBtn variant="primary" size="sm" onClick={this.handleReload}>
                Try Again
              </RetroBtn>
              <RetroBtn
                variant="ghost"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </RetroBtn>
            </div>

            <p className="mt-4 font-mono text-[10px] text-text-muted">
              If this keeps happening, check the app logs
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
