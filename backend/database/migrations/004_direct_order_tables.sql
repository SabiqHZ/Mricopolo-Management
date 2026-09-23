CREATE TABLE direct_orders (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  order_date TIMESTAMP NOT NULL DEFAULT now(),
  pickup_delivery_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed')),
  payment_status VARCHAR(10) NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('PAID','DEPOSIT','UNPAID')),
  deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  client_id UUID UNIQUE,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_direct_orders_status ON direct_orders(status);

CREATE TABLE direct_order_items (
  id SERIAL PRIMARY KEY,
  direct_order_id INT NOT NULL REFERENCES direct_orders(id),
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);