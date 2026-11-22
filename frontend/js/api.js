/**
 * JANO Client API - Módulo Centralizado de Comunicação HTTP com o Back-end
 * Isolamento de requisições com Fetch API, tratamento de tokens e cabeçalhos.
 */

// Permite flexibilidade de deploy: Vercel + Render, Monolítico (porta 3000) ou via WAMP/Live Server
const isLocalHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
const API_BASE_URL = window.API_BASE_URL || (
    window.location.port === '3000' || !isLocalHost
        ? '/api'
        : 'http://localhost:3000/api'
);
const SERVER_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

/**
 * Função genérica para requisições com tratamento de erro e injeção do JWT
 */
async function apiRequest(endpoint, { method = 'GET', body = null, headers = {} } = {}) {
    const token = localStorage.getItem('jano_token');

    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...headers
    };

    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers: defaultHeaders
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const url = `${API_BASE_URL}${endpoint}`;
        const response = await fetch(url, config);
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error(`Resposta inválida do servidor (${response.status}). Verifique se o backend Node.js está rodando em http://localhost:3000.`);
        }
        const data = await response.json();

        // Tratamento de Primeiro Acesso Obrigatório (RN03)
        if (response.status === 403 && data.codigo === 'PRIMEIRO_ACESSO_OBRIGATORIO') {
            if (!window.location.pathname.includes('alterar-senha.html')) {
                window.location.href = 'alterar-senha.html';
                return;
            }
        }

        // Tratamento de Token Expirado ou Sessão Inválida
        if (response.status === 401 && !endpoint.includes('/auth/login')) {
            localStorage.removeItem('jano_token');
            localStorage.removeItem('jano_user');
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) {
            throw new Error(data.mensagem || `Erro na requisição: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error(`[API Request Error] ${method} ${endpoint}:`, error);
        throw error;
    }
}

// -------------------------------------------------------------
// Módulos Especializados da API
// -------------------------------------------------------------

const AuthAPI = {
    login: (email, senha) => apiRequest('/auth/login', { method: 'POST', body: { email, senha } }),
    alterarSenha: (senhaAtual, novaSenha, confirmacaoSenha) => 
        apiRequest('/auth/alterar-senha', { method: 'POST', body: { senhaAtual, novaSenha, confirmacaoSenha } }),
    getUsuarioAtual: () => apiRequest('/auth/me')
};

const FuncionariosAPI = {
    listar: () => apiRequest('/funcionarios'),
    obterPorId: (id) => apiRequest(`/funcionarios/${id}`),
    cadastrar: (dados) => apiRequest('/funcionarios', { method: 'POST', body: dados }),
    excluir: (id) => apiRequest(`/funcionarios/${id}`, { method: 'DELETE' })
};

const EquipesAPI = {
    listar: (somenteMinhas = false) => apiRequest(`/equipes?somenteMinhas=${somenteMinhas}`),
    criar: (dados) => apiRequest('/equipes', { method: 'POST', body: dados }),
    vincularMembro: (idEquipe, idFuncionario) => 
        apiRequest(`/equipes/${idEquipe}/membros`, { method: 'POST', body: { id_funcionario: idFuncionario } }),
    removerMembro: (idEquipe, idFuncionario) => 
        apiRequest(`/equipes/${idEquipe}/membros/${idFuncionario}`, { method: 'DELETE' }),
    listarMembros: (idEquipe) => apiRequest(`/equipes/${idEquipe}/membros`)
};

const TarefasAPI = {
    listar: (filtros = {}) => {
        const queryParams = new URLSearchParams(filtros).toString();
        return apiRequest(`/tarefas${queryParams ? `?${queryParams}` : ''}`);
    },
    criar: (dados) => apiRequest('/tarefas', { method: 'POST', body: dados }),
    concluir: (id, evidencia, arquivo = null, somenteMinhas = false) =>
        apiRequest(`/tarefas/${id}/concluir`, {
            method: 'PATCH',
            body: { evidencia, arquivo, somenteMinhas }
        })
};

const DashboardAPI = {
    getMetricasRH: () => apiRequest('/dashboard/metricas-rh'),
    getMetricasGestor: () => apiRequest('/dashboard/metricas-gestor')
};

function resolveFileUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
    }
    return `${SERVER_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function fileToBase64Payload(file, maxSizeMB = 30) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);

        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        const isVideo = (file.type && file.type.startsWith('video/')) || /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(file.name);

        if (!isPdf && !isVideo) {
            return reject(new Error('Formato inválido. Selecione apenas arquivos PDF ou Vídeo (MP4, WebM, MOV, OGG, AVI, MKV).'));
        }

        if (file.size > maxSizeMB * 1024 * 1024) {
            return reject(new Error(`O arquivo ultrapassa o limite máximo de ${maxSizeMB} MB.`));
        }

        const reader = new FileReader();
        reader.onload = () => {
            resolve({
                nome: file.name,
                tipo: file.type || (isPdf ? 'application/pdf' : 'video/mp4'),
                dataBase64: reader.result
            });
        };
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
        reader.readAsDataURL(file);
    });
}

window.JanoAPI = {
    SERVER_BASE_URL,
    resolveFileUrl,
    fileToBase64Payload,
    Auth: AuthAPI,
    Funcionarios: FuncionariosAPI,
    Equipes: EquipesAPI,
    Tarefas: TarefasAPI,
    Dashboard: DashboardAPI
};
