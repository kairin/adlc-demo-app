import { AppError } from "../lib/errors";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      error.status,
    );
  }

  console.error("Unhandled error", error instanceof Error ? error.message : String(error));
  return json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
}
