const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool = null;
let isUsingFallback = false;

// Estado em memória caso o MySQL não esteja disponível no ambiente de teste/local
const memoryStore = {
    funcionarios: [
        {
            id: 1,
            nome: 'Ana Souza (RH Admin)',
            cpf: '111.222.333-44',
            cargo: 'Analista de Recursos Humanos Sênior',
            telefone: '(11) 98765-4321',
            email: 'rh@jano.com.br',
            senha_hash: bcrypt.hashSync('Admin@123', 10),
            primeiro_acesso: 0,
            perfil: 'RH',
            id_equipe: null,
            data_criacao: new Date('2026-11-10T10:00:00Z')
        },
        {
            id: 2,
            nome: 'Carlos Alberto Gestor',
            cpf: '222.333.444-55',
            cargo: 'Gerente de Engenharia de Software',
            telefone: '(11) 97654-3210',
            email: 'gestor@jano.com.br',
            senha_hash: bcrypt.hashSync('Gestor@123', 10),
            primeiro_acesso: 0,
            perfil: 'Gestor',
            id_equipe: 1,
            data_criacao: new Date('2026-11-10T10:00:00Z')
        },
        {
            id: 3,
            nome: 'Mariana Costa',
            cpf: '333.444.555-66',
            cargo: 'Desenvolvedora Full-Stack Júnior',
            telefone: '(11) 96543-2109',
            email: 'mariana.costa@jano.com.br',
            senha_hash: bcrypt.hashSync('Temp@123', 10),
            primeiro_acesso: 1, // Exige alteração no primeiro acesso!
            perfil: 'Funcionario',
            id_equipe: 1,
            data_criacao: new Date('2026-11-12T09:30:00Z')
        },
        {
            id: 4,
            nome: 'Lucas Pereira',
            cpf: '444.555.666-77',
            cargo: 'Designer de Produto UI/UX',
            telefone: '(11) 95432-1098',
            email: 'lucas.pereira@jano.com.br',
            senha_hash: bcrypt.hashSync('Senha@123', 10),
            primeiro_acesso: 0,
            perfil: 'Funcionario',
            id_equipe: 1,
            data_criacao: new Date('2026-11-14T14:15:00Z')
        }
    ],
    equipes: [
        {
            id: 1,
            nome: 'Engenharia de Plataforma',
            departamento: 'Tecnologia',
            id_gestor: 2,
            data_criacao: new Date('2026-11-10T10:00:00Z')
        },
        {
            id: 2,
            nome: 'Design & Experiência',
            departamento: 'Produto',
            id_gestor: 2,
            data_criacao: new Date('2026-11-10T10:00:00Z')
        }
    ],
    funcionario_equipe: [
        { id: 1, id_funcionario: 3, id_equipe: 1, data_vinculo: new Date('2026-11-12T09:30:00Z') },
        { id: 2, id_funcionario: 4, id_equipe: 1, data_vinculo: new Date('2026-11-14T14:15:00Z') },
        { id: 3, id_funcionario: 4, id_equipe: 2, data_vinculo: new Date('2026-11-14T14:15:00Z') }
    ],
    tarefas: [
        {
            id: 1,
            titulo: 'Configurar Ambiente de Desenvolvimento',
            descricao: 'Clonar repositórios git, instalar Node.js 20+, configurar chaves SSH e rodar o projeto localmente.',
            prazo: '2026-11-25',
            status: 'Pendente',
            evidencia: null,
            data_conclusao: null,
            id_funcionario: 3,
            id_equipe: 1,
            id_criador: 2,
            data_criacao: new Date('2026-11-12T10:00:00Z')
        },
        {
            id: 2,
            titulo: 'Leitura do Manual de Conduta e Cultura',
            descricao: 'Ler o documento de Cultura da Empresa e preencher o formulário de conformidade no portal interno.',
            prazo: '2026-11-28',
            status: 'Pendente',
            evidencia: null,
            data_conclusao: null,
            id_funcionario: 3,
            id_equipe: null,
            id_criador: 2,
            data_criacao: new Date('2026-11-12T10:00:00Z')
        },
        {
            id: 3,
            titulo: 'Apresentação com o Time de Engenharia',
            descricao: 'Reunião de alinhamento 1:1 com o gestor e equipe de desenvolvimento via Google Meet.',
            prazo: '2026-11-16',
            status: 'Concluida',
            evidencia: 'Reunião realizada com sucesso em 16/11/2026. Ata de reunião no link https://meet.google.com/abc-defg-hij',
            data_conclusao: new Date('2026-11-16T15:30:00Z'),
            id_funcionario: 4,
            id_equipe: 1,
            id_criador: 2,
            data_criacao: new Date('2026-11-14T14:30:00Z')
        },
        {
            id: 4,
            titulo: 'Treinamento de Segurança da Informação (LGPD)',
            descricao: 'Assistir às 4 videoaulas obrigatórias e submeter o certificado de conclusão.',
            prazo: '2026-11-30',
            status: 'Pendente',
            evidencia: null,
            data_conclusao: null,
            id_funcionario: 4,
            id_equipe: 2,
            id_criador: 2,
            data_criacao: new Date('2026-11-14T15:00:00Z')
        }
    ],
    projetos: [
        {
            id_projeto: 1,
            id_equipe: 1,
            nome: 'Portal Onboarding V1',
            validade: '2027-01-30',
            data_criacao: new Date('2026-11-10T10:00:00Z')
        },
        {
            id_projeto: 2,
            id_equipe: 2,
            nome: 'Design System Corporativo JANO',
            validade: '2027-02-28',
            data_criacao: new Date('2026-11-10T10:00:00Z')
        }
    ]
};

let nextIds = {
    funcionarios: 5,
    equipes: 3,
    funcionario_equipe: 4,
    tarefas: 5,
    projetos: 3
};

async function initDatabase() {
    try {
        pool = mysql.createPool({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD ?? '',
            database: process.env.DB_NAME || 'jano_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            connectTimeout: 2000
        });

        // Testa conexão
        const conn = await pool.getConnection();
        conn.release();
        console.log(' Conectado com sucesso ao banco de dados MySQL.');
        await garantirColunasAnexosTarefas();
        isUsingFallback = false;
    } catch (error) {
        if (process.env.DB_FALLBACK_MEMORY === 'true') {
            console.warn(` Servidor MySQL offline ou não configurado (${error.code || error.message}). Modo FALLBACK EM MEMÓRIA ativado para desenvolvimento e testes!`);
            isUsingFallback = true;
        } else {
            console.error(' Erro fatal ao conectar no MySQL:', error.message);
            throw error;
        }
    }
}

async function garantirColunasAnexosTarefas() {
    const colunasNecessarias = [
        { nome: 'anexo_url', definicao: 'VARCHAR(255) NULL' },
        { nome: 'anexo_nome', definicao: 'VARCHAR(255) NULL' },
        { nome: 'anexo_tipo', definicao: 'VARCHAR(100) NULL' },
        { nome: 'evidencia_arquivo_url', definicao: 'VARCHAR(255) NULL' },
        { nome: 'evidencia_arquivo_nome', definicao: 'VARCHAR(255) NULL' },
        { nome: 'evidencia_arquivo_tipo', definicao: 'VARCHAR(100) NULL' }
    ];

    try {
        const [cols] = await pool.query('SHOW COLUMNS FROM tarefas');
        const existentes = new Set(cols.map(c => c.Field));
        for (const col of colunasNecessarias) {
            if (!existentes.has(col.nome)) {
                await pool.query(`ALTER TABLE tarefas ADD COLUMN ${col.nome} ${col.definicao}`);
                console.log(` Coluna ${col.nome} adicionada automaticamente à tabela tarefas.`);
            }
        }
    } catch (err) {
        console.warn(' Aviso ao verificar colunas de anexos em tarefas:', err.message);
    }
}

/**
 * Executa uma query SQL no MySQL ou simula no memoryStore
 */
async function query(sql, params = []) {
    if (!isUsingFallback && pool) {
        try {
            return await pool.query(sql, params);
        } catch (err) {
            if (process.env.DB_FALLBACK_MEMORY === 'true') {
                console.warn(' [DB Error] Alternando dinamicamente para MemoryStore:', err.message);
                isUsingFallback = true;
            } else {
                throw err;
            }
        }
    }

    // Processamento simulado para fallback de desenvolvimento
    return executeFallbackQuery(sql, params);
}

function executeFallbackQuery(sql, params) {
    const cleanSql = sql.trim().replace(/\s+/g, ' ');
    const lower = cleanSql.toLowerCase();

    // SELECT funcionarios BY email ou cpf
    if (lower.startsWith('select') && lower.includes('from funcionarios') && lower.includes('where email = ?') && lower.includes('or cpf = ?')) {
        const [email, cpf] = params;
        const encontrados = memoryStore.funcionarios
            .filter(f => f.email.toLowerCase() === String(email).toLowerCase() || f.cpf === String(cpf))
            .map(f => ({ ...f }));
        return [encontrados, []];
    }

    // SELECT funcionarios BY email
    if (lower.startsWith('select') && lower.includes('from funcionarios') && lower.includes('where email = ?')) {
        const email = params[0];
        const user = memoryStore.funcionarios.find(f => f.email.toLowerCase() === String(email).toLowerCase());
        return [[user ? { ...user } : undefined].filter(Boolean), []];
    }

    // SELECT funcionarios BY id
    if (lower.startsWith('select') && lower.includes('from funcionarios') && lower.includes('where id = ?')) {
        const id = Number(params[0]);
        const user = memoryStore.funcionarios.find(f => f.id === id);
        return [[user ? { ...user } : undefined].filter(Boolean), []];
    }

    // SELECT ALL funcionarios (RH)
    if (lower.startsWith('select') && lower.includes('from funcionarios') && !lower.includes('where')) {
        const list = memoryStore.funcionarios.map(f => {
            const eq = memoryStore.equipes.find(e => e.id === f.id_equipe);
            return {
                ...f,
                equipe_nome: eq ? eq.nome : null
            };
        });
        return [list, []];
    }

    // INSERT INTO funcionarios
    if (lower.startsWith('insert into funcionarios')) {
        const newId = nextIds.funcionarios++;
        const [nome, cpf, cargo, telefone, email, senha_hash, primeiro_acesso, perfil, id_equipe] = params;
        const novo = {
            id: newId,
            nome,
            cpf,
            cargo,
            telefone,
            email,
            senha_hash,
            primeiro_acesso: primeiro_acesso !== undefined ? (primeiro_acesso ? 1 : 0) : 1,
            perfil,
            id_equipe: id_equipe || null,
            data_criacao: new Date()
        };
        memoryStore.funcionarios.push(novo);
        return [{ insertId: newId, affectedRows: 1 }, []];
    }

    // UPDATE funcionarios (alterar senha ou primeiro_acesso)
    if (lower.startsWith('update funcionarios')) {
        if (lower.includes('senha_hash = ?') && lower.includes('primeiro_acesso = ?') && lower.includes('where id = ?')) {
            const [senha_hash, primeiro_acesso, id] = params;
            const user = memoryStore.funcionarios.find(f => f.id === Number(id));
            if (user) {
                user.senha_hash = senha_hash;
                user.primeiro_acesso = primeiro_acesso ? 1 : 0;
            }
            return [{ affectedRows: user ? 1 : 0 }, []];
        }
        if (lower.includes('id_equipe = ?') && lower.includes('where id = ?')) {
            const [id_equipe, id] = params;
            const user = memoryStore.funcionarios.find(f => f.id === Number(id));
            if (user) user.id_equipe = id_equipe;
            return [{ affectedRows: user ? 1 : 0 }, []];
        }
    }

    // DELETE FROM funcionarios (desligamento)
    if (lower.startsWith('delete from funcionarios where id = ?')) {
        const id = Number(params[0]);
        const idx = memoryStore.funcionarios.findIndex(f => f.id === id);
        if (idx !== -1) {
            memoryStore.funcionarios.splice(idx, 1);
            // Remove de equipes e tarefas associadas
            memoryStore.funcionario_equipe = memoryStore.funcionario_equipe.filter(fe => fe.id_funcionario !== id);
            memoryStore.tarefas = memoryStore.tarefas.filter(t => t.id_funcionario !== id);
            return [{ affectedRows: 1 }, []];
        }
        return [{ affectedRows: 0 }, []];
    }

    // SELECT ALL equipes
    if (lower.startsWith('select') && lower.includes('from equipes') && !lower.includes('where')) {
        const list = memoryStore.equipes.map(eq => {
            const gestor = memoryStore.funcionarios.find(f => f.id === eq.id_gestor);
            const membros = memoryStore.funcionario_equipe.filter(fe => fe.id_equipe === eq.id);
            return {
                ...eq,
                gestor_nome: gestor ? gestor.nome : 'N/A',
                total_membros: membros.length
            };
        });
        return [list, []];
    }

    // SELECT equipes BY id_gestor
    if (lower.startsWith('select') && lower.includes('from equipes') && lower.includes('where id_gestor = ?')) {
        const id_gestor = Number(params[0]);
        const list = memoryStore.equipes.filter(eq => eq.id_gestor === id_gestor).map(eq => {
            const gestor = memoryStore.funcionarios.find(f => f.id === eq.id_gestor);
            const membros = memoryStore.funcionario_equipe.filter(fe => fe.id_equipe === eq.id);
            return {
                ...eq,
                gestor_nome: gestor ? gestor.nome : 'N/A',
                total_membros: membros.length
            };
        });
        return [list, []];
    }

    // INSERT INTO equipes
    if (lower.startsWith('insert into equipes')) {
        const newId = nextIds.equipes++;
        const [nome, departamento, id_gestor] = params;
        const nova = {
            id: newId,
            nome,
            departamento,
            id_gestor: Number(id_gestor),
            data_criacao: new Date()
        };
        memoryStore.equipes.push(nova);
        return [{ insertId: newId, affectedRows: 1 }, []];
    }

    // VINCULAR / REMOVER FUNCIONARIO DE EQUIPE (funcionario_equipe)
    if (lower.startsWith('insert into funcionario_equipe') || lower.startsWith('insert ignore into funcionario_equipe')) {
        const [id_funcionario, id_equipe] = params.map(Number);
        const exists = memoryStore.funcionario_equipe.some(fe => fe.id_funcionario === id_funcionario && fe.id_equipe === id_equipe);
        if (!exists) {
            memoryStore.funcionario_equipe.push({
                id: nextIds.funcionario_equipe++,
                id_funcionario,
                id_equipe,
                data_vinculo: new Date()
            });
            // Atualiza também id_equipe direto se estiver vazio
            const f = memoryStore.funcionarios.find(u => u.id === id_funcionario);
            if (f && !f.id_equipe) f.id_equipe = id_equipe;
        }
        return [{ insertId: 1, affectedRows: 1 }, []];
    }

    if (lower.startsWith('select') && lower.includes('from funcionario_equipe') && !lower.includes('where') && !lower.includes('join')) {
        return [memoryStore.funcionario_equipe.map(fe => ({ ...fe })), []];
    }

    if (lower.startsWith('select') && lower.includes('from funcionario_equipe') && lower.includes('where id_funcionario = ?') && !lower.includes('and id_equipe = ?') && !lower.includes('join')) {
        const id_funcionario = Number(params[0]);
        const list = memoryStore.funcionario_equipe.filter(fe => fe.id_funcionario === id_funcionario).map(fe => ({ ...fe }));
        return [list, []];
    }

    if (lower.startsWith('select') && lower.includes('from funcionario_equipe') && lower.includes('where id_funcionario = ?') && lower.includes('and id_equipe = ?')) {
        const [id_funcionario, id_equipe] = params.map(Number);
        const list = memoryStore.funcionario_equipe.filter(fe => fe.id_funcionario === id_funcionario && fe.id_equipe === id_equipe).map(fe => ({ ...fe }));
        return [list, []];
    }

    if (lower.startsWith('delete from funcionario_equipe') && lower.includes('id_funcionario = ?') && lower.includes('id_equipe = ?')) {
        const [id_funcionario, id_equipe] = params.map(Number);
        const idx = memoryStore.funcionario_equipe.findIndex(fe => fe.id_funcionario === id_funcionario && fe.id_equipe === id_equipe);
        if (idx !== -1) {
            memoryStore.funcionario_equipe.splice(idx, 1);
            const f = memoryStore.funcionarios.find(u => u.id === id_funcionario);
            if (f && f.id_equipe === id_equipe) {
                const remaining = memoryStore.funcionario_equipe.find(fe => fe.id_funcionario === id_funcionario);
                f.id_equipe = remaining ? remaining.id_equipe : null;
            }
            return [{ affectedRows: 1 }, []];
        }
        return [{ affectedRows: 0 }, []];
    }

    // SELECT membros de equipes
    if (lower.includes('from funcionario_equipe fe') || (lower.includes('from funcionarios') && lower.includes('funcionario_equipe'))) {
        const id_equipe = Number(params[0]);
        const membros = memoryStore.funcionario_equipe
            .filter(fe => fe.id_equipe === id_equipe)
            .map(fe => {
                const func = memoryStore.funcionarios.find(f => f.id === fe.id_funcionario);
                return {
                    ...func,
                    data_vinculo: fe.data_vinculo
                };
            }).filter(Boolean);
        return [membros, []];
    }

    // TAREFAS: SELECT BY FUNCIONARIO (tarefas do colaborador OU tarefas da sua equipe)
    if (lower.startsWith('select') && lower.includes('from tarefas') && lower.includes('id_funcionario = ?')) {
        const id_funcionario = Number(params[0]);
        const userTeams = memoryStore.funcionario_equipe
            .filter(fe => fe.id_funcionario === id_funcionario)
            .map(fe => fe.id_equipe);
        
        const list = memoryStore.tarefas.filter(t => 
            t.id_funcionario === id_funcionario || 
            (!t.id_funcionario && t.id_equipe && userTeams.includes(t.id_equipe))
        ).map(t => {
            const eq = memoryStore.equipes.find(e => e.id === t.id_equipe);
            const criador = memoryStore.funcionarios.find(f => f.id === t.id_criador);
            return {
                ...t,
                equipe_nome: eq ? eq.nome : null,
                criador_nome: criador ? criador.nome : 'Gestor'
            };
        });
        return [list, []];
    }

    // TAREFAS: SELECT BY ID
    if (lower.startsWith('select') && lower.includes('from tarefas') && lower.includes('where id = ?')) {
        const id = Number(params[0]);
        const tarefa = memoryStore.tarefas.find(t => t.id === id);
        return [[tarefa ? { ...tarefa } : undefined].filter(Boolean), []];
    }

    // TAREFAS: SELECT ALL (para gestor ou RH)
    if (lower.startsWith('select') && lower.includes('from tarefas')) {
        const list = memoryStore.tarefas.map(t => {
            const func = memoryStore.funcionarios.find(f => f.id === t.id_funcionario);
            const eq = memoryStore.equipes.find(e => e.id === t.id_equipe);
            return {
                ...t,
                funcionario_nome: func ? func.nome : 'Toda a Equipe',
                equipe_nome: eq ? eq.nome : null
            };
        });
        return [list, []];
    }

    // INSERT INTO tarefas
    if (lower.startsWith('insert into tarefas')) {
        const newId = nextIds.tarefas++;
        const [titulo, descricao, prazo, id_funcionario, id_equipe, id_criador, anexo_url = null, anexo_nome = null, anexo_tipo = null] = params;
        const nova = {
            id: newId,
            titulo,
            descricao,
            prazo,
            status: 'Pendente',
            evidencia: null,
            anexo_url,
            anexo_nome,
            anexo_tipo,
            evidencia_arquivo_url: null,
            evidencia_arquivo_nome: null,
            evidencia_arquivo_tipo: null,
            data_conclusao: null,
            id_funcionario: id_funcionario ? Number(id_funcionario) : null,
            id_equipe: id_equipe ? Number(id_equipe) : null,
            id_criador: id_criador ? Number(id_criador) : null,
            data_criacao: new Date()
        };
        memoryStore.tarefas.push(nova);
        return [{ insertId: newId, affectedRows: 1 }, []];
    }

    // UPDATE tarefas (concluir com evidência e/ou arquivo PDF/vídeo)
    if (lower.startsWith('update tarefas') && lower.includes('status = \'concluida\'') && lower.includes('evidencia = ?')) {
        if (lower.includes('evidencia_arquivo_url = ?')) {
            const [evidencia, evidencia_arquivo_url, evidencia_arquivo_nome, evidencia_arquivo_tipo, data_conclusao, id] = params;
            const tarefa = memoryStore.tarefas.find(t => t.id === Number(id));
            if (tarefa) {
                tarefa.status = 'Concluida';
                tarefa.evidencia = evidencia;
                tarefa.evidencia_arquivo_url = evidencia_arquivo_url || null;
                tarefa.evidencia_arquivo_nome = evidencia_arquivo_nome || null;
                tarefa.evidencia_arquivo_tipo = evidencia_arquivo_tipo || null;
                tarefa.data_conclusao = data_conclusao || new Date();
                return [{ affectedRows: 1 }, []];
            }
            return [{ affectedRows: 0 }, []];
        }
        const [evidencia, data_conclusao, id] = params;
        const tarefa = memoryStore.tarefas.find(t => t.id === Number(id));
        if (tarefa) {
            tarefa.status = 'Concluida';
            tarefa.evidencia = evidencia;
            tarefa.data_conclusao = data_conclusao || new Date();
            return [{ affectedRows: 1 }, []];
        }
        return [{ affectedRows: 0 }, []];
    }

    // SELECT PROJETOS
    if (lower.startsWith('select') && lower.includes('from projetos')) {
        const list = memoryStore.projetos.map(p => {
            const eq = memoryStore.equipes.find(e => e.id === p.id_equipe);
            return {
                ...p,
                equipe_nome: eq ? eq.nome : null
            };
        });
        return [list, []];
    }

    return [[], []];
}

module.exports = {
    initDatabase,
    query,
    get isFallback() {
        return isUsingFallback;
    },
    memoryStore
};
