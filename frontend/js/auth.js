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
        const pageName = path.split('/').pop() || 'index.html';

        if (pageName === 'login.html') {
            // Se já estiver logado e acessar login.html, redireciona para o destino
            if (this.isAuthenticated()) {
                const user = this.getUser();
                if (user.primeiro_acesso) {
                    window.location.href = 'alterar-senha.html';
                } else {
                    window.location.href = this.getDashboardUrl(user.perfil);
                }
            }
            return;
        }

        // Para qualquer outra página, exige autenticação
        if (!this.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        const user = this.getUser();

        // Regra RN03: Se primeiro_acesso estiver pendente, força ir para alterar-senha.html
        if (user.primeiro_acesso && pageName !== 'alterar-senha.html') {
            window.location.href = 'alterar-senha.html';
            return;
        }

        // Se já alterou a senha e tentar abrir alterar-senha.html, leva ao dashboard
        if (!user.primeiro_acesso && pageName === 'alterar-senha.html') {
            window.location.href = this.getDashboardUrl(user.perfil);
            return;
        }

        // Validação de RBAC de Perfis
        if (perfisPermitidos.length > 0 && !perfisPermitidos.includes(user.perfil)) {
            alert(`Acesso não autorizado para o perfil ${user.perfil}. Você será redirecionado para o seu painel.`);
            window.location.href = this.getDashboardUrl(user.perfil);
        }
    }
};

window.JanoAuth = JanoAuth;
