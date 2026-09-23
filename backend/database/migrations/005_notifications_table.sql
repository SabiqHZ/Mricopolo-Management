CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  store_id INT NOT NULL REFERENCES stores(id),
  type VARCHAR(50) NOT NULL,
  message TEXT,
  is_handled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  handled_at TIMESTAMP
);
CREATE INDEX idx_notifications_unhandled ON notifications(store_id, is_handled);