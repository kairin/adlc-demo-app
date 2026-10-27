import type {
  Order,
  OrderItem,
  OrderStatus,
  OrderSummary,
  StatusHistoryEntry,
} from "../domain/types";

interface OrderRow {
  id: string;
  customer_id: string;
  status: OrderStatus;
  currency: string;
  total_cents: number;
  created_at: string;
  updated_at: string;
}

interface OrderSummaryRow extends OrderRow {
  item_count: number;
}

interface OrderItemRow {
  product_id: string;
  product_name: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
}

interface HistoryRow {
  id: number;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  created_at: string;
}

export interface NewOrder {
  id: string;
  customerId: string;
  currency: string;
  totalCents: number;
  idempotencyKey: string;
  createdAt: string;
  items: OrderItem[];
}

export class OrdersRepo {
  constructor(private readonly db: D1Database) {}

  async list(limit = 100): Promise<OrderSummary[]> {
    const { results } = await this.db
      .prepare(
        `SELECT o.id, o.customer_id, o.status, o.currency, o.total_cents, o.created_at, o.updated_at,
                (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count
         FROM orders o
         ORDER BY o.created_at DESC, o.id DESC
         LIMIT ?`,
      )
      .bind(limit)
      .all<OrderSummaryRow>();
    return results.map((row) => ({
      id: row.id,
      status: row.status,
      currency: row.currency,
      totalCents: row.total_cents,
      itemCount: row.item_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async findById(id: string): Promise<Order | null> {
    const [orderResult, itemsResult, historyResult] = await this.db.batch([
      this.db
        .prepare(
          "SELECT id, customer_id, status, currency, total_cents, created_at, updated_at FROM orders WHERE id = ?",
        )
        .bind(id),
      this.db
        .prepare(
          `SELECT product_id, product_name, unit_price_cents, quantity, line_total_cents
           FROM order_items WHERE order_id = ? ORDER BY id`,
        )
        .bind(id),
      this.db
        .prepare(
          `SELECT id, from_status, to_status, created_at
           FROM order_status_history WHERE order_id = ? ORDER BY id`,
        )
        .bind(id),
    ]);

    const row = (orderResult?.results as OrderRow[] | undefined)?.[0];
    if (!row) {
      return null;
    }

    const items = ((itemsResult?.results ?? []) as OrderItemRow[]).map(
      (item): OrderItem => ({
        productId: item.product_id,
        productName: item.product_name,
        unitPriceCents: item.unit_price_cents,
        quantity: item.quantity,
        lineTotalCents: item.line_total_cents,
      }),
    );

    const history = ((historyResult?.results ?? []) as HistoryRow[]).map(
      (entry): StatusHistoryEntry => ({
        id: entry.id,
        fromStatus: entry.from_status,
        toStatus: entry.to_status,
        at: entry.created_at,
      }),
    );

    return {
      id: row.id,
      customerId: row.customer_id,
      status: row.status,
      currency: row.currency,
      totalCents: row.total_cents,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items,
      history,
    };
  }

  async insert(order: NewOrder): Promise<void> {
    const statements = [
      this.db
        .prepare(
          `INSERT INTO orders (id, customer_id, status, currency, total_cents, idempotency_key, created_at, updated_at)
           VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)`,
        )
        .bind(
          order.id,
          order.customerId,
          order.currency,
          order.totalCents,
          order.idempotencyKey,
          order.createdAt,
          order.createdAt,
        ),
      ...order.items.map((item) =>
        this.db
          .prepare(
            `INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity, line_total_cents)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            order.id,
            item.productId,
            item.productName,
            item.unitPriceCents,
            item.quantity,
            item.lineTotalCents,
          ),
      ),
      this.db
        .prepare(
          `INSERT INTO order_status_history (order_id, from_status, to_status, created_at)
           VALUES (?, NULL, 'pending', ?)`,
        )
        .bind(order.id, order.createdAt),
    ];

    await this.db.batch(statements);
  }

  async applyTransition(
    id: string,
    from: OrderStatus,
    to: OrderStatus,
    at: string,
  ): Promise<boolean> {
    const [update] = await this.db.batch([
      this.db
        .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?")
        .bind(to, at, id, from),
      this.db
        .prepare(
          `INSERT INTO order_status_history (order_id, from_status, to_status, created_at)
           SELECT ?, ?, ?, ? WHERE changes() = 1`,
        )
        .bind(id, from, to, at),
    ]);
    return (update?.meta.changes ?? 0) === 1;
  }
}
