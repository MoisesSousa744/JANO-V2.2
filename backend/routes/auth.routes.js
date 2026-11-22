const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { autenticarToken } = require('../middlewares/auth.middleware');

// Rota pública de login
router.post('/login', authController.login);

// Rotas autenticadas
router.post('/alterar-senha', autenticarToken, authController.alterarSenha);
router.get('/me', autenticarToken, authController.getUsuarioAtual);

module.exports = router;
