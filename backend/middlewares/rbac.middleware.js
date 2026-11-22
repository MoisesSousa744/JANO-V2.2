/**
 * Middleware RBAC (Role-Based Access Control)
 * Restringe acesso de acordo com os perfis cadastrados no JANO:
 * - 'RH'
 * - 'Gestor'
 * - 'Funcionario'
 */
function autorizarPerfis(...perfisPermitidos) {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Usuário não autenticado.'
            });
        }

        const perfilUsuario = req.usuario.perfil;

        if (!perfisPermitidos.includes(perfilUsuario)) {
            return res.status(403).json({
                sucesso: false,
                mensagem: `Acesso negado. Seu perfil (${perfilUsuario}) não possui permissão para executar esta ação. Perfis necessários: [${perfisPermitidos.join(', ')}].`
            });
        }

        next();
    };
}

module.exports = {
    autorizarPerfis
};
