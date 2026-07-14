"use client";

import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * GlobalErrorBoundary — atrapa cualquier error de renderizado en React.
 * En lugar de dejar la pantalla en negro, muestra una interfaz roja
 * con el error.message y el error.stack para debug rápido.
 */
export class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[GlobalErrorBoundary] Caught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "#1a0000",
            color: "#ff4444",
            padding: "2rem",
            fontFamily: "monospace",
            fontSize: "13px",
            overflow: "auto",
          }}
        >
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              marginBottom: "1rem",
              color: "#ff0000",
            }}
          >
            ⚠️ Error de renderizado detectado
          </h1>
          <div style={{ marginBottom: "1rem" }}>
            <strong>Mensaje:</strong> {this.state.error.message}
          </div>
          {this.state.error.stack && (
            <div style={{ marginBottom: "1rem" }}>
              <strong>Stack trace:</strong>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  fontSize: "11px",
                  lineHeight: "1.5",
                  color: "#ff6666",
                  marginTop: "0.5rem",
                }}
              >
                {this.state.error.stack}
              </pre>
            </div>
          )}
          {this.state.errorInfo?.componentStack && (
            <div>
              <strong>Component stack:</strong>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  fontSize: "11px",
                  lineHeight: "1.5",
                  color: "#ff9999",
                  marginTop: "0.5rem",
                }}
              >
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}
          <div style={{ marginTop: "2rem" }}>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#ff4444",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
