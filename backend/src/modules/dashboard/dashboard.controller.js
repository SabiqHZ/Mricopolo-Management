const dashboard = require('./dashboard.service');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

exports.getOverview = async (req, res) => {
  const { date_from, date_to } = req.query;

  if (!DATE_PATTERN.test(date_from || '') || !DATE_PATTERN.test(date_to || '')) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'date_from and date_to must use YYYY-MM-DD format' },
    });
  }

  if (date_from > date_to) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'date_from must not be after date_to' },
    });
  }

  const data = await dashboard.getOverview({ date_from, date_to });
  res.json({ success: true, data, message: 'Dashboard overview retrieved' });
};
