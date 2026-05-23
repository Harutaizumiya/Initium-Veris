import React from "react";
import { logger } from "../../lib/logger";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("error_boundary", "Application error boundary caught an error", {
      event: "react_error_boundary_caught",
      error,
      componentStack: errorInfo.componentStack,
    });

    if (import.meta.env.DEV) {
      console.error("Application error boundary caught an error", error, errorInfo);
    }
  }

  private reloadPage = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface px-6">
          <section className="ambient-shadow w-full max-w-xl rounded-[2rem] border border-surface-container/10 bg-surface-container-lowest p-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl font-black text-red-500">
              !
            </div>
            <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">页面运行异常</h1>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              当前页面遇到运行时错误。可以刷新页面恢复，如果问题重复出现，请保留控制台错误信息。
            </p>
            {import.meta.env.DEV ? (
              <pre className="mt-5 max-h-40 overflow-auto rounded-2xl bg-surface-container-low p-4 text-left text-xs text-on-surface-variant">
                {this.state.error.message}
              </pre>
            ) : null}
            <button
              type="button"
              onClick={this.reloadPage}
              className="mt-6 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary-container"
            >
              刷新页面
            </button>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}
