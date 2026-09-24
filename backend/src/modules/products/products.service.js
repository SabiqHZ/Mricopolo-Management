const pool = require('../../config/db');

const create = (data) => pool.query(
  `INSERT INTO products (name, category, base_price)
   VALUES ($1,$2,$3)
   RETURNING *`,
  [data.name, data.category, data.base_price]
).then(r => r.rows[0]);

const list = (filters = {}) => {
  const conditions = ['deleted_at IS NULL'];
  const params = [];

  if (filters.q && String(filters.q).trim()) {
    params.push(`%${String(filters.q).trim()}%`);

    conditions.push(`
      (
        name ILIKE $1
        OR category ILIKE $1
      )
    `);
  }

  return pool.query(
    `
    SELECT *
    FROM products
    WHERE ${conditions.join(' AND ')}
    ORDER BY name
    `,
    params
  ).then(r => r.rows);
};

const get = (id) => pool.query(
  `SELECT *
   FROM products
   WHERE id = $1
     AND deleted_at IS NULL`,
  [id]
).then(r => r.rows[0] || null);

const update = (id, data) => pool.query(
  `UPDATE products
   SET name=$1,
       category=$2,
       base_price=$3,
       updated_at=now()
   WHERE id=$4
     AND deleted_at IS NULL
   RETURNING *`,
  [data.name, data.category, data.base_price, id]
).then(r => r.rows[0] || null);

const remove = (id) => pool.query(
  `UPDATE products
   SET deleted_at=now()
   WHERE id=$1
     AND deleted_at IS NULL
   RETURNING id`,
  [id]
).then(r => r.rows[0] || null);

module.exports = {
  create,
  list,
  get,
  update,
  remove,
};
