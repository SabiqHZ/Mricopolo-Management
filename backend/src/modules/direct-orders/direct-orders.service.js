const crypto = require("crypto");
const pool = require("../../config/db");

const getWithSummary = async (client, id) => {
  const result = await client.query(
    `SELECT o.*, COALESCE(SUM(oi.quantity * oi.unit_price), 0)::numeric(12,2) AS total_amount,
            COALESCE((SELECT SUM(payment.amount) FROM direct_order_payments payment WHERE payment.direct_order_id = o.id), 0)::numeric(12,2) AS paid_amount
     FROM direct_orders o
     LEFT JOIN direct_order_items oi ON oi.direct_order_id = o.id
     WHERE o.id = $1
     GROUP BY o.id`,
    [id],
  );
  if (!result.rows.length) return null;
  const order = result.rows[0];
  return {
    ...order,
    outstanding_balance: Number(order.total_amount) - Number(order.paid_amount),
  };
};

const create = async (data) => {
  const clientId = data.client_id || crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT id FROM direct_orders WHERE client_id = $1",
      [clientId],
    );
    if (existing.rows.length) {
      await client.query("ROLLBACK");
      // FIX: return the full existing record (items/payments/totals), not just the id,
      // so a retried request doesn't force an extra GET round-trip.
      return { idempotent: true, ...(await get(existing.rows[0].id)) };
    }

    const items = [];
    let totalAmount = 0;
    for (const item of data.items) {
      const productResult = await client.query(
        "SELECT id, base_price FROM products WHERE id = $1 AND deleted_at IS NULL",
        [item.product_id],
      );
      if (!productResult.rows.length) {
        throw Object.assign(new Error(`Product ${item.product_id} not found`), {
          code: "PRODUCT_NOT_FOUND",
        });
      }
      const unitPrice = Number(productResult.rows[0].base_price);
      totalAmount += item.quantity * unitPrice;
      items.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
      });
    }

    const depositAmount = Number(data.deposit_amount || 0);
    if (depositAmount > totalAmount) {
      throw Object.assign(new Error("Deposit exceeds the order total"), {
        code: "OVERPAYMENT",
      });
    }
    const paymentStatus =
      depositAmount === 0
        ? "UNPAID"
        : depositAmount === totalAmount
          ? "PAID"
          : "DEPOSIT";
    const header = await client.query(
      `INSERT INTO direct_orders (customer_name, order_date, pickup_delivery_date, payment_status, deposit_amount, client_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.customer_name,
        data.order_date || new Date(),
        data.pickup_delivery_date || null,
        paymentStatus,
        depositAmount,
        clientId,
        data.created_by,
      ],
    );
    const orderId = header.rows[0].id;

    const createdItems = [];
    for (const item of items) {
      const created = await client.query(
        `INSERT INTO direct_order_items (direct_order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [orderId, item.product_id, item.quantity, item.unit_price],
      );
      createdItems.push(created.rows[0]);
    }
    if (depositAmount > 0) {
      await client.query(
        "INSERT INTO direct_order_payments (direct_order_id, amount, payment_date) VALUES ($1, $2, $3)",
        [
          orderId,
          depositAmount,
          new Date(data.order_date || Date.now()).toISOString().slice(0, 10),
        ],
      );
    }
    await client.query("COMMIT");
    return {
      idempotent: false,
      ...header.rows[0],
      items: createdItems,
      total_amount: totalAmount,
      paid_amount: depositAmount,
      outstanding_balance: totalAmount - depositAmount,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    // FIX: if two requests with the same client_id race past the SELECT check above,
    // the second INSERT hits the unique constraint instead of silently duplicating a row.
    // Catch that and fall back to returning the row the other request created.
    if (
      error.code === "23505" &&
      String(error.constraint || error.detail || "").includes("client_id")
    ) {
      const existing = await pool.query(
        "SELECT id FROM direct_orders WHERE client_id = $1",
        [clientId],
      );
      if (existing.rows.length)
        return { idempotent: true, ...(await get(existing.rows[0].id)) };
    }
    throw error;
  } finally {
    client.release();
  }
};

const list = () =>
  pool
    .query(
      `SELECT o.*, COALESCE(SUM(oi.quantity * oi.unit_price), 0)::numeric(12,2) AS total_amount,
          COALESCE((SELECT SUM(payment.amount) FROM direct_order_payments payment WHERE payment.direct_order_id = o.id), 0)::numeric(12,2) AS paid_amount
   FROM direct_orders o
   LEFT JOIN direct_order_items oi ON oi.direct_order_id = o.id
   GROUP BY o.id
   ORDER BY o.order_date ASC`,
    )
    .then((result) =>
      result.rows.map((order) => ({
        ...order,
        outstanding_balance:
          Number(order.total_amount) - Number(order.paid_amount),
      })),
    );

const get = async (id) => {
  const client = await pool.connect();
  try {
    const order = await getWithSummary(client, id);
    if (!order) return null;
    const [items, payments] = await Promise.all([
      client.query(
        `SELECT oi.*, p.name AS product_name FROM direct_order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.direct_order_id = $1`,
        [id],
      ),
      client.query(
        "SELECT * FROM direct_order_payments WHERE direct_order_id = $1 ORDER BY payment_date ASC, id ASC",
        [id],
      ),
    ]);
    return { ...order, items: items.rows, payments: payments.rows };
  } finally {
    client.release();
  }
};

const recordPayment = async (id, amount, paymentDate) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // FIX: lock the order row so two concurrent payments can't both read the same
    // outstanding_balance and both pass the overpayment check.
    await client.query(
      "SELECT id FROM direct_orders WHERE id = $1 FOR UPDATE",
      [id],
    );
    const order = await getWithSummary(client, id);
    if (!order)
      throw Object.assign(new Error("Direct order not found"), {
        code: "NOT_FOUND",
      });
    if (amount > order.outstanding_balance)
      throw Object.assign(new Error("Payment exceeds outstanding balance"), {
        code: "OVERPAYMENT",
      });
    await client.query(
      "INSERT INTO direct_order_payments (direct_order_id, amount, payment_date) VALUES ($1, $2, $3)",
      [id, amount, paymentDate],
    );
    const newPaidAmount = Number(order.paid_amount) + Number(amount);
    // FIX: tolerance-based comparison instead of strict float equality.
    const paymentStatus =
      Math.abs(newPaidAmount - Number(order.total_amount)) < 0.005
        ? "PAID"
        : "DEPOSIT";
    await client.query(
      "UPDATE direct_orders SET payment_status = $1, updated_at = now() WHERE id = $2",
      [paymentStatus, id],
    );
    await client.query("COMMIT");
    return get(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updateStatus = async (id, status) =>
  pool
    .query(
      "UPDATE direct_orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [status, id],
    )
    .then((result) => result.rows[0] || null);

module.exports = { create, get, list, recordPayment, updateStatus };
