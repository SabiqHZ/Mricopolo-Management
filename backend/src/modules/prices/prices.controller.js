const svc = require('./prices.service');
const ok = (res, data, message = 'OK') => res.json({ success: true, data, message });
const fail = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });

exports.upsert = async (req, res) => {
  const { store_id, product_id, price } = req.body;
  if (!store_id || !product_id || price == null)
    return fail(res, 400, 'VALIDATION_ERROR', 'store_id, product_id, price are required');
  ok(res, await svc.upsert(store_id, product_id, price), 'Price set');
};
exports.listByStore = async (req, res) => ok(res, await svc.listByStore(req.params.storeId));
exports.remove = async (req, res) => {
  const d = await svc.remove(req.params.storeId, req.params.productId);
  if (!d) return fail(res, 404, 'NOT_FOUND', 'No special price for this store/product');
  ok(res, null, 'Special price removed');
};