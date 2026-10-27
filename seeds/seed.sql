DELETE FROM order_status_history;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM products;

INSERT INTO products (id, name, description, price_cents, active) VALUES
  ('prod_mug', 'Enamel Camp Mug', 'Fictional demo product', 1800, 1),
  ('prod_tee', 'Workshop T-Shirt', 'Fictional demo product', 2500, 1),
  ('prod_stickers', 'Sticker Pack', 'Fictional demo product', 600, 1),
  ('prod_notebook', 'Dot Grid Notebook', 'Fictional demo product', 1200, 1),
  ('prod_bottle', 'Insulated Bottle', 'Fictional demo product', 3200, 1);

INSERT INTO orders (id, customer_id, status, currency, total_cents, idempotency_key, created_at, updated_at) VALUES
  ('ord_seed_pending', 'cust_demo', 'pending', 'USD', 4200, 'seed-key-pending-0001', '2026-01-10T09:00:00.000Z', '2026-01-10T09:00:00.000Z'),
  ('ord_seed_confirmed', 'cust_demo', 'confirmed', 'USD', 3700, 'seed-key-confirmed-0001', '2026-01-09T09:00:00.000Z', '2026-01-09T10:00:00.000Z'),
  ('ord_seed_shipped', 'cust_demo', 'shipped', 'USD', 3200, 'seed-key-shipped-0001', '2026-01-08T09:00:00.000Z', '2026-01-08T12:00:00.000Z'),
  ('ord_seed_delivered', 'cust_demo', 'delivered', 'USD', 3600, 'seed-key-delivered-0001', '2026-01-07T09:00:00.000Z', '2026-01-09T15:00:00.000Z'),
  ('ord_seed_cancelled', 'cust_demo', 'cancelled', 'USD', 5000, 'seed-key-cancelled-0001', '2026-01-06T09:00:00.000Z', '2026-01-06T11:00:00.000Z');

INSERT INTO order_items (id, order_id, product_id, product_name, unit_price_cents, quantity, line_total_cents) VALUES
  (1, 'ord_seed_pending', 'prod_mug', 'Enamel Camp Mug', 1800, 2, 3600),
  (2, 'ord_seed_pending', 'prod_stickers', 'Sticker Pack', 600, 1, 600),
  (3, 'ord_seed_confirmed', 'prod_tee', 'Workshop T-Shirt', 2500, 1, 2500),
  (4, 'ord_seed_confirmed', 'prod_notebook', 'Dot Grid Notebook', 1200, 1, 1200),
  (5, 'ord_seed_shipped', 'prod_bottle', 'Insulated Bottle', 3200, 1, 3200),
  (6, 'ord_seed_delivered', 'prod_stickers', 'Sticker Pack', 600, 3, 1800),
  (7, 'ord_seed_delivered', 'prod_mug', 'Enamel Camp Mug', 1800, 1, 1800),
  (8, 'ord_seed_cancelled', 'prod_tee', 'Workshop T-Shirt', 2500, 2, 5000);

INSERT INTO order_status_history (id, order_id, from_status, to_status, created_at) VALUES
  (1, 'ord_seed_cancelled', NULL, 'pending', '2026-01-06T09:00:00.000Z'),
  (2, 'ord_seed_cancelled', 'pending', 'cancelled', '2026-01-06T11:00:00.000Z'),
  (3, 'ord_seed_delivered', NULL, 'pending', '2026-01-07T09:00:00.000Z'),
  (4, 'ord_seed_delivered', 'pending', 'confirmed', '2026-01-07T10:00:00.000Z'),
  (5, 'ord_seed_delivered', 'confirmed', 'shipped', '2026-01-08T09:00:00.000Z'),
  (6, 'ord_seed_delivered', 'shipped', 'delivered', '2026-01-09T15:00:00.000Z'),
  (7, 'ord_seed_shipped', NULL, 'pending', '2026-01-08T09:00:00.000Z'),
  (8, 'ord_seed_shipped', 'pending', 'confirmed', '2026-01-08T10:00:00.000Z'),
  (9, 'ord_seed_shipped', 'confirmed', 'shipped', '2026-01-08T12:00:00.000Z'),
  (10, 'ord_seed_confirmed', NULL, 'pending', '2026-01-09T09:00:00.000Z'),
  (11, 'ord_seed_confirmed', 'pending', 'confirmed', '2026-01-09T10:00:00.000Z'),
  (12, 'ord_seed_pending', NULL, 'pending', '2026-01-10T09:00:00.000Z');
