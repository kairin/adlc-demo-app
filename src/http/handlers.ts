import { OrderService } from "../domain/orders";
import { systemClock } from "../lib/clock";
import { OrdersRepo } from "../repo/orders-repo";
import { ProductsRepo } from "../repo/products-repo";
import { json } from "./responses";
import type { Handler } from "./router";
import {
  parseCreateOrderBody,
  parseIdempotencyKey,
  parseOrderId,
  parseStatusBody,
  readJson,
} from "./validation";

function services(env: Env) {
  const products = new ProductsRepo(env.DB);
  const orders = new OrdersRepo(env.DB);
  return {
    products,
    orderService: new OrderService({ orders, products, clock: systemClock }),
  };
}

export const listProducts: Handler = async ({ env }) => {
  const products = await services(env).products.listActive();
  return json({ products });
};

export const listOrders: Handler = async ({ env }) => {
  const orders = await services(env).orderService.listOrders();
  return json({ orders });
};

export const getOrder: Handler = async ({ env, params }) => {
  const id = parseOrderId(params.id ?? "");
  const order = await services(env).orderService.getOrder(id);
  return json({ order });
};

export const createOrder: Handler = async ({ request, env }) => {
  const idempotencyKey = parseIdempotencyKey(request.headers);
  const body = await readJson(request);
  const input = parseCreateOrderBody(body, idempotencyKey);
  const order = await services(env).orderService.createOrder(input);
  return json({ order }, 201, { location: `/api/orders/${order.id}` });
};

export const changeOrderStatus: Handler = async ({ request, env, params }) => {
  const id = parseOrderId(params.id ?? "");
  const status = parseStatusBody(await readJson(request));
  const order = await services(env).orderService.changeStatus(id, status);
  return json({ order });
};
