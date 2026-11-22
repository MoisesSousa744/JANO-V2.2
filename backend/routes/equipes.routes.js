const express = require('express');
const router = express.Router();
const equipesController = require('../controllers/equipes.controller');
const { autenticarToken } = require('../middlewares/auth.middleware');
const { autorizarPerfis } = require('../middlewares/rbac.middleware');

router.use(autenticarToken);

// Gestores e RH podem visualizar equipes
router.get('/', autorizarPerfis('Gestor', 'RH'), equipesController.listarEquipes);
router.get('/:id/membros', autorizarPerfis('Gestor', 'RH'), equipesController.listarMembrosEquipe);

// Criação e gestão de membros (RF10, RF11, RF13, RN05)
router.post('/', autorizarPerfis('Gestor', 'RH'), equipesController.criarEquipe);
router.post('/:id/membros', autorizarPerfis('Gestor', 'RH'), equipesController.vincularMembro);
router.delete('/:id/membros/:id_funcionario', autorizarPerfis('Gestor', 'RH'), equipesController.removerMembro);

module.exports = router;
