CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  store_id INT NOT NULL REFERENCES stores(id),
  return_id INT NOT NULL UNIQUE REFERENCES returns(id),
  total_amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('PAID','UNPAID')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_store_status ON invoices(store_id, status);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);