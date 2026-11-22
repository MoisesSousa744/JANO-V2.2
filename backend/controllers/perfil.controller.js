const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Controller de Perfil do Usuário
 * Funcionalidade: Obter informações do usuário logado e alteração de senha
 */

async function obterPerfil(req, res, next) {
    try {
        const usuarioId = req.usuario.id;

        const [rows] = await db.query(
            `SELECT f.id, f.nome, f.cpf, f.cargo, f.telefone, f.email, f.perfil, f.primeiro_acesso, f.id_equipe, f.data_criacao,
                    e.nome as nome_equipe, e.departamento as departamento_equipe
             FROM funcionarios f
             LEFT JOIN equipes e ON f.id_equipe = e.id
             WHERE f.id = ?`,
            [usuarioId]
        );

        if (!rows.length) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Perfil do usuário não encontrado.'
            });
        }

        const usuario = rows[0];

        res.status(200).json({
            sucesso: true,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                cpf: usuario.cpf,
                cargo: usuario.cargo,
                telefone: usuario.telefone || 'Não informado',
                perfil: usuario.perfil,
                id_equipe: usuario.id_equipe,
                nome_equipe: usuario.nome_equipe || 'Sem equipe associada',
                departamento_equipe: usuario.departamento_equipe || null,
                primeiro_acesso: Boolean(usuario.primeiro_acesso),
                data_criacao: usuario.data_criacao
            }
        });
    } catch (error) {
        next(error);
    }
}

async function alterarSenhaPerfil(req, res, next) {
    try {
        const usuarioId = req.usuario.id;
        const { senhaAtual, novaSenha, confirmacaoSenha } = req.body;

        if (!senhaAtual || !novaSenha || !confirmacaoSenha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Preencha a senha atual, a nova senha e a confirmação.'
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

        // Valida senha atual com bcrypt
        const senhaAtualValida = await bcrypt.compare(senhaAtual, usuario.senha_hash);
        if (!senhaAtualValida) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'A senha atual informada está incorreta.'
            });
        }

        if (senhaAtual === novaSenha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'A nova senha deve ser diferente da senha atual.'
            });
        }

        // Gera novo hash bcrypt
        const novoHash = await bcrypt.hash(novaSenha, 10);

        // Atualiza senha e garante primeiro_acesso = 0
        await db.query(
            'UPDATE funcionarios SET senha_hash = ?, primeiro_acesso = ? WHERE id = ?',
            [novoHash, 0, usuarioId]
        );

        // Gera novo JWT atualizado
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

        return res.status(200).json({
            sucesso: true,
            mensagem: 'Senha alterada com sucesso!',
            token: novoToken,
            usuario: {
                ...payload
            }
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    obterPerfil,
    alterarSenhaPerfil
};
