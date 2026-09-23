const express = require('express');
const authenticate = require('../../middlewares/auth.middleware');
const controller = require('./direct-orders.controller');

const router = express.Router();
router.use(authenticate);
router.post('/', controller.create);
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/:id/payments', controller.recordPayment);
router.patch('/:id/status', controller.updateStatus);

module.exports = router;
