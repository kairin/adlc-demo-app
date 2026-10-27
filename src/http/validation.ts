import {
  type CreateOrderRequest,
  isOrderStatus,
  type OrderLineRequest,
  type OrderStatus,
} from "../domain/types";
import { AppError, type ErrorDetail, ValidationError } from "../lib/errors";

export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_LINE_ITEMS = 20;
export const MAX_QUANTITY = 99;

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export async function readJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    throw new ValidationError("Request body is too large");
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new ValidationError("Request body is too large");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

export function parseIdempotencyKey(headers: Headers): string {
  const key = headers.get("idempotency-key");
  if (key === null || key.trim() === "") {
    throw new AppError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key header is required");
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new AppError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency-Key must be 8-128 characters of letters, digits, '-' or '_'",
    );
  }
  return key;
}

export function parseOrderId(value: string): string {
  if (!ORDER_ID_PATTERN.test(value)) {
    throw new ValidationError("Invalid order id");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCreateOrderBody(body: unknown, idempotencyKey: string): CreateOrderRequest {
  if (!isRecord(body) || !Array.isArray(body.items)) {
    throw new ValidationError("Body must be an object with an items array", [
      { field: "items", message: "Required" },
    ]);
  }
  if (body.items.length === 0 || body.items.length > MAX_LINE_ITEMS) {
    throw new ValidationError(`Orders must contain between 1 and ${MAX_LINE_ITEMS} line items`, [
      { field: "items", message: "Invalid length" },
    ]);
  }

  const details: ErrorDetail[] = [];
  const seen = new Set<string>();
  const items: OrderLineRequest[] = [];

  body.items.forEach((raw: unknown, index: number) => {
    if (!isRecord(raw)) {
      details.push({ field: `items[${index}]`, message: "Must be an object" });
      return;
    }
    const { productId, quantity } = raw;
    if (typeof productId !== "string" || !PRODUCT_ID_PATTERN.test(productId)) {
      details.push({ field: `items[${index}].productId`, message: "Must be a product id" });
      return;
    }
    if (seen.has(productId)) {
      details.push({ field: `items[${index}].productId`, message: "Duplicate product" });
      return;
    }
    seen.add(productId);
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      details.push({
        field: `items[${index}].quantity`,
        message: `Must be an integer between 1 and ${MAX_QUANTITY}`,
      });
      return;
    }
    items.push({ productId, quantity });
  });

  if (details.length > 0) {
    throw new ValidationError("Invalid order request", details);
  }

  return { idempotencyKey, items };
}

export function parseStatusBody(body: unknown): OrderStatus {
  if (!isRecord(body) || !isOrderStatus(body.status)) {
    throw new ValidationError("Body must include a valid status", [
      {
        field: "status",
        message: "Must be one of pending, confirmed, shipped, delivered, cancelled",
      },
    ]);
  }
  return body.status;
}
