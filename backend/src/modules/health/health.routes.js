'use strict';

const express = require('express');
const { getHealth } = require('./health.controller');

const router = express.Router();

// Mounted at /api/health by app.js
router.get('/', getHealth);

module.exports = router;
