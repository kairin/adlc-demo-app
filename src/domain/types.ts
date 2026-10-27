export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CURRENCY = "USD";
export const DEMO_CUSTOMER_ID = "cust_demo";

export interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
}

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  currency: string;
  totalCents: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface StatusHistoryEntry {
  id: number;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  at: string;
}

export interface Order {
  id: string;
  customerId: string;
  status: OrderStatus;
  currency: string;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  history: StatusHistoryEntry[];
}

export interface OrderLineRequest {
  productId: string;
  quantity: number;
}

export interface CreateOrderRequest {
  idempotencyKey: string;
  items: OrderLineRequest[];
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}
