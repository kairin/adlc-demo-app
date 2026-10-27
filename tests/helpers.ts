import { env, exports } from "cloudflare:workers";

const BASE = "https://order-tracker.test";

export interface ApiResult<T = any> {
  status: number;
  headers: Headers;
  body: T;
}

export async function call<T = any>(
  method: string,
  path: string,
  options: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<ApiResult<T>> {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", ...options.headers },
  };
  if (options.body !== undefined) {
    init.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }
  const response = await exports.default.fetch(`${BASE}${path}`, init);
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: (text ? JSON.parse(text) : null) as T,
  };
}

export function newKey(): string {
  return `test-${crypto.randomUUID()}`;
}

export function createOrder(
  items: { productId: string; quantity: number }[],
  key: string = newKey(),
): Promise<ApiResult> {
  return call("POST", "/api/orders", { body: { items }, headers: { "Idempotency-Key": key } });
}

export function setStatus(orderId: string, status: string): Promise<ApiResult> {
  return call("POST", `/api/orders/${orderId}/status`, { body: { status } });
}

export async function resetToFixtures(): Promise<void> {
  const statements = env.TEST_SEED_SQL.split(/;\s*(?:\n|$)/)
    .map((sql) => sql.trim())
    .filter((sql) => sql.length > 0)
    .map((sql) => env.DB.prepare(sql));
  await env.DB.batch(statements);
}

export async function countRows(): Promise<{ orders: number; items: number; history: number }> {
  const [orders, items, history] = await env.DB.batch<{ n: number }>([
    env.DB.prepare("SELECT COUNT(*) AS n FROM orders"),
    env.DB.prepare("SELECT COUNT(*) AS n FROM order_items"),
    env.DB.prepare("SELECT COUNT(*) AS n FROM order_status_history"),
  ]);
  return {
    orders: orders?.results[0]?.n ?? 0,
    items: items?.results[0]?.n ?? 0,
    history: history?.results[0]?.n ?? 0,
  };
}
