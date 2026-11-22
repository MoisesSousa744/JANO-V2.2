const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '../uploads/tarefas');
const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB

const ALLOWED_MIME_MAP = {
    'application/pdf': '.pdf',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogg',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
    'video/x-matroska': '.mkv'
};

const EXT_TO_MIME = {
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska'
};

/**
 * Salva um arquivo enviado em Base64 (PDF ou Vídeo) em backend/uploads/tarefas
 * @param {{ nome?: string, tipo?: string, dataBase64: string }} arquivo
 * @returns {Promise<{ url: string, nome: string, tipo: string }>}
 */
async function salvarArquivoBase64(arquivo) {
    if (!arquivo || !arquivo.dataBase64) {
        return null;
    }

    let rawBase64 = String(arquivo.dataBase64).trim();
    let detectedMime = (arquivo.tipo || '').trim().toLowerCase();

    const dataUrlMatch = rawBase64.match(/^data:([^;]+);base64,(.+)$/s);
    if (dataUrlMatch) {
        if (!detectedMime) {
            detectedMime = dataUrlMatch[1].trim().toLowerCase();
        }
        rawBase64 = dataUrlMatch[2];
    }

    const originalName = path.basename(String(arquivo.nome || 'anexo')).replace(/[^\w.\-() ]+/g, '_').slice(0, 120) || 'anexo';
    const originalExt = path.extname(originalName).toLowerCase();

    if (!detectedMime && EXT_TO_MIME[originalExt]) {
        detectedMime = EXT_TO_MIME[originalExt];
    }

    let ext = ALLOWED_MIME_MAP[detectedMime];
    if (!ext && EXT_TO_MIME[originalExt]) {
        ext = originalExt;
        detectedMime = EXT_TO_MIME[originalExt];
    }

    if (!ext) {
        const err = new Error('Tipo de arquivo não permitido. Envie apenas arquivos PDF ou Vídeo (MP4, WebM, MOV, OGG, AVI, MKV).');
        err.status = 400;
        throw err;
    }

    const buffer = Buffer.from(rawBase64, 'base64');
    if (!buffer.length) {
        const err = new Error('O arquivo enviado está vazio ou corrompido.');
        err.status = 400;
        throw err;
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
        const err = new Error('O arquivo excede o tamanho máximo permitido de 30 MB.');
        err.status = 400;
        throw err;
    }

    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });

    const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    const fullPath = path.join(UPLOADS_DIR, uniqueName);
    await fs.promises.writeFile(fullPath, buffer);

    return {
        url: `/uploads/tarefas/${uniqueName}`,
        nome: originalName,
        tipo: detectedMime
    };
}

module.exports = {
    salvarArquivoBase64,
    MAX_FILE_SIZE_BYTES
};
