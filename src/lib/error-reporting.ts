export type ErrorContext = Record<string, unknown>;

// Simple project-owned error reporting wrapper.
// Extend this to forward errors to a remote logging service if desired.
export function reportError(error: unknown, context: ErrorContext = {}) {
  if (typeof window !== "undefined") {
    // Client-side: log to console and attach route info when available
    // eslint-disable-next-line no-console
    console.error("BrokeFlex Data error:", error, { ...context, path: window.location?.pathname });
  } else {
    // Server-side: ensure errors are logged
    // eslint-disable-next-line no-console
    console.error("BrokeFlex Data server error:", error, context);
  }
}

export function captureException(error: unknown, context: ErrorContext = {}) {
  // Placeholder for future integration (Sentry, Logflare, etc.)
  reportError(error, context);
}

export default { reportError, captureException };
