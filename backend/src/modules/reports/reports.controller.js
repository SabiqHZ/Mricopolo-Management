const reportsService = require("./reports.service");

const parseDate = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }

  const match = /^\d{4}-\d{2}-\d{2}$/.test(value);

  if (!match) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return value;
};

const validateDateRange = (date_from, date_to) => {
  const from = parseDate(date_from);
  const to = parseDate(date_to);

  if (!from || !to) {
    return {
      valid: false,
      error: {
        code: "INVALID_DATE_RANGE",
        message:
          "date_from dan date_to wajib menggunakan format YYYY-MM-DD yang valid.",
      },
    };
  }

  if (from > to) {
    return {
      valid: false,
      error: {
        code: "INVALID_DATE_RANGE",
        message: "date_from tidak boleh lebih besar dari date_to.",
      },
    };
  }

  return {
    valid: true,
    date_from: from,
    date_to: to,
  };
};

const parseLimit = (value) => {
  if (value === undefined) {
    return 10;
  }

  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return null;
  }

  return limit;
};

const sendError = (res, status, code, message) => {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
    },
  });
};

const getReport = async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;

    const dateValidation = validateDateRange(date_from, date_to);

    if (!dateValidation.valid) {
      return sendError(
        res,
        400,
        dateValidation.error.code,
        dateValidation.error.message,
      );
    }

    const limit = parseLimit(req.query.limit);

    if (limit === null) {
      return sendError(
        res,
        400,
        "INVALID_LIMIT",
        "limit harus berupa bilangan bulat antara 1 sampai 50.",
      );
    }

    const [summary, topProducts, topStores] = await Promise.all([
      reportsService.getSummary({
        date_from: dateValidation.date_from,
        date_to: dateValidation.date_to,
      }),
      reportsService.getTopProducts({
        date_from: dateValidation.date_from,
        date_to: dateValidation.date_to,
        limit,
      }),
      reportsService.getTopStores({
        date_from: dateValidation.date_from,
        date_to: dateValidation.date_to,
        limit,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        period: {
          date_from: dateValidation.date_from,
          date_to: dateValidation.date_to,
        },
        summary,
        top_products: topProducts,
        top_stores: topStores,
      },
      message: "Report retrieved successfully.",
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getReport,
};
