const pool = require('../../config/db');
const crypto = require('crypto');
const pricesSvc = require('../prices/prices.service');

const create = async (data) => {
  const client_id = data.client_id || crypto.randomUUID();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM returns WHERE client_id=$1',
      [client_id],
    );

    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return {
        idempotent: true,
        id: existing.rows[0].id,
      };
    }

    const validated = [];

    for (const item of data.items) {
      const diRes = await client.query(
        `SELECT
           di.id,
           di.quantity AS dropped_qty,
           di.product_id,
           d.store_id
         FROM dropping_items di
         JOIN droppings d ON d.id = di.dropping_id
         WHERE di.id = $1`,
        [item.dropping_item_id],
      );

      if (!diRes.rows.length) {
        throw Object.assign(
          new Error('Invalid dropping_item_id'),
          { code: 'INVALID_DROPPING_ITEM' },
        );
      }

      const di = diRes.rows[0];

      if (di.store_id !== data.store_id) {
        throw Object.assign(
          new Error('dropping_item does not belong to this store'),
          { code: 'STORE_MISMATCH' },
        );
      }

      if (item.quantity > di.dropped_qty) {
        throw Object.assign(
          new Error(
            `Return quantity exceeds dropped quantity (dropping_item ${item.dropping_item_id})`,
          ),
          { code: 'RETURN_EXCEEDS_DROPPED' },
        );
      }

      const soldQty = di.dropped_qty - item.quantity;
      const price = await pricesSvc.getApplicablePrice(
        data.store_id,
        di.product_id,
      );

      validated.push({
        ...item,
        product_id: di.product_id,
        soldQty,
        price,
      });
    }

    const header = await client.query(
      `INSERT INTO returns
        (store_id, client_id, returned_at, created_by)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [
        data.store_id,
        client_id,
        data.returned_at || new Date(),
        data.created_by,
      ],
    );

    const returnId = header.rows[0].id;

    let totalAmount = 0;
    const items = [];

    for (const v of validated) {
      const r = await client.query(
        `INSERT INTO return_items
          (return_id, dropping_item_id, quantity)
         VALUES ($1,$2,$3)
         RETURNING *`,
        [
          returnId,
          v.dropping_item_id,
          v.quantity,
        ],
      );

      items.push({
        ...r.rows[0],
        sold_qty: v.soldQty,
        price: v.price,
        line_total: v.soldQty * v.price,
      });

      totalAmount += v.soldQty * v.price;
    }

    const invoice = await client.query(
      `INSERT INTO invoices
        (store_id, return_id, total_amount, status)
       VALUES ($1,$2,$3,'UNPAID')
       RETURNING *`,
      [
        data.store_id,
        returnId,
        totalAmount,
      ],
    );

    await client.query('COMMIT');

    return {
      idempotent: false,
      ...header.rows[0],
      items,
      invoice: invoice.rows[0],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const list = (filters = {}) => {
  const conditions = [];
  const params = [];
  let index = 1;

  if (filters.store_id) {
    conditions.push(`r.store_id = $${index}`);
    params.push(filters.store_id);
    index++;
  }

  if (filters.date_from) {
    conditions.push(`r.returned_at >= $${index}::date`);
    params.push(filters.date_from);
    index++;
  }

  if (filters.date_to) {
    conditions.push(
      `r.returned_at < ($${index}::date + INTERVAL '1 day')`,
    );
    params.push(filters.date_to);
    index++;
  }

  if (filters.product_id) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM return_items ri_filter
        JOIN dropping_items di_filter
          ON di_filter.id = ri_filter.dropping_item_id
        WHERE ri_filter.return_id = r.id
          AND di_filter.product_id = $${index}
      )
    `);

    params.push(filters.product_id);
    index++;
  }

  if (filters.status) {
    conditions.push(`i.status = $${index}`);
    params.push(filters.status);
    index++;
  }

  if (filters.q && String(filters.q).trim()) {
    conditions.push(`
      (
        s.name ILIKE $${index}
        OR EXISTS (
          SELECT 1
          FROM return_items ri_search
          JOIN dropping_items di_search
            ON di_search.id = ri_search.dropping_item_id
          JOIN products p_search
            ON p_search.id = di_search.product_id
          WHERE ri_search.return_id = r.id
            AND p_search.name ILIKE $${index}
        )
      )
    `);

    params.push(`%${String(filters.q).trim()}%`);
    index++;
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  return pool.query(
    `SELECT
       r.*,
       s.name AS store_name,
       i.id AS invoice_id,
       i.total_amount AS invoice_total,
       i.status AS invoice_status
     FROM returns r
     JOIN stores s
       ON s.id = r.store_id
     JOIN invoices i
       ON i.return_id = r.id
     ${where}
     ORDER BY r.returned_at DESC`,
    params,
  ).then((result) => result.rows);
};

const getWithItems = async (id) => {
  const header = await pool.query(
    `SELECT
       r.*,
       s.name AS store_name,
       i.id AS invoice_id,
       i.total_amount AS invoice_total,
       i.status AS invoice_status
     FROM returns r
     JOIN stores s
       ON s.id = r.store_id
     JOIN invoices i
       ON i.return_id = r.id
     WHERE r.id = $1`,
    [id],
  );

  if (!header.rows.length) return null;

  const items = await pool.query(
    `SELECT
       ri.*,
       di.product_id,
       di.quantity AS dropped_quantity,
       p.name AS product_name,
       (di.quantity - ri.quantity) AS sold_quantity
     FROM return_items ri
     JOIN dropping_items di
       ON di.id = ri.dropping_item_id
     JOIN products p
       ON p.id = di.product_id
     WHERE ri.return_id = $1`,
    [id],
  );

  return {
    ...header.rows[0],
    items: items.rows,
  };
};

module.exports = {
  create,
  list,
  getWithItems,
};
