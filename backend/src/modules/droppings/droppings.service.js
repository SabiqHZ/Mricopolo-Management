const pool = require('../../config/db');
const crypto = require('crypto');

const create = async (data) => {
  const client_id = data.client_id || crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM droppings WHERE client_id=$1', [client_id]);
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return { idempotent: true, id: existing.rows[0].id };
    }

    const header = await client.query(
      `INSERT INTO droppings (store_id, client_id, dropped_at, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [data.store_id, client_id, data.dropped_at || new Date(), data.created_by]
    );
    const droppingId = header.rows[0].id;

    const items = [];
    for (const item of data.items) {
      const r = await client.query(
        `INSERT INTO dropping_items (dropping_id, product_id, quantity)
         VALUES ($1,$2,$3) RETURNING *`,
        [droppingId, item.product_id, item.quantity]
      );
      items.push(r.rows[0]);
    }

    await client.query('COMMIT');
    return { idempotent: false, ...header.rows[0], items };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const list = (filters) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.store_id) { conditions.push(`d.store_id = $${idx++}`); params.push(filters.store_id); }
  if (filters.date_from) { conditions.push(`d.dropped_at >= $${idx++}`); params.push(filters.date_from); }
  if (filters.date_to) { conditions.push(`d.dropped_at <= $${idx++}`); params.push(filters.date_to); }

  let productJoin = '';
  if (filters.product_id) {
    productJoin = `JOIN dropping_items di_filter ON di_filter.dropping_id = d.id AND di_filter.product_id = $${idx++}`;
    params.push(filters.product_id);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return pool.query(
    `SELECT DISTINCT d.* FROM droppings d ${productJoin} ${where} ORDER BY d.dropped_at ASC`,
    params
  ).then(r => r.rows);
};

const getWithItems = async (id) => {
  const header = await pool.query(`SELECT * FROM droppings WHERE id=$1`, [id]);
  if (!header.rows.length) return null;
  const items = await pool.query(
    `SELECT di.*, p.name AS product_name FROM dropping_items di
     JOIN products p ON p.id = di.product_id WHERE di.dropping_id=$1`,
    [id]
  );
  return { ...header.rows[0], items: items.rows };
};

module.exports = { create, list, getWithItems };