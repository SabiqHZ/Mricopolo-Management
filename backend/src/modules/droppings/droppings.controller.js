const svc = require('./droppings.service');
const ok = (res, data, message = 'OK') => res.json({ success: true, data, message });
const fail = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });

exports.create = async (req, res) => {
  const { store_id, items } = req.body;
  if (!store_id || !Array.isArray(items) || items.length === 0)
    return fail(res, 400, 'VALIDATION_ERROR', 'store_id and a non-empty items array are required');
  for (const item of items) {
    if (!item.product_id || !item.quantity || item.quantity <= 0)
      return fail(res, 400, 'VALIDATION_ERROR', 'each item needs product_id and quantity > 0');
  }
  const result = await svc.create({ ...req.body, created_by: req.user.id });
  ok(res, result, result.idempotent ? 'Already recorded (idempotent)' : 'Dropping recorded');
};

exports.list = async (req, res) => ok(res, await svc.list(req.query));

exports.get = async (req, res) => {
  const d = await svc.getWithItems(req.params.id);
  if (!d) return fail(res, 404, 'NOT_FOUND', 'Dropping not found');
  ok(res, d);
};