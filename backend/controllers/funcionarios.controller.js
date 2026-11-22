const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateTemporaryPassword } = require('../utils/password.generator');
const { sendTemporaryCredentialsEmail } = require('../utils/email.service');

/**
 * Controller de Gestão de Funcionários (RH)
 * Regras: RF01, RF02, RF03, RF15, RN01, RN02, RN07, RN08
 */

function formatarCPF(valor) {
    const digitos = String(valor || '').replace(/\D/g, '');
    if (digitos.length !== 11) return null;
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`;
}

function formatarTelefone(valor) {
    const digitos = String(valor || '').replace(/\D/g, '');
    if (!digitos) return null;
    if (digitos.length === 10) {
        return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6, 10)}`;
    }
    if (digitos.length === 11) {
        return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7, 11)}`;
    }
    return false;
}

async function cadastrarFuncionario(req, res, next) {
    try {
        const { nome, cpf, cargo, telefone, email, perfil = 'Funcionario', id_equipe, equipes } = req.body;

        if (!nome || !cpf || !cargo || !email) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Nome, CPF, Cargo e E-mail são campos obrigatórios.'
            });
        }

        const cpfLimpo = String(cpf).trim();
        if (cpfLimpo.length > 14) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'CPF inválido. Deve conter no máximo 14 caracteres (formato 000.000.000-00).'
            });
        }

        const cpfFormatado = formatarCPF(cpfLimpo);
        if (!cpfFormatado) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'CPF inválido. Informe exatamente 11 dígitos numéricos.'
            });
        }

        let telefoneFormatado = null;
        if (telefone && String(telefone).trim()) {
            const telLimpo = String(telefone).trim();
            if (telLimpo.length > 15) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Telefone inválido. Deve conter no máximo 15 caracteres (formato (00) 00000-0000).'
                });
            }
            telefoneFormatado = formatarTelefone(telLimpo);
            if (telefoneFormatado === false) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Telefone inválido. Informe 10 ou 11 dígitos numéricos (com DDD).'
                });
            }
        }

        const perfisValidos = ['RH', 'Gestor', 'Funcionario'];
        if (!perfisValidos.includes(perfil)) {
            return res.status(400).json({
                sucesso: false,
                mensagem: `Perfil inválido. Valores aceitos: ${perfisValidos.join(', ')}.`
            });
        }

        const emailNormalizado = email.trim().toLowerCase();

        // Verifica se e-mail ou CPF já existem
        const [existentes] = await db.query(
            'SELECT id, email, cpf FROM funcionarios WHERE email = ? OR cpf = ?',
            [emailNormalizado, cpfFormatado]
        );

        if (existentes && existentes.length > 0) {
            const mesmoEmail = existentes.some(e => e.email && e.email.toLowerCase() === emailNormalizado);
            return res.status(409).json({
                sucesso: false,
                mensagem: mesmoEmail
                    ? 'Já existe um funcionário cadastrado com este e-mail.'
                    : 'Já existe um funcionário cadastrado com este CPF.'
            });
        }

        // RF02: Gera senha temporária aleatória
        const senhaTemporaria = generateTemporaryPassword(10);
        const senhaHash = await bcrypt.hash(senhaTemporaria, 10);

        // Normaliza múltiplas equipes selecionadas (RN08)
        let equipesIds = [];
        if (Array.isArray(equipes)) {
            equipesIds = [...new Set(equipes.map(Number).filter(id => Number.isInteger(id) && id > 0))];
        } else if (id_equipe) {
            const singleId = Number(id_equipe);
            if (Number.isInteger(singleId) && singleId > 0) {
                equipesIds = [singleId];
            }
        }

        // Insere o funcionário com primeiro_acesso = TRUE
        const equipeIdPrincipal = equipesIds.length > 0 ? equipesIds[0] : null;
        const [resultado] = await db.query(
            `INSERT INTO funcionarios (nome, cpf, cargo, telefone, email, senha_hash, primeiro_acesso, perfil, id_equipe, data_criacao)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [nome.trim(), cpfFormatado, cargo.trim(), telefoneFormatado, emailNormalizado, senhaHash, 1, perfil, equipeIdPrincipal]
        );

        const novoId = resultado.insertId;

        // Vincula todas as equipes selecionadas na tabela associativa N:N (RN08)
        for (const eqId of equipesIds) {
            await db.query(
                `INSERT IGNORE INTO funcionario_equipe (id_funcionario, id_equipe, data_vinculo) VALUES (?, ?, NOW())`,
                [novoId, eqId]
            );
        }

        const nomeLimpo = nome.trim();
        const cargoLimpo = cargo.trim();

        // Tarefa pré-programada de onboarding: Mini-Treinamento Inicial para novos colaboradores
        if (perfil === 'Funcionario') {
            try {
                const prazoTreinamento = new Date();
                prazoTreinamento.setDate(prazoTreinamento.getDate() + 3);
                const prazoStr = prazoTreinamento.toISOString().split('T')[0];

                await db.query(
                    `INSERT INTO tarefas (titulo, descricao, prazo, status, id_funcionario, id_equipe, id_criador, data_criacao)
                     VALUES (?, ?, ?, 'Pendente', ?, NULL, NULL, NOW())`,
                    [
                        '🏁 Mini-Treinamento: Boas-vindas ao JANO e Primeiros Passos',
                        'Treinamento prático de integração obrigatório: conheça as funcionalidades da plataforma JANO, acesse materiais de apoio e conclua esta tarefa enviando uma evidência para liberar suas atividades diárias.',
                        prazoStr,
                        novoId
                    ]
                );
            } catch (errTask) {
                console.warn('Aviso ao criar mini-treinamento inicial para o colaborador:', errTask.message);
            }
        }

        // RF03: Dispara o e-mail real (ou fallback simulado caso SMTP não esteja configurado/falhe)
        const emailStatus = await sendTemporaryCredentialsEmail({
            nome: nomeLimpo,
            email: emailNormalizado,
            senhaTemporaria,
            cargo: cargoLimpo
        });

        const mensagemResposta = emailStatus.enviado
            ? 'Funcionário cadastrado com sucesso! Credenciais temporárias geradas e enviadas por e-mail.'
            : 'Funcionário cadastrado com sucesso! Credenciais geradas, mas o envio de e-mail não foi realizado (modo simulado).';

        return res.status(201).json({
            sucesso: true,
            mensagem: mensagemResposta,
            emailStatus,
            funcionario: {
                id: novoId,
                nome: nomeLimpo,
                cpf: cpfFormatado,
                cargo: cargoLimpo,
                telefone: telefoneFormatado,
                email: emailNormalizado,
                perfil,
                id_equipe: equipeIdPrincipal,
                equipes_ids: equipesIds,
                primeiro_acesso: true
            },
            credenciaisTemporarias: {
                email: emailNormalizado,
                senhaTemporaria
            }
        });
    } catch (error) {
        next(error);
    }
}

async function listarFuncionarios(req, res, next) {
    try {
        const [funcionarios] = await db.query(
            `SELECT f.id, f.nome, f.cpf, f.cargo, f.telefone, f.email, f.primeiro_acesso, f.perfil, f.id_equipe, f.data_criacao
             FROM funcionarios f
             ORDER BY f.id DESC`
        );

        // Adiciona informações de todas as equipes associadas (RN08) e progresso
        const [equipes] = await db.query('SELECT * FROM equipes');
        const [vinculos] = await db.query('SELECT * FROM funcionario_equipe');
        const [todasTarefas] = await db.query('SELECT * FROM tarefas');

        const funcionariosFormatados = funcionarios.map(func => {
            const idsVinculados = vinculos
                .filter(v => v.id_funcionario === func.id)
                .map(v => v.id_equipe);

            const idsUnicos = [...new Set(idsVinculados)];
            if (func.id_equipe && !idsUnicos.includes(func.id_equipe)) {
                idsUnicos.push(func.id_equipe);
            }

            const equipesDoFunc = idsUnicos
                .map(eqId => equipes.find(e => e.id === eqId))
                .filter(Boolean)
                .map(e => ({ id: e.id, nome: e.nome, departamento: e.departamento }));

            // Tarefas do funcionário: individuais + da(s) equipe(s) dele
            const tarefasDoFunc = todasTarefas.filter(t => 
                t.id_funcionario === func.id ||
                (!t.id_funcionario && t.id_equipe && idsUnicos.includes(t.id_equipe))
            );

            const concluidas = tarefasDoFunc.filter(t => t.status === 'Concluida').length;
            const total = tarefasDoFunc.length;
            const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;
            const concluido = total > 0 && concluidas === total;

            return {
                ...func,
                primeiro_acesso: Boolean(func.primeiro_acesso),
                equipes: equipesDoFunc,
                equipes_ids: equipesDoFunc.map(e => e.id),
                equipe_nome: equipesDoFunc.length > 0 ? equipesDoFunc.map(e => e.nome).join(', ') : 'Sem Equipe',
                total_tarefas: total,
                tarefas_concluidas: concluidas,
                progresso_onboarding: progresso,
                onboarding_concluido: concluido,
                status_onboarding: concluido ? 'Concluído' : (total > 0 ? 'Em andamento' : 'Pendente')
            };
        });

        res.status(200).json({
            sucesso: true,
            total: funcionariosFormatados.length,
            funcionarios: funcionariosFormatados
        });
    } catch (error) {
        next(error);
    }
}

async function obterFuncionarioPorId(req, res, next) {
    try {
        const id = Number(req.params.id);
        const [rows] = await db.query(
            'SELECT id, nome, cpf, cargo, telefone, email, primeiro_acesso, perfil, id_equipe, data_criacao FROM funcionarios WHERE id = ?',
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Funcionário não encontrado.'
            });
        }

        const funcionario = rows[0];
        const [equipesAssociadas] = await db.query(
            `SELECT e.id, e.nome, e.departamento, fe.data_vinculo
             FROM funcionario_equipe fe
             JOIN equipes e ON fe.id_equipe = e.id
             WHERE fe.id_funcionario = ?`,
            [id]
        );

        res.status(200).json({
            sucesso: true,
            funcionario: {
                ...funcionario,
                primeiro_acesso: Boolean(funcionario.primeiro_acesso),
                equipes: equipesAssociadas
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * RF15 / RN01 / RN07: Exclusão de funcionário em caso de desligamento
 */
async function excluirFuncionario(req, res, next) {
    try {
        const id = Number(req.params.id);

        if (id === req.usuario.id) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Você não pode excluir o seu próprio usuário de administrador.'
            });
        }

        const [rows] = await db.query('SELECT id, nome FROM funcionarios WHERE id = ?', [id]);
        if (!rows.length) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Funcionário não encontrado para exclusão.'
            });
        }

        await db.query('DELETE FROM funcionarios WHERE id = ?', [id]);

        res.status(200).json({
            sucesso: true,
            mensagem: `Desligamento efetuado: Funcionário "${rows[0].nome}" (ID ${id}) foi excluído do sistema com sucesso.`
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    cadastrarFuncionario,
    listarFuncionarios,
    obterFuncionarioPorId,
    excluirFuncionario
};
