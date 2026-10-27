import type { Clock } from "../lib/clock";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";
import { newOrderId } from "../lib/ids";
import type { OrdersRepo } from "../repo/orders-repo";
import type { ProductsRepo } from "../repo/products-repo";
import { assertTransition } from "./lifecycle";
import {
  type CreateOrderRequest,
  CURRENCY,
  DEMO_CUSTOMER_ID,
  type Order,
  type OrderItem,
  type OrderStatus,
  type OrderSummary,
} from "./types";

const MAX_TRANSITION_ATTEMPTS = 3;

export interface OrderServiceDeps {
  orders: OrdersRepo;
  products: ProductsRepo;
  clock: Clock;
}

export class OrderService {
  constructor(private readonly deps: OrderServiceDeps) {}

  listOrders(): Promise<OrderSummary[]> {
    return this.deps.orders.list();
  }

  async getOrder(id: string): Promise<Order> {
    const order = await this.deps.orders.findById(id);
    if (!order) {
      throw new NotFoundError(`Order ${id} not found`);
    }
    return order;
  }

  async createOrder(request: CreateOrderRequest): Promise<Order> {
    const productIds = request.items.map((line) => line.productId);
    const products = await this.deps.products.findActiveByIds(productIds);

    const missing = productIds.filter((id) => !products.has(id));
    if (missing.length > 0) {
      throw new ValidationError(
        "One or more products are unknown or unavailable",
        missing.map((id) => ({ field: "items.productId", message: `Unknown product: ${id}` })),
      );
    }

    const items: OrderItem[] = request.items.map((line) => {
      const product = products.get(line.productId);
      if (!product) {
        throw new ValidationError(`Unknown product: ${line.productId}`);
      }
      return {
        productId: product.id,
        productName: product.name,
        unitPriceCents: product.priceCents,
        quantity: line.quantity,
        lineTotalCents: product.priceCents * line.quantity,
      };
    });

    const id = newOrderId();
    await this.deps.orders.insert({
      id,
      customerId: DEMO_CUSTOMER_ID,
      currency: CURRENCY,
      totalCents: items.reduce((sum, item) => sum + item.lineTotalCents, 0),
      idempotencyKey: request.idempotencyKey,
      createdAt: this.deps.clock(),
      items,
    });

    return this.getOrder(id);
  }

  async changeStatus(id: string, next: OrderStatus): Promise<Order> {
    for (let attempt = 0; attempt < MAX_TRANSITION_ATTEMPTS; attempt++) {
      const current = await this.getOrder(id);
      if (current.status === next) {
        return current;
      }

      assertTransition(current.status, next);

      const applied = await this.deps.orders.applyTransition(
        id,
        current.status,
        next,
        this.deps.clock(),
      );
      if (applied) {
        return this.getOrder(id);
      }
    }

    throw new ConflictError(
      "ORDER_UPDATE_CONFLICT",
      "The order changed while it was being updated; reload and try again",
    );
  }
}
