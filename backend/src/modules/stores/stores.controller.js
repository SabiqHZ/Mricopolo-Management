const svc = require('./stores.service');

const ok = (res, data, message = 'OK') => res.json({ success: true, data, message });
const fail = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });

exports.create = async (req, res) => {
  if (!req.body.name) return fail(res, 400, 'VALIDATION_ERROR', 'name is required');
  ok(res, await svc.create(req.body), 'Store created', res);
};
exports.list = async (req, res) => ok(res, await svc.list());
exports.get = async (req, res) => {
  const store = await svc.get(req.params.id);
  if (!store) return fail(res, 404, 'NOT_FOUND', 'Store not found');
  ok(res, store);
};
exports.update = async (req, res) => {
  const store = await svc.update(req.params.id, req.body);
  if (!store) return fail(res, 404, 'NOT_FOUND', 'Store not found');
  ok(res, store, 'Store updated');
};
exports.remove = async (req, res) => {
  const deleted = await svc.remove(req.params.id);
  if (!deleted) return fail(res, 404, 'NOT_FOUND', 'Store not found');
  ok(res, null, 'Store deleted');
};