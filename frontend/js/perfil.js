/**
 * JANO - Controlador da Tela de Meu Perfil
 * Regras: Exibição de dados do colaborador e alteração de senha
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Valida autenticação
    window.JanoAuth.guardRoute(['RH', 'Gestor', 'Funcionario']);

    // Renderiza a Sidebar marcando a aba "perfil" como ativa
    window.JanoComponents.renderSidebar('sidebar-container', 'perfil');

    // Carrega dados do perfil
    await carregarPerfil();

    // Evento de alteração de senha
    const formSenha = document.getElementById('form-alterar-senha-perfil');
    formSenha.addEventListener('submit', async (e) => {
        e.preventDefault();

        const alertBox = document.getElementById('perfil-senha-alert');
        alertBox.classList.add('d-none');

        const senhaAtual = document.getElementById('perfil-senha-atual').value;
        const novaSenha = document.getElementById('perfil-nova-senha').value;
        const confSenha = document.getElementById('perfil-conf-senha').value;

        if (!senhaAtual || !novaSenha || !confSenha) {
            alertBox.textContent = 'Por favor, preencha todos os campos.';
            alertBox.classList.remove('d-none');
            return;
        }

        if (novaSenha !== confSenha) {
            alertBox.textContent = 'A nova senha e a confirmação não coincidem.';
            alertBox.classList.remove('d-none');
            return;
        }

        if (novaSenha.length < 6) {
            alertBox.textContent = 'A nova senha deve ter no mínimo 6 caracteres.';
            alertBox.classList.remove('d-none');
            return;
        }

        if (senhaAtual === novaSenha) {
            alertBox.textContent = 'A nova senha deve ser diferente da senha atual.';
            alertBox.classList.remove('d-none');
            return;
        }

        const btnSubmit = document.getElementById('btn-salvar-senha-perfil');
        const btnTexto = document.getElementById('btn-salvar-senha-texto');
        btnSubmit.disabled = true;
        btnTexto.textContent = 'Salvando...';

        try {
            const res = await window.JanoAPI.Perfil.alterarSenha(senhaAtual, novaSenha, confSenha);

            if (res.sucesso) {
                // Atualiza a sessão caso um novo token tenha sido emitido
                if (res.token && res.usuario) {
                    window.JanoAuth.setSession(res.token, res.usuario);
                }

                formSenha.reset();
                window.JanoComponents.showToast('Senha alterada com sucesso!', 'sucesso');
            } else {
                alertBox.textContent = res.mensagem || 'Falha ao atualizar senha.';
                alertBox.classList.remove('d-none');
            }
        } catch (error) {
            alertBox.textContent = error.message || 'Erro ao conectar ao servidor.';
            alertBox.classList.remove('d-none');
        } finally {
            btnSubmit.disabled = false;
            btnTexto.textContent = 'Atualizar Senha';
        }
    });
});

async function carregarPerfil() {
    try {
        const res = await window.JanoAPI.Perfil.obter();

        if (!res.sucesso || !res.usuario) {
            window.JanoComponents.showToast('Não foi possível carregar as informações do perfil.', 'erro');
            return;
        }

        const u = res.usuario;

        const iniciais = (u.nome || 'JANO')
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

        document.getElementById('perfil-avatar').textContent = iniciais;
        document.getElementById('perfil-nome').textContent = u.nome;
        document.getElementById('perfil-badge-cargo').textContent = u.cargo;
        document.getElementById('perfil-email').textContent = u.email;
        document.getElementById('perfil-cpf').textContent = u.cpf;
        document.getElementById('perfil-telefone').textContent = u.telefone;
        document.getElementById('perfil-perfil').textContent = u.perfil;
        document.getElementById('perfil-equipe').textContent = u.nome_equipe;

        // Formatação de data timezone-safe
        const dataFormatada = window.JanoComponents.formatarData(u.data_criacao);
        document.getElementById('perfil-data-criacao').textContent = dataFormatada;
    } catch (err) {
        console.error('Erro ao carregar perfil:', err);
        window.JanoComponents.showToast('Erro ao carregar perfil: ' + err.message, 'erro');
    }
}
