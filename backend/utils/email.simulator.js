/**
 * Simulador de envio de e-mails para credenciais de Onboarding
 * Atende ao RF03: O sistema deverá enviar as credenciais temporárias para o e-mail cadastrado do novo funcionário.
 */

async function sendTemporaryCredentialsEmail({ nome, email, senhaTemporaria, cargo }) {
    const timestamp = new Date().toISOString();
    
    const emailPayload = {
        to: email,
        from: 'no-reply@jano-onboarding.corp',
        subject: 'Bem-vindo ao JANO! Suas credenciais de acesso corporativo',
        timestamp,
        content: `
======================================================================
[SIMULAÇÃO DE DISPARO DE E-MAIL - SISTEMA JANO ONBOARDING]
Para: ${nome} <${email}>
Assunto: Bem-vindo(a) à empresa! Suas credenciais temporárias de acesso
----------------------------------------------------------------------
Olá, ${nome}!

Seu cadastro como "${cargo}" foi realizado com sucesso em nosso sistema de integração.
Para iniciar sua jornada de onboarding corporativo, acesse o portal JANO com as seguintes credenciais:

  Portal: http://localhost:5500/login.html
  Login (E-mail): ${email}
  Senha Temporária: ${senhaTemporaria}

IMPORTANTE:
Por razões de segurança corporativa, este é o seu primeiro acesso e o sistema
exigirá obrigatoriamente a substituição desta senha temporária por uma nova senha pessoal definitiva.

Atenciosamente,
Equipe de Recursos Humanos & Gente e Gestão
======================================================================
        `
    };

    console.log(emailPayload.content);
    return {
        success: true,
        deliveredTo: email,
        sentAt: timestamp
    };
}

module.exports = {
    sendTemporaryCredentialsEmail
};
