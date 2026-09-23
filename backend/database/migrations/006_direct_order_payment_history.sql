CREATE TABLE direct_order_payments (
  id SERIAL PRIMARY KEY,
  direct_order_id INT NOT NULL REFERENCES direct_orders(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_direct_order_payments_order ON direct_order_payments(direct_order_id);
