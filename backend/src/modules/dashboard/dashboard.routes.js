const express = require('express');
const authenticate = require('../../middlewares/auth.middleware');
const controller = require('./dashboard.controller');

const router = express.Router();

router.use(authenticate);
router.get('/overview', controller.getOverview);

module.exports = router;
