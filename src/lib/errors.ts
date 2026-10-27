export type ErrorCode =
  | "VALIDATION_FAILED"
  | "INVALID_IDEMPOTENCY_KEY"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "INVALID_ORDER_TRANSITION"
  | "IDEMPOTENCY_KEY_REUSED"
  | "ORDER_UPDATE_CONFLICT"
  | "INTERNAL_ERROR";

export interface ErrorDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetail[]) {
    super(400, "VALIDATION_FAILED", message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(409, "INVALID_ORDER_TRANSITION", `Cannot change order status from ${from} to ${to}`);
  }
}

export class ConflictError extends AppError {
  constructor(code: "IDEMPOTENCY_KEY_REUSED" | "ORDER_UPDATE_CONFLICT", message: string) {
    super(409, code, message);
  }
}
