import { InvalidTransitionError } from "../lib/errors";
import type { OrderStatus } from "./types";

export const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const TERMINAL_STATUSES: readonly OrderStatus[] = ["delivered", "cancelled"];

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function canCancel(status: OrderStatus): boolean {
  return canTransition(status, "cancelled");
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  const allowed = to === "cancelled" ? canCancel(from) : canTransition(from, to);
  if (!allowed) {
    throw new InvalidTransitionError(from, to);
  }
}
