import type { Product } from "../domain/types";

interface ProductRow {
  id: string;
  name: string;
  description: string;
  price_cents: number;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
  };
}

export class ProductsRepo {
  constructor(private readonly db: D1Database) {}

  async listActive(): Promise<Product[]> {
    const { results } = await this.db
      .prepare(
        "SELECT id, name, description, price_cents FROM products WHERE active = 1 ORDER BY name, id",
      )
      .all<ProductRow>();
    return results.map(toProduct);
  }

  async findActiveByIds(ids: readonly string[]): Promise<Map<string, Product>> {
    if (ids.length === 0) {
      return new Map();
    }
    const placeholders = ids.map(() => "?").join(", ");
    const { results } = await this.db
      .prepare(
        `SELECT id, name, description, price_cents FROM products WHERE active = 1 AND id IN (${placeholders})`,
      )
      .bind(...ids)
      .all<ProductRow>();
    return new Map(results.map((row) => [row.id, toProduct(row)]));
  }
}
