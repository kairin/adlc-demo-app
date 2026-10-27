CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  currency TEXT NOT NULL CHECK (currency = 'USD'),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_orders_created_at ON orders (created_at DESC, id DESC);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products (id),
  product_name TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0)
);

CREATE INDEX idx_order_items_order_id ON order_items (order_id, id);

CREATE TABLE order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  from_status TEXT CHECK (from_status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  to_status TEXT NOT NULL CHECK (to_status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_order_status_history_order_id ON order_status_history (order_id, id);
