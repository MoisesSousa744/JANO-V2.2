const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { autenticarToken } = require('../middlewares/auth.middleware');
const { autorizarPerfis } = require('../middlewares/rbac.middleware');

router.use(autenticarToken);

router.get('/metricas-rh', autorizarPerfis('RH'), dashboardController.getMetricasRH);
router.get('/metricas-gestor', autorizarPerfis('Gestor', 'RH'), dashboardController.getMetricasGestor);

module.exports = router;
