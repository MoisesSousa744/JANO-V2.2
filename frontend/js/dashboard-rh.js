/**
 * JANO - Controlador do Dashboard de Recursos Humanos (Figma)
 * Regras: RF01, RF02, RF03, RF15, RN01, RN07
 */

let funcionariosLista = [];

document.addEventListener('DOMContentLoaded', async () => {
    // RBAC: Somente o perfil 'RH' pode acessar este painel
    window.JanoAuth.guardRoute(['RH']);

    // Renderiza a Sidebar lateral do Figma
    window.JanoComponents.renderSidebar('sidebar-container', 'rh');

    // Inicializa modais Bootstrap
    const modalCadastrarEl = document.getElementById('modal-novo-funcionario');
    const modalCadastrar = new bootstrap.Modal(modalCadastrarEl);

    const modalCredenciaisEl = document.getElementById('modal-credenciais-geradas');
    const modalCredenciais = new bootstrap.Modal(modalCredenciaisEl);

    // Carrega dados iniciais
    await carregarEquipesSelect();
    await carregarFuncionarios();

    // Máscara e limite de caracteres para CPF (11 dígitos -> 000.000.000-00, max 14 chars)
    const inputCpf = document.getElementById('cad-cpf');
    if (inputCpf) {
        inputCpf.addEventListener('input', (e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
            let masked = digits;
            if (digits.length > 9) {
                masked = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
            } else if (digits.length > 6) {
                masked = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
            } else if (digits.length > 3) {
                masked = `${digits.slice(0, 3)}.${digits.slice(3)}`;
            }
            e.target.value = masked;
        });
    }

    // Máscara e limite de caracteres para Telefone (até 11 dígitos -> (00) 00000-0000, max 15 chars)
    const inputTelefone = document.getElementById('cad-telefone');
    if (inputTelefone) {
        inputTelefone.addEventListener('input', (e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
            let masked = digits;
            if (digits.length > 10) {
                masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
            } else if (digits.length > 6) {
                masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
            } else if (digits.length > 2) {
                masked = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
            } else if (digits.length > 0) {
                masked = `(${digits}`;
            }
            e.target.value = masked;
        });
    }

    // Filtro de busca de funcionário em tempo real
    const inputBusca = document.getElementById('input-busca-funcionario');
    if (inputBusca) {
        inputBusca.addEventListener('input', (e) => {
            const termo = e.target.value.toLowerCase().trim();
            const filtrados = funcionariosLista.filter(f => {
                const nomesEquipes = Array.isArray(f.equipes)
                    ? f.equipes.map(eq => eq.nome).join(' ').toLowerCase()
                    : (f.equipe_nome || '').toLowerCase();
                return (
                    f.nome.toLowerCase().includes(termo) ||
                    f.email.toLowerCase().includes(termo) ||
                    f.cargo.toLowerCase().includes(termo) ||
                    nomesEquipes.includes(termo)
                );
            });
            renderizarTabela(filtrados);
        });
    }

    // Evento de submit do cadastro
    const formCad = document.getElementById('form-cadastrar-funcionario');
    formCad.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorAlert = document.getElementById('modal-error-alert');
        errorAlert.classList.add('d-none');

        const cpfValor = document.getElementById('cad-cpf').value.trim();
        const cpfDigitos = cpfValor.replace(/\D/g, '');
        if (cpfDigitos.length !== 11) {
            errorAlert.textContent = 'Informe um CPF válido com 11 dígitos (000.000.000-00).';
            errorAlert.classList.remove('d-none');
            return;
        }

        const telefoneValor = document.getElementById('cad-telefone').value.trim();
        const telefoneDigitos = telefoneValor.replace(/\D/g, '');
        if (telefoneValor && telefoneDigitos.length !== 10 && telefoneDigitos.length !== 11) {
            errorAlert.textContent = 'Informe um telefone válido com DDD (10 ou 11 dígitos).';
            errorAlert.classList.remove('d-none');
            return;
        }

        const equipesSelecionadas = Array.from(
            document.querySelectorAll('#cad-equipes-lista input[type="checkbox"]:checked')
        ).map(cb => Number(cb.value));

        const btnSubmit = document.getElementById('btn-submit-cad');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cadastrando...';

        const dados = {
            nome: document.getElementById('cad-nome').value.trim(),
            cpf: cpfValor,
            cargo: document.getElementById('cad-cargo').value.trim(),
            telefone: telefoneValor,
            email: document.getElementById('cad-email').value.trim(),
            perfil: document.getElementById('cad-perfil').value,
            equipes: equipesSelecionadas,
            id_equipe: equipesSelecionadas[0] || null
        };

        try {
            const res = await window.JanoAPI.Funcionarios.cadastrar(dados);

            if (res.sucesso) {
                modalCadastrar.hide();
                formCad.reset();
                document.querySelectorAll('#cad-equipes-lista .team-checkbox-item').forEach(el => {
                    el.classList.remove('checked');
                });

                // Exibe modal com as credenciais geradas e status real do envio de e-mail
                document.getElementById('cred-email').textContent = res.credenciaisTemporarias.email;
                document.getElementById('cred-senha').textContent = res.credenciaisTemporarias.senhaTemporaria;

                const statusAlert = document.getElementById('cred-email-status-alert');
                if (statusAlert) {
                    statusAlert.replaceChildren();
                    if (res.emailStatus && res.emailStatus.enviado) {
                        statusAlert.className = 'alert alert-success py-2 small text-start mb-3';
                        const icon = document.createElement('i');
                        icon.className = 'bi bi-envelope-check-fill me-1';
                        const strong = document.createElement('strong');
                        strong.textContent = res.credenciaisTemporarias.email;
                        statusAlert.append(icon, ' E-mail enviado com sucesso para ', strong, '.');
                    } else {
                        const motivo = res.emailStatus && res.emailStatus.erro
                            ? res.emailStatus.erro
                            : 'Serviço de e-mail operando em modo simulado.';
                        statusAlert.className = 'alert alert-warning py-2 small text-start mb-3';
                        const icon = document.createElement('i');
                        icon.className = 'bi bi-exclamation-triangle-fill me-1';
                        const title = document.createElement('strong');
                        title.textContent = 'O e-mail não foi enviado: ';
                        const br = document.createElement('br');
                        const code = document.createElement('code');
                        code.textContent = 'backend/.env';
                        statusAlert.append(
                            icon,
                            ' ',
                            title,
                            motivo,
                            br,
                            'Você pode copiar a senha abaixo para entregar manualmente ou verificar o arquivo ',
                            code,
                            '.'
                        );
                    }
                }

                modalCredenciais.show();

                if (res.emailStatus && res.emailStatus.enviado) {
                    window.JanoComponents.showToast('Colaborador cadastrado e credenciais enviadas por e-mail!', 'sucesso');
                } else {
                    window.JanoComponents.showToast('Colaborador cadastrado, mas o e-mail não foi enviado. Veja o aviso no modal.', 'aviso');
                }

                // Recarrega lista
                await carregarFuncionarios();
            } else {
                errorAlert.textContent = res.mensagem || 'Erro ao cadastrar funcionário.';
                errorAlert.classList.remove('d-none');
            }
        } catch (error) {
            errorAlert.textContent = error.message || 'Erro na comunicação com o servidor.';
            errorAlert.classList.remove('d-none');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'Cadastrar Funcionário';
        }
    });

    // Botão de copiar senha gerada
    document.getElementById('btn-copiar-senha').addEventListener('click', () => {
        const senha = document.getElementById('cred-senha').textContent;
        navigator.clipboard.writeText(senha).then(() => {
            window.JanoComponents.showToast('Senha temporária copiada para a área de transferência!', 'info');
        });
    });
});

async function carregarEquipesSelect() {
    try {
        const res = await window.JanoAPI.Equipes.listar();
        const container = document.getElementById('cad-equipes-lista');
        if (!container) return;

        if (res.sucesso && res.equipes && res.equipes.length > 0) {
            container.innerHTML = res.equipes.map(eq => `
                <label class="team-checkbox-item">
                    <input type="checkbox" value="${eq.id}" onchange="this.closest('.team-checkbox-item').classList.toggle('checked', this.checked)">
                    <span>${eq.nome} <small class="text-muted">(${eq.departamento})</small></span>
                </label>
            `).join('');
        } else {
            container.innerHTML = '<span class="text-muted small">Nenhuma equipe cadastrada ainda.</span>';
        }
    } catch (err) {
        console.error('Erro ao carregar lista de equipes:', err);
    }
}

async function carregarFuncionarios() {
    const tbody = document.getElementById('tabela-funcionarios-body');
    const badgeTotal = document.getElementById('badge-total-funcionarios');

    try {
        const res = await window.JanoAPI.Funcionarios.listar();
        if (!res.sucesso || !res.funcionarios) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Falha ao carregar colaboradores.</td></tr>';
            return;
        }

        funcionariosLista = res.funcionarios;
        badgeTotal.textContent = funcionariosLista.length;
        renderizarTabela(funcionariosLista);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Erro: ${error.message}</td></tr>`;
    }
}

function renderizarTabela(lista) {
    const tbody = document.getElementById('tabela-funcionarios-body');
    const textoPaginacao = document.getElementById('texto-paginacao');

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Nenhum funcionário encontrado.</td></tr>';
        if (textoPaginacao) textoPaginacao.textContent = 'Mostrando 0 funcionários';
        return;
    }

    if (textoPaginacao) {
        textoPaginacao.textContent = `Mostrando 1–${lista.length} de ${lista.length} funcionários`;
    }

    const usuarioLogado = window.JanoAuth.getUser();
    const coresAvatares = ['#e0f2fe', '#ede9fe', '#dcfce7', '#ffedd5', '#fce7f3'];
    const coresTextos = ['#0369a1', '#6d28d9', '#15803d', '#c2410c', '#be185d'];

    tbody.innerHTML = lista.map((func, index) => {
        const isMe = usuarioLogado && usuarioLogado.id === func.id;
        const iniciais = (func.nome || 'J')
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

        const corBg = coresAvatares[index % coresAvatares.length];
        const equipesDoFunc = Array.isArray(func.equipes) ? func.equipes : [];
        const equipeBadge = equipesDoFunc.length > 0
            ? `<div class="status-teams-wrap">${equipesDoFunc.map(eq => `<span class="badge-figma blue">${eq.nome}</span>`).join('')}</div>`
            : `<span class="badge-figma neutral">Sem Equipe</span>`;

        const progresso = typeof func.progresso_onboarding === 'number' ? func.progresso_onboarding : 0;
        const totalTar = func.total_tarefas || 0;
        const concTar = func.tarefas_concluidas || 0;
        const isConcluido = func.onboarding_concluido || (totalTar > 0 && concTar === totalTar);

        let progressoHtml = '';
        if (totalTar === 0) {
            progressoHtml = '<span class="badge-figma neutral">Sem tarefas</span>';
        } else if (isConcluido) {
            progressoHtml = `
                <div>
                    <span class="badge-figma green mb-1"><i class="bi bi-check2-all me-1"></i>Concluído</span>
                    <small class="text-muted d-block" style="font-size: 0.72rem;">${concTar}/${totalTar} (100%)</small>
                </div>
            `;
        } else {
            progressoHtml = `
                <div style="min-width: 130px;">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge-figma blue" style="font-size: 0.7rem;">Em andamento</span>
                        <strong class="text-primary small">${progresso}%</strong>
                    </div>
                    <div class="progress" style="height: 5px; border-radius: 4px; background: #e2e8f0;">
                        <div class="progress-bar bg-primary" role="progressbar" style="width: ${progresso}%; border-radius: 4px;"></div>
                    </div>
                    <small class="text-muted d-block mt-1" style="font-size: 0.7rem;">${concTar} de ${totalTar} concluídas</small>
                </div>
            `;
        }

        return `
            <tr>
                <td>
                    <div class="d-flex align-items-center gap-3">
                        <div style="width: 38px; height: 38px; border-radius: 50%; background: ${corBg}; color: ${corTxt}; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            ${iniciais}
                        </div>
                        <div>
                            <div class="fw-bold text-dark">${func.nome} ${isMe ? '<span class="badge-figma neutral ms-1">Você</span>' : ''}</div>
                            <small class="text-muted" style="font-size: 0.75rem;">CPF: ${func.cpf}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="text-dark fw-medium">${func.cargo}</span>
                </td>
                <td>
                    ${equipeBadge}
                </td>
                <td>
                    ${progressoHtml}
                </td>
                <td>
                    <span class="text-muted">${func.email}</span>
                </td>
                <td class="text-center">
                    ${!isMe ? `
                        <button type="button" class="btn btn-sm btn-outline-danger border-0 p-2" onclick="confirmarDesligamento(${func.id}, '${escapeHtml(func.nome)}')" title="Efetuar Desligamento (RN01, RN07, RF15)">
                            <i class="bi bi-trash fs-5"></i>
                        </button>
                    ` : `
                        <span class="text-muted small">-</span>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

window.confirmarDesligamento = async function(id, nome) {
    const confirmou = confirm(`CONFIRMAÇÃO DE DESLIGAMENTO (RN01/RN07/RF15):\n\nDeseja realmente desligar e excluir o cadastro de "${nome}"?\nEsta ação removerá o colaborador do sistema e das equipes associadas.`);
    if (!confirmou) return;

    try {
        const res = await window.JanoAPI.Funcionarios.excluir(id);
        if (res.sucesso) {
            window.JanoComponents.showToast(`Colaborador "${nome}" desligado com sucesso.`, 'aviso');
            await carregarFuncionarios();
        } else {
            alert(res.mensagem || 'Falha ao excluir colaborador.');
        }
    } catch (error) {
        alert(error.message || 'Erro ao processar desligamento.');
    }
};

function escapeHtml(text) {
    return (text || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
