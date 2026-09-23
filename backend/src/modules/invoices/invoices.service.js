const pool = require('../../config/db');

const invoiceSummarySelect = `
  SELECT i.*, s.name AS store_name,
         COALESCE(SUM(p.amount), 0)::numeric(12,2) AS paid_amount,
         (i.total_amount - COALESCE(SUM(p.amount), 0))::numeric(12,2) AS outstanding_balance
  FROM invoices i
  JOIN stores s ON s.id = i.store_id
  LEFT JOIN payments p ON p.invoice_id = i.id`;

const list = (filters) => {
  const params = [];
  const where = filters.store_id ? 'WHERE i.store_id = $1' : '';
  if (filters.store_id) params.push(filters.store_id);

  return pool.query(
    `${invoiceSummarySelect}
     ${where}
     GROUP BY i.id, s.name
     ORDER BY i.created_at ASC`,
    params
  ).then((result) => result.rows);
};

const get = (id) => pool.query(
  `${invoiceSummarySelect}
   WHERE i.id = $1
   GROUP BY i.id, s.name`,
  [id]
).then((result) => result.rows[0] || null);

module.exports = { list, get };
