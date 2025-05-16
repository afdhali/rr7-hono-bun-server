// app/components/suspense/SuspenseWrapper.tsx
// Perbaikan untuk SuspenseErrorBoundary
import React, { Suspense, type ReactNode } from "react";

// Tipe untuk error boundary props dengan render prop
interface SuspenseErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode | ((error: Error) => ReactNode);
}

// Tipe state untuk error boundary
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ErrorBoundary komponen yang mendukung render prop untuk fallback
export class SuspenseErrorBoundary extends React.Component<
  SuspenseErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: SuspenseErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by SuspenseErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Cek apakah fallback adalah fungsi atau ReactNode
      if (typeof this.props.fallback === "function") {
        // Jika fungsi, panggil dengan error sebagai argument
        return this.props.fallback(this.state.error!);
      }
      // Jika bukan fungsi, render fallback langsung
      return this.props.fallback;
    }

    return this.props.children;
  }
}

// Wrapper component yang menggabungkan Suspense dan ErrorBoundary
export default function SuspenseWrapper({
  children,
  fallback,
  errorFallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
  errorFallback?: ReactNode | ((error: Error) => ReactNode);
}) {
  return (
    <SuspenseErrorBoundary fallback={errorFallback || <DefaultErrorFallback />}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </SuspenseErrorBoundary>
  );
}

// Component default untuk error fallback
function DefaultErrorFallback() {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-md">
      <h2 className="text-lg font-semibold text-red-800 mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-red-700 mb-4">
        An unexpected error occurred while loading data
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-3 py-1 bg-red-100 text-red-800 rounded-md text-sm"
      >
        Try again
      </button>
    </div>
  );
}
