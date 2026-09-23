const authService = require('./auth.service');

async function loginHandler(req, res) {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'identifier and password are required' },
    });
  }

  const result = await authService.login(identifier, password);
  if (!result) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username/email or password' },
    });
  }

  return res.json({ success: true, data: result, message: 'Login successful' });
}

module.exports = { loginHandler };