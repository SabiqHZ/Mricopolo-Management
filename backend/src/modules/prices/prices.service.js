const pool = require('../../config/db');

const upsert = (store_id, product_id, price) => pool.query(
  `INSERT INTO store_product_prices (store_id, product_id, price)
   VALUES ($1,$2,$3)
   ON CONFLICT (store_id, product_id) DO UPDATE SET price=$3, updated_at=now()
   RETURNING *`,
  [store_id, product_id, price]
).then(r => r.rows[0]);

const listByStore = (store_id) => pool.query(
  `SELECT spp.*, p.name AS product_name, p.base_price
   FROM store_product_prices spp
   JOIN products p ON p.id = spp.product_id
   WHERE spp.store_id = $1`,
  [store_id]
).then(r => r.rows);

const remove = (store_id, product_id) => pool.query(
  `DELETE FROM store_product_prices WHERE store_id=$1 AND product_id=$2 RETURNING *`,
  [store_id, product_id]
).then(r => r.rows[0] || null);

// FR-05 core rule: special price if set, else base price
const getApplicablePrice = async (store_id, product_id) => {
  const special = await pool.query(
    `SELECT price FROM store_product_prices WHERE store_id=$1 AND product_id=$2`,
    [store_id, product_id]
  );
  if (special.rows.length) return special.rows[0].price;

  const base = await pool.query(`SELECT base_price FROM products WHERE id=$1`, [product_id]);
  return base.rows[0]?.base_price ?? null;
};

module.exports = { upsert, listByStore, remove, getApplicablePrice };