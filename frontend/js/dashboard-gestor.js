/**
 * JANO - Controlador do Dashboard do Gestor (Figura 11 do Figma)
 * Regras: RF06, RF07, RF10, RF11, RF13, RN05, RN08
 */

let equipesGlobais = [];
let funcionariosGlobais = [];

document.addEventListener('DOMContentLoaded', async () => {
    // RBAC: Apenas Gestor ou RH
    window.JanoAuth.guardRoute(['Gestor', 'RH']);

    // Renderiza a Sidebar lateral do Figma
    window.JanoComponents.renderSidebar('sidebar-container', 'gestor');

    // Carregamento de dados
    await carregarDadosCompletos();

    // Alternar rádio: Para Indivíduo vs Para Equipe
    const radioIndividuo = document.getElementById('tipoIndividuo');
    const radioEquipe = document.getElementById('tipoEquipe');
    const boxFuncionario = document.getElementById('box-destinatario-funcionario');
    const boxEquipe = document.getElementById('box-destinatario-equipe');

    radioIndividuo.addEventListener('change', () => {
        boxFuncionario.classList.remove('d-none');
        boxEquipe.classList.add('d-none');
    });

    radioEquipe.addEventListener('change', () => {
        boxFuncionario.classList.add('d-none');
        boxEquipe.classList.remove('d-none');
    });

    // Form: Nova Equipe (RF10)
    const formEquipe = document.getElementById('form-criar-equipe');
    formEquipe.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertEl = document.getElementById('msg-equipe-alert');
        alertEl.classList.add('d-none');

        const dados = {
            nome: document.getElementById('eq-nome').value.trim(),
            departamento: document.getElementById('eq-departamento').value.trim()
        };

        if (!dados.nome || !dados.departamento) {
            alertEl.textContent = 'Preencha o nome e o departamento da equipe.';
            alertEl.classList.remove('d-none');
            return;
        }

        try {
            const res = await window.JanoAPI.Equipes.criar(dados);
            if (res.sucesso) {
                formEquipe.reset();
                window.JanoComponents.showToast('Equipe criada com sucesso!', 'sucesso');
                await carregarDadosCompletos();
            } else {
                alertEl.textContent = res.mensagem || 'Falha ao criar equipe.';
                alertEl.classList.remove('d-none');
            }
        } catch (error) {
            alertEl.textContent = error.message;
            alertEl.classList.remove('d-none');
        }
    });

    // Preview do arquivo selecionado em Atribuir Tarefa
    const inputTarAnexo = document.getElementById('tar-anexo');
    const tarAnexoInfo = document.getElementById('tar-anexo-info');
    if (inputTarAnexo && tarAnexoInfo) {
        inputTarAnexo.addEventListener('change', () => {
            const file = inputTarAnexo.files[0];
            if (file) {
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                tarAnexoInfo.textContent = `Selecionado: ${file.name} (${sizeMB} MB)`;
            } else {
                tarAnexoInfo.textContent = 'Aceita PDF ou vídeo (MP4, WebM, MOV, OGG) até 30 MB.';
            }
        });
    }

    // Form: Atribuir Tarefa (RF06, RF07)
    const formTarefa = document.getElementById('form-atribuir-tarefa');
    formTarefa.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertEl = document.getElementById('msg-tarefa-alert');
        alertEl.classList.add('d-none');

        const isEquipe = radioEquipe.checked;
        const idFuncionario = isEquipe ? null : document.getElementById('tar-funcionario').value;
        const idEquipe = isEquipe ? document.getElementById('tar-equipe').value : null;

        const titulo = document.getElementById('tar-titulo').value.trim();
        const prazo = document.getElementById('tar-prazo').value;

        if (!titulo || !prazo) {
            alertEl.textContent = 'Informe a descrição/título e o prazo da tarefa.';
            alertEl.classList.remove('d-none');
            return;
        }

        if (!isEquipe && !idFuncionario) {
            alertEl.textContent = 'Escolha um funcionário destinatário.';
            alertEl.classList.remove('d-none');
            return;
        }

        if (isEquipe && !idEquipe) {
            alertEl.textContent = 'Escolha a equipe destinatária.';
            alertEl.classList.remove('d-none');
            return;
        }

        const btnSubmit = document.getElementById('btn-submit-tarefa');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';

        try {
            const arquivoSelecionado = inputTarAnexo && inputTarAnexo.files ? inputTarAnexo.files[0] : null;
            const anexoPayload = arquivoSelecionado
                ? await window.JanoAPI.fileToBase64Payload(arquivoSelecionado, 30)
                : null;

            const dados = {
                titulo,
                descricao: titulo,
                prazo,
                id_funcionario: idFuncionario || null,
                id_equipe: idEquipe || null,
                anexo: anexoPayload
            };

            const res = await window.JanoAPI.Tarefas.criar(dados);
            if (res.sucesso) {
                formTarefa.reset();
                boxFuncionario.classList.remove('d-none');
                boxEquipe.classList.add('d-none');
                if (tarAnexoInfo) {
                    tarAnexoInfo.textContent = 'Aceita PDF ou vídeo (MP4, WebM, MOV, OGG) até 30 MB.';
                }
                window.JanoComponents.showToast('Tarefa atribuída com sucesso!', 'sucesso');
            } else {
                alertEl.textContent = res.mensagem || 'Erro ao atribuir tarefa.';
                alertEl.classList.remove('d-none');
            }
        } catch (error) {
            alertEl.textContent = error.message;
            alertEl.classList.remove('d-none');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<span>Atribuir</span>';
        }
    });
});

async function carregarDadosCompletos() {
    await carregarEquipes();
    await carregarFuncionarios();
    renderizarTabelaAlocacao();
}

async function carregarEquipes() {
    try {
        const res = await window.JanoAPI.Equipes.listar();
        if (res.sucesso && res.equipes) {
            equipesGlobais = res.equipes;

            // Atualiza select de equipes no form de atribuir tarefa
            const selectEquipe = document.getElementById('tar-equipe');
            selectEquipe.innerHTML = '<option value="">Escolha uma equipe...</option>' +
                equipesGlobais.map(eq => `<option value="${eq.id}">${eq.nome} (${eq.departamento})</option>`).join('');
        }
    } catch (err) {
        console.error('Erro ao listar equipes:', err);
    }
}

async function carregarFuncionarios() {
    try {
        const res = await window.JanoAPI.Funcionarios.listar();
        if (res.sucesso && res.funcionarios) {
            funcionariosGlobais = res.funcionarios;

            // Atualiza select de funcionários no form de atribuir tarefa
            const selectFunc = document.getElementById('tar-funcionario');
            selectFunc.innerHTML = '<option value="">Escolha um funcionário...</option>' +
                funcionariosGlobais.map(f => `<option value="${f.id}">${f.nome} (${f.cargo})</option>`).join('');
        }
    } catch (err) {
        console.error('Erro ao listar funcionários:', err);
    }
}

function renderizarTabelaAlocacao() {
    const tbody = document.getElementById('tabela-alocacao-body');
    if (!funcionariosGlobais.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Nenhum funcionário encontrado.</td></tr>';
        return;
    }

    const coresAvatares = ['#e0f2fe', '#ede9fe', '#dcfce7', '#ffedd5', '#fce7f3'];
    const coresTextos = ['#0369a1', '#6d28d9', '#15803d', '#c2410c', '#be185d'];

    tbody.innerHTML = funcionariosGlobais.map((func, index) => {
        const iniciais = (func.nome || 'J')
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

        const corBg = coresAvatares[index % coresAvatares.length];
        const corTxt = coresTextos[index % coresTextos.length];

        const equipesDoFunc = Array.isArray(func.equipes) ? func.equipes : [];
        const idsEquipesDoFunc = new Set(equipesDoFunc.map(e => Number(e.id)));

        const statusBadge = equipesDoFunc.length > 0
            ? `<div class="status-teams-wrap">${equipesDoFunc.map(eq => `<span class="badge-figma green">${eq.nome}</span>`).join('')}</div>`
            : `<span class="badge-figma orange">Sem Equipe</span>`;

        // Monta checkboxes para marcar/desmarcar múltiplas equipes
        const checkboxesEquipes = equipesGlobais.length > 0
            ? `<div class="team-checkbox-list">
                ${equipesGlobais.map(eq => {
                    const checked = idsEquipesDoFunc.has(Number(eq.id));
                    return `
                        <label class="team-checkbox-item ${checked ? 'checked' : ''}">
                            <input
                                type="checkbox"
                                ${checked ? 'checked' : ''}
                                onchange="alternarEquipeFuncionario(${func.id}, ${eq.id}, this)"
                            >
                            <span>${eq.nome}</span>
                        </label>
                    `;
                }).join('')}
               </div>`
            : '<span class="text-muted small">Crie uma equipe primeiro</span>';

        return `
            <tr>
                <td>
                    <div class="d-flex align-items-center gap-3">
                        <div style="width: 38px; height: 38px; border-radius: 50%; background: ${corBg}; color: ${corTxt}; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            ${iniciais}
                        </div>
                        <div class="fw-bold text-dark">${func.nome}</div>
                    </div>
                </td>
                <td>
                    <span class="text-muted">${func.email}</span>
                </td>
                <td>
                    ${statusBadge}
                </td>
                <td>
                    ${checkboxesEquipes}
                </td>
            </tr>
        `;
    }).join('');
}

window.alternarEquipeFuncionario = async function(idFuncionario, idEquipe, checkboxEl) {
    const marcado = checkboxEl.checked;
    checkboxEl.disabled = true;

    try {
        const res = marcado
            ? await window.JanoAPI.Equipes.vincularMembro(idEquipe, idFuncionario)
            : await window.JanoAPI.Equipes.removerMembro(idEquipe, idFuncionario);

        if (res.sucesso) {
            window.JanoComponents.showToast(
                marcado ? 'Colaborador adicionado à equipe!' : 'Colaborador removido da equipe!',
                marcado ? 'sucesso' : 'info'
            );
            await carregarDadosCompletos();
        } else {
            checkboxEl.checked = !marcado;
            alert(res.mensagem || 'Falha ao atualizar equipe.');
        }
    } catch (error) {
        checkboxEl.checked = !marcado;
        alert(error.message);
    } finally {
        checkboxEl.disabled = false;
    }
};
