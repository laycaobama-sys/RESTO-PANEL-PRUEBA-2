// ============================================================
// RestoPanel · Professional Logger
// ============================================================
// Replaces console.log with structured logging.
// Levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
// ============================================================

type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARNING: 30,
  ERROR: 40,
  CRITICAL: 50,
};

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === "production" ? "INFO" : "DEBUG");

interface LogEntry {
  level: LogLevel;
  message: string;
  module?: string;
  userId?: string;
  orgId?: string;
  data?: any;
  timestamp: string;
}

function formatLog(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level}]`,
    entry.module ? `[${entry.module}]` : "",
    entry.message,
  ].filter(Boolean);

  if (entry.data) {
    try {
      parts.push(JSON.stringify(entry.data));
    } catch {
      parts.push(String(entry.data));
    }
  }

  return parts.join(" ");
}

function log(level: LogLevel, message: string, module?: string, data?: any) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[MIN_LEVEL]) return;

  const entry: LogEntry = {
    level,
    message,
    module,
    data,
    timestamp: new Date().toISOString(),
  };

  const formatted = formatLog(entry);

  // Output to appropriate stream
  if (level === "ERROR" || level === "CRITICAL") {
    process.stderr.write(formatted + "\n");
  } else {
    process.stdout.write(formatted + "\n");
  }

  // In production, also send to monitoring (future: Sentry, Datadog)
  if (process.env.NODE_ENV === "production" && level === "CRITICAL") {
    // TODO: Send to Sentry/Datadog when configured
  }
}

export const logger = {
  debug: (msg: string, module?: string, data?: any) => log("DEBUG", msg, module, data),
  info: (msg: string, module?: string, data?: any) => log("INFO", msg, module, data),
  warn: (msg: string, module?: string, data?: any) => log("WARNING", msg, module, data),
  error: (msg: string, module?: string, data?: any) => log("ERROR", msg, module, data),
  critical: (msg: string, module?: string, data?: any) => log("CRITICAL", msg, module, data),
};
