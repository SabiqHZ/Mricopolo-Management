const express = require('express');
const authenticate = require('../../middlewares/auth.middleware');
const c = require('./droppings.controller');
const router = express.Router();
router.use(authenticate);
router.post('/', c.create);
router.get('/', c.list);
router.get('/:id', c.get);
module.exports = router;