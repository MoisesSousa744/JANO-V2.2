const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const { initDatabase } = require('./config/database');
const { manipuladorErros } = require('./middlewares/error.middleware');
const { getEmailConfigStatus } = require('./utils/email.service');

// Importação das rotas
const authRoutes = require('./routes/auth.routes');
const authController = require('./controllers/auth.controller');
const funcionariosRoutes = require('./routes/funcionarios.routes');
const equipesRoutes = require('./routes/equipes.routes');
const tarefasRoutes = require('./routes/tarefas.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const perfilRoutes = require('./routes/perfil.routes');
const gestorRoutes = require('./routes/gestor.routes');
const { autenticarToken } = require('./middlewares/auth.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de CORS e Parsers
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve arquivos enviados (PDFs e Vídeos de tarefas)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve arquivos estáticos do Front-end (permitindo rodar tudo unificado ou independente)
app.use(express.static(path.join(__dirname, '../frontend')));

// Health check para monitoramento de deploy (ex: Render)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        sistema: 'JANO Onboarding API',
        versao: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Aliases diretos para compatibilidade com especificações (/api/login e /api/alterar-senha)
app.post('/api/login', authController.login);
app.post('/api/alterar-senha', autenticarToken, authController.alterarSenha);

// Rotas da API REST
app.use('/api/auth', authRoutes);
app.use('/api/funcionarios', funcionariosRoutes);
app.use('/api/equipes', equipesRoutes);
app.use('/api/tarefas', tarefasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/gestor', gestorRoutes);

// Fallback de rota para frontend SPA/estático se não for /api
app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api')) {
        return res.status(404).json({
            sucesso: false,
            mensagem: `Rota não encontrada: ${req.method} ${req.url}`
        });
    }
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Middleware global de tratamento de erros
app.use(manipuladorErros);

// Inicialização do servidor
async function startServer() {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            const emailCfg = getEmailConfigStatus();
            console.log(`====================================================`);
            console.log(`🚀 SERVIDOR JANO ONBOARDING INICIADO COM SUCESSO!`);
            console.log(`📡 Porta: ${PORT}`);
            console.log(`🌐 URL Local: http://localhost:${PORT}`);
            console.log(`📋 API Health: http://localhost:${PORT}/api/health`);
            if (emailCfg.configured) {
                console.log(`📧 E-mail: ATIVO via ${emailCfg.provider} (${emailCfg.user})`);
            } else {
                console.log(`⚠️  E-mail: MODO SIMULADO (configure EMAIL_USER e EMAIL_PASS no backend/.env)`);
            }
            console.log(`====================================================`);
        });
    } catch (err) {
        console.error('Falha crítica ao iniciar o servidor JANO:', err);
        process.exit(1);
    }
}

startServer();

module.exports = app;
