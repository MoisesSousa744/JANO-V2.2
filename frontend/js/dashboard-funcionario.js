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
        const progresso = typeof res.progresso === 'number' ? res.progresso : (total > 0 ? Math.round((concluidas.length / total) * 100) : 0);

        // Atualiza contadores em pills do Figma
        const pillPend = document.getElementById('pill-pendentes');
        const pillConc = document.getElementById('pill-concluidas');
        if (pillPend) pillPend.textContent = pendentes.length;
        if (pillConc) pillConc.textContent = concluidas.length;

        // Atualiza elementos da Barra de Progresso do Onboarding
        const elPorcentagem = document.getElementById('onboarding-porcentagem');
        const elContador = document.getElementById('onboarding-contador-tarefas');
        const elBarra = document.getElementById('onboarding-progress-bar');
        const bannerConcluido = document.getElementById('banner-onboarding-concluido');
        const bannerTreinamento = document.getElementById('banner-mini-treinamento');

        if (elPorcentagem) elPorcentagem.textContent = `${progresso}%`;
        if (elContador) elContador.textContent = `${concluidas.length} de ${total} atividades concluídas`;
        if (elBarra) {
            elBarra.style.width = `${progresso}%`;
            elBarra.setAttribute('aria-valuenow', progresso);
            if (progresso === 100) {
                elBarra.classList.remove('bg-primary');
                elBarra.classList.add('bg-success');
            } else {
                elBarra.classList.remove('bg-success');
                elBarra.classList.add('bg-primary');
            }
        }

        // Verifica se o onboarding está 100% concluído
        if (progresso === 100 && total > 0) {
            if (bannerConcluido) bannerConcluido.classList.remove('d-none');
            if (bannerTreinamento) bannerTreinamento.classList.add('d-none');
        } else {
            if (bannerConcluido) bannerConcluido.classList.add('d-none');
            // Verifica se o mini-treinamento está pendente
            const miniTreinamentoPendente = pendentes.some(t => 
                t.titulo.toLowerCase().includes('mini-treinamento') || t.titulo.toLowerCase().includes('treinamento inicial')
            );
            if (miniTreinamentoPendente && bannerTreinamento) {
                bannerTreinamento.classList.remove('d-none');
            } else if (bannerTreinamento) {
                bannerTreinamento.classList.add('d-none');
            }
        }

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
                const isTreinamento = t.titulo.toLowerCase().includes('mini-treinamento') || t.titulo.toLowerCase().includes('treinamento inicial');
                
                let tipoBadge = !t.id_funcionario && t.id_equipe
                    ? `<span class="badge-figma blue">Da Equipe${t.equipe_nome ? `: ${escapeText(t.equipe_nome)}` : ''}</span>`
                    : '<span class="badge-figma blue">Individual</span>';

                if (isTreinamento) {
                    tipoBadge = `<span class="badge-figma purple me-1"><i class="bi bi-star-fill me-1"></i>Mini-Treinamento</span>` + tipoBadge;
                }

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
                        <div class="task-card-figma ${isTreinamento ? 'border-primary' : ''}" style="${isTreinamento ? 'border: 2px solid #bfdbfe;' : ''}">
                            <div>
                                <div class="task-card-top">
                                    <div class="d-flex flex-wrap gap-1">${tipoBadge}</div>
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

        // Renderiza Tarefas Já Realizadas (Histórico de Entregas)
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

                const formatDataConclusao = t.data_conclusao ? formatarData(t.data_conclusao, 'com-hora') : 'Concluída';
                const badgeArquivo = t.evidencia_arquivo_url
                    ? `<span class="badge-figma purple ms-1"><i class="bi ${isVideoMime(t.evidencia_arquivo_tipo, t.evidencia_arquivo_url) ? 'bi-camera-video' : 'bi-file-earmark-pdf'} me-1"></i>${isVideoMime(t.evidencia_arquivo_tipo, t.evidencia_arquivo_url) ? 'Vídeo' : 'PDF'}</span>`
                    : '';

                // Formata o resumo da evidência para exibição clara
                let resumoEvidencia = '';
                if (t.evidencia) {
                    if (t.evidencia.startsWith('http://') || t.evidencia.startsWith('https://')) {
                        resumoEvidencia = `
                            <div class="small p-2 mt-2 rounded" style="background: #f1f5f9; border: 1px solid #e2e8f0;">
                                <strong class="text-secondary d-block"><i class="bi bi-link-45deg me-1"></i>Evidência enviada:</strong>
                                <a href="${escapeText(t.evidencia)}" target="_blank" rel="noopener noreferrer" class="text-primary text-truncate d-block">${escapeText(t.evidencia)}</a>
                            </div>
                        `;
                    } else {
                        resumoEvidencia = `
                            <div class="small p-2 mt-2 rounded text-dark" style="background: #f8fafc; border: 1px solid #e2e8f0;">
                                <strong class="text-secondary d-block"><i class="bi bi-file-text me-1"></i>Evidência enviada:</strong>
                                ${escapeText(t.evidencia)}
                            </div>
                        `;
                    }
                }

                return `
                    <div class="col-12 col-md-6 col-xl-6">
                        <div class="task-card-figma" style="background-color: #fafbfc; border-left: 4px solid #10b981;">
                            <div>
                                <div class="task-card-top">
                                    <div class="d-flex flex-wrap gap-1">${tipoBadge}${badgeArquivo}</div>
                                    <span class="small fw-bold text-success">
                                        <i class="bi bi-check2-circle me-1"></i> Concluída
                                    </span>
                                </div>
                                <h6 class="task-card-title text-dark">${escapeText(t.titulo)}</h6>
                                <p class="task-card-desc mb-2">${escapeText(t.descricao || '')}</p>
                                ${resumoEvidencia}
                            </div>
                            <div class="task-card-bottom mt-3">
                                <span class="task-card-deadline text-success fw-semibold">
                                    <i class="bi bi-calendar-check"></i> ${formatDataConclusao}
                                </span>
                                <button type="button" class="btn btn-sm btn-outline-primary" style="border-radius: 8px;" onclick="visualizarEvidencia(${t.id})">
                                    <i class="bi bi-eye me-1"></i> Ver detalhes completos
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
