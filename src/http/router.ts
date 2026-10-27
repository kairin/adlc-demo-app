import { AppError, NotFoundError } from "../lib/errors";
import { errorResponse } from "./responses";

export interface RouteContext {
  request: Request;
  env: Env;
  params: Record<string, string>;
}

export type Handler = (ctx: RouteContext) => Promise<Response>;

interface Route {
  method: string;
  pattern: URLPattern;
  handler: Handler;
}

export class Router {
  private readonly routes: Route[] = [];

  on(method: string, pathname: string, handler: Handler): this {
    this.routes.push({ method, pattern: new URLPattern({ pathname }), handler });
    return this;
  }

  async handle(request: Request, env: Env): Promise<Response> {
    try {
      let pathMatched = false;
      for (const route of this.routes) {
        const match = route.pattern.exec(request.url);
        if (!match) {
          continue;
        }
        pathMatched = true;
        if (route.method !== request.method) {
          continue;
        }
        const params: Record<string, string> = {};
        for (const [key, value] of Object.entries(match.pathname.groups)) {
          if (value !== undefined) {
            params[key] = decodeURIComponent(value);
          }
        }
        return await route.handler({ request, env, params });
      }
      if (pathMatched) {
        throw new AppError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
      }
      throw new NotFoundError("Route not found");
    } catch (error) {
      return errorResponse(error);
    }
  }
}
