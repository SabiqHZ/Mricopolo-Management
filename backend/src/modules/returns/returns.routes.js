const express = require('express');
const authenticate = require('../../middlewares/auth.middleware');
const c = require('./returns.controller');
const router = express.Router();
router.use(authenticate);
router.post('/', c.create);
module.exports = router;