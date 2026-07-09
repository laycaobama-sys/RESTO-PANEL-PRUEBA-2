// ============================================================
// RestoPanel · Error Hierarchy
// ============================================================
// Professional error system with typed errors that can be
// caught and handled appropriately by API routes and middleware.
// ============================================================

export enum ErrorCode {
  // Validation
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_FIELD = "MISSING_FIELD",

  // Auth
  UNAUTHORIZED = "UNAUTHORIZED",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  SESSION_EXPIRED = "SESSION_EXPIRED",

  // Permissions
  FORBIDDEN = "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  FEATURE_NOT_ENABLED = "FEATURE_NOT_ENABLED",

  // Business logic
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  ALREADY_EXISTS = "ALREADY_EXISTS",
  LIMIT_EXCEEDED = "LIMIT_EXCEEDED",
  BUSINESS_RULE_VIOLATION = "BUSINESS_RULE_VIOLATION",

  // Infrastructure
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  RATE_LIMITED = "RATE_LIMITED",
  MAINTENANCE_MODE = "MAINTENANCE_MODE",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }
}

export class AuthError extends AppError {
  constructor(code: ErrorCode, message: string, statusCode: number = 401) {
    super(code, message, statusCode);
  }
}

export class PermissionError extends AppError {
  constructor(message: string = "No tienes permisos para esta acción") {
    super(ErrorCode.INSUFFICIENT_PERMISSIONS, message, 403);
  }
}

export class BusinessError extends AppError {
  constructor(code: ErrorCode, message: string, statusCode: number = 400, details?: any) {
    super(code, message, statusCode, details);
  }
}

export class InfrastructureError extends AppError {
  constructor(code: ErrorCode, message: string, statusCode: number = 503) {
    super(code, message, statusCode);
  }
}

// ─── Helper: convert any error to AppError ───────────────────
export function toAppError(err: any): AppError {
  if (err instanceof AppError) return err;

  if (err?.code === "23505") {
    return new BusinessError(ErrorCode.ALREADY_EXISTS, "El registro ya existe", 409);
  }
  if (err?.code === "23503") {
    return new BusinessError(ErrorCode.BUSINESS_RULE_VIOLATION, "Referencia inválida", 400);
  }
  if (err?.code === "PGRST116") {
    return new BusinessError(ErrorCode.NOT_FOUND, "No encontrado", 404);
  }

  return new AppError(ErrorCode.INTERNAL_ERROR, err?.message || "Error interno del servidor", 500);
}

// ─── Helper: create NextResponse from AppError ──────────────
export function errorResponse(err: AppError | Error): Response {
  const appErr = err instanceof AppError ? err : toAppError(err);
  return new Response(JSON.stringify(appErr.toJSON()), {
    status: appErr.statusCode,
    headers: { "Content-Type": "application/json" },
  });
}
