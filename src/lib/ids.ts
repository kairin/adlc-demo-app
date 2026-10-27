export function newOrderId(): string {
  return `ord_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}
