const svc = require('./payments.service');
const ok = (res, data, message = 'OK') => res.json({ success: true, data, message });
const fail = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });
const errorStatus = { INVOICE_NOT_FOUND: 404, OVERPAYMENT: 422 };

exports.create = async (req, res) => {
  const { invoice_id, amount, payment_date } = req.body;
  if (!invoice_id || !amount || amount <= 0 || !payment_date)
    return fail(res, 400, 'VALIDATION_ERROR', 'invoice_id, amount (>0), and payment_date are required');
  try {
    const result = await svc.create(invoice_id, amount, payment_date);
    ok(res, result, `Payment recorded, invoice is now ${result.invoice.status}`);
  } catch (err) {
    if (errorStatus[err.code]) return fail(res, errorStatus[err.code], err.code, err.message);
    throw err;
  }
};

exports.history = async (req, res) => ok(res, await svc.history(req.params.invoiceId));