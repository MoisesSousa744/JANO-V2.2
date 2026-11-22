const express = require('express');
const router = express.Router();
const tarefasController = require('../controllers/tarefas.controller');
const { autenticarToken } = require('../middlewares/auth.middleware');
const { autorizarPerfis } = require('../middlewares/rbac.middleware');

router.use(autenticarToken);

// Listagem de tarefas (Funcionários veem as suas; Gestores/RH veem de suas equipes ou todas)
router.get('/', tarefasController.listarTarefas);

// Criar tarefa (Gestor ou RH)
router.post('/', autorizarPerfis('Gestor', 'RH'), tarefasController.criarTarefa);

// Concluir tarefa com evidência (Funcionário ou Gestor)
router.patch('/:id/concluir', tarefasController.concluirTarefa);

module.exports = router;
