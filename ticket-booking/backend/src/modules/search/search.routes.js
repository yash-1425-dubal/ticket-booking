const { Router } = require('express');
const controller = require('./search.controller');

const router = Router();

router.get('/', controller.search);

module.exports = router;
