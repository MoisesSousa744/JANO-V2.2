const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Controller de Autenticação do JANO
 * Gerencia Login, Troca Obrigatória de Senha (Primeiro Acesso) e Dados da Sessão
 */

async function login(req, res, next) {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Informe o e-mail e a senha para autenticar.'
            });
        }

        const [rows] = await db.query('SELECT * FROM funcionarios WHERE email = ?', [email.trim().toLowerCase()]);
        const usuario = rows[0];

        if (!usuario) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Credenciais inválidas. Verifique o e-mail e a senha digitados.'
            });
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
        if (!senhaValida) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Credenciais inválidas. Verifique o e-mail e a senha digitados.'
            });
        }

        const payload = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            cargo: usuario.cargo,
            perfil: usuario.perfil,
            id_equipe: usuario.id_equipe,
            primeiro_acesso: Boolean(usuario.primeiro_acesso)
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'jano_secret_key_super_segura_jwt_2026_etec_onboarding',
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        // Mapeia o dashboard correspondente a cada perfil
        const mapaDashboard = {
            'RH': 'dashboard-rh.html',
            'Gestor': 'dashboard-gestor.html',
            'Funcionario': 'dashboard-funcionario.html'
        };

        const destino = usuario.primeiro_acesso ? 'alterar-senha.html' : (mapaDashboard[usuario.perfil] || 'dashboard-funcionario.html');

        return res.status(200).json({
            sucesso: true,
            mensagem: usuario.primeiro_acesso
                ? 'Primeiro acesso identificado. É obrigatório alterar sua senha temporária.'
                : 'Login realizado com sucesso!',
            token,
            primeiroAcesso: Boolean(usuario.primeiro_acesso),
            redirecionarPara: destino,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                cargo: usuario.cargo,
                perfil: usuario.perfil,
                primeiro_acesso: Boolean(usuario.primeiro_acesso)
            }
        });
    } catch (error) {
        next(error);
    }
}

async function alterarSenha(req, res, next) {
    try {
        const usuarioId = req.usuario.id;
        const { senhaAtual, novaSenha, confirmacaoSenha } = req.body;

        if (!senhaAtual || !novaSenha || !confirmacaoSenha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Preencha a senha atual/temporária, a nova senha e a confirmação.'
            });
        }

        if (novaSenha !== confirmacaoSenha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'A nova senha e a confirmação não coincidem.'
            });
        }

        if (novaSenha.length < 6) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'A nova senha deve ter no mínimo 6 caracteres.'
            });
        }

        const [rows] = await db.query('SELECT * FROM funcionarios WHERE id = ?', [usuarioId]);
        const usuario = rows[0];

        if (!usuario) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Usuário não encontrado.'
            });
        }

        // Valida se a senha temporária/atual fornecida confere
        const senhaAtualValida = await bcrypt.compare(senhaAtual, usuario.senha_hash);
        if (!senhaAtualValida) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'A senha atual/temporária informada está incorreta.'
            });
        }

        // Gera o novo hash seguro
        const novoHash = await bcrypt.hash(novaSenha, 10);

        // Atualiza no banco: nova senha e remove o flag de primeiro_acesso
        await db.query(
            'UPDATE funcionarios SET senha_hash = ?, primeiro_acesso = ? WHERE id = ?',
            [novoHash, 0, usuarioId]
        );

        // Gera um novo JWT com primeiro_acesso = false
        const payload = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            cargo: usuario.cargo,
            perfil: usuario.perfil,
            id_equipe: usuario.id_equipe,
            primeiro_acesso: false
        };

        const novoToken = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'jano_secret_key_super_segura_jwt_2026_etec_onboarding',
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        const mapaDashboard = {
            'RH': 'dashboard-rh.html',
            'Gestor': 'dashboard-gestor.html',
            'Funcionario': 'dashboard-funcionario.html'
        };

        return res.status(200).json({
            sucesso: true,
            mensagem: 'Senha alterada com sucesso! Seu acesso foi liberado.',
            token: novoToken,
            redirecionarPara: mapaDashboard[usuario.perfil] || 'dashboard-funcionario.html',
            usuario: {
                ...payload
            }
        });
    } catch (error) {
        next(error);
    }
}

async function getUsuarioAtual(req, res, next) {
    try {
        const [rows] = await db.query(
            'SELECT id, nome, cpf, cargo, telefone, email, primeiro_acesso, perfil, id_equipe, data_criacao FROM funcionarios WHERE id = ?',
            [req.usuario.id]
        );

        if (!rows.length) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Usuário não encontrado.'
            });
        }

        res.status(200).json({
            sucesso: true,
            usuario: rows[0]
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    login,
    alterarSenha,
    getUsuarioAtual
};
