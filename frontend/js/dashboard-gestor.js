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

        if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) {
            alertEl.textContent = 'Prazo inválido. O ano deve conter exatamente 4 dígitos (AAAA-MM-DD).';
            alertEl.classList.remove('d-none');
            return;
        }

        const anoPrazo = parseInt(prazo.split('-')[0], 10);
        if (anoPrazo < 1900 || anoPrazo > 2099) {
            alertEl.textContent = 'Prazo inválido. O ano deve estar entre 1900 e 2099.';
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

let entregasGlobais = [];

async function carregarDadosCompletos() {
    await carregarEquipes();
    await carregarFuncionarios();
    renderizarTabelaAlocacao();
    await carregarEntregasGestor();
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
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Nenhum funcionário encontrado.</td></tr>';
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

        // Coluna de Progresso de Onboarding (Item 5)
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
                    <span class="badge-figma green mb-1"><i class="bi bi-check2-all me-1"></i>Concluído (100%)</span>
                    <small class="text-muted d-block" style="font-size: 0.75rem;">${concTar} de ${totalTar} tarefas</small>
                </div>
            `;
        } else {
            progressoHtml = `
                <div style="min-width: 140px;">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge-figma blue" style="font-size: 0.72rem;">Em andamento</span>
                        <strong class="text-primary small">${progresso}%</strong>
                    </div>
                    <div class="progress" style="height: 6px; border-radius: 4px; background: #e2e8f0;">
                        <div class="progress-bar bg-primary" role="progressbar" style="width: ${progresso}%; border-radius: 4px;"></div>
                    </div>
                    <small class="text-muted d-block mt-1" style="font-size: 0.72rem;">${concTar} de ${totalTar} concluídas</small>
                </div>
            `;
        }

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
                        <div>
                            <div class="fw-bold text-dark">${func.nome}</div>
                            <small class="text-muted">${func.cargo}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="text-muted">${func.email}</span>
                </td>
                <td>
                    ${statusBadge}
                </td>
                <td>
                    ${progressoHtml}
                </td>
                <td>
                    ${checkboxesEquipes}
                </td>
            </tr>
        `;
    }).join('');
}

async function carregarEntregasGestor() {
    const tbody = document.getElementById('tabela-entregas-gestor-body');
    const badgeTotal = document.getElementById('badge-total-entregas-gestor');
    if (!tbody) return;

    try {
        const res = await window.JanoAPI.Gestor.listarTarefas();
        if (!res.sucesso || !res.tarefas) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Nenhuma atividade encontrada.</td></tr>';
            return;
        }

        const concluidas = res.concluidas || res.tarefas.filter(t => t.status === 'Concluida');
        entregasGlobais = concluidas;

        if (badgeTotal) {
            badgeTotal.textContent = `${concluidas.length} entrega${concluidas.length === 1 ? '' : 's'}`;
        }

        if (concluidas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><i class="bi bi-inbox me-1"></i>Nenhuma entrega registrada pelos colaboradores até o momento.</td></tr>';
            return;
        }

        tbody.innerHTML = concluidas.map(t => {
            const dest = t.funcionario_nome || (t.equipe_nome ? `Equipe: ${t.equipe_nome}` : 'Geral');
            const cargo = t.funcionario_cargo ? `<small class="text-muted d-block">${escapeText(t.funcionario_cargo)}</small>` : '';
            const dataFmt = t.data_conclusao ? formatarData(t.data_conclusao, 'com-hora') : 'Data não registrada';

            const temArquivo = Boolean(t.evidencia_arquivo_url);
            const isVideo = temArquivo && isVideoMime(t.evidencia_arquivo_tipo, t.evidencia_arquivo_url);

            const badgeMidia = temArquivo
                ? `<span class="badge-figma purple ms-1"><i class="bi ${isVideo ? 'bi-camera-video' : 'bi-file-earmark-pdf'} me-1"></i>${isVideo ? 'Vídeo' : 'PDF'}</span>`
                : '';

            return `
                <tr>
                    <td>
                        <strong class="text-dark">${escapeText(dest)}</strong>
                        ${cargo}
                    </td>
                    <td>
                        <div class="fw-semibold text-dark">${escapeText(t.titulo)}</div>
                        <small class="text-muted text-truncate d-block" style="max-width: 280px;">${escapeText(t.descricao || '')}</small>
                    </td>
                    <td>
                        <span class="text-success fw-medium small">
                            <i class="bi bi-calendar-check me-1"></i>${dataFmt}
                        </span>
                    </td>
                    <td>
                        <span class="badge-figma green">
                            <i class="bi bi-check-circle-fill me-1"></i>Concluída
                        </span>
                    </td>
                    <td>
                        <button type="button" class="btn btn-sm btn-outline-primary" style="border-radius: 8px;" onclick="abrirModalEvidenciaGestor(${t.id})">
                            <i class="bi bi-eye me-1"></i>Ver Evidência${badgeMidia}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Erro ao carregar entregas:', err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Erro ao carregar entregas: ${err.message}</td></tr>`;
    }
}

window.abrirModalEvidenciaGestor = function(idTarefa) {
    const tarefa = entregasGlobais.find(t => t.id === idTarefa);
    if (!tarefa) return;

    document.getElementById('gestor-evidencia-tarefa-titulo').textContent = tarefa.titulo;
    document.getElementById('gestor-evidencia-colaborador').textContent = tarefa.funcionario_nome || tarefa.equipe_nome || 'Colaborador';
    document.getElementById('gestor-evidencia-data').textContent = tarefa.data_conclusao ? formatarData(tarefa.data_conclusao, 'com-hora') : 'Data não informada';

    const textoBox = document.getElementById('gestor-evidencia-texto');
    if (tarefa.evidencia && (tarefa.evidencia.startsWith('http://') || tarefa.evidencia.startsWith('https://'))) {
        const link = escapeText(tarefa.evidencia);
        textoBox.innerHTML = `<a href="${link}" target="_blank" rel="noopener noreferrer" class="text-primary text-break fw-semibold"><i class="bi bi-box-arrow-up-right me-1"></i>${link}</a>`;
    } else {
        textoBox.textContent = tarefa.evidencia || 'Nenhum texto de evidência fornecido.';
    }

    const midiaBox = document.getElementById('gestor-evidencia-midia-box');
    if (tarefa.evidencia_arquivo_url) {
        const urlCompleta = window.JanoAPI.resolveFileUrl(tarefa.evidencia_arquivo_url);
        const isVideo = isVideoMime(tarefa.evidencia_arquivo_tipo, tarefa.evidencia_arquivo_url);
        const nomeArquivo = escapeText(tarefa.evidencia_arquivo_nome || (isVideo ? 'Vídeo de Comprovação' : 'Documento PDF'));

        midiaBox.classList.remove('d-none');
        if (isVideo) {
            midiaBox.innerHTML = `
                <div class="mt-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <strong class="small text-dark"><i class="bi bi-camera-video me-1 text-primary"></i>${nomeArquivo}</strong>
                        <a href="${urlCompleta}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary">
                            <i class="bi bi-box-arrow-up-right me-1"></i>Abrir em nova aba
                        </a>
                    </div>
                    <video controls style="width: 100%; max-height: 400px; border-radius: 10px; background: #000;">
                        <source src="${urlCompleta}" type="${escapeText(tarefa.evidencia_arquivo_tipo || 'video/mp4')}">
                        Seu navegador não suporta reprodução de vídeo.
                    </video>
                </div>
            `;
        } else {
            midiaBox.innerHTML = `
                <div class="mt-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <strong class="small text-dark"><i class="bi bi-file-earmark-pdf me-1 text-danger"></i>${nomeArquivo}</strong>
                        <a href="${urlCompleta}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary">
                            <i class="bi bi-box-arrow-up-right me-1"></i>Abrir PDF em nova aba
                        </a>
                    </div>
                    <iframe src="${urlCompleta}" style="width: 100%; height: 420px; border: 1px solid #e2e8f0; border-radius: 10px;"></iframe>
                </div>
            `;
        }
    } else {
        midiaBox.classList.add('d-none');
        midiaBox.innerHTML = '';
    }

    const modal = new bootstrap.Modal(document.getElementById('modal-ver-evidencia-gestor'));
    modal.show();
};

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

function isVideoMime(tipo, url) {
    if (tipo && String(tipo).toLowerCase().startsWith('video/')) return true;
    return /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i.test(String(url || ''));
}

function escapeText(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatarData(dataStr, formato = 'longo') {
    if (!dataStr) return '';
    if (window.JanoComponents && window.JanoComponents.formatarData) {
        return window.JanoComponents.formatarData(dataStr, formato);
    }
    try {
        const str = String(dataStr).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            const [ano, mes, dia] = str.split('-');
            return `${dia}/${mes}/${ano}`;
        }
        const d = new Date(dataStr);
        return d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dataStr;
    }
}
