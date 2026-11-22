const db = require('../config/database');

/**
 * Controller de Gestão de Equipes (Gestor de Equipe & RH)
 * Regras: RF10, RF11, RF12, RF13, RN05, RN06, RN08
 */

async function criarEquipe(req, res, next) {
    try {
        const { nome, departamento, id_gestor } = req.body;

        if (!nome || !departamento) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Nome da equipe e Departamento são obrigatórios.'
            });
        }

        // Se o usuário logado for Gestor, ele é automaticamente o id_gestor da equipe
        // Se for RH, ele pode atribuir um gestor existente
        const gestorId = req.usuario.perfil === 'Gestor' ? req.usuario.id : (id_gestor || req.usuario.id);

        const [resultado] = await db.query(
            'INSERT INTO equipes (nome, departamento, id_gestor, data_criacao) VALUES (?, ?, ?, NOW())',
            [nome.trim(), departamento.trim(), gestorId]
        );

        res.status(201).json({
            sucesso: true,
            mensagem: 'Equipe criada com sucesso!',
            equipe: {
                id: resultado.insertId,
                nome,
                departamento,
                id_gestor: gestorId
            }
        });
    } catch (error) {
        next(error);
    }
}

async function listarEquipes(req, res, next) {
    try {
        let sql = 'SELECT * FROM equipes';
        let params = [];

        // Se for Gestor, pode listar as equipes gerenciadas por ele (ou todas para visão global)
        if (req.usuario.perfil === 'Gestor' && req.query.somenteMinhas === 'true') {
            sql = 'SELECT * FROM equipes WHERE id_gestor = ?';
            params = [req.usuario.id];
        }

        const [equipes] = await db.query(sql, params);
        const [todosFuncionarios] = await db.query('SELECT id, nome, cargo, email, perfil FROM funcionarios');

        // Para cada equipe, agrega membros vinculados
        const equipesCompletas = await Promise.all(equipes.map(async (eq) => {
            const gestor = todosFuncionarios.find(f => f.id === eq.id_gestor);
            const [membros] = await db.query(
                `SELECT f.id, f.nome, f.cargo, f.email, fe.data_vinculo
                 FROM funcionario_equipe fe
                 JOIN funcionarios f ON fe.id_funcionario = f.id
                 WHERE fe.id_equipe = ?`,
                [eq.id]
            );

            return {
                ...eq,
                gestor_nome: gestor ? gestor.nome : 'Não especificado',
                gestor_email: gestor ? gestor.email : '',
                total_membros: membros.length,
                membros
            };
        }));

        res.status(200).json({
            sucesso: true,
            total: equipesCompletas.length,
            equipes: equipesCompletas
        });
    } catch (error) {
        next(error);
    }
}

async function vincularMembro(req, res, next) {
    try {
        const id_equipe = Number(req.params.id);
        const { id_funcionario } = req.body;

        if (!id_funcionario) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'ID do funcionário é obrigatório para vínculo à equipe.'
            });
        }

        const funcId = Number(id_funcionario);

        // RF11 & RN05 & RN08: Gestor vincula funcionário à equipe (suporta múltiplas equipes sem duplicar)
        await db.query(
            'INSERT IGNORE INTO funcionario_equipe (id_funcionario, id_equipe, data_vinculo) VALUES (?, ?, NOW())',
            [funcId, id_equipe]
        );

        // Define como equipe principal caso o funcionário ainda não tenha nenhuma
        const [funcRows] = await db.query('SELECT id_equipe FROM funcionarios WHERE id = ?', [funcId]);
        if (funcRows.length && !funcRows[0].id_equipe) {
            await db.query('UPDATE funcionarios SET id_equipe = ? WHERE id = ?', [id_equipe, funcId]);
        }

        res.status(200).json({
            sucesso: true,
            mensagem: 'Colaborador vinculado à equipe com sucesso!'
        });
    } catch (error) {
        next(error);
    }
}

async function removerMembro(req, res, next) {
    try {
        const id_equipe = Number(req.params.id);
        const id_funcionario = Number(req.params.id_funcionario);

        // RF13: Gestor remove funcionário da equipe
        await db.query(
            'DELETE FROM funcionario_equipe WHERE id_funcionario = ? AND id_equipe = ?',
            [id_funcionario, id_equipe]
        );

        // Sincroniza id_equipe principal na tabela funcionarios com as equipes restantes
        const [restantes] = await db.query(
            'SELECT id_equipe FROM funcionario_equipe WHERE id_funcionario = ?',
            [id_funcionario]
        );
        const proximaEquipe = restantes && restantes.length > 0 ? restantes[0].id_equipe : null;
        await db.query('UPDATE funcionarios SET id_equipe = ? WHERE id = ?', [proximaEquipe, id_funcionario]);

        res.status(200).json({
            sucesso: true,
            mensagem: 'Colaborador desvinculado da equipe com sucesso!'
        });
    } catch (error) {
        next(error);
    }
}

async function listarMembrosEquipe(req, res, next) {
    try {
        const id_equipe = Number(req.params.id);
        const [membros] = await db.query(
            `SELECT f.id, f.nome, f.cargo, f.email, fe.data_vinculo
             FROM funcionario_equipe fe
             JOIN funcionarios f ON fe.id_funcionario = f.id
             WHERE fe.id_equipe = ?`,
            [id_equipe]
        );

        res.status(200).json({
            sucesso: true,
            total: membros.length,
            membros
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    criarEquipe,
    listarEquipes,
    vincularMembro,
    removerMembro,
    listarMembrosEquipe
};
