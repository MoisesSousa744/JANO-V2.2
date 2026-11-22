const jwt = require('jsonwebtoken');

/**
 * Middleware de Autenticação JWT
 * Valida o token e impõe a regra de Primeiro Acesso (RN03):
 * Se primeiro_acesso for true, bloqueia o acesso a qualquer recurso do sistema
 * exceto as rotas permitidas para a troca obrigatória de senha.
 */
function autenticarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Token de autenticação não fornecido. Faça login para continuar.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jano_secret_key_super_segura_jwt_2026_etec_onboarding');
        req.usuario = decoded;

        // Regra de Negócio RN03: Bloquear acesso se for primeiro acesso e não for troca de senha
        const rotaAtual = (req.originalUrl || req.url || '').split('?')[0];
        const rotasPermitidasPrimeiroAcesso = [
            '/api/auth/alterar-senha',
            '/api/alterar-senha',
            '/api/perfil/senha',
            '/api/auth/me',
            '/api/auth/logout'
        ];

        const isRotaPermitida = rotasPermitidasPrimeiroAcesso.some(rota => rotaAtual === rota || rotaAtual.startsWith(rota));

        if (req.usuario.primeiro_acesso && !isRotaPermitida) {
            return res.status(403).json({
                sucesso: false,
                primeiro_acesso: true,
                primeiroAcesso: true,
                codigo: 'PRIMEIRO_ACESSO_OBRIGATORIO',
                mensagem: 'Primeiro acesso detectado. É obrigatório alterar sua senha temporária antes de navegar no sistema.',
                redirecionarPara: '/alterar-senha.html'
            });
        }

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                sucesso: false,
                codigo: 'TOKEN_EXPIRADO',
                mensagem: 'Sua sessão expirou. Faça login novamente.'
            });
        }
        return res.status(403).json({
            sucesso: false,
            mensagem: 'Token de autenticação inválido.'
        });
    }
}

module.exports = {
    autenticarToken
};
