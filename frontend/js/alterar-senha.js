/**
 * JANO - Lógica de Alteração Obrigatória de Senha (Primeiro Acesso)
 * Regras: RF05, RN03
 */

document.addEventListener('DOMContentLoaded', () => {
    // Garante que o usuário está logado
    if (!window.JanoAuth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    const form = document.getElementById('form-alterar-senha');
    const senhaAtualInput = document.getElementById('senhaAtual');
    const novaSenhaInput = document.getElementById('novaSenha');
    const confirmacaoSenhaInput = document.getElementById('confirmacaoSenha');
    const alertBox = document.getElementById('alert-box');
    const btnSalvar = document.getElementById('btn-salvar');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        const senhaAtual = senhaAtualInput.value;
        const novaSenha = novaSenhaInput.value;
        const confirmacaoSenha = confirmacaoSenhaInput.value;

        if (!senhaAtual || !novaSenha || !confirmacaoSenha) {
            showAlert('Por favor, preencha todos os campos.');
            return;
        }

        if (novaSenha !== confirmacaoSenha) {
            showAlert('A nova senha e a confirmação não coincidem.');
            return;
        }

        if (novaSenha.length < 6) {
            showAlert('A nova senha deve ter no mínimo 6 caracteres.');
            return;
        }

        if (senhaAtual === novaSenha) {
            showAlert('A nova senha deve ser diferente da senha temporária.');
            return;
        }

        setLoading(true);

        try {
            const res = await window.JanoAPI.Auth.alterarSenha(senhaAtual, novaSenha, confirmacaoSenha);

            if (res.sucesso) {
                // Atualiza token e usuário com primeiro_acesso = false
                window.JanoAuth.setSession(res.token, res.usuario);

                window.JanoComponents.showToast('Senha atualizada com sucesso! Redirecionando...', 'sucesso');

                setTimeout(() => {
                    window.location.href = res.redirecionarPara || window.JanoAuth.getDashboardUrl(res.usuario.perfil);
                }, 1200);
            } else {
                showAlert(res.mensagem || 'Falha ao alterar senha.');
            }
        } catch (error) {
            showAlert(error.message || 'Erro ao conectar ao servidor para alterar a senha.');
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
        btnSalvar.disabled = isLoading;
        if (isLoading) {
            btnText.textContent = 'Gravando nova senha...';
            btnSpinner.classList.remove('d-none');
        } else {
            btnText.textContent = 'Salvar Senha e Iniciar Onboarding';
            btnSpinner.classList.add('d-none');
        }
    }
});
