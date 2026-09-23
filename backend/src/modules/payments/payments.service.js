const pool = require('../../config/db');

const create = async (invoice_id, amount, payment_date) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const invRes = await client.query(`SELECT * FROM invoices WHERE id=$1 FOR UPDATE`, [invoice_id]);
    if (!invRes.rows.length)
      throw Object.assign(new Error('Invoice not found'), { code: 'INVOICE_NOT_FOUND' });
    const invoice = invRes.rows[0];

    const paidRes = await client.query(`SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE invoice_id=$1`, [invoice_id]);
    const alreadyPaid = Number(paidRes.rows[0].total);
    const outstanding = Number(invoice.total_amount) - alreadyPaid;

    if (amount > outstanding)
      throw Object.assign(new Error(`Payment (${amount}) exceeds outstanding balance (${outstanding})`), { code: 'OVERPAYMENT' });

    const payment = await client.query(
      `INSERT INTO payments (invoice_id, amount, payment_date) VALUES ($1,$2,$3) RETURNING *`,
      [invoice_id, amount, payment_date]
    );

    const newTotalPaid = alreadyPaid + amount;
    const newStatus = newTotalPaid >= Number(invoice.total_amount) ? 'PAID' : 'UNPAID';

    const updatedInvoice = await client.query(
      `UPDATE invoices SET status=$1, updated_at=now() WHERE id=$2 RETURNING *`,
      [newStatus, invoice_id]
    );

    await client.query('COMMIT');
    return {
      payment: payment.rows[0],
      invoice: updatedInvoice.rows[0],
      outstanding_balance: Number(updatedInvoice.rows[0].total_amount) - newTotalPaid,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const history = (invoice_id) => pool.query(
  `SELECT * FROM payments WHERE invoice_id=$1 ORDER BY payment_date ASC, id ASC`, [invoice_id]
).then(r => r.rows);

module.exports = { create, history };