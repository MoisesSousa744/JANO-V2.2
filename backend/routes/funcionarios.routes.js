const express = require('express');
const router = express.Router();
const funcionariosController = require('../controllers/funcionarios.controller');
const { autenticarToken } = require('../middlewares/auth.middleware');
const { autorizarPerfis } = require('../middlewares/rbac.middleware');

// Todas as rotas de funcionários exigem autenticação
router.use(autenticarToken);

// Listagem de colaboradores (disponível para RH e Gestor para alocações em equipes)
router.get('/', autorizarPerfis('RH', 'Gestor'), funcionariosController.listarFuncionarios);
router.get('/:id', autorizarPerfis('RH', 'Gestor'), funcionariosController.obterFuncionarioPorId);

// Somente RH tem permissão para cadastrar e excluir (desligamento) - RN01, RN07, RF01, RF15
router.post('/', autorizarPerfis('RH'), funcionariosController.cadastrarFuncionario);
router.delete('/:id', autorizarPerfis('RH'), funcionariosController.excluirFuncionario);

module.exports = router;
