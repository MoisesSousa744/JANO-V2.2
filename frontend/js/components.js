/**
 * JANO Components - Componentização em Vanilla JS (Baseado no Design do Figma)
 * Renderiza a Sidebar lateral azul marinho, perfil ativo e toasts do sistema
 */

const JanoComponents = {
    renderSidebar(containerId = 'sidebar-container', activePage = '') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const user = window.JanoAuth ? window.JanoAuth.getUser() : null;
        if (!user) return;

        const perfilLabels = {
            'RH': 'Perfil: RH',
            'Gestor': 'Perfil: Gestor',
            'Funcionario': 'Perfil: Funcionário'
        };

        const iniciais = (user.nome || 'JANO')
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

        const html = `
            <aside class="sidebar-figma">
                <div>
                    <!-- Logo JANO Figma -->
                    <div class="sidebar-brand-box">
                        <div class="sidebar-brand-icon">J</div>
                        <div>
                            <div class="sidebar-brand-title">JANO</div>
                            <div class="sidebar-brand-sub">${perfilLabels[user.perfil] || 'Perfil: Usuário'}</div>
                        </div>
                    </div>

                    <!-- Navegação do Menu -->
                    <ul class="sidebar-nav">
                        ${user.perfil === 'RH' ? `
                            <li class="sidebar-nav-item ${activePage === 'rh' ? 'active' : ''}">
                                <a href="dashboard-rh.html">
                                    <i class="bi bi-grid-fill"></i>
                                    <span>Gestão de Cadastros</span>
                                </a>
                            </li>
                        ` : ''}

                        ${user.perfil === 'Gestor' ? `
                            <li class="sidebar-nav-item ${activePage === 'gestor' ? 'active' : ''}">
                                <a href="dashboard-gestor.html">
                                    <i class="bi bi-people-fill"></i>
                                    <span>Minha Equipe</span>
                                </a>
                            </li>
                        ` : ''}

                        <li class="sidebar-nav-item ${activePage === 'funcionario' ? 'active' : ''}">
                            <a href="dashboard-funcionario.html">
                                <i class="bi bi-card-checklist"></i>
                                <span>Minhas Tarefas</span>
                            </a>
                        </li>

                        <li class="sidebar-nav-item ${activePage === 'perfil' ? 'active' : ''}">
                            <a href="perfil.html">
                                <i class="bi bi-person-circle"></i>
                                <span>Meu Perfil</span>
                            </a>
                        </li>
                    </ul>
                </div>

                <!-- Rodapé da Sidebar com Usuário e Logout -->
                <div class="sidebar-bottom">
                    <div class="sidebar-user-pill">
                        <a href="perfil.html" class="sidebar-user-info text-decoration-none" title="Ver meu perfil">
                            <div class="sidebar-avatar">${iniciais}</div>
                            <div style="min-width: 0;">
                                <div class="sidebar-user-name">${user.nome}</div>
                                <div class="sidebar-user-email">${user.email}</div>
                            </div>
                        </a>
                        <button class="btn-sidebar-logout" onclick="window.JanoAuth.logout()" title="Encerrar sessão">
                            <i class="bi bi-box-arrow-right"></i>
                        </button>
                    </div>
                </div>
            </aside>
        `;

        container.innerHTML = html;
    },

    formatarData(dataStr, formato = 'longo') {
        if (!dataStr) return '';
        try {
            const str = String(dataStr).trim();
            // Se for data pura YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
                const [ano, mes, dia] = str.split('-');
                if (formato === 'curto') {
                    return `${dia}/${mes}/${ano}`;
                }
                const d = new Date(`${str}T12:00:00Z`);
                return d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
            }

            // Se for string ISO com timestamp ou objeto Date
            const d = new Date(dataStr);
            if (isNaN(d.getTime())) return str;

            // Se apenas data (meia-noite UTC), usa UTC para não retroceder 1 dia em UTC-3
            if (str.includes('T00:00:00') || !str.includes(':')) {
                if (formato === 'curto') {
                    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
                }
                return d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
            }

            // Data com horário real de conclusão ou envio
            if (formato === 'com-hora') {
                return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
            return String(dataStr);
        }
    },

    showToast(mensagem, tipo = 'info') {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }

        const bgMap = {
            'sucesso': 'bg-success text-white',
            'erro': 'bg-danger text-white',
            'aviso': 'bg-warning text-dark',
            'info': 'bg-primary text-white'
        };

        const toastId = 'toast_' + Date.now();
        const toastEl = document.createElement('div');
        toastEl.id = toastId;
        toastEl.className = `toast align-items-center border-0 shadow ${bgMap[tipo] || bgMap.info}`;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');

        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body fw-semibold">
                    ${mensagem}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;

        toastContainer.appendChild(toastEl);
        const bsToast = new bootstrap.Toast(toastEl, { delay: 4000 });
        bsToast.show();

        toastEl.addEventListener('hidden.bs.toast', () => {
            toastEl.remove();
        });
    }
};

window.JanoComponents = JanoComponents;
