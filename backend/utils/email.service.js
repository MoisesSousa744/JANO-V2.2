const nodemailer = require('nodemailer');

/**
 * Serviço de Envio de E-mails do JANO
 * Suporta:
 * 1. Webhook HTTPS (ex: Google Apps Script via porta 443 - funciona mesmo se SMTP estiver bloqueado)
 * 2. Brevo API HTTPS (porta 443 - plano gratuito)
 * 3. Gmail / SMTP via Nodemailer (IPv4 + tentativa automática nas portas 587 e 465)
 * 4. Fallback simulado no console caso nenhum provedor funcione ou esteja configurado
 */

function obterCredenciaisEmail() {
    const user = (process.env.EMAIL_USER || process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
    // Remove espaços comuns ao colar Senha de App do Google (ex: "abcd efgh ijkl mnop")
    const rawPass = (process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '').trim();
    const pass = rawPass.replace(/\s+/g, '');
    const webhookUrl = (process.env.EMAIL_WEBHOOK_URL || '').trim();
    const brevoApiKey = (process.env.BREVO_API_KEY || '').trim();

    return { user, pass, webhookUrl, brevoApiKey };
}

function getEmailConfigStatus() {
    const { user, pass, webhookUrl, brevoApiKey } = obterCredenciaisEmail();
    const host = (process.env.SMTP_HOST || '').trim();

    if (webhookUrl) {
        return { configured: true, provider: 'https-webhook', user: user || 'webhook' };
    }

    if (brevoApiKey) {
        return { configured: true, provider: 'brevo-https', user: user || 'brevo' };
    }

    if (!user || !pass) {
        return {
            configured: false,
            provider: 'simulado',
            user: user || null
        };
    }

    return {
        configured: true,
        provider: host || 'gmail (587/465)',
        user
    };
}

function criarTransportadoresSMTP() {
    const { user, pass } = obterCredenciaisEmail();

    if (!user || !pass) {
        return [];
    }

    const smtpHost = (process.env.SMTP_HOST || '').trim();
    const baseTimeouts = {
        family: 4, // Força IPv4 para evitar timeouts de IPv6 no Windows/Node 20+
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
    };

    if (smtpHost) {
        const smtpPort = Number(process.env.SMTP_PORT) || 587;
        const smtpSecure = process.env.SMTP_SECURE
            ? process.env.SMTP_SECURE === 'true'
            : smtpPort === 465;

        return [{
            label: `${smtpHost}:${smtpPort}`,
            transporter: nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpSecure,
                auth: { user, pass },
                ...baseTimeouts
            })
        }];
    }

    // Para Gmail: tenta porta 587 (STARTTLS) primeiro e faz fallback para porta 465 (SSL)
    return [
        {
            label: 'smtp.gmail.com:587 (STARTTLS)',
            transporter: nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                requireTLS: true,
                auth: { user, pass },
                ...baseTimeouts
            })
        },
        {
            label: 'smtp.gmail.com:465 (SSL)',
            transporter: nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: { user, pass },
                ...baseTimeouts
            })
        }
    ];
}

function formatarErroAmigavel(err) {
    const msg = err?.message || 'Erro desconhecido ao enviar e-mail.';
    const code = err?.code || err?.responseCode || null;

    if (code === 'ETIMEDOUT' || /timeout/i.test(msg) || code === 'ECONNECTION' || code === 'ESOCKET') {
        return 'Tempo esgotado ao conectar no SMTP (portas 587 e 465 bloqueadas pela rede/firewall ou antivírus). Teste em outra rede ou configure EMAIL_WEBHOOK_URL / BREVO_API_KEY (HTTPS porta 443).';
    }

    if (code === 'EAUTH' || code === 535 || /Invalid login|Username and Password not accepted/i.test(msg)) {
        return 'Falha de autenticação no Gmail (EAUTH). Verifique se EMAIL_USER está correto e se EMAIL_PASS é uma Senha de App válida de 16 caracteres.';
    }

    return msg;
}

async function enviarViaWebhookHTTPS({ webhookUrl, email, assunto, corpoTexto, corpoHtml }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: email,
                subject: assunto,
                text: corpoTexto,
                html: corpoHtml
            }),
            signal: controller.signal
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Webhook HTTPS retornou HTTP ${res.status}: ${body.slice(0, 150)}`);
        }
        return { messageId: `webhook-${Date.now()}` };
    } finally {
        clearTimeout(timer);
    }
}

async function enviarViaBrevoHTTPS({ brevoApiKey, senderEmail, nome, email, assunto, corpoTexto, corpoHtml }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': brevoApiKey
            },
            body: JSON.stringify({
                sender: { name: 'JANO Onboarding', email: senderEmail },
                to: [{ email, name: nome }],
                subject: assunto,
                textContent: corpoTexto,
                htmlContent: corpoHtml
            }),
            signal: controller.signal
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.message || `Brevo API retornou HTTP ${res.status}`);
        }
        return { messageId: data.messageId || `brevo-${Date.now()}` };
    } finally {
        clearTimeout(timer);
    }
}

async function sendTemporaryCredentialsEmail({ nome, email, senhaTemporaria, cargo }) {
    const timestamp = new Date().toISOString();
    const { user: configuredUser, webhookUrl, brevoApiKey } = obterCredenciaisEmail();
    const senderEmail = configuredUser || 'no-reply@jano-onboarding.corp';
    const assunto = 'Bem-vindo ao JANO! Suas credenciais de acesso corporativo';

    const corpoTexto = `
Olá, ${nome}!

Seu cadastro como "${cargo}" foi realizado com sucesso no sistema JANO de Onboarding Corporativo.

Para acessar o portal e iniciar sua integração, utilize as credenciais temporárias abaixo:
  • Portal: ${process.env.APP_FRONTEND_URL || 'http://localhost:3000/login.html'}
  • E-mail: ${email}
  • Senha Temporária: ${senhaTemporaria}

IMPORTANTE:
No seu primeiro acesso, o sistema exigirá obrigatoriamente a troca desta senha temporária por uma nova senha definitiva e pessoal.

Atenciosamente,
Equipe de Recursos Humanos & Gente e Gestão - JANO
    `.trim();

    const corpoHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #1e3a8a, #0d6efd); padding: 20px; border-radius: 6px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 24px;">⚡ SISTEMA JANO</h2>
            <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">Onboarding Corporativo</p>
        </div>
        <div style="padding: 24px 8px; color: #1e293b; line-height: 1.6;">
            <p style="font-size: 16px;">Olá, <strong>${nome}</strong>!</p>
            <p>Seu cadastro como <strong>${cargo}</strong> foi realizado com sucesso em nosso sistema de integração corporativa.</p>
            <p>Utilize as credenciais temporárias abaixo para realizar seu primeiro acesso:</p>
            
            <div style="background-color: #ffffff; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0;"><strong>Login (E-mail):</strong> <span style="color: #0d6efd;">${email}</span></p>
                <p style="margin: 0;"><strong>Senha Temporária:</strong> <code style="font-size: 16px; font-weight: bold; background: #e0f2fe; padding: 4px 8px; border-radius: 4px; color: #0369a1;">${senhaTemporaria}</code></p>
            </div>

            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; font-size: 14px; color: #92400e;">
                <strong>Atenção:</strong> Por motivos de segurança, você será solicitado(a) a criar uma nova senha definitiva no primeiro acesso.
            </div>

            <div style="text-align: center; margin-top: 28px;">
                <a href="${process.env.APP_FRONTEND_URL || 'http://localhost:3000/login.html'}" style="background-color: #0d6efd; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acessar Portal JANO</a>
            </div>
        </div>
        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #64748b; text-align: center;">
            Este é um e-mail automático gerado pelo Sistema JANO de Onboarding Corporativo.
        </div>
    </div>
    `;

    let erroEnvio = null;
    let codigoErro = null;

    // 1. Envio via Webhook HTTPS (porta 443 - ex: Google Apps Script)
    if (webhookUrl) {
        try {
            const info = await enviarViaWebhookHTTPS({ webhookUrl, email, assunto, corpoTexto, corpoHtml });
            console.log(`📧 [E-mail Real Enviado via HTTPS Webhook]: ID ${info.messageId} para ${email}`);
            return {
                success: true,
                enviado: true,
                modo: 'real',
                messageId: info.messageId,
                deliveredTo: email,
                sentAt: timestamp
            };
        } catch (err) {
            erroEnvio = err.message || 'Falha no envio via EMAIL_WEBHOOK_URL.';
            codigoErro = 'WEBHOOK_ERROR';
            console.error('⚠️ Falha no envio via EMAIL_WEBHOOK_URL:', erroEnvio);
        }
    }

    // 2. Envio via Brevo API HTTPS (porta 443)
    if (brevoApiKey) {
        try {
            const info = await enviarViaBrevoHTTPS({ brevoApiKey, senderEmail, nome, email, assunto, corpoTexto, corpoHtml });
            console.log(`📧 [E-mail Real Enviado via Brevo HTTPS]: ID ${info.messageId} para ${email}`);
            return {
                success: true,
                enviado: true,
                modo: 'real',
                messageId: info.messageId,
                deliveredTo: email,
                sentAt: timestamp
            };
        } catch (err) {
            erroEnvio = err.message || 'Falha no envio via Brevo API.';
            codigoErro = 'BREVO_ERROR';
            console.error('⚠️ Falha no envio via Brevo API:', erroEnvio);
        }
    }

    // 3. Envio via Gmail / SMTP (IPv4 + fallback automático 587 -> 465)
    const transportadores = criarTransportadoresSMTP();
    if (transportadores.length > 0) {
        for (let i = 0; i < transportadores.length; i++) {
            const { label, transporter } = transportadores[i];
            try {
                const info = await transporter.sendMail({
                    from: `"JANO Onboarding" <${senderEmail}>`,
                    to: email,
                    subject: assunto,
                    text: corpoTexto,
                    html: corpoHtml
                });

                console.log(`📧 [E-mail Real Enviado via ${label}]: ID ${info.messageId} para ${email}`);
                return {
                    success: true,
                    enviado: true,
                    modo: 'real',
                    messageId: info.messageId,
                    deliveredTo: email,
                    sentAt: timestamp
                };
            } catch (err) {
                codigoErro = err.code || err.responseCode || null;
                erroEnvio = formatarErroAmigavel(err);
                console.error(`⚠️ Falha no envio via ${label}:`, {
                    mensagem: err.message,
                    codigo: codigoErro,
                    resposta: err.response
                });

                // Se foi erro de autenticação (EAUTH/535), não adianta tentar outra porta
                const isAuthError = codigoErro === 'EAUTH' || codigoErro === 535 || /Invalid login|Username and Password not accepted/i.test(err.message || '');
                if (isAuthError) {
                    break;
                }
            }
        }
    } else if (!erroEnvio) {
        erroEnvio = 'EMAIL_USER e/ou EMAIL_PASS não configurados no arquivo backend/.env.';
        codigoErro = 'EMAIL_NOT_CONFIGURED';
        console.warn(`⚠️ [E-mail] ${erroEnvio} Usando modo simulado no console.`);
    }

    // Modo simulado (fallback quando não há SMTP configurado ou quando o envio falha)
    console.log(`
======================================================================
[DISPARO DE E-MAIL - SISTEMA JANO ONBOARDING] (Modo Simulado / Fallback)
De: ${senderEmail}
Para: ${nome} <${email}>
Assunto: ${assunto}
Data: ${timestamp}
Motivo do fallback: ${erroEnvio}
----------------------------------------------------------------------
${corpoTexto}
======================================================================
    `);

    return {
        success: false,
        enviado: false,
        modo: 'simulado',
        erro: erroEnvio,
        codigoErro,
        deliveredTo: email,
        sentAt: timestamp
    };
}

module.exports = {
    sendTemporaryCredentialsEmail,
    getEmailConfigStatus
};
