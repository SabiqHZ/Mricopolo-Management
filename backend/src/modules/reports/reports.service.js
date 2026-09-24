const pool = require("../../config/db");

const getSummary = async ({ date_from, date_to }) => {
  const result = await pool.query(
    `
    WITH consignment_per_return AS (
      SELECT
        r.id,
        COALESCE(SUM(di.quantity - ri.quantity), 0)::int AS sold_quantity,
        COALESCE(SUM(ri.quantity), 0)::int AS returned_quantity,
        COALESCE(i.total_amount, 0)::numeric(12,2) AS revenue
      FROM returns r
      JOIN return_items ri
        ON ri.return_id = r.id
      JOIN dropping_items di
        ON di.id = ri.dropping_item_id
      JOIN invoices i
        ON i.return_id = r.id
      WHERE r.returned_at >= $1::date
        AND r.returned_at < ($2::date + INTERVAL '1 day')
      GROUP BY r.id, i.total_amount
    ),

    direct_per_order AS (
      SELECT
        o.id,
        COALESCE(SUM(oi.quantity), 0)::int AS sold_quantity,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0)::numeric(12,2) AS revenue
      FROM direct_orders o
      LEFT JOIN direct_order_items oi
        ON oi.direct_order_id = o.id
      WHERE o.order_date >= $1::date
        AND o.order_date < ($2::date + INTERVAL '1 day')
      GROUP BY o.id
    ),

    consignment_summary AS (
      SELECT
        COALESCE(SUM(sold_quantity), 0)::int AS sold_quantity,
        COALESCE(SUM(returned_quantity), 0)::int AS returned_quantity,
        COALESCE(SUM(revenue), 0)::numeric(12,2) AS revenue
      FROM consignment_per_return
    ),

    direct_summary AS (
      SELECT
        COALESCE(SUM(sold_quantity), 0)::int AS sold_quantity,
        COALESCE(SUM(revenue), 0)::numeric(12,2) AS revenue
      FROM direct_per_order
    )

    SELECT
      cs.sold_quantity AS consignment_sold_quantity,
      cs.returned_quantity AS consignment_returned_quantity,
      cs.revenue AS consignment_revenue,

      ds.sold_quantity AS direct_order_sold_quantity,
      ds.revenue AS direct_order_revenue,

      (
        cs.revenue + ds.revenue
      )::numeric(12,2) AS total_revenue,

      (
        cs.sold_quantity + ds.sold_quantity
      )::int AS total_sold_quantity

    FROM consignment_summary cs
    CROSS JOIN direct_summary ds
    `,
    [date_from, date_to],
  );

  const row = result.rows[0];

  return {
    date_from,
    date_to,

    consignment: {
      sold_quantity: Number(row.consignment_sold_quantity),
      returned_quantity: Number(row.consignment_returned_quantity),
      revenue: Number(row.consignment_revenue),
    },

    direct_order: {
      sold_quantity: Number(row.direct_order_sold_quantity),
      revenue: Number(row.direct_order_revenue),
    },

    combined: {
      sold_quantity: Number(row.total_sold_quantity),
      revenue: Number(row.total_revenue),
    },
  };
};

const getTopProducts = async ({ date_from, date_to, limit = 10 }) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

  const result = await pool.query(
    `
    WITH consignment_products AS (
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        COALESCE(
          SUM(di.quantity - ri.quantity),
          0
        )::int AS sold_quantity
      FROM returns r
      JOIN return_items ri
        ON ri.return_id = r.id
      JOIN dropping_items di
        ON di.id = ri.dropping_item_id
      JOIN products p
        ON p.id = di.product_id
      WHERE r.returned_at >= $1::date
        AND r.returned_at < ($2::date + INTERVAL '1 day')
      GROUP BY p.id, p.name
    ),

    direct_products AS (
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        COALESCE(
          SUM(oi.quantity),
          0
        )::int AS sold_quantity
      FROM direct_orders o
      JOIN direct_order_items oi
        ON oi.direct_order_id = o.id
      JOIN products p
        ON p.id = oi.product_id
      WHERE o.order_date >= $1::date
        AND o.order_date < ($2::date + INTERVAL '1 day')
      GROUP BY p.id, p.name
    ),

    combined_products AS (
      SELECT
        product_id,
        product_name,
        sold_quantity
      FROM consignment_products

      UNION ALL

      SELECT
        product_id,
        product_name,
        sold_quantity
      FROM direct_products
    )

    SELECT
      product_id,
      product_name,
      SUM(sold_quantity)::int AS sold_quantity
    FROM combined_products
    GROUP BY product_id, product_name
    ORDER BY sold_quantity DESC, product_name ASC
    LIMIT $3
    `,
    [date_from, date_to, safeLimit],
  );

  return result.rows.map((row, index) => ({
    rank: index + 1,
    product_id: row.product_id,
    product_name: row.product_name,
    sold_quantity: Number(row.sold_quantity),
  }));
};

const getTopStores = async ({ date_from, date_to, limit = 10 }) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

  const result = await pool.query(
    `
    SELECT
      s.id AS store_id,
      s.name AS store_name,
      COUNT(DISTINCT r.id)::int AS transaction_count,
      COALESCE(SUM(di.quantity - ri.quantity), 0)::int AS sold_quantity,
      COALESCE(SUM(ri.quantity), 0)::int AS returned_quantity,
      COALESCE(SUM(i.total_amount), 0)::numeric(12,2) AS revenue
    FROM returns r
    JOIN stores s
      ON s.id = r.store_id
    JOIN return_items ri
      ON ri.return_id = r.id
    JOIN dropping_items di
      ON di.id = ri.dropping_item_id
    JOIN invoices i
      ON i.return_id = r.id
    WHERE r.returned_at >= $1::date
      AND r.returned_at < ($2::date + INTERVAL '1 day')
    GROUP BY s.id, s.name
    ORDER BY revenue DESC, s.name ASC
    LIMIT $3
    `,
    [date_from, date_to, safeLimit],
  );

  return result.rows.map((row, index) => ({
    rank: index + 1,
    store_id: row.store_id,
    store_name: row.store_name,
    transaction_count: Number(row.transaction_count),
    sold_quantity: Number(row.sold_quantity),
    returned_quantity: Number(row.returned_quantity),
    revenue: Number(row.revenue),
  }));
};

module.exports = {
  getSummary,
  getTopProducts,
  getTopStores,
};
