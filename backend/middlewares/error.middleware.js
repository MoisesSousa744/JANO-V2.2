/**
 * Middleware centralizado de tratamento de erros
 */
function manipuladorErros(err, req, res, next) {
    console.error(' [Erro na Requisição]:', {
        metodo: req.method,
        url: req.url,
        mensagem: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    const status = err.status || 500;
    const resposta = {
        sucesso: false,
        mensagem: err.message || 'Ocorreu um erro interno no servidor.'
    };

    if (process.env.NODE_ENV === 'development') {
        resposta.detalhes = err.stack;
    }

    res.status(status).json(resposta);
}

module.exports = {
    manipuladorErros
};
