const express = require('express');
const authenticate = require('../../middlewares/auth.middleware');
const controller = require('./invoices.controller');

const router = express.Router();
router.use(authenticate);
router.get('/', controller.list);
router.get('/:id', controller.get);

module.exports = router;
