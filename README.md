# ⚡ JANO - Sistema de Automatização do Processo de Onboarding Corporativo

> **Trabalho de Conclusão de Curso (TCC)**  
> **Instituição:** Centro Estadual de Educação Tecnológica Paula Souza - ETEC São Mateus  
> **Curso:** Técnico em Desenvolvimento de Sistemas Integrado ao Ensino Médio (MTEC)  
> **Versão:** 1.0.0 (MVP)

---

## 📋 Sumário
1. [Sobre o Projeto](#-sobre-o-projeto)
2. [Stack Tecnológica](#-stack-tecnológica)
3. [Arquitetura e Organização de Pastas](#-arquitetura-e-organização-de-pastas)
4. [Atores e Níveis de Acesso (RBAC)](#-atores-e-níveis-de-acesso-rbac)
5. [Modelo de Banco de Dados (MySQL)](#-modelo-de-banco-de-dados-mysql)
6. [Regras de Negócio e Casos de Uso](#-regras-de-negócio-e-casos-de-uso)
7. [Como Executar o Projeto Localmente](#-como-executar-o-projeto-localmente)
8. [Credenciais de Teste / Demonstração](#-credenciais-de-teste--demonstração)
9. [Instruções para Deploy (Render & Vercel)](#-instruções-para-deploy-render--vercel)

---

## 🎯 Sobre o Projeto

O **JANO** é uma plataforma corporativa desenvolvida para padronizar, automatizar e centralizar as etapas de integração de novos colaboradores nas organizações. O sistema resolve gargalos operacionais comuns em processos de contratação manuais, tais como:
- Demora na liberação de credenciais de acesso;
- Desorganização e perda de evidências de cumprimento das etapas;
- Falhas de comunicação entre Recursos Humanos, Gestores de Área e Colaboradores.

---

## 🛠 Stack Tecnológica

*   **Front-end:** HTML5, CSS3, Vanilla JavaScript (ES6+ modular), Bootstrap 5.3. NENHUM framework reativo pesado (atendendo à restrição técnica de ser estático e facilmente hospedado em CDNs/Vercel).
*   **Back-end:** Node.js com Express em arquitetura Clean Code e padrão MVC (Controllers, Middlewares, Routes, Services).
*   **Banco de Dados:** MySQL 8.0+ com pool de conexões otimizado (`mysql2/promise`) e fallback transparente de desenvolvimento em memória caso o MySQL não esteja instalado localmente.
*   **Segurança & Autenticação:** JWT (JSON Web Tokens) com expiração configurável e hash de senhas via **Bcrypt** (salt rounds = 10).

---

## 📁 Arquitetura e Organização de Pastas

```text
jano/
├── database/
│   └── schema.sql                # Script DDL completo MySQL (tabelas, FKs e seeds com Bcrypt)
├── backend/
│   ├── package.json              # Dependências do servidor (express, bcryptjs, jsonwebtoken, mysql2, cors, dotenv)
│   ├── .env.example              # Modelo de variáveis de ambiente
│   ├── .env                      # Variáveis locais ativas
│   ├── server.js                 # Ponto de entrada do Express (configurado para Render e estáticos)
│   ├── config/
│   │   └── database.js           # Gerenciador de conexão MySQL e fallback de desenvolvimento
│   ├── controllers/
│   │   ├── auth.controller.js    # Login, troca obrigatória de senha e perfil do usuário
│   │   ├── funcionarios.controller.js # Cadastro pelo RH, geração de senha temp e desligamento
│   │   ├── equipes.controller.js # Criação de times, alocação e desvinculação de membros
│   │   ├── tarefas.controller.js # Atribuição (por pessoa/equipe), listagem e entrega com evidência
│   │   └── dashboard.controller.js # Métricas analíticas do RH e de liderança
│   ├── middlewares/
│   │   ├── auth.middleware.js    # Validação do JWT e bloqueio estrito de Primeiro Acesso (RN03)
│   │   ├── rbac.middleware.js    # Controle de autorização baseado em papéis (RH, Gestor, Funcionario)
│   │   └── error.middleware.js   # Tratador centralizado de exceções HTTP
│   └── utils/
│       ├── password.generator.js # Gerador seguro de senhas temporárias aleatórias (RF02)
│       └── email.simulator.js    # Simulador de disparo de e-mails corporativos (RF03)
├── frontend/
│   ├── vercel.json               # Configuração de roteamento e proxy reverso para Vercel
│   ├── index.html                # Roteador inicial dinâmico
│   ├── login.html                # Tela de autenticação com botões de atalho para banca examinadora
│   ├── alterar-senha.html        # Tela de primeiro acesso obrigatório (RN03 / RF05)
│   ├── dashboard-rh.html         # Painel administrativo do RH (quadro de pessoas e desligamento)
│   ├── dashboard-gestor.html     # Painel de equipes, membros e atribuição de tarefas de onboarding
│   ├── dashboard-funcionario.html# Portal do colaborador com cards de tarefas e entrega de evidências
│   ├── css/
│   │   └── style.css             # Tema corporativo em tons de azul (#0d6efd, #1e3a8a, #f8fafc)
│   └── js/
│       ├── api.js                # Cliente HTTP modular (Fetch API + interceptores de token)
│       ├── auth.js               # Gerenciador de sessão, Route Guards e RBAC no front-end
│       ├── components.js         # Componentização Vanilla JS (Navbar dinâmica, toasts e footer)
│       ├── login.js              # Lógica de login
│       ├── alterar-senha.js      # Lógica de alteração obrigatória de senha
│       ├── dashboard-rh.js       # Lógica do painel de Recursos Humanos
│       ├── dashboard-gestor.js   # Lógica do painel do Gestor
│       └── dashboard-funcionario.js # Lógica do portal do Colaborador
└── render.yaml                   # Configuração de Deploy em um clique no Render
```

---

## 👥 Atores e Níveis de Acesso (RBAC)

1.  **Profissional de RH (Admin):**
    *   Cadastra novos colaboradores no sistema (RF01).
    *   O sistema gera senha temporária automática (RF02) e simula o envio por e-mail (RF03).
    *   Efetua o desligamento/exclusão de colaboradores (RF15 / RN01 / RN07).
    *   Acompanha indicadores gerais do onboarding corporativo (taxa global de conclusão, colaboradores ativos e equipes).

2.  **Gestor de Equipe:**
    *   Cria equipes de trabalho por departamento (RF10).
    *   Aloca colaboradores em equipes (RF11 / RN08 - suporta múltiplas equipes por pessoa).
    *   Remove colaboradores da equipe (RF13 / RN05).
    *   Atribui tarefas de integração a um colaborador específico ou à equipe inteira (RF06 / RF07).
    *   Audita e acompanha o cumprimento das tarefas e as evidências submetidas.

3.  **Funcionário (Novo Colaborador):**
    *   Realiza o primeiro acesso e é obrigado a substituir a senha temporária (RF04, RF05, RN03).
    *   Visualiza exclusivamente as tarefas atribuídas a ele ou à sua equipe (RF08, RN04).
    *   Marca tarefas como 'Concluída' e envia comprovante/evidência em formato de texto explicativo ou link de repositório/documento (RF09, RN04).

---

## 🗄 Modelo de Banco de Dados (MySQL)

O modelo relacional foi projetado em 3ª Forma Normal (3FN), contendo as tabelas:
*   `funcionarios`: Armazena dados cadastrais, hash Bcrypt da senha, perfil RBAC, flag de primeiro acesso e equipe principal.
*   `equipes`: Armazena o departamento, nome e chave estrangeira para o Gestor responsável.
*   `funcionario_equipe`: Tabela associativa N:N que atende à **RN08**, permitindo que um mesmo colaborador integre múltiplos times simultaneamente.
*   `tarefas`: Tarefas de integração contendo título, descrição, prazo, status ('Pendente' | 'Concluida'), campo de evidência e vínculo opcional com funcionário ou equipe inteira.
*   `projetos`: Registro dos projetos e iniciativas vinculados aos times.

O script DDL completo com constraints e sementes iniciais está em:
👉 [`database/schema.sql`](file:///home/antigravity/jano/database/schema.sql)

---

## 🔑 Credenciais de Teste / Demonstração

Para facilitar a avaliação da banca examinadora, a tela de login já possui botões de clique rápido com as seguintes contas pré-configuradas:

| Ator | E-mail | Senha | Comportamento no Login |
| :--- | :--- | :--- | :--- |
| **RH (Admin)** | `rh@jano.com.br` | `Admin@123` | Direciona direto para `dashboard-rh.html` |
| **Gestor** | `gestor@jano.com.br` | `Gestor@123` | Direciona direto para `dashboard-gestor.html` |
| **1º Acesso Pendente** | `mariana.costa@jano.com.br` | `Temp@123` | **Bloqueia painéis e força ir para `alterar-senha.html` (RN03)** |
| **Colaborador Ativo** | `lucas.pereira@jano.com.br` | `Senha@123` | Direciona direto para `dashboard-funcionario.html` |

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
*   **Node.js 18+** instalado.
*   **MySQL Server** (opcional: caso não tenha MySQL ativo, o sistema iniciará automaticamente com o modo **Fallback em Memória**, permitindo testar tudo imediatamente).

### Passo a Passo

1. **Clonar ou acessar a pasta do projeto:**
   ```bash
   cd /home/antigravity/jano/backend
   ```

2. **Instalar as dependências:**
   ```bash
   npm install
   ```

3. **Configurar o Banco de Dados (Opcional se usar MySQL):**
   * Crie o banco executando o script `database/schema.sql`:
     ```bash
     mysql -u root -p < ../database/schema.sql
     ```
   * Configure suas credenciais no arquivo `backend/.env`.

4. **Iniciar o Servidor:**
   ```bash
   npm start
   ```
   * O servidor iniciará em `http://localhost:3000`.

5. **Acessar a Aplicação:**
   * Abra no navegador: **`http://localhost:3000/login.html`**
   * Todas as páginas HTML, estilos CSS e scripts JS serão servidos de forma integrada!

---

## 🌐 Instruções para Deploy (Render & Vercel)

### 1. Deploy do Back-end no Render
1. Conecte o repositório GitHub no [Render.com](https://render.com).
2. Selecione **Web Service** apontando para o diretório `backend`.
3. Configure os comandos:
   * **Build Command:** `npm install`
   * **Start Command:** `node server.js`
4. Adicione as variáveis de ambiente baseadas no `.env.example` (incluindo as credenciais do seu banco MySQL gerenciado, como Aiven, PlanetScale ou Railway).
5. (Ou utilize o arquivo `render.yaml` para deploy automático via Blueprint).

### 2. Deploy do Front-end na Vercel
1. Conecte o repositório na [Vercel.com](https://vercel.com).
2. Defina o **Root Directory** como `frontend`.
3. Como o projeto é baseado em arquivos estáticos (HTML/CSS/JS Vanilla), não é necessário nenhum comando de build (`Framework Preset: Other`).
4. O arquivo `frontend/vercel.json` já está preparado com as regras de rewrite e proxy reverso para apontar chamadas `/api/*` diretamente para o seu back-end no Render.
