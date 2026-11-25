/**
 * JANO Auth - Gerenciamento de Sessão e Route Guarding
 * Regras: RBAC no front-end e Bloqueio de Primeiro Acesso (RN03)
 */

const JanoAuth = {
    TOKEN_KEY: 'jano_token',
    USER_KEY: 'jano_user',

    setSession(token, user) {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    },

    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    },

    getUser() {
        try {
            const data = localStorage.getItem(this.USER_KEY);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    isAuthenticated() {
        return Boolean(this.getToken() && this.getUser());
    },

    logout() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        window.location.href = 'login.html';
    },

    getDashboardUrl(perfil) {
        switch (perfil) {
            case 'RH': return 'dashboard-rh.html';
            case 'Gestor': return 'dashboard-gestor.html';
            case 'Funcionario': return 'dashboard-funcionario.html';
            default: return 'login.html';
        }
    },

    /**
     * Valida se o usuário tem permissão para acessar a página atual.
     * @param {Array<string>} perfisPermitidos - Perfis aceitos na tela
     */
    guardRoute(perfisPermitidos = []) {
        const path = window.location.pathname;
        const pageName = (path.split('/').pop() || 'index.html').toLowerCase();
        const isLoginPage = pageName === 'login.html' || pageName === 'login';
        const isAlterarSenhaPage = pageName === 'alterar-senha.html' || pageName === 'alterar-senha';

        // Modo Preview para Figma Canvas / Showcase (permite visualização dos frames sem redirecionamento)
        if (window.location.search.includes('preview=true') || window.__JANO_PREVIEW__ || (window.self !== window.top)) {
            if (!this.getUser()) {
                const previewUsers = {
                    'dashboard-rh.html': { id: 1, nome: 'Ana Souza (RH Admin)', email: 'rh@jano.com.br', cargo: 'Analista de Recursos Humanos Sênior', perfil: 'RH', primeiro_acesso: false },
                    'dashboard-gestor.html': { id: 2, nome: 'Carlos Alberto Gestor', email: 'gestor@jano.com.br', cargo: 'Gerente de Engenharia de Software', perfil: 'Gestor', primeiro_acesso: false },
                    'dashboard-funcionario.html': { id: 3, nome: 'Mariana Costa', email: 'mariana.costa@jano.com.br', cargo: 'Desenvolvedora Full-Stack Júnior', perfil: 'Funcionario', primeiro_acesso: false },
                    'perfil.html': { id: 3, nome: 'Mariana Costa', email: 'mariana.costa@jano.com.br', cargo: 'Desenvolvedora Full-Stack Júnior', perfil: 'Funcionario', primeiro_acesso: false }
                };
                const mock = previewUsers[pageName] || { id: 1, nome: 'Usuário Demonstração', email: 'demo@jano.com.br', perfil: 'Funcionario', primeiro_acesso: false };
                localStorage.setItem(this.USER_KEY, JSON.stringify(mock));
                localStorage.setItem(this.TOKEN_KEY, 'preview_token_jano_figma');
            }
            return;
        }

        // Se estiver na tela de login:
        if (isLoginPage) {
            // Se já estiver autenticado, leva ao dashboard ou à troca de senha
            if (this.isAuthenticated()) {
                const user = this.getUser();
                if (user && user.primeiro_acesso) {
                    window.location.href = 'alterar-senha.html';
                } else if (user) {
                    window.location.href = this.getDashboardUrl(user.perfil);
                }
            }
            // Se não autenticado, PERMANECE na tela de login sem recarregar
            return;
        }

        // Para qualquer outra página protegida, se não estiver logado, redireciona ao login
        if (!this.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        const user = this.getUser();

        // Regra RN03: Se primeiro_acesso estiver pendente, força ir para alterar-senha.html
        if (user && user.primeiro_acesso && !isAlterarSenhaPage) {
            window.location.href = 'alterar-senha.html';
            return;
        }

        // Se já alterou a senha e tentar abrir alterar-senha.html, leva ao dashboard
        if (user && !user.primeiro_acesso && isAlterarSenhaPage) {
            window.location.href = this.getDashboardUrl(user.perfil);
            return;
        }

        // Validação de RBAC de Perfis
        if (perfisPermitidos.length > 0 && user && !perfisPermitidos.includes(user.perfil)) {
            alert(`Acesso não autorizado para o perfil ${user.perfil}. Você será redirecionado para o seu painel.`);
            window.location.href = this.getDashboardUrl(user.perfil);
        }
    }
};

window.JanoAuth = JanoAuth;
