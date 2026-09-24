const express = require("express");
const { getReport } = require("./reports.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

const router = express.Router();

router.get("/", authMiddleware, getReport);

module.exports = router;
