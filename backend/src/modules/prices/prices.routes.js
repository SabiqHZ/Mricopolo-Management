const express = require('express');
const authenticate = require('../../middlewares/auth.middleware');
const c = require('./prices.controller');
const router = express.Router();
router.use(authenticate);
router.post('/', c.upsert);
router.get('/store/:storeId', c.listByStore);
router.delete('/store/:storeId/product/:productId', c.remove);
module.exports = router;
