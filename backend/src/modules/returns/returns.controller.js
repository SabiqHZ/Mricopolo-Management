const svc = require('./returns.service');
const ok = (res, data, message = 'OK') => res.json({ success: true, data, message });
const fail = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });

const errorStatus = { INVALID_DROPPING_ITEM: 400, STORE_MISMATCH: 400, RETURN_EXCEEDS_DROPPED: 422 };

exports.create = async (req, res) => {
  const { store_id, items } = req.body;
  if (!store_id || !Array.isArray(items) || items.length === 0)
    return fail(res, 400, 'VALIDATION_ERROR', 'store_id and a non-empty items array are required');
  for (const item of items) {
    if (!item.dropping_item_id || !item.quantity || item.quantity <= 0)
      return fail(res, 400, 'VALIDATION_ERROR', 'each item needs dropping_item_id and quantity > 0');
  }
  try {
    const result = await svc.create({ ...req.body, created_by: req.user.id });
    ok(res, result, result.idempotent ? 'Already recorded (idempotent)' : 'Return recorded, invoice generated');
  } catch (err) {
    if (err.code === '23505') return fail(res, 409, 'DUPLICATE_RETURN', 'This dropping item has already been returned against');
    if (errorStatus[err.code]) return fail(res, errorStatus[err.code], err.code, err.message);
    throw err;
  }
};