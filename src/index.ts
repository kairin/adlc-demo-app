import {
  changeOrderStatus,
  createOrder,
  getOrder,
  listOrders,
  listProducts,
} from "./http/handlers";
import { Router } from "./http/router";

const router = new Router()
  .on("GET", "/api/products", listProducts)
  .on("GET", "/api/orders", listOrders)
  .on("POST", "/api/orders", createOrder)
  .on("GET", "/api/orders/:id", getOrder)
  .on("POST", "/api/orders/:id/status", changeOrderStatus);

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/")) {
      return router.handle(request, env);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
