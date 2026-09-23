const pool = require('../../config/db');

const getOverview = async ({ date_from, date_to }) => {
  const result = await pool.query(
    `WITH per_return AS (
       SELECT
         r.id,
         SUM(di.quantity - ri.quantity) AS sold_quantity,
         SUM(ri.quantity) AS returned_quantity,
         i.total_amount
       FROM returns r
       JOIN return_items ri ON ri.return_id = r.id
       JOIN dropping_items di ON di.id = ri.dropping_item_id
       JOIN invoices i ON i.return_id = r.id
       WHERE r.returned_at >= $1
         AND r.returned_at < ($2::date + INTERVAL '1 day')
       GROUP BY r.id, i.total_amount
     )
     SELECT
       COALESCE(SUM(sold_quantity), 0)::int AS sold_quantity,
       COALESCE(SUM(returned_quantity), 0)::int AS returned_quantity,
       COALESCE(SUM(total_amount), 0)::numeric(12,2) AS revenue
     FROM per_return`,
    [date_from, date_to]
  );

  const overview = result.rows[0];
  return {
    sold_quantity: Number(overview.sold_quantity),
    returned_quantity: Number(overview.returned_quantity),
    revenue: Number(overview.revenue),
    transaction_channel: 'CONSIGNMENT',
    date_from,
    date_to,
  };
};

module.exports = { getOverview };
