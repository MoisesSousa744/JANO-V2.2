const db = require('../config/database');

/**
 * Controller de Métricas e Dashboards Corporativos
 * Alimenta os painéis gerenciais do RH e do Gestor com estatísticas de onboarding em tempo real
 */

async function getMetricasRH(req, res, next) {
    try {
        const [funcionarios] = await db.query('SELECT id, primeiro_acesso, perfil FROM funcionarios');
        const [equipes] = await db.query('SELECT id FROM equipes');
        const [tarefas] = await db.query('SELECT id, status FROM tarefas');

        const totalColaboradores = funcionarios.length;
        const totalEquipes = equipes.length;
        const totalTarefas = tarefas.length;
        const concluidas = tarefas.filter(t => t.status === 'Concluida').length;
        const pendentes = tarefas.filter(t => t.status === 'Pendente').length;
        const primeiroAcessoPendente = funcionarios.filter(f => f.primeiro_acesso).length;

        const taxaConclusaoGeral = totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 100) : 0;

        res.status(200).json({
            sucesso: true,
            metricas: {
                totalColaboradores,
                totalEquipes,
                totalTarefas,
                concluidas,
                pendentes,
                taxaConclusaoGeral,
                primeiroAcessoPendente
            }
        });
    } catch (error) {
        next(error);
    }
}

async function getMetricasGestor(req, res, next) {
    try {
        const gestorId = req.usuario.id;

        const [equipes] = await db.query('SELECT id, nome, departamento FROM equipes WHERE id_gestor = ?', [gestorId]);
        const equipeIds = equipes.map(e => e.id);

        let membrosCount = 0;
        let tarefas = [];

        if (equipeIds.length > 0) {
            const [membros] = await db.query(
                `SELECT DISTINCT id_funcionario FROM funcionario_equipe WHERE id_equipe IN (?)`,
                [equipeIds]
            );
            membrosCount = membros.length;

            const [tarefasEncontradas] = await db.query(
                `SELECT id, status, prazo FROM tarefas WHERE id_equipe IN (?) OR id_criador = ?`,
                [equipeIds, gestorId]
            );
            tarefas = tarefasEncontradas;
        }

        const totalTarefas = tarefas.length;
        const concluidas = tarefas.filter(t => t.status === 'Concluida').length;
        const pendentes = totalTarefas - concluidas;
        const taxaSucesso = totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 100) : 0;

        res.status(200).json({
            sucesso: true,
            metricas: {
                totalEquipes: equipes.length,
                totalMembros: membrosCount,
                totalTarefas,
                concluidas,
                pendentes,
                taxaSucesso
            }
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getMetricasRH,
    getMetricasGestor
};
