const express = require('express');
const router = express.Router();
const perfilController = require('../controllers/perfil.controller');
const { autenticarToken } = require('../middlewares/auth.middleware');

router.use(autenticarToken);

// GET /api/perfil - Retorna dados do usuário autenticado
router.get('/', perfilController.obterPerfil);

// PUT /api/perfil/senha - Atualiza a senha do usuário autenticado com validação da senha atual
router.put('/senha', perfilController.alterarSenhaPerfil);

module.exports = router;
