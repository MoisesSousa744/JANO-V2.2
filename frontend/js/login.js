/**
 * JANO - Lógica da Tela de Login
 * Regras: RF04, RN03, RN10
 */

document.addEventListener('DOMContentLoaded', () => {
    // Se o usuário já estiver logado, redireciona pelo guard
    window.JanoAuth.guardRoute();

    const form = document.getElementById('form-login');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const alertBox = document.getElementById('login-alert');
    const btnSubmit = document.getElementById('btn-submit');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');
    const btnToggleSenha = document.getElementById('btn-toggle-senha');

    // Alternar visibilidade da senha
    if (btnToggleSenha) {
        btnToggleSenha.addEventListener('click', () => {
            const isPassword = senhaInput.type === 'password';
            senhaInput.type = isPassword ? 'text' : 'password';
            btnToggleSenha.innerHTML = isPassword ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        const email = emailInput.value.trim();
        const senha = senhaInput.value;

        if (!email || !senha) {
            showAlert('Por favor, informe seu e-mail e senha corporativos.');
            return;
        }

        setLoading(true);

        try {
            const res = await window.JanoAPI.Auth.login(email, senha);

            if (res.sucesso && res.token) {
                // Salva a sessão localmente
                window.JanoAuth.setSession(res.token, res.usuario);

                // Se for primeiro acesso, redireciona obrigatoriamente para alterar-senha.html
                if (res.primeiroAcesso || res.usuario.primeiro_acesso) {
                    window.location.href = 'alterar-senha.html';
                } else {
                    window.location.href = res.redirecionarPara || window.JanoAuth.getDashboardUrl(res.usuario.perfil);
                }
            } else {
                showAlert(res.mensagem || 'Falha ao autenticar.');
            }
        } catch (error) {
            showAlert(error.message || 'Erro ao conectar ao servidor de autenticação.');
        } finally {
            setLoading(false);
        }
    });

    function showAlert(msg) {
        alertBox.textContent = msg;
        alertBox.classList.remove('d-none');
    }

    function hideAlert() {
        alertBox.textContent = '';
        alertBox.classList.add('d-none');
    }

    function setLoading(isLoading) {
        btnSubmit.disabled = isLoading;
        if (isLoading) {
            btnText.textContent = 'Autenticando...';
            btnSpinner.classList.remove('d-none');
        } else {
            btnText.textContent = 'Entrar no Sistema';
            btnSpinner.classList.add('d-none');
        }
    }
});

// Função utilitária para os botões de demonstração
window.preencherCredenciais = function(email, senha) {
    const emailEl = document.getElementById('email');
    const senhaEl = document.getElementById('senha');
    if (emailEl && senhaEl) {
        emailEl.value = email;
        senhaEl.value = senha;
    }
};
