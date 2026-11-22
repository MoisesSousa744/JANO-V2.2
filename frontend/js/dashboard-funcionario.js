/**
 * JANO - Controlador do Portal de Tarefas do Colaborador (Figura 13 do Figma)
 * Regras: RF08, RF09, RN03, RN04
 */

let tarefasPendentesGlobais = [];
let tarefasConcluidasGlobais = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Garante autenticação e RBAC
    window.JanoAuth.guardRoute(['Funcionario', 'Gestor', 'RH']);

    // Renderiza a Sidebar lateral do Figma
    window.JanoComponents.renderSidebar('sidebar-container', 'funcionario');

    const modalEntregaEl = document.getElementById('modal-entregar-tarefa');
    const modalEntrega = new bootstrap.Modal(modalEntregaEl);

    const modalVerEvidenciaEl = document.getElementById('modal-ver-evidencia');
    if (modalVerEvidenciaEl) {
        modalVerEvidenciaEl.addEventListener('hidden.bs.modal', () => {
            const midiaBox = document.getElementById('ver-evidencia-midia');
            if (midiaBox) {
                midiaBox.innerHTML = '';
                midiaBox.classList.add('d-none');
            }
        });
    }

    // Carrega tarefas do funcionário
    await carregarMinhasTarefas();

    // Preview de nome/tamanho do arquivo PDF ou Vídeo na entrega
    const inputArquivo = document.getElementById('entrega-arquivo');
    const infoArquivo = document.getElementById('entrega-arquivo-info');
    if (inputArquivo && infoArquivo) {
        inputArquivo.addEventListener('change', () => {
            const file = inputArquivo.files[0];
            if (file) {
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                infoArquivo.textContent = `Selecionado: ${file.name} (${sizeMB} MB)`;
            } else {
                infoArquivo.textContent = 'Aceita PDF ou vídeo (MP4, WebM, MOV, OGG) até 30 MB. Você pode enviar texto, arquivo ou ambos.';
            }
        });
    }

    // Evento de entrega da tarefa
    const formEntrega = document.getElementById('form-entregar-tarefa');
    formEntrega.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorAlert = document.getElementById('modal-entrega-error');
        errorAlert.classList.add('d-none');

        const idTarefa = document.getElementById('entrega-tarefa-id').value;
        const evidencia = document.getElementById('entrega-evidencia').value.trim();
        const arquivoEl = document.getElementById('entrega-arquivo');
        const arquivoSelecionado = arquivoEl && arquivoEl.files ? arquivoEl.files[0] : null;

        if (!evidencia && !arquivoSelecionado) {
            errorAlert.textContent = 'Informe uma descrição/link ou anexe um vídeo/PDF para concluir a tarefa.';
            errorAlert.classList.remove('d-none');
            return;
        }

        const btnSubmit = document.getElementById('btn-submit-entrega');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';

        try {
            const arquivoPayload = arquivoSelecionado
                ? await window.JanoAPI.fileToBase64Payload(arquivoSelecionado, 30)
                : null;

            const res = await window.JanoAPI.Tarefas.concluir(idTarefa, evidencia, arquivoPayload, true);

            if (res.sucesso) {
                modalEntrega.hide();
                formEntrega.reset();
                if (infoArquivo) {
                    infoArquivo.textContent = 'Aceita PDF ou vídeo (MP4, WebM, MOV, OGG) até 30 MB. Você pode enviar texto, arquivo ou ambos.';
                }
                window.JanoComponents.showToast('Tarefa entregue com sucesso!', 'sucesso');
                await carregarMinhasTarefas();
            } else {
                errorAlert.textContent = res.mensagem || 'Falha ao registrar entrega da tarefa.';
                errorAlert.classList.remove('d-none');
            }
        } catch (error) {
            errorAlert.textContent = error.message || 'Erro de comunicação ao entregar tarefa.';
            errorAlert.classList.remove('d-none');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'Confirmar Entrega';
        }
    });
});

async function carregarMinhasTarefas() {
    const containerPendentes = document.getElementById('container-tarefas-pendentes');
    const containerConcluidas = document.getElementById('container-tarefas-concluidas');

    try {
        // Sempre solicita apenas as tarefas do usuário logado (seja Funcionário, Gestor ou RH)
        const res = await window.JanoAPI.Tarefas.listar({ somenteMinhas: 'true' });

        if (!res.sucesso) {
            containerPendentes.innerHTML = '<div class="col-12 text-center text-danger">Falha ao carregar suas tarefas de integração.</div>';
            return;
        }

        const pendentes = res.pendentes || [];
        const concluidas = res.concluidas || [];
        tarefasPendentesGlobais = pendentes;
        tarefasConcluidasGlobais = concluidas;

        const total = pendentes.length + concluidas.length;

        // Atualiza contadores em pills do Figma
        document.getElementById('pill-total-tarefas').textContent = `Total de tarefas: ${total}`;
        document.getElementById('pill-pendentes').textContent = `Pendentes: ${pendentes.length}`;
        document.getElementById('pill-concluidas').textContent = `Concluídas: ${concluidas.length}`;

        document.getElementById('count-pendentes-header').textContent = pendentes.length;
        document.getElementById('count-concluidas-header').textContent = concluidas.length;

        // Renderiza Tarefas Pendentes (Figma Card)
        if (pendentes.length === 0) {
            containerPendentes.innerHTML = `
                <div class="col-12">
                    <div class="card-figma p-4 text-center text-muted">
                        <i class="bi bi-check-circle-fill text-success fs-2 mb-2"></i>
                        <h6 class="fw-bold mb-1">Nenhuma tarefa pendente</h6>
                        <small>Você completou todas as atividades de onboarding atribuídas a você.</small>
                    </div>
                </div>
            `;
        } else {
            containerPendentes.innerHTML = pendentes.map(t => {
                const tipoBadge = !t.id_funcionario && t.id_equipe
                    ? `<span class="badge-figma blue">Da Equipe${t.equipe_nome ? `: ${escapeText(t.equipe_nome)}` : ''}</span>`
                    : '<span class="badge-figma blue">Individual</span>';

                const formatPrazo = t.prazo ? formatarData(t.prazo) : 'Sem prazo';
                const botaoMaterial = t.anexo_url
                    ? `<div class="mb-3">
                           <button type="button" class="btn btn-sm btn-outline-primary" style="border-radius: 8px;" onclick="visualizarMaterialTarefa(${t.id}, 'pendente')">
                               <i class="bi ${isVideoMime(t.anexo_tipo, t.anexo_url) ? 'bi-play-circle' : 'bi-file-earmark-pdf'} me-1"></i>
                               Ver material anexado
                           </button>
                       </div>`
                    : '';

                return `
                    <div class="col-12 col-md-6 col-xl-4">
                        <div class="task-card-figma">
                            <div>
                                <div class="task-card-top">
                                    ${tipoBadge}
                                    <span class="small fw-semibold text-danger">
                                        <span style="font-size: 1rem; line-height: 0;">•</span> Pendente
                                    </span>
                                </div>
                                <h6 class="task-card-title">${escapeText(t.titulo)}</h6>
                                <p class="task-card-desc">${escapeText(t.descricao || 'Sem descrição específica.')}</p>
                                ${botaoMaterial}
                            </div>
                            <div class="task-card-bottom">
                                <span class="task-card-deadline">
                                    <i class="bi bi-calendar3"></i> Prazo: ${formatPrazo}
                                </span>
                                <button type="button" class="btn-task-action" onclick="abrirModalEntrega(${t.id})">
                                    <span>Entregar Tarefa</span>
                                    <i class="bi bi-arrow-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Renderiza Tarefas Já Realizadas (Figma Card)
        if (concluidas.length === 0) {
            containerConcluidas.innerHTML = `
                <div class="col-12">
                    <div class="card-figma p-4 text-center text-muted">
                        <i class="bi bi-clipboard2-check fs-2 mb-2"></i>
                        <h6 class="fw-bold mb-1">Nenhuma entrega realizada ainda</h6>
                        <small>Quando você concluir uma tarefa e enviar a evidência, ela aparecerá aqui.</small>
                    </div>
                </div>
            `;
        } else {
            containerConcluidas.innerHTML = concluidas.map(t => {
                const tipoBadge = !t.id_funcionario && t.id_equipe
                    ? `<span class="badge-figma neutral">Da Equipe${t.equipe_nome ? `: ${escapeText(t.equipe_nome)}` : ''}</span>`
                    : '<span class="badge-figma neutral">Individual</span>';

                const formatDataConclusao = t.data_conclusao ? formatarData(t.data_conclusao) : 'Concluída';
                const badgeArquivo = t.evidencia_arquivo_url
                    ? `<span class="badge-figma purple ms-1"><i class="bi ${isVideoMime(t.evidencia_arquivo_tipo, t.evidencia_arquivo_url) ? 'bi-camera-video' : 'bi-file-earmark-pdf'} me-1"></i>${isVideoMime(t.evidencia_arquivo_tipo, t.evidencia_arquivo_url) ? 'Vídeo' : 'PDF'}</span>`
                    : '';

                return `
                    <div class="col-12 col-md-6 col-xl-6">
                        <div class="task-card-figma" style="background-color: #fafbfc;">
                            <div>
                                <div class="task-card-top">
                                    <div>${tipoBadge}${badgeArquivo}</div>
                                    <span class="small fw-bold text-success">
                                        <i class="bi bi-check2-circle me-1"></i> Concluída
                                    </span>
                                </div>
                                <h6 class="task-card-title text-dark">${escapeText(t.titulo)}</h6>
                                <p class="task-card-desc mb-2">${escapeText(t.descricao || '')}</p>
                            </div>
                            <div class="task-card-bottom">
                                <span class="task-card-deadline">
                                    <i class="bi bi-calendar-check"></i> Concluída em: ${formatDataConclusao}
                                </span>
                                <button type="button" class="btn btn-link text-primary text-decoration-none fw-semibold small p-0" onclick="visualizarEvidencia(${t.id})">
                                    Ver evidência enviada
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        containerPendentes.innerHTML = `<div class="col-12 text-center text-danger">Erro: ${err.message}</div>`;
    }
}

window.abrirModalEntrega = function(idTarefa) {
    const tarefa = tarefasPendentesGlobais.find(t => t.id === idTarefa);
    if (!tarefa) return;

    document.getElementById('entrega-tarefa-id').value = tarefa.id;
    document.getElementById('entrega-tarefa-titulo').textContent = tarefa.titulo;
    document.getElementById('entrega-tarefa-descricao').textContent = tarefa.descricao || 'Sem orientações adicionais.';
    document.getElementById('entrega-evidencia').value = '';
    const inputArquivo = document.getElementById('entrega-arquivo');
    if (inputArquivo) inputArquivo.value = '';
    const infoArquivo = document.getElementById('entrega-arquivo-info');
    if (infoArquivo) {
        infoArquivo.textContent = 'Aceita PDF ou vídeo (MP4, WebM, MOV, OGG) até 30 MB. Você pode enviar texto, arquivo ou ambos.';
    }

    const anexoBox = document.getElementById('entrega-tarefa-anexo-box');
    if (anexoBox) {
        if (tarefa.anexo_url) {
            const urlCompleta = window.JanoAPI.resolveFileUrl(tarefa.anexo_url);
            const isVideo = isVideoMime(tarefa.anexo_tipo, tarefa.anexo_url);
            anexoBox.classList.remove('d-none');
            anexoBox.innerHTML = `
                <a href="${urlCompleta}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary" style="border-radius: 8px;">
                    <i class="bi ${isVideo ? 'bi-play-circle' : 'bi-file-earmark-pdf'} me-1"></i>
                    Abrir material da tarefa (${escapeText(tarefa.anexo_nome || (isVideo ? 'Vídeo' : 'PDF'))})
                </a>
            `;
        } else {
            anexoBox.classList.add('d-none');
            anexoBox.innerHTML = '';
        }
    }

    document.getElementById('modal-entrega-error').classList.add('d-none');

    const modal = bootstrap.Modal.getInstance(document.getElementById('modal-entregar-tarefa')) ||
                  new bootstrap.Modal(document.getElementById('modal-entregar-tarefa'));
    modal.show();
};

function renderizarMidiaNoModal(url, nome, tipo) {
    const midiaBox = document.getElementById('ver-evidencia-midia');
    if (!midiaBox) return;

    if (!url) {
        midiaBox.classList.add('d-none');
        midiaBox.innerHTML = '';
        return;
    }

    const urlCompleta = window.JanoAPI.resolveFileUrl(url);
    const isVideo = isVideoMime(tipo, url);
    const nomeSeguro = escapeText(nome || (isVideo ? 'Vídeo anexado' : 'Documento PDF'));

    midiaBox.classList.remove('d-none');
    if (isVideo) {
        midiaBox.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <strong class="small text-dark"><i class="bi bi-camera-video me-1 text-primary"></i>${nomeSeguro}</strong>
                <a href="${urlCompleta}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary">
                    <i class="bi bi-box-arrow-up-right me-1"></i>Abrir vídeo em nova aba
                </a>
            </div>
            <video controls style="width: 100%; max-height: 420px; border-radius: 10px; background: #000;">
                <source src="${urlCompleta}" type="${escapeText(tipo || 'video/mp4')}">
                Seu navegador não suporta a reprodução deste vídeo.
            </video>
        `;
    } else {
        midiaBox.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <strong class="small text-dark"><i class="bi bi-file-earmark-pdf me-1 text-danger"></i>${nomeSeguro}</strong>
                <a href="${urlCompleta}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary">
                    <i class="bi bi-box-arrow-up-right me-1"></i>Abrir PDF em nova aba
                </a>
            </div>
            <iframe src="${urlCompleta}" style="width: 100%; height: 440px; border: 1px solid #e2e8f0; border-radius: 10px;"></iframe>
        `;
    }
}

window.visualizarMaterialTarefa = function(idTarefa, origem) {
    const lista = origem === 'concluida' ? tarefasConcluidasGlobais : tarefasPendentesGlobais;
    const tarefa = lista.find(t => t.id === idTarefa);
    if (!tarefa || !tarefa.anexo_url) return;

    document.getElementById('ver-evidencia-modal-title').textContent = 'Material de Apoio da Tarefa';
    document.getElementById('ver-evidencia-titulo').textContent = tarefa.titulo;
    const box = document.getElementById('ver-evidencia-conteudo');
    box.textContent = tarefa.descricao || 'Material de apoio anexado à tarefa.';
    renderizarMidiaNoModal(tarefa.anexo_url, tarefa.anexo_nome, tarefa.anexo_tipo);

    const modal = bootstrap.Modal.getInstance(document.getElementById('modal-ver-evidencia')) ||
                  new bootstrap.Modal(document.getElementById('modal-ver-evidencia'));
    modal.show();
};

window.visualizarEvidencia = function(idTarefa) {
    const tarefa = tarefasConcluidasGlobais.find(t => t.id === idTarefa);
    if (!tarefa) return;

    document.getElementById('ver-evidencia-modal-title').textContent = 'Evidência de Conclusão';
    document.getElementById('ver-evidencia-titulo').textContent = tarefa.titulo;
    const box = document.getElementById('ver-evidencia-conteudo');

    if (tarefa.evidencia && (tarefa.evidencia.startsWith('http://') || tarefa.evidencia.startsWith('https://'))) {
        const linkSeguro = escapeText(tarefa.evidencia);
        box.innerHTML = `<strong>Link da evidência:</strong><br><a href="${linkSeguro}" target="_blank" rel="noopener noreferrer" class="text-primary text-break">${linkSeguro}</a>`;
    } else {
        box.textContent = tarefa.evidencia || 'Nenhuma evidência por escrito informada.';
    }

    renderizarMidiaNoModal(
        tarefa.evidencia_arquivo_url,
        tarefa.evidencia_arquivo_nome,
        tarefa.evidencia_arquivo_tipo
    );

    const modal = bootstrap.Modal.getInstance(document.getElementById('modal-ver-evidencia')) ||
                  new bootstrap.Modal(document.getElementById('modal-ver-evidencia'));
    modal.show();
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

function formatarData(dataStr) {
    if (!dataStr) return '';
    try {
        const d = new Date(dataStr);
        if (isNaN(d.getTime())) {
            const partes = dataStr.split('T')[0].split('-');
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dataStr;
    }
}
