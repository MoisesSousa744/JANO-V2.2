const db = require('../config/database');
const { salvarArquivoBase64 } = require('../utils/upload.helper');

/**
 * Controller de Tarefas de Integração (Onboarding)
 * Regras: RF06, RF07, RF08, RF09, RN04, RN05
 */

async function criarTarefa(req, res, next) {
    try {
        const { titulo, descricao, prazo, id_funcionario, id_equipe, anexo } = req.body;

        if (!titulo || !prazo) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Título e Prazo da tarefa são obrigatórios.'
            });
        }

        if (!id_funcionario && !id_equipe) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'A tarefa deve ser atribuída a um Colaborador específico ou a uma Equipe.'
            });
        }

        const criadorId = req.usuario.id;
        const funcionarioId = id_funcionario ? Number(id_funcionario) : null;
        const equipeId = id_equipe ? Number(id_equipe) : null;

        let anexoSalvo = null;
        if (anexo && anexo.dataBase64) {
            anexoSalvo = await salvarArquivoBase64(anexo);
        }

        const [resultado] = await db.query(
            `INSERT INTO tarefas (titulo, descricao, prazo, status, id_funcionario, id_equipe, id_criador, anexo_url, anexo_nome, anexo_tipo, data_criacao)
             VALUES (?, ?, ?, 'Pendente', ?, ?, ?, ?, ?, ?, NOW())`,
            [
                titulo.trim(),
                descricao ? descricao.trim() : null,
                prazo,
                funcionarioId,
                equipeId,
                criadorId,
                anexoSalvo ? anexoSalvo.url : null,
                anexoSalvo ? anexoSalvo.nome : null,
                anexoSalvo ? anexoSalvo.tipo : null
            ]
        );

        res.status(201).json({
            sucesso: true,
            mensagem: 'Tarefa de integração criada e atribuída com sucesso!',
            tarefa: {
                id: resultado.insertId,
                titulo: titulo.trim(),
                descricao: descricao ? descricao.trim() : null,
                prazo,
                status: 'Pendente',
                id_funcionario: funcionarioId,
                id_equipe: equipeId,
                id_criador: criadorId,
                anexo_url: anexoSalvo ? anexoSalvo.url : null,
                anexo_nome: anexoSalvo ? anexoSalvo.nome : null,
                anexo_tipo: anexoSalvo ? anexoSalvo.tipo : null
            }
        });
    } catch (error) {
        next(error);
    }
}

async function listarTarefas(req, res, next) {
    try {
        const usuario = req.usuario;
        const somenteMinhas = req.query.somenteMinhas === 'true';

        // Perfil Funcionário OU visualização "Minhas Tarefas" de RH/Gestor:
        // visualiza exclusivamente as tarefas atribuídas diretamente ao usuário logado ou às suas equipes
        if (usuario.perfil === 'Funcionario' || somenteMinhas) {
            let [tarefas] = await db.query(
                `SELECT t.id, t.titulo, t.descricao, t.prazo, t.status, t.evidencia,
                        t.anexo_url, t.anexo_nome, t.anexo_tipo,
                        t.evidencia_arquivo_url, t.evidencia_arquivo_nome, t.evidencia_arquivo_tipo,
                        t.data_conclusao, t.id_funcionario, t.id_equipe, t.id_criador, t.data_criacao,
                        e.nome as equipe_nome, f_criador.nome as criador_nome
                 FROM tarefas t
                 LEFT JOIN equipes e ON t.id_equipe = e.id
                 LEFT JOIN funcionarios f_criador ON t.id_criador = f_criador.id
                 WHERE t.id_funcionario = ? 
                    OR (t.id_funcionario IS NULL AND t.id_equipe IN (
                        SELECT id_equipe FROM funcionario_equipe WHERE id_funcionario = ?
                    ))
                 ORDER BY t.status DESC, t.prazo ASC`,
                [usuario.id, usuario.id]
            );

            // Se for funcionário e ainda não tiver nenhuma tarefa ou não tiver o mini-treinamento inicial pré-programado
            const temTreinamento = tarefas.some(t => t.titulo.toLowerCase().includes('mini-treinamento') || t.titulo.toLowerCase().includes('treinamento inicial'));
            if (!temTreinamento && usuario.perfil === 'Funcionario') {
                try {
                    const prazoInicial = new Date();
                    prazoInicial.setDate(prazoInicial.getDate() + 3);
                    const prazoStr = prazoInicial.toISOString().split('T')[0];

                    await db.query(
                        `INSERT INTO tarefas (titulo, descricao, prazo, status, id_funcionario, id_equipe, id_criador, data_criacao)
                         VALUES (?, ?, ?, 'Pendente', ?, NULL, NULL, NOW())`,
                        [
                            '🏁 Mini-Treinamento: Boas-vindas ao JANO e Primeiros Passos',
                            'Treinamento prático de integração obrigatório: conheça as funcionalidades da plataforma JANO, acesse materiais de apoio e conclua esta tarefa enviando uma evidência para liberar suas atividades diárias.',
                            prazoStr,
                            usuario.id
                        ]
                    );

                    // Recarrega tarefas atualizadas
                    const [tarefasAtualizadas] = await db.query(
                        `SELECT t.id, t.titulo, t.descricao, t.prazo, t.status, t.evidencia,
                                t.anexo_url, t.anexo_nome, t.anexo_tipo,
                                t.evidencia_arquivo_url, t.evidencia_arquivo_nome, t.evidencia_arquivo_tipo,
                                t.data_conclusao, t.id_funcionario, t.id_equipe, t.id_criador, t.data_criacao,
                                e.nome as equipe_nome, f_criador.nome as criador_nome
                         FROM tarefas t
                         LEFT JOIN equipes e ON t.id_equipe = e.id
                         LEFT JOIN funcionarios f_criador ON t.id_criador = f_criador.id
                         WHERE t.id_funcionario = ? 
                            OR (t.id_funcionario IS NULL AND t.id_equipe IN (
                                SELECT id_equipe FROM funcionario_equipe WHERE id_funcionario = ?
                            ))
                         ORDER BY t.status DESC, t.prazo ASC`,
                        [usuario.id, usuario.id]
                    );
                    tarefas = tarefasAtualizadas;
                } catch (errAuto) {
                    console.warn('Aviso ao auto-atribuir mini-treinamento inicial:', errAuto.message);
                }
            }

            const pendentes = tarefas.filter(t => t.status === 'Pendente');
            const concluidas = tarefas.filter(t => t.status === 'Concluida');
            const total = tarefas.length;
            const progresso = total > 0 ? Math.round((concluidas.length / total) * 100) : 0;

            return res.status(200).json({
                sucesso: true,
                total,
                totalPendentes: pendentes.length,
                totalConcluidas: concluidas.length,
                progresso,
                onboardingConcluido: total > 0 && concluidas.length === total,
                pendentes,
                concluidas,
                todas: tarefas
            });
        }

        // Se for Gestor ou RH (visão gerencial), lista todas com nomes dos colaboradores e equipes
        let querySql = `
            SELECT t.id, t.titulo, t.descricao, t.prazo, t.status, t.evidencia,
                   t.anexo_url, t.anexo_nome, t.anexo_tipo,
                   t.evidencia_arquivo_url, t.evidencia_arquivo_nome, t.evidencia_arquivo_tipo,
                   t.data_conclusao, t.id_funcionario, t.id_equipe, t.id_criador, t.data_criacao,
                   f.nome as funcionario_nome, f.cargo as funcionario_cargo,
                   e.nome as equipe_nome,
                   fc.nome as criador_nome
            FROM tarefas t
            LEFT JOIN funcionarios f ON t.id_funcionario = f.id
            LEFT JOIN equipes e ON t.id_equipe = e.id
            LEFT JOIN funcionarios fc ON t.id_criador = fc.id
        `;
        let params = [];

        if (req.query.id_equipe) {
            querySql += ' WHERE t.id_equipe = ?';
            params.push(Number(req.query.id_equipe));
        } else if (req.query.id_funcionario) {
            querySql += ' WHERE t.id_funcionario = ?';
            params.push(Number(req.query.id_funcionario));
        }

        querySql += ' ORDER BY t.id DESC';

        const [tarefas] = await db.query(querySql, params);

        res.status(200).json({
            sucesso: true,
            total: tarefas.length,
            tarefas
        });
    } catch (error) {
        next(error);
    }
}

async function concluirTarefa(req, res, next) {
    try {
        const id = Number(req.params.id);
        const { evidencia, arquivo } = req.body;
        const evidenciaTexto = evidencia ? String(evidencia).trim() : '';
        const temArquivo = Boolean(arquivo && arquivo.dataBase64);

        if (!evidenciaTexto && !temArquivo) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Forneça uma descrição/link ou anexe um arquivo PDF/Vídeo como evidência da entrega.'
            });
        }

        // Busca a tarefa
        const [rows] = await db.query('SELECT * FROM tarefas WHERE id = ?', [id]);
        if (!rows.length) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Tarefa de integração não encontrada.'
            });
        }

        const tarefa = rows[0];

        // Valida permissão sobre a tarefa (RN04):
        // Funcionário ou usuário concluindo pela tela Minhas Tarefas só pode concluir tarefas próprias ou de suas equipes
        if (req.usuario.perfil === 'Funcionario' || req.body.somenteMinhas === true) {
            const isDono = tarefa.id_funcionario === req.usuario.id;

            let isMembroEquipe = false;
            if (!tarefa.id_funcionario && tarefa.id_equipe) {
                const [vinculo] = await db.query(
                    'SELECT id FROM funcionario_equipe WHERE id_funcionario = ? AND id_equipe = ?',
                    [req.usuario.id, tarefa.id_equipe]
                );
                isMembroEquipe = vinculo && vinculo.length > 0;
            }

            if (!isDono && !isMembroEquipe) {
                return res.status(403).json({
                    sucesso: false,
                    mensagem: 'Você só pode concluir tarefas atribuídas diretamente a você ou à sua equipe.'
                });
            }
        }

        let arquivoSalvo = null;
        if (temArquivo) {
            arquivoSalvo = await salvarArquivoBase64(arquivo);
        }

        const evidenciaFinal = evidenciaTexto || (arquivoSalvo ? `Arquivo anexado: ${arquivoSalvo.nome}` : '');
        const dataConclusao = new Date();
        await db.query(
            `UPDATE tarefas
             SET status = 'Concluida',
                 evidencia = ?,
                 evidencia_arquivo_url = ?,
                 evidencia_arquivo_nome = ?,
                 evidencia_arquivo_tipo = ?,
                 data_conclusao = ?
             WHERE id = ?`,
            [
                evidenciaFinal,
                arquivoSalvo ? arquivoSalvo.url : null,
                arquivoSalvo ? arquivoSalvo.nome : null,
                arquivoSalvo ? arquivoSalvo.tipo : null,
                dataConclusao,
                id
            ]
        );

        res.status(200).json({
            sucesso: true,
            mensagem: 'Tarefa concluída e evidência registrada com sucesso!',
            tarefa: {
                id,
                status: 'Concluida',
                evidencia: evidenciaFinal,
                evidencia_arquivo_url: arquivoSalvo ? arquivoSalvo.url : null,
                evidencia_arquivo_nome: arquivoSalvo ? arquivoSalvo.nome : null,
                evidencia_arquivo_tipo: arquivoSalvo ? arquivoSalvo.tipo : null,
                data_conclusao: dataConclusao
            }
        });
    } catch (error) {
        next(error);
    }
}

async function listarTarefasGestor(req, res, next) {
    try {
        const usuario = req.usuario;
        let querySql = `
            SELECT t.id, t.titulo, t.descricao, t.prazo, t.status, t.evidencia,
                   t.anexo_url, t.anexo_nome, t.anexo_tipo,
                   t.evidencia_arquivo_url, t.evidencia_arquivo_nome, t.evidencia_arquivo_tipo,
                   t.data_conclusao, t.id_funcionario, t.id_equipe, t.id_criador, t.data_criacao,
                   f.nome as funcionario_nome, f.cargo as funcionario_cargo, f.email as funcionario_email,
                   e.nome as equipe_nome,
                   fc.nome as criador_nome
            FROM tarefas t
            LEFT JOIN funcionarios f ON t.id_funcionario = f.id
            LEFT JOIN equipes e ON t.id_equipe = e.id
            LEFT JOIN funcionarios fc ON t.id_criador = fc.id
        `;
        let params = [];

        // Se for Gestor, filtra apenas suas equipes gerenciadas e colaboradores vinculados
        if (usuario.perfil === 'Gestor') {
            querySql += `
                WHERE t.id_criador = ?
                   OR t.id_equipe IN (SELECT id FROM equipes WHERE id_gestor = ?)
                   OR t.id_funcionario IN (
                       SELECT id_funcionario FROM funcionario_equipe WHERE id_equipe IN (
                           SELECT id FROM equipes WHERE id_gestor = ?
                       )
                   )
                   OR t.id_funcionario IN (
                       SELECT id FROM funcionarios WHERE id_equipe IN (
                           SELECT id FROM equipes WHERE id_gestor = ?
                       )
                   )
            `;
            params.push(usuario.id, usuario.id, usuario.id, usuario.id);
        }

        querySql += ' ORDER BY t.status ASC, t.id DESC';

        const [tarefas] = await db.query(querySql, params);

        const pendentes = tarefas.filter(t => t.status === 'Pendente');
        const concluidas = tarefas.filter(t => t.status === 'Concluida');

        res.status(200).json({
            sucesso: true,
            total: tarefas.length,
            totalPendentes: pendentes.length,
            totalConcluidas: concluidas.length,
            tarefas,
            pendentes,
            concluidas
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    criarTarefa,
    listarTarefas,
    concluirTarefa,
    listarTarefasGestor
};
