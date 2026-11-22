const express = require('express');
const router = express.Router();
const tarefasController = require('../controllers/tarefas.controller');
const { autenticarToken } = require('../middlewares/auth.middleware');
const { autorizarPerfis } = require('../middlewares/rbac.middleware');

router.use(autenticarToken);
router.use(autorizarPerfis('Gestor', 'RH'));

// GET /api/gestor/tarefas - Lista tarefas e entregas das equipes gerenciadas pelo gestor ou todas para RH
router.get('/tarefas', tarefasController.listarTarefasGestor);

module.exports = router;
