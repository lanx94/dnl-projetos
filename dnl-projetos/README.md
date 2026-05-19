# DNL Projetos — v0.6

Sistema interno desktop completo para Windows. Construído em Electron + React + SQLite.

**v0.6 — CRM, Reuniões, Excel real e PF/PJ**

---

## 🆕 O que mudou na v0.6

### 📊 **Exportação para Excel real (.xlsx)**
- Botão **"📊 Excel"** na página de **Relatório de Horas**
  - Aba 1: Cronômetros detalhados (data, funcionário, projeto, duração)
  - Aba 2: Total por projeto (resumo)
  - Aba 3: Total por funcionário (resumo)
- Botão **"📊 Excel (mês)"** na página de **Ponto**
  - Aba 1: Lista de pontos do mês
  - Aba 2: Resumo diário (entrada, saída, almoço, paradas, horas trabalhadas)
- Formato xlsx nativo (Excel-friendly), com cabeçalhos formatados e linhas congeladas

### 👤 **Cadastro de Cliente PF e PJ**
- Toggle no formulário pra escolher entre **Pessoa Física** ou **Pessoa Jurídica**
- PJ: CNPJ + Inscrição Estadual
- PF: CPF + RG
- Cards na listagem mostram badge "PF" ou "PJ"
- Busca funciona pelo CPF e CNPJ
- Migração automática preserva dados antigos

### 🔍 **Filtro de projetos por cliente**
- Já existia! Mantido na v0.6 (filtro "Cliente" na página Projetos)
- Edição inline do nome do projeto via botão de editar (ícone de lápis no card)

### 📝 **Reuniões dos Sócios** (nova área)
- Menu lateral: **Reuniões**
- Crie reuniões com data, título e tópicos
- Tópicos coloridos (azul, amarelo, rosa, vermelho, lilás, verde, cinza) pra agrupar visualmente
- Marque tópicos como concluídos com 1 clique
- Barra de progresso mostra % de tópicos feitos
- Reordenar tópicos com setas ▲▼

### 🎯 **CRM (Pipeline de Leads/Orçamentos)** (nova área)
- Menu lateral: **CRM**
- Kanban com 7 colunas: **Lead → Reunião → Proposta → Aguardando → Orçamento → Fechado / Perdido**
- **Arraste e solte** cards entre colunas
- Cada card mostra: nome, valor estimado, cliente, responsável, data
- Total de R$ por coluna no topo
- Modal de edição com todos os campos
- Cores estilo Notion (rosa, amarelo, azul, ciano, roxo, verde, vermelho)

---

## ⚡ Como rodar

### Pré-requisitos
- **Node.js 20 LTS** — https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi
- **Visual Studio Build Tools com C++** — https://visualstudio.microsoft.com/visual-cpp-build-tools/

### Passos
1. Extraia o ZIP em uma pasta
2. Abra o **Prompt de Comando** dentro da pasta
3. `npm install` (3-5 min)
4. `npm run electron:dev`

Para gerar o `.exe` instalador, veja **BUILD.md**.

---

## 🔄 Atualizando da v0.5 ou anterior

**Migração automática** detecta colunas faltantes e adiciona sem perder dados.

1. Substitua os arquivos do projeto (mantém o banco em `%APPDATA%\dnl-projetos\` intacto)
2. `npm install`
3. `npm run electron:dev`
4. No primeiro start, vai aparecer no console:
   ```
   [MIGRATION] clientes.tipo_pessoa adicionada
   [MIGRATION] clientes.cpf adicionada
   [MIGRATION] clientes.rg adicionada
   ...
   ```

---

## 👥 Usuários iniciais

### Administrador
- Email: `admin@dnlprojetos.com`
- Senha: `Admin@2025`

### Funcionário de teste
- Email: `teste@dnlprojetos.com`
- Senha: `Teste@2025`

> 🚨 Troque a senha do admin em **Minha Conta** logo no primeiro login.

---

## 📋 Funcionalidades completas

### Para todos os usuários
- ✅ Visão Geral · Feed · Ponto (com export Excel) · Projetos · Cronômetro
- ✅ Diário · Horas (com export Excel) · Base técnica (14 artigos + 6 calculadoras)
- ✅ Minha Conta (trocar senha)

### Admin/RH
- 🛡️ **Painel Admin** — Visão consolidada da equipe
- 👥 **Funcionários** — Cadastro com máscaras
- 🏢 **Clientes** — PF/PJ com toggle, máscaras, representante legal
- 💰 **Financeiro** — Receitas/despesas, categorias
- 📊 **DRE** — Demonstração mensal
- 📜 **Orçamentos** — Geração com itens
- ✍️ **Contratos** — Gerador completo com 7 tipos
- 📅 **Reuniões dos sócios** — Pauta com tópicos coloridos
- 🎯 **CRM** — Pipeline kanban de leads
- 💾 **Backup** — Export/import (admin only)

---

## 🧮 Calculadoras incluídas (6)

1. BTU · 2. Caixa d'água · 3. Disjuntor + Cabo · 4. Esgoto · 5. Carga Elétrica · 6. Gás GLP

## 📚 Artigos pré-cadastrados (14)

Climatização, Hidráulica, Elétrica, Gás, Regularização, Laudos, Normas

---

## ❓ Solução de problemas

### Erro `table contratos has no column named tipo_contrato`
**Resolvido na v0.5.1.** Migração automática.

### Senha admin esquecida
Apague `%APPDATA%\dnl-projetos\dnl-projetos.db` e reinicie.

---

**DNL Projetos** · v0.6 · CRM + Reuniões + Excel + PF/PJ
