const express = require('express');
const authenticate = require('../../middlewares/auth.middleware');
const c = require('./payments.controller');
const router = express.Router();
router.use(authenticate);
router.post('/', c.create);
router.get('/invoice/:invoiceId', c.history);
module.exports = router;