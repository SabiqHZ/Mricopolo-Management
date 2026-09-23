const svc = require('./products.service');
const ok = (res, data, message = 'OK') => res.json({ success: true, data, message });
const fail = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });

exports.create = async (req, res) => {
  if (!req.body.name || req.body.base_price == null)
    return fail(res, 400, 'VALIDATION_ERROR', 'name and base_price are required');
  try {
    ok(res, await svc.create(req.body), 'Product created');
  } catch (err) {
    if (err.code === '23505') return fail(res, 409, 'DUPLICATE_PRODUCT', 'Product name already exists');
    throw err;
  }
};
exports.list = async (req, res) => ok(res, await svc.list());
exports.get = async (req, res) => {
  const p = await svc.get(req.params.id);
  if (!p) return fail(res, 404, 'NOT_FOUND', 'Product not found');
  ok(res, p);
};
exports.update = async (req, res) => {
  const p = await svc.update(req.params.id, req.body);
  if (!p) return fail(res, 404, 'NOT_FOUND', 'Product not found');
  ok(res, p, 'Product updated');
};
exports.remove = async (req, res) => {
  const d = await svc.remove(req.params.id);
  if (!d) return fail(res, 404, 'NOT_FOUND', 'Product not found');
  ok(res, null, 'Product deleted');
};