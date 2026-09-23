CREATE TABLE droppings (
  id SERIAL PRIMARY KEY,
  store_id INT NOT NULL REFERENCES stores(id),
  client_id UUID UNIQUE NOT NULL,
  dropped_at TIMESTAMP NOT NULL,
  created_by INT NOT NULL REFERENCES users(id),
  sync_status VARCHAR(20) NOT NULL DEFAULT 'synced',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_droppings_store_date ON droppings(store_id, dropped_at);

CREATE TABLE dropping_items (
  id SERIAL PRIMARY KEY,
  dropping_id INT NOT NULL REFERENCES droppings(id),
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_dropping_items_dropping ON dropping_items(dropping_id);

CREATE TABLE returns (
  id SERIAL PRIMARY KEY,
  store_id INT NOT NULL REFERENCES stores(id),
  client_id UUID UNIQUE NOT NULL,
  returned_at TIMESTAMP NOT NULL,
  created_by INT NOT NULL REFERENCES users(id),
  sync_status VARCHAR(20) NOT NULL DEFAULT 'synced',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_returns_store_date ON returns(store_id, returned_at);

CREATE TABLE return_items (
  id SERIAL PRIMARY KEY,
  return_id INT NOT NULL REFERENCES returns(id),
  dropping_item_id INT NOT NULL REFERENCES dropping_items(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_return_items_dropping_item ON return_items(dropping_item_id);