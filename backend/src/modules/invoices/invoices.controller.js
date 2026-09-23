const invoices = require('./invoices.service');

const ok = (res, data, message = 'OK') => res.json({ success: true, data, message });

exports.list = async (req, res) => ok(res, await invoices.list(req.query));

exports.get = async (req, res) => {
  const invoice = await invoices.get(req.params.id);
  if (!invoice) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
  }
  ok(res, invoice);
};
