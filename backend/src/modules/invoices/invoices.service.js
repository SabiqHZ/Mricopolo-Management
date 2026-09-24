const pool = require('../../config/db');

const invoiceSummarySelect = `
  SELECT
    i.*,
    s.name AS store_name,
    COALESCE(SUM(p.amount), 0)::numeric(12,2) AS paid_amount,
    (
      i.total_amount - COALESCE(SUM(p.amount), 0)
    )::numeric(12,2) AS outstanding_balance
  FROM invoices i
  JOIN stores s
    ON s.id = i.store_id
  LEFT JOIN payments p
    ON p.invoice_id = i.id
`;

const list = (filters = {}) => {
  const conditions = [];
  const params = [];
  let index = 1;

  if (filters.store_id) {
    conditions.push(`i.store_id = $${index}`);
    params.push(filters.store_id);
    index++;
  }

  if (filters.status) {
    conditions.push(`i.status = $${index}`);
    params.push(filters.status);
    index++;
  }

  if (filters.date_from) {
    conditions.push(`i.created_at >= $${index}::date`);
    params.push(filters.date_from);
    index++;
  }

  if (filters.date_to) {
    conditions.push(
      `i.created_at < ($${index}::date + INTERVAL '1 day')`,
    );
    params.push(filters.date_to);
    index++;
  }

  if (filters.q && String(filters.q).trim()) {
    conditions.push(`
      (
        s.name ILIKE $${index}
        OR CAST(i.id AS TEXT) ILIKE $${index}
      )
    `);

    params.push(`%${String(filters.q).trim()}%`);
    index++;
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  return pool.query(
    `${invoiceSummarySelect}
     ${where}
     GROUP BY i.id, s.name
     ORDER BY i.created_at DESC`,
    params,
  ).then((result) => result.rows);
};

const get = (id) => pool.query(
  `${invoiceSummarySelect}
   WHERE i.id = $1
   GROUP BY i.id, s.name`,
  [id],
).then((result) => result.rows[0] || null);

module.exports = {
  list,
  get,
};
