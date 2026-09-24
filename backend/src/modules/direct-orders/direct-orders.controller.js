const orders = require("./direct-orders.service");

const ok = (res, data, message = "OK") =>
  res.json({ success: true, data, message });
const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, error: { code, message } });

exports.create = async (req, res) => {
  const { customer_name, items, deposit_amount } = req.body;
  if (!customer_name || !Array.isArray(items) || !items.length)
    return fail(
      res,
      400,
      "VALIDATION_ERROR",
      "customer_name and a non-empty items array are required",
    );
  // FIX: Number.isFinite guard rejects non-numeric quantity strings that used to slip past `<= 0`.
  if (
    items.some(
      (item) =>
        !item.product_id ||
        !Number.isFinite(Number(item.quantity)) ||
        Number(item.quantity) <= 0,
    )
  )
    return fail(
      res,
      400,
      "VALIDATION_ERROR",
      "each item needs product_id and quantity > 0",
    );
  // FIX: same NaN guard for deposit_amount.
  if (
    deposit_amount != null &&
    (!Number.isFinite(Number(deposit_amount)) || Number(deposit_amount) < 0)
  )
    return fail(
      res,
      400,
      "VALIDATION_ERROR",
      "deposit_amount must be a non-negative number",
    );
  try {
    const result = await orders.create({
      ...req.body,
      created_by: req.user.id,
    });
    ok(
      res,
      result,
      result.idempotent
        ? "Already recorded (idempotent)"
        : "Direct order recorded",
    );
  } catch (error) {
    if (error.code === "PRODUCT_NOT_FOUND")
      return fail(res, 404, error.code, error.message);
    if (error.code === "OVERPAYMENT")
      return fail(res, 422, error.code, error.message);
    throw error;
  }
};

exports.list = async (_req, res) => ok(res, await orders.list());
exports.get = async (req, res) => {
  const order = await orders.get(req.params.id);
  if (!order) return fail(res, 404, "NOT_FOUND", "Direct order not found");
  ok(res, order);
};
exports.recordPayment = async (req, res) => {
  const { amount, payment_date } = req.body;
  // FIX: Number.isFinite guard rejects non-numeric amount strings that used to slip past `!amount`.
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || !payment_date)
    return fail(
      res,
      400,
      "VALIDATION_ERROR",
      "amount (>0) and payment_date are required",
    );
  try {
    ok(
      res,
      await orders.recordPayment(req.params.id, Number(amount), payment_date),
      "Direct-order payment recorded",
    );
  } catch (error) {
    if (error.code === "NOT_FOUND")
      return fail(res, 404, error.code, error.message);
    if (error.code === "OVERPAYMENT")
      return fail(res, 422, error.code, error.message);
    throw error;
  }
};
exports.updateStatus = async (req, res) => {
  if (!["processing", "completed"].includes(req.body.status))
    return fail(
      res,
      400,
      "VALIDATION_ERROR",
      "status must be processing or completed",
    );
  const order = await orders.updateStatus(req.params.id, req.body.status);
  if (!order) return fail(res, 404, "NOT_FOUND", "Direct order not found");
  ok(res, order, "Direct order status updated");
};
