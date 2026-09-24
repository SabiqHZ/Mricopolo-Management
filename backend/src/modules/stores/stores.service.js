const pool = require("../../config/db");

const create = (data) =>
  pool
    .query(
      `INSERT INTO stores (name, address, contact, visit_schedule, visit_reminder_days)
   VALUES ($1,$2,$3,$4,$5)
   RETURNING *`,
      [
        data.name,
        data.address,
        data.contact,
        data.visit_schedule,
        data.visit_reminder_days || 3,
      ],
    )
    .then((r) => r.rows[0]);

const list = (filters = {}) => {
  const conditions = ["deleted_at IS NULL"];
  const params = [];
  let index = 1;

  if (filters.q && String(filters.q).trim()) {
    const search = `%${String(filters.q).trim()}%`;

    conditions.push(`
      (
        name ILIKE $${index}
        OR address ILIKE $${index}
        OR contact ILIKE $${index}
      )
    `);

    params.push(search);
    index++;
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  return pool
    .query(
      `
    SELECT *
    FROM stores
    ${where}
    ORDER BY name ASC
    `,
      params,
    )
    .then((r) => r.rows);
};

const get = (id) =>
  pool
    .query(
      `SELECT *
   FROM stores
   WHERE id = $1
     AND deleted_at IS NULL`,
      [id],
    )
    .then((r) => r.rows[0] || null);

const update = (id, data) =>
  pool
    .query(
      `UPDATE stores
   SET name = $1,
       address = $2,
       contact = $3,
       visit_schedule = $4,
       visit_reminder_days = $5,
       updated_at = now()
   WHERE id = $6
     AND deleted_at IS NULL
   RETURNING *`,
      [
        data.name,
        data.address,
        data.contact,
        data.visit_schedule,
        data.visit_reminder_days,
        id,
      ],
    )
    .then((r) => r.rows[0] || null);

const remove = (id) =>
  pool
    .query(
      `UPDATE stores
   SET deleted_at = now()
   WHERE id = $1
     AND deleted_at IS NULL
   RETURNING id`,
      [id],
    )
    .then((r) => r.rows[0] || null);

module.exports = {
  create,
  list,
  get,
  update,
  remove,
};
