-- =====================================================================
-- SISTEMA JANO - Automação do Processo de Onboarding Corporativo
-- Script de Inicialização DDL e Carga Inicial (Seeds)
-- Banco de Dados: MySQL 8.0+
-- =====================================================================

CREATE DATABASE IF NOT EXISTS jano_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE jano_db;

-- ---------------------------------------------------------------------
-- Desativa checagem de chaves estrangeiras para limpeza segura
-- ---------------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS tarefas;
DROP TABLE IF EXISTS projetos;
DROP TABLE IF EXISTS funcionario_equipe;
DROP TABLE IF EXISTS equipes;
DROP TABLE IF EXISTS funcionarios;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1. TABELA: funcionarios
-- ---------------------------------------------------------------------
CREATE TABLE funcionarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    cargo VARCHAR(100) NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    primeiro_acesso BOOLEAN NOT NULL DEFAULT TRUE,
    perfil ENUM('RH', 'Gestor', 'Funcionario') NOT NULL DEFAULT 'Funcionario',
    id_equipe INT NULL,
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_funcionario_email (email),
    INDEX idx_funcionario_perfil (perfil)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. TABELA: equipes
-- ---------------------------------------------------------------------
CREATE TABLE equipes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    departamento VARCHAR(100) NOT NULL,
    id_gestor INT NOT NULL,
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_equipe_gestor FOREIGN KEY (id_gestor) 
        REFERENCES funcionarios(id) 
        ON UPDATE CASCADE 
        ON DELETE RESTRICT,
    INDEX idx_equipe_gestor (id_gestor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Adiciona a FK id_equipe na tabela funcionarios (com SET NULL caso equipe seja removida)
ALTER TABLE funcionarios
    ADD CONSTRAINT fk_funcionario_equipe_direta FOREIGN KEY (id_equipe)
        REFERENCES equipes(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 3. TABELA: funcionario_equipe (Tabela associativa N:N - RN08)
-- Permite que um colaborador integre múltiplas equipes simultaneamente
-- ---------------------------------------------------------------------
CREATE TABLE funcionario_equipe (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_funcionario INT NOT NULL,
    id_equipe INT NOT NULL,
    data_vinculo DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fe_funcionario FOREIGN KEY (id_funcionario)
        REFERENCES funcionarios(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_fe_equipe FOREIGN KEY (id_equipe)
        REFERENCES equipes(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    UNIQUE KEY uk_funcionario_equipe (id_funcionario, id_equipe)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. TABELA: tarefas (Tarefas de Onboarding)
-- Podem ser atribuídas a um colaborador específico OU para uma equipe inteira
-- ---------------------------------------------------------------------
CREATE TABLE tarefas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT,
    prazo DATE NOT NULL,
    status ENUM('Pendente', 'Concluida') NOT NULL DEFAULT 'Pendente',
    evidencia TEXT NULL,
    anexo_url VARCHAR(255) NULL,
    anexo_nome VARCHAR(255) NULL,
    anexo_tipo VARCHAR(100) NULL,
    evidencia_arquivo_url VARCHAR(255) NULL,
    evidencia_arquivo_nome VARCHAR(255) NULL,
    evidencia_arquivo_tipo VARCHAR(100) NULL,
    data_conclusao DATETIME NULL,
    id_funcionario INT NULL,
    id_equipe INT NULL,
    id_criador INT NULL,
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tarefa_funcionario FOREIGN KEY (id_funcionario)
        REFERENCES funcionarios(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_tarefa_equipe FOREIGN KEY (id_equipe)
        REFERENCES equipes(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_tarefa_criador FOREIGN KEY (id_criador)
        REFERENCES funcionarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    INDEX idx_tarefas_status (status),
    INDEX idx_tarefas_prazo (prazo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. TABELA: projetos
-- ---------------------------------------------------------------------
CREATE TABLE projetos (
    id_projeto INT AUTO_INCREMENT PRIMARY KEY,
    id_equipe INT NOT NULL,
    nome VARCHAR(150) NOT NULL,
    validade DATE,
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_projeto_equipe FOREIGN KEY (id_equipe)
        REFERENCES equipes(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. DADOS INICIAIS (SEEDS)
-- Senhas criptografadas com Bcrypt (salt rounds = 10):
-- rh@jano.com.br          -> Admin@123
-- gestor@jano.com.br      -> Gestor@123
-- mariana.costa@jano.com.br -> Temp@123 (primeiro_acesso = TRUE)
-- lucas.pereira@jano.com.br -> Senha@123 (primeiro_acesso = FALSE)
-- ---------------------------------------------------------------------

-- Inserção de Funcionários Iniciais (RH, Gestor e Funcionários)
INSERT INTO funcionarios (id, nome, cpf, cargo, telefone, email, senha_hash, primeiro_acesso, perfil, data_criacao)
VALUES 
(1, 'Ana Souza (RH Admin)', '111.222.333-44', 'Analista de Recursos Humanos Sênior', '(11) 98765-4321', 'rh@jano.com.br', '$2a$10$qZc8PlwciiLne66tyQxYieWNjuyPBAzwz85FMYu7nLOKJ1GYv24Jy', FALSE, 'RH', NOW()),
(2, 'Carlos Alberto Gestor', '222.333.444-55', 'Gerente de Engenharia de Software', '(11) 97654-3210', 'gestor@jano.com.br', '$2a$10$NGrPYezkI7bswWlEHjhq2uJSELCzYYsHaHvw1XjJdt7PqymWvper6', FALSE, 'Gestor', NOW()),
(3, 'Mariana Costa', '333.444.555-66', 'Desenvolvedora Full-Stack Júnior', '(11) 96543-2109', 'mariana.costa@jano.com.br', '$2a$10$INFktczxsFmVtK7BQ42oSu0j0RfZC1MFWZoYuVvNrJOv89kwxwgnS', TRUE, 'Funcionario', NOW()),
(4, 'Lucas Pereira', '444.555.666-77', 'Designer de Produto UI/UX', '(11) 95432-1098', 'lucas.pereira@jano.com.br', '$2a$10$3Y3e5NQPMncvZLr05AE.LedEiqMpiM0.bbziADurAHxdoA29.m8e2', FALSE, 'Funcionario', NOW());

-- Inserção de Equipes Iniciais
INSERT INTO equipes (id, nome, departamento, id_gestor, data_criacao)
VALUES 
(1, 'Engenharia de Plataforma', 'Tecnologia', 2, NOW()),
(2, 'Design & Experiência', 'Produto', 2, NOW());

-- Associação de Funcionários às Equipes
INSERT INTO funcionario_equipe (id_funcionario, id_equipe)
VALUES
(3, 1), -- Mariana na equipe de Engenharia
(4, 1), -- Lucas na equipe de Engenharia
(4, 2); -- Lucas também na equipe de Design (suporte a múltiplas equipes)

-- Atualização da equipe padrão/principal de cada funcionário
UPDATE funcionarios SET id_equipe = 1 WHERE id IN (3, 4);

-- Inserção de Projetos Iniciais
INSERT INTO projetos (id_projeto, id_equipe, nome, validade, data_criacao)
VALUES 
(1, 1, 'Portal Onboarding V1', DATE_ADD(CURDATE(), INTERVAL 60 DAY), NOW()),
(2, 2, 'Design System Corporativo JANO', DATE_ADD(CURDATE(), INTERVAL 90 DAY), NOW());

-- Inserção de Tarefas Iniciais de Onboarding
INSERT INTO tarefas (titulo, descricao, prazo, status, evidencia, id_funcionario, id_equipe, id_criador, data_criacao)
VALUES 
('Configurar Ambiente de Desenvolvimento', 'Clonar repositórios git, instalar Node.js 20+, configurar chaves SSH e rodar o projeto localmente.', DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'Pendente', NULL, 3, 1, 2, NOW()),
('Leitura do Manual de Conduta e Cultura', 'Ler o documento de Cultura da Empresa e preencher o quiz de conformidade no portal interno.', DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'Pendente', NULL, 3, NULL, 2, NOW()),
('Apresentação com o Time de Engenharia', 'Reunião de alinhamento 1:1 com o gestor e equipe de desenvolvimento via Google Meet.', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Concluida', 'Reunião realizada com sucesso em 16/11/2026. Ata de reunião no link https://meet.google.com/abc-defg-hij', 4, 1, 2, DATE_SUB(NOW(), INTERVAL 2 DAY)),
('Treinamento de Segurança da Informação (LGPD)', 'Assistir às 4 videoaulas obrigatórias e submeter o certificado de conclusão.', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'Pendente', NULL, 4, 2, 2, NOW());
