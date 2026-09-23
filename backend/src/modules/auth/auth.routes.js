const express = require('express');
const { loginHandler } = require('./auth.controller');

const router = express.Router();
router.post('/login', loginHandler);

module.exports = router;