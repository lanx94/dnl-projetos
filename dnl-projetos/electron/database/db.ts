import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

bcrypt.setRandomFallback((len: number) => {
  const buf = crypto.randomBytes(len)
  return Array.from(buf)
})

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    const userData = app.getPath('userData')
    if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true })
    const dbPath = path.join(userData, 'dnl-projetos.db')
    console.log('[DB] Caminho do banco:', dbPath)
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    seedInitialData(db)
  }
  return db
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      nome TEXT NOT NULL,
      cargo TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'rh', 'funcionario')),
      cpf TEXT,
      telefone TEXT,
      data_admissao TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS pontos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada','almoco_inicio','almoco_fim','saida','parada_inicio','parada_fim')),
      timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      observacao TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_pontos_usuario_data ON pontos(usuario_id, timestamp);

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_pessoa TEXT NOT NULL DEFAULT 'juridica' CHECK(tipo_pessoa IN ('fisica','juridica')),
      nome TEXT NOT NULL,
      email TEXT,
      telefone TEXT,
      cnpj TEXT,
      inscricao_estadual TEXT,
      cpf TEXT,
      rg TEXT,
      endereco TEXT,
      contato_responsavel TEXT,
      observacoes TEXT,
      representante_nome TEXT,
      representante_nacionalidade TEXT,
      representante_naturalidade TEXT,
      representante_estado_civil TEXT,
      representante_profissao TEXT,
      representante_rg TEXT,
      representante_cpf TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS projetos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      descricao TEXT,
      status TEXT NOT NULL DEFAULT 'em_andamento'
        CHECK(status IN ('planejamento','em_andamento','pausado','concluido','cancelado')),
      revisao_atual TEXT NOT NULL DEFAULT 'R00',
      data_inicio TEXT,
      data_prevista_fim TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS projeto_funcionario (
      projeto_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      PRIMARY KEY (projeto_id, usuario_id),
      FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cronometros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      projeto_id INTEGER NOT NULL,
      inicio TEXT NOT NULL,
      fim TEXT,
      observacao TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_cronometros_usuario ON cronometros(usuario_id, inicio);

    CREATE TABLE IF NOT EXISTS relatorios_diarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      revisao TEXT NOT NULL,
      projeto_id INTEGER,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE (usuario_id, data),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      autor_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('aviso','comunicado','pessoal','aniversario','reuniao')),
      titulo TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      global INTEGER NOT NULL DEFAULT 0,
      data_evento TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_eventos_global_data ON eventos(global, criado_em DESC);

    CREATE TABLE IF NOT EXISTS categorias_financeiras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('receita','despesa')),
      cor TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(nome, tipo)
    );

    CREATE TABLE IF NOT EXISTS lancamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK(tipo IN ('receita','despesa')),
      descricao TEXT NOT NULL,
      valor REAL NOT NULL,
      categoria_id INTEGER,
      projeto_id INTEGER,
      cliente_id INTEGER,
      data TEXT NOT NULL,
      pago INTEGER NOT NULL DEFAULT 0,
      observacoes TEXT,
      criado_por_id INTEGER NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (categoria_id) REFERENCES categorias_financeiras(id) ON DELETE SET NULL,
      FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE SET NULL,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
      FOREIGN KEY (criado_por_id) REFERENCES usuarios(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos(data);
    CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo ON lancamentos(tipo);

    -- FASE 3 ---------------------------------------------------

    CREATE TABLE IF NOT EXISTS artigos_conhecimento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria TEXT NOT NULL CHECK(categoria IN ('climatizacao','hidraulica','eletrica','gas','estrutural','regularizacao','laudos','normas','outro')),
      titulo TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      tags TEXT,
      autor_id INTEGER NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_artigos_categoria ON artigos_conhecimento(categoria);

    CREATE TABLE IF NOT EXISTS orcamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      cliente_id INTEGER NOT NULL,
      projeto_id INTEGER,
      titulo TEXT NOT NULL,
      descricao TEXT,
      status TEXT NOT NULL DEFAULT 'rascunho'
        CHECK(status IN ('rascunho','enviado','aprovado','rejeitado','expirado')),
      data_emissao TEXT NOT NULL DEFAULT (date('now', 'localtime')),
      validade_dias INTEGER NOT NULL DEFAULT 30,
      desconto_percentual REAL NOT NULL DEFAULT 0,
      forma_pagamento TEXT,
      prazo_execucao TEXT,
      observacoes TEXT,
      criado_por_id INTEGER NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
      FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE SET NULL,
      FOREIGN KEY (criado_por_id) REFERENCES usuarios(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS itens_orcamento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orcamento_id INTEGER NOT NULL,
      ordem INTEGER NOT NULL DEFAULT 0,
      descricao TEXT NOT NULL,
      quantidade REAL NOT NULL DEFAULT 1,
      unidade TEXT NOT NULL DEFAULT 'un',
      valor_unitario REAL NOT NULL DEFAULT 0,
      valor_total REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_itens_orc ON itens_orcamento(orcamento_id, ordem);

    CREATE TABLE IF NOT EXISTS contratos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      tipo_contrato TEXT NOT NULL DEFAULT 'generico'
        CHECK(tipo_contrato IN ('laudo_vizinhanca','eletrica','hidraulica','gas','regularizacao','manual_proprietario','generico')),
      cliente_id INTEGER NOT NULL,
      projeto_id INTEGER,
      orcamento_id INTEGER,
      titulo TEXT NOT NULL,
      objeto TEXT NOT NULL,
      endereco_imovel TEXT,
      valor REAL NOT NULL DEFAULT 0,
      valor_extenso TEXT,
      servicos_json TEXT NOT NULL DEFAULT '[]',
      parcelas_json TEXT NOT NULL DEFAULT '[]',
      multa_percentual TEXT,
      juros_diario TEXT,
      forma_pagamento TEXT,
      prazo_execucao TEXT,
      data_inicio TEXT,
      data_fim TEXT,
      cidade TEXT NOT NULL DEFAULT 'São Paulo',
      data_assinatura TEXT,
      clausulas_json TEXT NOT NULL DEFAULT '[]',
      observacoes TEXT,
      status TEXT NOT NULL DEFAULT 'rascunho'
        CHECK(status IN ('rascunho','aguardando_assinatura','ativo','concluido','cancelado')),
      criado_por_id INTEGER NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
      FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE SET NULL,
      FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE SET NULL,
      FOREIGN KEY (criado_por_id) REFERENCES usuarios(id) ON DELETE RESTRICT
    );

    -- Tabela de cláusulas padrão por tipo de contrato
    CREATE TABLE IF NOT EXISTS clausulas_padrao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_contrato TEXT NOT NULL
        CHECK(tipo_contrato IN ('laudo_vizinhanca','eletrica','hidraulica','gas','regularizacao','manual_proprietario','generico')),
      clausula_id TEXT NOT NULL,
      secao TEXT NOT NULL,
      rotulo TEXT NOT NULL,
      texto TEXT NOT NULL,
      essencial INTEGER NOT NULL DEFAULT 0,
      ordem INTEGER NOT NULL DEFAULT 0,
      ativa INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE (tipo_contrato, clausula_id)
    );
    CREATE INDEX IF NOT EXISTS idx_clausulas_tipo ON clausulas_padrao(tipo_contrato, ordem);

    -- Reuniões dos sócios
    CREATE TABLE IF NOT EXISTS reunioes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT (date('now', 'localtime')),
      observacoes TEXT,
      criado_por_id INTEGER NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (criado_por_id) REFERENCES usuarios(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS reuniao_topicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reuniao_id INTEGER NOT NULL,
      texto TEXT NOT NULL,
      cor TEXT NOT NULL DEFAULT 'azul',
      ordem INTEGER NOT NULL DEFAULT 0,
      concluido INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (reuniao_id) REFERENCES reunioes(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_reuniao_topicos ON reuniao_topicos(reuniao_id, ordem);

    -- CRM (Pipeline de Leads/Orçamentos)
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'lead'
        CHECK(status IN ('lead','reuniao','proposta','aguardando','orcamento','fechado','perdido')),
      valor_estimado REAL NOT NULL DEFAULT 0,
      responsavel_id INTEGER,
      cliente_id INTEGER,
      contatado_em TEXT,
      data_alvo TEXT,
      observacoes TEXT,
      ordem INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (responsavel_id) REFERENCES usuarios(id) ON DELETE SET NULL,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_leads_status_ordem ON leads(status, ordem);
  `)

  // Migração: adiciona colunas que faltam em bancos antigos (v0.4 → v0.5)
  migrarColunasNovas(db)
}

function migrarColunasNovas(db: Database.Database) {
  // Helper: verifica se a coluna existe
  function temColuna(tabela: string, coluna: string): boolean {
    const info = db.prepare(`PRAGMA table_info(${tabela})`).all() as Array<{ name: string }>
    return info.some((c) => c.name === coluna)
  }

  function adicionar(tabela: string, coluna: string, definicao: string) {
    if (!temColuna(tabela, coluna)) {
      try {
        db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`)
        console.log(`[MIGRATION] ${tabela}.${coluna} adicionada`)
      } catch (e: any) {
        console.warn(`[MIGRATION] Erro ao adicionar ${tabela}.${coluna}:`, e.message)
      }
    }
  }

  // Migração da tabela clientes (campos de representante legal)
  adicionar('clientes', 'representante_nome', 'TEXT')
  adicionar('clientes', 'representante_nacionalidade', 'TEXT')
  adicionar('clientes', 'representante_naturalidade', 'TEXT')
  adicionar('clientes', 'representante_estado_civil', 'TEXT')
  adicionar('clientes', 'representante_profissao', 'TEXT')
  adicionar('clientes', 'representante_rg', 'TEXT')
  adicionar('clientes', 'representante_cpf', 'TEXT')

  // Migração v0.6: tipo de pessoa (PF/PJ)
  adicionar('clientes', 'tipo_pessoa', "TEXT NOT NULL DEFAULT 'juridica'")
  adicionar('clientes', 'cpf', 'TEXT')
  adicionar('clientes', 'rg', 'TEXT')
  adicionar('clientes', 'inscricao_estadual', 'TEXT')

  // Migração da tabela contratos (v0.5 - gerador completo)
  // Como o CHECK constraint do tipo_contrato é novo, o ALTER TABLE não consegue
  // adicionar com CHECK. Solucionamos: adicionar como TEXT simples e aceitamos
  // o trade-off (validação fica no handler em runtime).
  adicionar('contratos', 'tipo_contrato', "TEXT NOT NULL DEFAULT 'generico'")
  adicionar('contratos', 'endereco_imovel', 'TEXT')
  adicionar('contratos', 'valor_extenso', 'TEXT')
  adicionar('contratos', 'servicos_json', "TEXT NOT NULL DEFAULT '[]'")
  adicionar('contratos', 'parcelas_json', "TEXT NOT NULL DEFAULT '[]'")
  adicionar('contratos', 'multa_percentual', 'TEXT')
  adicionar('contratos', 'juros_diario', 'TEXT')
  adicionar('contratos', 'cidade', "TEXT NOT NULL DEFAULT 'São Paulo'")
  adicionar('contratos', 'data_assinatura', 'TEXT')

  // Coluna 'clausulas' antiga (TEXT NOT NULL DEFAULT '') -> nova é clausulas_json
  // Estratégia: adicionamos clausulas_json como nova coluna; a antiga 'clausulas'
  // permanece (mas é ignorada no novo handler).
  adicionar('contratos', 'clausulas_json', "TEXT NOT NULL DEFAULT '[]'")
}

function seedInitialData(db: Database.Database) {
  const userCount = db.prepare('SELECT COUNT(*) as n FROM usuarios').get() as { n: number }
  if (userCount.n === 0) {
    const senhaAdmin = bcrypt.hashSync('Admin@2025', 10)
    db.prepare(
      `INSERT INTO usuarios (email, senha_hash, nome, cargo, role) VALUES (?, ?, ?, ?, ?)`
    ).run('admin@dnlprojetos.com', senhaAdmin, 'Administrador', 'Diretor', 'admin')

    const senhaTeste = bcrypt.hashSync('Teste@2025', 10)
    db.prepare(
      `INSERT INTO usuarios (email, senha_hash, nome, cargo, role, data_admissao)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      'teste@dnlprojetos.com',
      senhaTeste,
      'João da Silva',
      'Engenheiro Civil',
      'funcionario',
      '2024-01-15'
    )

    console.log('[DB] Usuário admin criado: admin@dnlprojetos.com / Admin@2025')
    console.log('[DB] Funcionário teste criado: teste@dnlprojetos.com / Teste@2025')

    db.prepare(`INSERT INTO clientes (nome, email) VALUES (?, ?)`).run(
      'DNL Projetos (Interno)',
      'contato@dnlprojetos.com'
    )
  }

  const catCount = db.prepare('SELECT COUNT(*) as n FROM categorias_financeiras').get() as {
    n: number
  }
  if (catCount.n === 0) {
    const cats: Array<[string, 'receita' | 'despesa', string]> = [
      ['Projetos', 'receita', '#5D7B4A'],
      ['Consultoria', 'receita', '#4A6238'],
      ['Outras receitas', 'receita', '#9CAF8A'],
      ['Folha de pagamento', 'despesa', '#C75D2C'],
      ['Aluguel', 'despesa', '#A84A1F'],
      ['Software/Licenças', 'despesa', '#D8825A'],
      ['Material de escritório', 'despesa', '#E8C9B8'],
      ['Impostos', 'despesa', '#7E3815'],
      ['Outras despesas', 'despesa', '#9A9A95']
    ]
    const stmt = db.prepare(
      'INSERT INTO categorias_financeiras (nome, tipo, cor) VALUES (?, ?, ?)'
    )
    for (const [nome, tipo, cor] of cats) stmt.run(nome, tipo, cor)
    console.log('[DB] Categorias financeiras padrão criadas')
  }

  // Seed dos artigos da base de conhecimento
  const artCount = db.prepare('SELECT COUNT(*) as n FROM artigos_conhecimento').get() as {
    n: number
  }
  if (artCount.n === 0) {
    const adminId = (
      db.prepare("SELECT id FROM usuarios WHERE role = 'admin' LIMIT 1").get() as { id: number }
    )?.id
    if (adminId) {
      const artigos = [
        {
          categoria: 'climatizacao',
          titulo: 'Cálculo de BTU para Ar-Condicionado',
          tags: 'btu, ar condicionado, climatização, dimensionamento',
          conteudo: `## Como dimensionar a capacidade do ar-condicionado

A capacidade do ar-condicionado é medida em BTU/h (British Thermal Units por hora). Calcular corretamente é fundamental para garantir conforto térmico e eficiência energética.

### Fórmula simplificada

**BTU base = Área (m²) × 600**

A esse valor base, adicione:
- **+ 600 BTU** para cada pessoa adicional além da segunda
- **+ 600 BTU** para cada equipamento eletrônico (TV, computador, etc.)
- **+ 800 BTU** se o ambiente recebe sol direto
- **+ 400 BTU** para cada janela
- **+ 1.000 BTU** se a cozinha possuir fogão

### Tabela rápida (residencial sem sol direto, 2 pessoas)

| Área (m²) | BTU/h recomendado |
|-----------|-------------------|
| Até 10    | 7.500             |
| 11 a 15   | 9.000             |
| 16 a 20   | 12.000            |
| 21 a 25   | 18.000            |
| 26 a 35   | 22.000 a 24.000   |
| 36 a 45   | 30.000            |
| 46 a 60   | 36.000            |

### Pé-direito alto

Para pé-direito acima de 3 metros, multiplicar a área pelo fator de correção:
- 3,0 a 3,5 m → fator 1,15
- 3,5 a 4,0 m → fator 1,25
- Acima de 4,0 m → cálculo volumétrico

### Recomendações

1. Em ambientes comerciais, somar carga de iluminação (10W/m² aprox.)
2. Considerar a NBR 16401 para projetos formais
3. Sempre arredondar para a capacidade comercial superior mais próxima

> Use o calculador na lateral para fazer o cálculo automaticamente.`
        },
        {
          categoria: 'hidraulica',
          titulo: 'Alturas Padrão para Pontos Hidráulicos',
          tags: 'hidráulica, alturas, pontos água, esgoto, instalação',
          conteudo: `## Alturas de referência para pontos hidráulicos

As alturas a seguir são medidas a partir do **piso acabado** até o **eixo do ponto**, conforme NBR 5626 e práticas usuais de mercado.

### Banheiro

| Ponto | Altura (m) | Observação |
|-------|------------|------------|
| Lavatório (água fria/quente) | 0,55 a 0,60 | Altura do registro/torneira |
| Lavatório (esgoto) | 0,52 | Sifão |
| Vaso sanitário (água) | 0,30 | Caixa acoplada |
| Vaso com válvula de descarga | 1,10 | Centro da válvula |
| Vaso (esgoto) | 0,00 (no piso) | Saída horizontal |
| Bidê | 0,20 (água), 0,10 (esgoto) | |
| Chuveiro/Ducha | 2,10 a 2,20 | Saída para o registro |
| Chuveiro (registro misturador) | 1,00 a 1,10 | |
| Box (ralo) | piso, com caimento de 1% | Mínimo |

### Cozinha

| Ponto | Altura (m) | Observação |
|-------|------------|------------|
| Pia (água fria/quente) | 1,00 a 1,05 | Acima da bancada |
| Pia (esgoto) | 0,55 | Sifão sob bancada |
| Máquina de lavar louça | 0,55 a 0,60 (água), 0,40 (esgoto) | |
| Filtro/purificador | 0,55 a 0,60 | |
| Geladeira (ponto de água) | 0,30 a 1,80 | Verificar modelo |

### Área de serviço

| Ponto | Altura (m) | Observação |
|-------|------------|------------|
| Tanque | 0,90 (água), 0,55 (esgoto) | |
| Máquina de lavar | 0,90 (água), 0,55 (esgoto) | Altura do registro |
| Torneira de jardim externa | 0,50 a 0,60 | |

### Diâmetros mínimos (ramais)

| Aparelho | Diâmetro nominal |
|----------|------------------|
| Bacia sanitária (esgoto) | 100 mm |
| Lavatório, bidê, mictório (esgoto) | 40 mm |
| Pia, máquina, tanque (esgoto) | 50 mm |
| Caixa sifonada (saída) | 75 mm a 100 mm |
| Coluna de ventilação | 75 mm |

### Observações importantes

- Sempre verificar projeto arquitetônico e detalhe das louças/metais especificados
- Em PCD/acessibilidade, seguir NBR 9050 (alturas diferenciadas)
- Manter caimento mínimo de 2% nos ramais de esgoto até DN 75
- Caimento mínimo de 1% para DN ≥ 100 mm`
        },
        {
          categoria: 'hidraulica',
          titulo: 'Dimensionamento de Caixa d\'Água Residencial',
          tags: 'caixa dagua, reservatório, hidráulica, dimensionamento',
          conteudo: `## Como dimensionar a capacidade da caixa d'água

### Consumo per capita diário (NBR 5626)

| Tipo de uso | Consumo (L/pessoa/dia) |
|-------------|------------------------|
| Residência popular | 120 |
| Residência média | 150 |
| Residência alto padrão | 200 |
| Apartamento | 200 |
| Escritório | 50 |
| Hotel | 200 a 250 |
| Escola | 50 |
| Restaurante | 25 (por refeição) |

### Fórmula

**Volume = Consumo per capita × N° pessoas × Reserva**

A NBR 5626 recomenda **reserva de 24 horas**, ou seja, multiplicar por 1,0.
Para reserva de incêndio (edifícios), seguir NBR 13714.

### Exemplo prático

Casa com 4 pessoas, padrão médio:
- 150 L × 4 pessoas × 1 dia = **600 litros**
- Caixa comercial mais próxima: **750 L**

### Distribuição (caixa superior + cisterna)

Em residências com cisterna:
- Cisterna: 60% do total
- Caixa superior: 40% do total

> Use o calculador para fazer o dimensionamento automático.`
        },
        {
          categoria: 'eletrica',
          titulo: 'Dimensionamento de Cabos e Disjuntores',
          tags: 'elétrica, cabos, disjuntores, dimensionamento, NBR 5410',
          conteudo: `## Tabela de seções mínimas (NBR 5410)

### Por circuito

| Circuito | Seção mínima (mm²) |
|----------|---------------------|
| Iluminação | 1,5 |
| Tomadas de uso geral (TUG) | 2,5 |
| Tomadas de uso específico (TUE) | 2,5 a 6,0 |
| Cozinha/área de serviço | 2,5 |
| Chuveiro 5500W (220V) | 4,0 |
| Chuveiro 7500W (220V) | 6,0 |
| Ar-condicionado split 9.000-12.000 BTU | 2,5 |
| Ar-condicionado split 18.000-24.000 BTU | 4,0 |
| Forno elétrico/cooktop | 4,0 a 6,0 |

### Capacidade dos cabos (em ampères, eletroduto, 30°C)

| Seção (mm²) | Corrente (A) | Disjuntor compatível |
|-------------|--------------|----------------------|
| 1,5 | 15,5 | 10 A |
| 2,5 | 21 | 16 A ou 20 A |
| 4,0 | 28 | 25 A |
| 6,0 | 36 | 32 A |
| 10,0 | 50 | 40 A |
| 16,0 | 68 | 50 A ou 63 A |
| 25,0 | 89 | 80 A |

### Regra prática para escolher disjuntor

1. Calcular a corrente do circuito: **I = P / V** (P em watts, V em volts)
2. Aplicar fator de segurança: I × 1,25
3. Escolher disjuntor com valor comercial ≥ ao calculado, mas ≤ à capacidade do cabo

### Exemplo

Chuveiro 5.500 W em 220 V:
- I = 5.500 / 220 = **25 A**
- Com fator: 25 × 1,25 = **31,25 A**
- Disjuntor: **32 A**
- Cabo necessário (32 A): **6,0 mm²**

### Observações

- Sempre seguir a NBR 5410 (instalações elétricas de baixa tensão)
- Considerar fator de agrupamento se houver muitos circuitos no mesmo eletroduto
- DR (diferencial residual) obrigatório em circuitos de áreas molhadas`
        },
        {
          categoria: 'normas',
          titulo: 'Normas Técnicas Mais Usadas',
          tags: 'normas, NBR, ABNT, referências',
          conteudo: `## Principais Normas ABNT

### Hidráulica
- **NBR 5626** — Sistemas prediais de água fria
- **NBR 7198** — Projeto e execução de instalações prediais de água quente
- **NBR 8160** — Sistemas prediais de esgoto sanitário
- **NBR 10844** — Instalações prediais de águas pluviais
- **NBR 13714** — Sistemas de hidrantes e mangotinhos para combate a incêndio

### Elétrica
- **NBR 5410** — Instalações elétricas de baixa tensão
- **NBR 5419** — Proteção contra descargas atmosféricas (SPDA)
- **NBR 14039** — Instalações elétricas de média tensão (1,0 kV a 36,2 kV)
- **NBR IEC 60898** — Disjuntores para proteção de sobrecorrentes

### Climatização
- **NBR 16401** — Instalações de ar-condicionado: sistemas centrais e unitários
- **NBR 16655** — Instalações elétricas de baixa tensão para sistemas de climatização

### Estrutural
- **NBR 6118** — Projeto de estruturas de concreto
- **NBR 8800** — Projeto de estruturas de aço e mistas
- **NBR 7190** — Projeto de estruturas de madeira
- **NBR 6120** — Cargas para o cálculo de estruturas de edificações

### Acessibilidade
- **NBR 9050** — Acessibilidade a edificações, mobiliário, espaços e equipamentos urbanos

### Incêndio (geral)
- **NBR 9077** — Saídas de emergência em edifícios
- **NBR 17240** — Sistemas de detecção e alarme de incêndio
- **NBR 13434** — Sinalização de segurança contra incêndio e pânico

### Gás
- **NBR 13523** — Central de gás liquefeito de petróleo (GLP)
- **NBR 13932** — Instalações internas de gás liquefeito de petróleo (GLP) — Projeto e execução
- **NBR 15526** — Redes de distribuição interna para gases combustíveis em instalações residenciais
- **NBR 14570** — Instalações internas para uso alternativo dos gases GN e GLP
- **NBR 15923** — Inspeção em instalações prediais de GLP

### Regularização
- **Lei nº 13.465/2017** — Regularização Fundiária Urbana (REURB)
- **Lei nº 6.766/79** — Parcelamento do solo urbano
- **Código Civil, art. 1.238 a 1.244** — Usucapião
- **Lei nº 13.105/2015** (CPC), arts. 1.071 e 216-A — Usucapião extrajudicial
- **Provimento CNJ nº 65/2017** — Procedimento da usucapião extrajudicial

### Laudos
- **NBR 13752** — Perícias de engenharia na construção civil
- **NBR 5674** — Manutenção de edificações: requisitos para o sistema de gestão de manutenção
- **NBR 14037** — Manual de uso, operação e manutenção das edificações
- **NBR 12722** — Discriminação de serviços para construção de edifícios

### Geral
- **NBR 13531** — Elaboração de projetos de edificações
- **NBR 13532** — Elaboração de projetos de edificações: arquitetura
- **NBR 14645** — Elaboração do "como construído" (as built)`
        },
        {
          categoria: 'gas',
          titulo: 'Dimensionamento de Tubulação de GLP Residencial',
          tags: 'gás, glp, tubulação, dimensionamento, NBR 13932',
          conteudo: `## Como dimensionar tubulação de gás GLP em residências

Conforme **NBR 13932** (instalações internas de GLP) e **NBR 15526** (redes de gases combustíveis).

### Vazões típicas dos aparelhos (kcal/h)

| Aparelho | Potência (kcal/h) | Consumo (kg/h GLP) |
|----------|-------------------|---------------------|
| Fogão 4 bocas + forno | 8.500 | 0,73 |
| Fogão 6 bocas + forno | 12.500 | 1,07 |
| Aquecedor de passagem 7,5 L/min | 17.000 | 1,46 |
| Aquecedor de passagem 12 L/min | 27.000 | 2,32 |
| Aquecedor de passagem 18 L/min | 41.000 | 3,52 |
| Aquecedor de acumulação 100 L | 23.000 | 1,98 |
| Secadora de roupa | 8.000 | 0,69 |
| Lareira a gás média | 6.000 | 0,52 |

### Pressões usuais

- **Saída do regulador (1º estágio):** 1,5 kgf/cm²
- **Saída do regulador (2º estágio):** 2,8 kPa (28 mbar) — pressão de uso doméstico
- **Pressão mínima no aparelho:** 2,0 kPa

### Diâmetros mínimos da tubulação interna

Para cobre rígido em residência típica (potência total até ~30.000 kcal/h):

| Trecho | Diâmetro mínimo |
|--------|-----------------|
| Entrada (até 1º derivação) | 22 mm (3/4") |
| Ramais (cozinha, área serviço) | 15 mm (1/2") |
| Ramal individual ao aparelho | 12 mm (3/8") |

Para tubulação maior, dimensionar pelo método das vazões equivalentes (tabela 3 da NBR 15526).

### Distância máxima sem ventilação

Em ambientes com aparelhos a gás, o cômodo deve ter:
- Abertura permanente de ventilação inferior: mín. 0,02 m² (200 cm²)
- Abertura permanente de ventilação superior: mín. 0,02 m²
- Volume mínimo de ar do ambiente: 1 m³ por kW de potência instalada (≈ 1,16 m³/kcal/h × 1.000)

### Cuidados de execução

1. Soldagem com solda forte para tubo de cobre (mín. 5% prata)
2. Teste de estanqueidade obrigatório (mín. 20 min com pressão 1,5x a operação)
3. Registros de gás visíveis e acessíveis em cada aparelho
4. Tubulação aparente em área externa, embutida só com proteção mecânica
5. **Distância mínima de fiação elétrica: 30 cm** (paralelo) ou cruzamento perpendicular protegido

> **Atenção:** projeto e execução de gás exigem ART/RRT do profissional habilitado.`
        },
        {
          categoria: 'gas',
          titulo: 'Central de GLP - Dimensionamento e Localização',
          tags: 'gás, glp, central, P13, botijão, NBR 13523',
          conteudo: `## Central de GLP — quando, como e onde

Conforme **NBR 13523**.

### Quando a central é obrigatória

Obrigatória quando:
- Consumo total instalado > 6 kg/h (≈ 70.000 kcal/h)
- Soma da capacidade dos cilindros > 1 P-13 (13 kg)
- Edificação multifamiliar (qualquer porte)

Em residência unifamiliar com até 1 P-13, pode ser instalado externamente sem central.

### Tipos de cilindros

| Cilindro | Capacidade | Uso |
|----------|------------|-----|
| P-2 | 2 kg | portátil |
| P-5 | 5 kg | portátil |
| P-13 | 13 kg | residencial padrão |
| P-20 | 20 kg | residencial/comercial |
| P-45 | 45 kg | comercial — central pequena |
| P-90 | 90 kg | comercial/industrial |
| P-190 | 190 kg | industrial |

### Distâncias mínimas de segurança (NBR 13523)

Da central até:

| Elemento | Distância (m) |
|----------|---------------|
| Edificações vizinhas, divisas | 1,5 |
| Aberturas de ventilação | 1,5 |
| Aparelhos elétricos não classificados | 1,5 |
| Caixa de inspeção de esgoto, ralo | 1,5 |
| Drenagens, poços | 3,0 |
| Materiais combustíveis (madeira, papel) | 3,0 |
| Tomadas elétricas comuns | 3,0 |
| Subestação, transformador | 3,0 |
| Tanques de combustível | 7,5 |

### Requisitos da central

- **Local ventilado** — preferencialmente ao ar livre, com ventilação cruzada permanente
- **Piso firme**, não combustível, com 5 cm de altura mínima sobre o solo
- **Cobertura leve** apenas como proteção do sol/chuva, sem fechar lateralmente
- **Cerca/grade ventilada** para isolamento
- **Sinalização**: placas "GÁS INFLAMÁVEL" e "PROIBIDO FUMAR" visíveis
- **Extintor** PQS 6 kg ou CO₂ 6 kg na entrada

### Limite por bateria

- Máx. 8 cilindros P-13 ou P-20 por bateria
- Máx. 4 cilindros P-45 por bateria
- Bateria reserva idêntica obrigatória (sistema duplicado)

### Tubulações da central até a edificação

- Tubo de cobre rígido (mais comum) ou aço galvanizado
- Tubulação enterrada: profundidade mín. 30 cm, com fita sinalizadora amarela
- Em laje/parede: protegida com calha ou eletroduto rígido

> **Lembrar:** projeto da central exige ART e aprovação do Corpo de Bombeiros local.`
        },
        {
          categoria: 'regularizacao',
          titulo: 'Usucapião Extrajudicial - Documentação e Procedimento',
          tags: 'usucapião, regularização, cartório, extrajudicial, CPC',
          conteudo: `## Usucapião extrajudicial: passo a passo

A usucapião extrajudicial foi instituída pelo **art. 216-A do CPC** (Lei 13.105/2015), regulamentada pelo **Provimento CNJ 65/2017**. Permite reconhecer a propriedade sem necessidade de processo judicial.

### Modalidades de usucapião (resumo)

| Modalidade | Tempo | Requisitos especiais |
|------------|-------|----------------------|
| Extraordinária (CC art. 1.238) | 15 anos | Sem contestação |
| Extraordinária reduzida | 10 anos | Moradia ou obras produtivas |
| Ordinária (CC art. 1.242) | 10 anos | Justo título + boa-fé |
| Ordinária reduzida | 5 anos | Justo título + boa-fé + moradia |
| Especial Urbana (CF art. 183) | 5 anos | Imóvel urbano até 250 m², não tem outro |
| Especial Rural | 5 anos | Imóvel rural até 50 ha, produtividade |
| Familiar (CC art. 1.240-A) | 2 anos | Abandono de lar pelo cônjuge |
| Coletiva (Lei 10.257/01 art. 10) | 5 anos | Núcleo urbano informal de baixa renda |

### Documentos necessários

1. **Ata notarial** lavrada por tabelião — comprova posse mansa e pacífica
2. **Planta e memorial descritivo** assinados por engenheiro/arquiteto com **ART/RRT** e pelo proprietário registrado (se houver)
3. **Certidões negativas**:
   - Distribuidor cível, criminal e fiscal do domicílio do requerente e do imóvel (últimos 10 anos)
   - Tributos imobiliários (IPTU/ITR)
   - Cartório de registro de imóveis (matrícula atualizada)
4. **Justo título** ou comprovantes de posse:
   - Contratos, notas fiscais de obras, contas de luz/água em nome do requerente, declarações de vizinhos (com firma reconhecida), fotos, etc.
5. **Manifestação dos confrontantes** (vizinhos): devem assinar a planta. Caso recusem ou não localizados, há procedimento subsidiário (notificação extrajudicial, edital).

### Etapas no cartório

1. **Petição inicial** ao cartório de registro de imóveis competente
2. Análise pelo **Oficial do Registro** (até 15 dias)
3. Notificação dos titulares de direitos reais sobre o imóvel
4. Notificação aos confrontantes
5. **Manifestação da União, Estado e Município** (15 dias cada)
6. **Publicação de edital** (jornal de grande circulação + imprensa oficial)
7. **Prazo para impugnação** (15 dias após o último edital)
8. Sem impugnação → registro da usucapião na matrícula

### Custos aproximados (varia por estado)

- Ata notarial: R$ 1.500 a R$ 4.000
- Planta + memorial + ART: R$ 1.500 a R$ 5.000 (depende da área)
- Custas cartorárias de registro: 1% a 2% do valor do imóvel
- Editais: R$ 500 a R$ 2.000
- ITBI: alguns municípios isentam

### Quando não cabe extrajudicial

- Imóvel da União, Estados ou Municípios (bens públicos)
- Confrontantes desconhecidos sem possibilidade de localização
- Posse contestada por algum interessado
- Imóveis em condomínio fechado sem regularização

> **Importante:** se houver impugnação, o cartório arquiva o pedido e a parte deve ajuizar ação. Por isso, ata notarial bem feita e diálogo prévio com confrontantes são fundamentais.`
        },
        {
          categoria: 'regularizacao',
          titulo: 'REURB - Regularização Fundiária Urbana',
          tags: 'reurb, regularização, lei 13465, núcleo informal',
          conteudo: `## REURB — Regularização Fundiária Urbana (Lei 13.465/2017)

A REURB é o conjunto de medidas jurídicas, urbanísticas, ambientais e sociais que visam regularizar **núcleos urbanos informais** existentes em áreas urbanas, e titulação dos seus ocupantes.

### Modalidades

| Modalidade | Característica | Custo do interessado |
|------------|----------------|----------------------|
| **REURB-S** (Social) | População de baixa renda | Gratuito (custos públicos) |
| **REURB-E** (Específica) | Demais casos | Pagos pelos beneficiários |

A classificação é feita pelo Município, com base na renda familiar e perfil do núcleo.

### Quem pode requerer

- A União, Estados, Distrito Federal e Municípios
- Os beneficiários (individual ou coletivamente, por associação)
- Cooperativas habitacionais e habitacionais comunitárias
- Loteadores e incorporadores
- Defensoria Pública (em nome dos beneficiários hipossuficientes)
- Ministério Público

### Documentos para abrir o processo

1. **Requerimento** ao Município
2. **Levantamento topográfico planialtimétrico cadastral** com coordenadas georreferenciadas (SIRGAS 2000) e ART
3. **Memorial descritivo** com identificação de cada lote
4. **Diagnóstico ambiental** simplificado (REURB-S) ou EIA/RIMA (REURB-E em APP/APA)
5. **Listagem dos ocupantes** e respectivos lotes
6. **Comprovante de posse** de cada ocupante
7. **Projeto urbanístico de regularização** (incluindo áreas verdes, sistema viário, equipamentos públicos)
8. **Estudo técnico ambiental** se houver irregularidade ambiental

### Etapas

1. **Requerimento ao Município** com documentação básica
2. **Análise municipal** e classificação (REURB-S ou E)
3. **Notificação dos titulares de direitos reais** sobre os imóveis
4. **Audiência pública** (em REURB-S)
5. **Aprovação municipal do projeto de regularização**
6. **Emissão da CRF** (Certidão de Regularização Fundiária) pelo Município
7. **Registro da CRF** no cartório de registro de imóveis (sem custas em REURB-S)
8. **Emissão dos títulos** individuais (legitimação fundiária ou de posse)

### Tipos de título emitidos

- **Legitimação fundiária**: transfere a propriedade ao ocupante de forma originária (sem ônus prévios)
- **Legitimação de posse**: reconhece a posse, conversível em propriedade após 5 anos
- **Doação ou compra e venda direta** com Município/União em casos específicos

### Custos aproximados

REURB-S é **gratuita** para o beneficiário (Município arca com custos).

REURB-E:
- Levantamento topográfico: R$ 80 a R$ 300 por lote (depende do total)
- Projeto de regularização: R$ 200 a R$ 800 por lote
- Custas cartorárias: variam por estado
- Estudo ambiental simplificado: R$ 5.000 a R$ 30.000 (área toda)

### Diferença entre REURB e Usucapião

- **REURB**: coletiva (núcleo todo), promovida pelo Município, gera CRF
- **Usucapião**: individual, judicial ou cartorial, reconhece propriedade pelo tempo de posse

> Em muitos casos, faz-se **REURB do núcleo + usucapião individual** dos lotes onde a regularização coletiva não chega.`
        },
        {
          categoria: 'laudos',
          titulo: 'Laudo de Vizinhança - Estrutura e Conteúdo',
          tags: 'laudo, vizinhança, vistoria, NBR 13752, perícia',
          conteudo: `## Laudo de vistoria de vizinhança

O **laudo de vizinhança** (ou "vistoria cautelar de vizinhança") é elaborado **antes do início de uma obra** que possa afetar imóveis lindeiros (edifícios próximos, muros, ruas). Tem caráter **preventivo**: documenta o estado prévio dos imóveis vizinhos para evitar que danos futuros sejam atribuídos indevidamente à obra.

Base normativa: **NBR 13752** (Perícias de engenharia na construção civil) e **NBR 12722** (discriminação de serviços).

### Quando fazer

- Antes de **demolições** próximas a edificações vizinhas
- Antes de **escavações profundas** (subsolos, fundações profundas)
- Antes de obras com **fundações por estaca cravada** (vibração)
- Antes de **rebaixamento de lençol freático**
- Quando exigido pelo **alvará da prefeitura** ou pelo **estudo de impacto de vizinhança (EIV)**

### Estrutura padrão de um laudo de vizinhança

#### 1. Capa e identificação
- Cliente / contratante
- Imóvel principal (obra) — endereço, matrícula
- Imóveis vistoriados — relação de cada vizinho
- Profissional responsável (CREA/CAU + ART/RRT)
- Data da vistoria

#### 2. Objetivo da perícia
Texto curto explicando que se trata de vistoria cautelar prévia para registro do estado dos imóveis vizinhos.

#### 3. Metodologia
- Vistoria visual sistemática
- Registro fotográfico datado e georreferenciado
- Medição de fissuras existentes (com calibrador ou paquímetro)
- Levantamento de patologias preexistentes
- Equipamentos utilizados (régua, fissurômetro, trena, câmera)

#### 4. Descrição de cada imóvel vizinho
Para cada vizinho:
- Endereço, descrição (n° pavimentos, idade aproximada, tipologia)
- Acesso permitido pelo proprietário (com autorização assinada — anexo)
- **Patologias visuais existentes** ambiente por ambiente:
  - Fissuras (descrever direção, abertura, comprimento)
  - Manchas, infiltrações, descolamento de revestimento
  - Esquadrias mal vedadas, tortas, com defeito
  - Pisos, rodapés, tetos
- **Fotos numeradas** (mín. uma por ambiente, com legenda)

#### 5. Anexos
- **Autorização de vistoria** assinada por cada proprietário
- **Termo de recusa** (caso vizinho não permita) — com testemunhas
- **Plantas com indicação fotográfica** (mapa de patologias)
- **ART/RRT** do responsável
- **Documentos do imóvel** (matrícula, IPTU)
- **Relatório fotográfico completo**

#### 6. Conclusão
Declaração de que o documento registra **fielmente o estado** observado na data, e que serve para **comparação posterior** caso haja sinistro alegado.

### Boas práticas

1. **Numere todas as fotos** e amarre cada uma a um ponto na planta baixa
2. **Use referências dimensionais** (régua, moeda) para fissuras
3. **Não opine** sobre causa das patologias preexistentes — apenas descreva
4. **Datacao** automática da câmera ativada
5. **Imprima em 2 vias** assinadas por todas as partes (proprietário, profissional)
6. Em caso de **recusa do vizinho**, registre por escrito a tentativa, com testemunha, e idealmente notifique extrajudicialmente

### Honorários (referência)

- Imóvel térreo simples: R$ 800 a R$ 1.500
- Sobrado/casa média: R$ 1.500 a R$ 3.000
- Edifício até 4 pavimentos: R$ 3.000 a R$ 6.000
- Conjunto de 5+ vizinhos: orçamento específico

> **Crítico:** sem laudo prévio, qualquer dano alegado pelo vizinho durante/após a obra fica difícil de contestar.`
        },
        {
          categoria: 'laudos',
          titulo: 'Laudo de Entrega de Apartamento (Vistoria de Recebimento)',
          tags: 'laudo, vistoria, entrega, recebimento, apartamento, NBR 17170',
          conteudo: `## Laudo de vistoria de entrega de apartamento

Documento técnico que registra o **estado do imóvel no momento da entrega** pela construtora ao comprador. Serve para identificar não-conformidades antes do recebimento e formalizar pendências.

Base: **NBR 17170:2022** (Diretrizes para vistoria técnica de recebimento de unidades habitacionais).

### Quando solicitar

- Antes da **entrega das chaves** pela construtora
- Antes de **assinar o termo de recebimento** definitivo
- Em caso de **garantia** (pode ser feito a qualquer momento até fim do prazo legal)

### Garantias legais (Código Civil + Lei do Distrato)

| Item | Prazo de garantia |
|------|-------------------|
| Estrutura (lajes, vigas, pilares, fundação) | 5 anos |
| Impermeabilização | 5 anos |
| Instalações elétricas e hidráulicas embutidas | 5 anos |
| Acabamentos (pintura, revestimentos) | 1 a 3 anos |
| Esquadrias e ferragens | 1 a 2 anos |
| Equipamentos (elevador, gerador) | conforme fabricante |

### Estrutura do laudo

#### 1. Identificação
- Empreendimento, torre, unidade, vaga(s)
- Construtora/incorporadora
- Comprador
- Profissional responsável (CREA/CAU + ART/RRT)
- Data e hora da vistoria

#### 2. Documentos verificados
- Memorial descritivo do empreendimento
- Manual do proprietário
- Planta da unidade
- Habite-se / Auto de Conclusão
- Termo de garantia

#### 3. Vistoria sistemática (cômodo por cômodo)

**Sala / Quartos / Corredor:**
- Pintura (uniformidade, tonalidade, escorrimentos)
- Pisos (nivelamento, rejunte, peças quebradas)
- Forros e tetos (gesso, fissuras, manchas)
- Esquadrias (alinhamento, vedação, fechamento)
- Tomadas e interruptores (testar TODOS)
- Pontos de TV/internet/telefone
- Rodapés (alinhamento)

**Cozinha / Área de serviço:**
- Bancadas (nivelamento, rejunte)
- Torneiras (vazão, vazamentos)
- Pia / cuba (escoamento, sifão)
- Pontos de gás (vedação, registro)
- Coifa, exaustor (se entregue)
- Tomadas em quantidade suficiente
- Ralos (escoamento — testar com balde de água)

**Banheiros:**
- Bacia sanitária (descarga, vedação ao piso, nível)
- Lavatório (torneira, sifão, escoamento)
- Box / chuveiro (rejunte, ralo, vazão)
- Espelho (fixação)
- Aquecedor a gás (acendimento, segurança)
- Ventilação / exaustor

**Sacada / Varanda:**
- Caimento do piso (mín. 1% para o ralo)
- Impermeabilização visível
- Guarda-corpo (altura mín. 1,10 m, fixação, NBR 14718)
- Esquadrias de fechamento (se for sacada com vidro)

**Áreas comuns** (vistoriar como condomínio):
- Hall, corredores, elevadores
- Garagem (vagas demarcadas, pé-direito mín. 2,30 m)
- Salão de festas, churrasqueira, piscina
- Subestação, central de gás, gerador

#### 4. Testes técnicos
- **Tomadas**: testar todas com testador (polaridade, terra)
- **Hidráulica**: abrir todas as torneiras e verificar pressão
- **Elétrica**: medir tensão (110V/220V conforme projeto)
- **Esgoto**: jogar água em ralos e verificar escoamento
- **Estanqueidade**: testar caimento de piso, juntas

#### 5. Lista de não-conformidades (anexo)

Tabela numerada:

| # | Local | Descrição | Foto | Garantia (categoria) | Status |
|---|-------|-----------|------|---------------------|--------|

#### 6. Conclusão
- Recomendação: receber com ressalvas / não receber / receber
- Anexar lista de pendências para reparo prévio à entrega das chaves

### Honorários (referência)

- Apartamento até 50 m²: R$ 600 a R$ 1.000
- Apartamento 50-100 m²: R$ 900 a R$ 1.800
- Apartamento 100-200 m²: R$ 1.500 a R$ 3.000
- Cobertura/duplex: R$ 2.500 a R$ 5.000

> **Cliente sempre acompanha a vistoria.** Não assinar termo de recebimento até que pendências sejam corrigidas ou expressamente listadas.`
        },
        {
          categoria: 'laudos',
          titulo: 'Manual do Proprietário - Conteúdo Obrigatório (NBR 14037)',
          tags: 'manual, proprietário, NBR 14037, NBR 5674, manutenção',
          conteudo: `## Manual do Proprietário (NBR 14037)

Documento que a construtora deve entregar ao comprador junto com as chaves. Reúne **informações de uso, operação e manutenção** da edificação.

Base: **NBR 14037:2014** (Diretrizes para elaboração de manuais de uso, operação e manutenção das edificações) e **NBR 5674** (manutenção de edificações).

### Tipos de manual

1. **Manual da edificação** (do condomínio inteiro) — para o síndico
2. **Manual da unidade** (do apartamento) — para cada proprietário
3. **Manual de áreas comuns** — quando aplicável

### Conteúdo mínimo do manual da unidade

#### Capítulo 1: Apresentação
- Dados do empreendimento (nome, endereço, construtora, incorporadora)
- Dados da unidade (nº, área privativa/total, vaga)
- Identificação do projeto e responsáveis técnicos
- Data de entrega
- Habite-se

#### Capítulo 2: Garantias
- Tabela de **prazos de garantia** por sistema (estrutura 5 anos, impermeabilização 5 anos, etc.)
- Termos de garantia anexados
- Condições para validade da garantia (uso correto, manutenção em dia)
- Procedimento para acionamento da garantia (canal, prazo de resposta)

#### Capítulo 3: Memoriais
- **Memorial descritivo** dos materiais empregados (marca, modelo, especificação)
- **Memorial de acabamentos** (pisos, revestimentos, pintura, esquadrias)
- **Plantas baixas** da unidade (arquitetônica, elétrica, hidráulica)
- **Esquema de instalações** (pontos elétricos, pontos hidráulicos, gás)
- **Carga elétrica disponível** (kVA, padrão)
- **Layout sugerido** (quando há)

#### Capítulo 4: Recomendações de uso
- Carga máxima por ambiente (kgf/m²)
- Restrições para reformas (não retirar paredes estruturais — indicar em planta)
- Como ligar/desligar registros gerais (água, gás, elétrica)
- Operação dos equipamentos (interfone, automação, gerador, etc.)
- Programa de prevenção de patologias (limpeza, ventilação, dilatação)

#### Capítulo 5: Programa de manutenção preventiva
Tabela com cada sistema, tarefa, periodicidade e responsável:

| Sistema | Tarefa | Periodicidade | Responsável |
|---------|--------|---------------|-------------|
| Hidráulica | Verificar vazamentos visíveis | Mensal | Proprietário |
| Hidráulica | Limpar caixa d'água | Semestral | Empresa contratada |
| Elétrica | Testar disjuntores DR | Mensal | Proprietário |
| Elétrica | Inspeção quadro geral | Anual | Eletricista |
| Esquadrias | Lubrificar dobradiças | Trimestral | Proprietário |
| Esquadrias | Verificar borrachas/vedação | Anual | Proprietário |
| Pintura | Repintura interna | 5 a 10 anos | Pintor |
| Impermeabilização | Inspeção visual de áreas molhadas | Anual | Proprietário |
| Impermeabilização | Refazer (se necessário) | 10-15 anos | Empresa especializada |
| Esgoto | Limpeza de caixas de gordura | Semestral | Proprietário/Cond. |
| Gás | Teste de estanqueidade | Anual | Empresa habilitada |
| Aquecedor a gás | Manutenção preventiva | Anual | Técnico |

#### Capítulo 6: Operação de sistemas específicos
- Ar-condicionado (manutenção, limpeza filtros)
- Sistema de aquecimento solar (se houver)
- Automação residencial
- Cozinhas industriais (em coberturas com churrasqueira)
- Banheira de hidromassagem

#### Capítulo 7: Em caso de emergência
- Telefones úteis (Bombeiros 193, SAMU 192, Defesa Civil 199)
- Procedimento em caso de:
  - Vazamento de gás
  - Falta de energia
  - Vazamento de água/inundação
  - Incêndio
  - Falha no elevador
- Localização de extintores e hidrantes

#### Capítulo 8: Responsabilidades
- Do proprietário (manutenção, uso correto, não modificar estrutura)
- Do condomínio (áreas comuns, contratação de manutenção)
- Da construtora (durante prazo de garantia)

### Anexos obrigatórios

1. ART/RRT dos projetos principais
2. Termos de garantia individuais (esquadrias, equipamentos)
3. Plantas e detalhamentos
4. Manuais dos equipamentos do fabricante (interfone, aquecedor, etc.)
5. Termo de entrega da unidade
6. Lista de fornecedores recomendados para serviços específicos

### Quando o manual não foi entregue

A não entrega caracteriza **descumprimento contratual** e **infração à NBR 14037**. O proprietário pode:
1. Notificar extrajudicialmente a construtora
2. Reportar ao PROCON
3. Acionar a construtora judicialmente

> **Modelo de manual prontos** estão disponíveis no SindusCon e em consultorias técnicas — porém devem ser **personalizados para cada empreendimento**.`
        },
        {
          categoria: 'eletrica',
          titulo: 'Padrão de Entrada de Energia (Padrão CEMIG/Enel/etc.)',
          tags: 'elétrica, padrão de entrada, medidor, ramal, NBR 5410',
          conteudo: `## Padrão de entrada de energia

O padrão de entrada é o conjunto de equipamentos e materiais usados para conectar a edificação à rede pública de energia. As especificações variam por concessionária (CEMIG, Enel, Light, Equatorial, CPFL, etc.) — sempre consultar a **norma técnica local**.

### Tipos de fornecimento

| Tipo | Tensão | Carga típica | Uso |
|------|--------|--------------|-----|
| Monofásico | 127V (2 fios: F+N) | até 8 kW | Casa pequena, apartamento simples |
| Bifásico | 127/220V (3 fios: 2F+N) | 8 a 25 kW | Residência média, com chuveiro elétrico |
| Trifásico | 127/220V ou 220/380V (4 fios: 3F+N) | 25 a 75 kW | Residência grande, comércio |
| Trifásico industrial | 220/380V (4 fios) | acima de 75 kW | Indústria leve, edifícios |

### Cálculo da carga (resumo)

Somar potência de TODOS os pontos:
- Iluminação: 100W por ponto (mín.)
- Tomadas (TUG): 100W cada (mín. 600W por circuito)
- Tomadas específicas (TUE — chuveiro, ar-cond, micro-ondas): potência real do aparelho
- Aplicar **fator de demanda** conforme tabela da NBR 5410 (anexo C)

### Carga instalada × Carga de demanda

A concessionária dimensiona o padrão pela **carga de demanda**, não pela instalada.

Exemplo: residência com chuveiro 5500W + 2 ar-cond 9000 BTU (1500W cada) + iluminação/tomadas 4000W:
- Carga instalada = 5500 + 1500 + 1500 + 4000 = **12.500W**
- Aplicando fatores de demanda da NBR 5410 ≈ **8.000 a 9.000W**
- Padrão recomendado: **bifásico 60A** (~13 kW disponíveis)

### Componentes do padrão

1. **Caixa de medição** (poste/mureta)
2. **Caixa de proteção** (com disjuntor geral)
3. **Eletroduto de descida** (PVC rígido 1" ou 1.1/2")
4. **Aterramento** (haste cobreada de 2,4m mínimo, profundidade total)
5. **Cabos de entrada** (do poste da rua até o medidor)
6. **Cabo do ramal interno** (do medidor até o quadro de distribuição)

### Disjuntor geral típico (referência CEMIG)

| Carga (kW) | Tipo | Disjuntor | Cabo entrada (mm²) |
|------------|------|-----------|---------------------|
| até 8 | Monofásico | 40 A | 10 |
| 8 a 14 | Bifásico | 50 A | 16 |
| 14 a 22 | Bifásico | 70 A | 25 |
| 22 a 35 | Trifásico | 60 A | 16 |
| 35 a 50 | Trifásico | 80 A | 25 |
| 50 a 75 | Trifásico | 125 A | 50 |

### Aterramento (essencial!)

- Haste cobreada de aço-cobre (mín. 2,4m × 5/8")
- Resistência de aterramento: **máx. 25 Ω** (preferível < 10 Ω)
- Conector tipo split-bolt ou cadweld
- Cabo de aterramento mín. 16 mm² (proporcional à entrada)
- Ligar à barra de equipotencial do quadro

### Documentação para concessionária

1. **Projeto elétrico** com ART do engenheiro eletricista
2. **Memorial descritivo**
3. **Diagrama unifilar** do quadro
4. **Croquis de localização**
5. **Habite-se** (em obra nova)
6. **Documentos do proprietário** (RG, CPF, comprovante de endereço)
7. **Solicitação de ligação** (formulário da concessionária)

### Erros comuns

- **Subdimensionar** o padrão pensando só em iluminação/tomadas — esqueceu chuveiro elétrico (5,5 a 7,5 kW)
- **Não fazer aterramento adequado** — DPS e DR não funcionam sem ele
- **Padrão monofásico em casa com chuveiro 220V** — não funciona, precisa bifásico
- **Eletroduto de PVC fino** — concessionária exige PVC anti-chama rígido
- **Fios subdimensionados** — aquecimento, perdas, queima do disjuntor

> **Sempre consulte a norma técnica da concessionária local** antes de orçar — especificações de poste, altura, materiais variam significativamente.`
        },
        {
          categoria: 'hidraulica',
          titulo: 'Cálculo de Vazão para Esgoto Predial',
          tags: 'esgoto, vazão, dimensionamento, NBR 8160, UH',
          conteudo: `## Dimensionamento de tubulações de esgoto

Conforme **NBR 8160** (sistemas prediais de esgoto sanitário). O método utilizado é o das **Unidades Hunter de Contribuição (UHC)**.

### Unidades Hunter por aparelho

| Aparelho | UHC | Diâmetro mínimo (mm) |
|----------|-----|----------------------|
| Bacia sanitária | 6 | 100 |
| Banheira | 3 | 40 |
| Bidê | 1 | 40 |
| Chuveiro residencial | 2 | 40 |
| Chuveiro coletivo | 4 | 75 |
| Lavatório | 1 | 40 |
| Mictório válvula descarga | 6 | 75 |
| Mictório com sifão integrado | 5 | 75 |
| Mictório autosifonado | 4 | 50 |
| Mictório de calha | 2 (por metro) | 75 |
| Pia de cozinha residencial | 3 | 50 |
| Pia de cozinha industrial | 6 | 75 |
| Tanque de lavar roupa | 3 | 40 |
| Máquina de lavar roupa | 3 | 50 |
| Máquina de lavar pratos | 2 | 50 |
| Bebedouro | 0,5 | 40 |
| Ralo sifonado | conforme contribuintes | 75 |

### Diâmetros máximos permitidos por trecho

#### Ramal de esgoto

| Diâmetro (mm) | UHC máximo |
|---------------|------------|
| 40 | 3 |
| 50 | 6 |
| 75 | 20 |
| 100 | 160 |

#### Tubo de queda

| Diâmetro (mm) | UHC máx (até 3 pavimentos) | UHC máx (acima de 3 pavimentos) |
|---------------|----------------------------|--------------------------------|
| 75 | 30 | 60 |
| 100 | 240 | 500 |
| 125 | 540 | 1.100 |
| 150 | 960 | 1.900 |

#### Coletor predial e subcoletor

Em função da declividade:

| Diâmetro (mm) | UHC máx (1%) | UHC máx (2%) | UHC máx (4%) |
|---------------|--------------|--------------|--------------|
| 100 | 180 | 216 | 250 |
| 125 | 280 | 380 | 480 |
| 150 | 420 | 580 | 720 |
| 200 | 1.000 | 1.290 | 1.680 |

### Declividades mínimas

| Diâmetro (mm) | Declividade mínima |
|---------------|---------------------|
| Até 75 | 2,0% |
| 100 | 1,0% |
| Acima de 100 | 0,5% |

### Ventilação (essencial!)

A coluna de ventilação evita ressecamento dos sifões e atraso na descarga.

#### Diâmetro mínimo da ventilação primária (continuação do tubo de queda):

| Tubo de queda (mm) | Ventilação primária (mm) |
|---------------------|---------------------------|
| 75 | 75 |
| 100 | 75 |
| 125 | 100 |
| 150 | 100 |

#### Distância máxima do ramal de descarga ao desconector

| Diâmetro do ramal (mm) | Distância máxima (m) |
|------------------------|----------------------|
| 40 | 1,7 |
| 50 | 2,3 |
| 75 | 3,0 |
| 100 | 4,5 |

### Caixas e dispositivos

- **Caixa sifonada (CS)**: receptora de ralos secos. Saída mín. DN 75 ou DN 100
- **Caixa de inspeção (CI)**: a cada 25m no coletor predial e em mudanças de direção
- **Caixa de gordura (CG)**: na saída de pias de cozinha
  - Residencial: simples (capacidade mín. 18 L para 1-2 unidades)
  - Coletiva: dupla (cozinha de restaurante, etc.)
  - Especial: para grandes volumes

### Exemplo prático: residência com 1 banheiro + cozinha + área serviço

Aparelhos:
- 1 bacia sanitária (6 UHC, 100mm)
- 1 lavatório (1 UHC, 40mm)
- 1 chuveiro (2 UHC, 40mm)
- 1 pia cozinha (3 UHC, 50mm)
- 1 tanque (3 UHC, 40mm)
- 1 máq. lavar (3 UHC, 50mm)

**Total: 18 UHC**

- Coletor predial: DN 100 (suporta 180 a 216 UHC) ✓
- Saída para a rede: DN 100 com declividade 1% ✓

> **Lembrar:** sempre prever caixa de inspeção a cada 25 m e em todas as mudanças de direção do coletor enterrado.`
        }
      ]
      const stmt = db.prepare(
        'INSERT INTO artigos_conhecimento (categoria, titulo, conteudo, tags, autor_id) VALUES (?, ?, ?, ?, ?)'
      )
      for (const a of artigos) {
        stmt.run(a.categoria, a.titulo, a.conteudo, a.tags, adminId)
      }
      console.log('[DB] Artigos da base de conhecimento criados (' + artigos.length + ' artigos)')
    }
  }

  // Seed das cláusulas padrão (compartilhadas entre os 7 tipos de contrato)
  const clausCount = db.prepare('SELECT COUNT(*) as n FROM clausulas_padrao').get() as {
    n: number
  }
  if (clausCount.n === 0) {
    // Cláusulas comuns (servem para todos os tipos com pequenas variações)
    const clausulasBase = [
      {
        clausula_id: 'objeto',
        secao: 'DO OBJETO DO CONTRATO',
        rotulo: 'Objeto do contrato',
        essencial: 1,
        ordem: 1,
        texto:
          'É objeto do presente contrato, a {{objeto_descricao}}{{objeto_endereco}}, conforme orçamento no valor de R$ {{valor_numero}} ({{valor_extenso}}), parte integrante deste contrato.'
      },
      {
        clausula_id: 'servicos',
        secao: 'DOS SERVIÇOS',
        rotulo: 'Lista dos serviços contratados',
        essencial: 1,
        ordem: 2,
        texto:
          'Os serviços contratados pelo CONTRATANTE são:\n{{servicos_lista}}\n\nParágrafo Único – Todos os documentos serão entregues em formato digital (.PDF).'
      },
      {
        clausula_id: 'nao_incluso',
        secao: 'DOS SERVIÇOS',
        rotulo: 'Itens NÃO inclusos no contrato',
        essencial: 0,
        ordem: 3,
        texto:
          'Não está incluso no presente contrato:\n• O reconhecimento de firma nas assinaturas do contrato;\n• Impressão das folhas dos projetos;\n• Os valores referentes às taxas da prefeitura municipal;\n• Qualquer custo referente a multas e encargos de qualquer órgão ou natureza, será por conta do CONTRATANTE;\n• Taxas de solicitação e/ou elaboração de documentos faltantes ou emitidos pelo CONTRATANTE;\n• Acompanhamento de obra, execução e administração de obra.'
      },
      {
        clausula_id: 'obr_acesso',
        secao: 'OBRIGAÇÕES DO CONTRATANTE E CONTRATADA',
        rotulo: 'Acesso ao imóvel e fornecimento de informações',
        essencial: 0,
        ordem: 4,
        texto:
          'O CONTRATANTE deverá fornecer à CONTRATADA, em relação à visita técnica, o acesso livre ao imóvel e às edificações que lá se encontram, no melhor dia, que será combinado e acertado entre ambos, assim como, fornecer todos os dados, informações e documentos necessários para o bom e fiel desenvolvimento do objeto contratado, declarando por meio do presente instrumento a veracidade, comprometendo-se a não faltar com a verdade, sendo responsável pela idoneidade moral, legitimidade e veracidade dos documentos e informações que apresentar à CONTRATADA, devendo informar quaisquer alterações e manter os dados e documentos atualizados.'
      },
      {
        clausula_id: 'prazo_entrega',
        secao: 'OBRIGAÇÕES DO CONTRATANTE E CONTRATADA',
        rotulo: 'Prazo de entrega do trabalho técnico',
        essencial: 0,
        ordem: 5,
        texto:
          'A CONTRATADA se compromete a entregar o trabalho técnico no prazo de 20 dias úteis após a visita no local e mediante o pagamento da entrada, desde que tenha recebido todos os documentos e informações necessárias para a confecção do trabalho técnico, e não serão contados os dias em que o projeto ficar retido pelo CONTRATANTE para apreciação. Caso contrário, o prazo será computado a partir da data de recebimento dos documentos.'
      },
      {
        clausula_id: 'disponibilidade_correcoes',
        secao: 'OBRIGAÇÕES DO CONTRATANTE E CONTRATADA',
        rotulo: 'Disponibilidade para correções',
        essencial: 0,
        ordem: 6,
        texto:
          'A CONTRATADA entregará ao CONTRATANTE todos os documentos relacionados na {{ref:servicos}}, e estará à disposição, se houver manifestação negativa do Registro de Imóveis ou da Prefeitura do Município, para futuras correções e ajustes necessários até a finalização do processo.'
      },
      {
        clausula_id: 'entrega_pdf',
        secao: 'OBRIGAÇÕES DO CONTRATANTE E CONTRATADA',
        rotulo: 'Entrega em PDF e suporte a dúvidas',
        essencial: 0,
        ordem: 7,
        texto:
          'A CONTRATADA entregará ao CONTRATANTE todos os documentos relacionados na {{ref:servicos}} no formato PDF, e estará à disposição, se houver dúvidas.'
      },
      {
        clausula_id: 'responsabilidade_alteracoes',
        secao: 'OBRIGAÇÕES DO CONTRATANTE E CONTRATADA',
        rotulo: 'Responsabilidade por alterações pós-entrega',
        essencial: 0,
        ordem: 8,
        texto:
          'A CONTRATADA não se responsabiliza por alterações ocorridas durante o processo que estiverem em desacordo com os serviços por ela entregues ou alterações solicitadas pelo CONTRATANTE após a aprovação e entrega do projeto finalizado.'
      },
      {
        clausula_id: 'outras_atividades',
        secao: 'OBRIGAÇÕES DO CONTRATANTE E CONTRATADA',
        rotulo: 'Outras atividades não inclusas',
        essencial: 0,
        ordem: 9,
        texto:
          'As partes estão cientes de que quaisquer outras atividades, produtos e contratações de serviços não englobam o presente contrato. A título de exemplo, não constam no preço e obrigações do projeto: impostos, taxas, emolumentos, registros na Prefeitura, análises de solo, cópias heliográficas, xerox, fotografias, bem como, de qualquer bem destinado à execução e decoração do imóvel, pessoal necessário para execução dos serviços e eventuais encargos sociais, etc.'
      },
      {
        clausula_id: 'limitacao_obra_fisica',
        secao: 'OBRIGAÇÕES DO CONTRATANTE E CONTRATADA',
        rotulo: 'Limitação à parte técnica (sem obra física)',
        essencial: 0,
        ordem: 10,
        texto:
          'O Projeto não envolve alterações da obra física (paredes, janelas, etc.); os serviços contratados se limitam à parte técnica do processo, nos termos da legislação civil, sabido que tais incumbências técnicas são de responsabilidade do Arquiteto e/ou Engenheiro responsável pela construção inicial da residência.'
      },
      {
        clausula_id: 'preco',
        secao: 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',
        rotulo: 'Preço total e parcelas',
        essencial: 1,
        ordem: 11,
        texto:
          'O valor total do serviço contratado neste instrumento é de R$ {{valor_numero}} ({{valor_extenso}}), conforme a seguir:\n\n{{parcelas_lista}}\n\nO pagamento deverá ser realizado via PIX para a chave CNPJ 51.212.533/0001-78, em nome de "Desenvolvendo Novos Lares" – Banco Nubank.'
      },
      {
        clausula_id: 'atraso',
        secao: 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',
        rotulo: 'Multa e juros por atraso',
        essencial: 0,
        ordem: 12,
        texto:
          'O atraso no pagamento acarretará multa de {{multa}}% (um por cento) ao mês e juros de {{juros}}% (cinquenta centésimos por cento) ao dia.'
      },
      {
        clausula_id: 'rescisao',
        secao: 'DA RESCISÃO',
        rotulo: 'Descumprimento do contrato',
        essencial: 0,
        ordem: 13,
        texto:
          'O presente contrato será rescindido caso uma das partes descumpra o pactuado nas cláusulas deste instrumento.\n\nParágrafo único – O presente contrato poderá ser rescindido por qualquer das partes contratadas, mediante aviso, com prazo de 30 dias.'
      },
      {
        clausula_id: 'desist_contratante',
        secao: 'DA RESCISÃO',
        rotulo: 'Desistência pelo contratante',
        essencial: 0,
        ordem: 14,
        texto:
          'Em caso de desistência por parte do CONTRATANTE, fica a CONTRATADA expressamente autorizada a reter o valor recebido referente a 50% do valor da assinatura deste contrato.'
      },
      {
        clausula_id: 'desist_contratada',
        secao: 'DA RESCISÃO',
        rotulo: 'Desistência pela contratada',
        essencial: 0,
        ordem: 15,
        texto:
          'Caso ocorra a desistência por parte da CONTRATADA, a parte deverá proceder à devolução dos valores recebidos ao CONTRATANTE.'
      },
      {
        clausula_id: 'propriedade',
        secao: 'CONDIÇÕES GERAIS',
        rotulo: 'Propriedade intelectual (Lei 9.610/98)',
        essencial: 0,
        ordem: 16,
        texto:
          'Nos limites da Lei nº 9.610/98, todo e qualquer projeto, desenho, especificações, relatórios, pareceres e outros documentos elaborados pela CONTRATADA são de sua propriedade.'
      },
      {
        clausula_id: 'cessao',
        secao: 'CONDIÇÕES GERAIS',
        rotulo: 'Proibição de cessão',
        essencial: 0,
        ordem: 17,
        texto:
          'Fica expressamente proibido a qualquer das partes ceder ou transferir, total ou parcialmente, os direitos e obrigações decorrentes deste contrato, sob pena das sanções e responsabilidades civis, sem prejuízo da multa contratual.'
      },
      {
        clausula_id: 'lgpd_coleta',
        secao: 'CONDIÇÕES GERAIS',
        rotulo: 'LGPD — Coleta de dados',
        essencial: 0,
        ordem: 18,
        texto:
          'Os dados pessoais do CONTRATANTE foram coletados exclusivamente para elaboração do presente contrato de prestação de serviços, e serão armazenados somente pelo prazo de vigência deste instrumento.'
      },
      {
        clausula_id: 'lgpd_protecao',
        secao: 'CONDIÇÕES GERAIS',
        rotulo: 'LGPD — Proteção de dados',
        essencial: 0,
        ordem: 19,
        texto:
          'A CONTRATADA e seus colaboradores se comprometem a manter os dados coletados protegidos, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018), e as determinações de órgãos reguladores e fiscalizadores, além das demais normas e políticas de proteção de dados.'
      },
      {
        clausula_id: 'uso_imagens',
        secao: 'CONDIÇÕES GERAIS',
        rotulo: 'Permissão de uso de imagens (marketing)',
        essencial: 0,
        ordem: 20,
        texto:
          'O CONTRATANTE, declarando estar ciente, permite o uso de imagens e vídeos da obra e/ou divulgação do projeto de forma gratuita para a CONTRATADA, para uso de marketing ou quaisquer outras formas de mídia em divulgações publicitárias.'
      },
      {
        clausula_id: 'foro',
        secao: 'DO FORO',
        rotulo: 'Foro de eleição',
        essencial: 1,
        ordem: 21,
        texto:
          'Para dirimir quaisquer controvérsias oriundas do CONTRATO, as partes elegem o foro da comarca de {{cidade}}.'
      }
    ]

    const stmtCl = db.prepare(
      `INSERT INTO clausulas_padrao
       (tipo_contrato, clausula_id, secao, rotulo, texto, essencial, ordem)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )

    // Replica essas mesmas cláusulas pra todos os 7 tipos de contrato
    const tipos = [
      'laudo_vizinhanca',
      'eletrica',
      'hidraulica',
      'gas',
      'regularizacao',
      'manual_proprietario',
      'generico'
    ]

    for (const tipo of tipos) {
      for (const c of clausulasBase) {
        stmtCl.run(tipo, c.clausula_id, c.secao, c.rotulo, c.texto, c.essencial, c.ordem)
      }
    }
    console.log(
      '[DB] Cláusulas padrão criadas (' +
        clausulasBase.length +
        ' cláusulas × ' +
        tipos.length +
        ' tipos = ' +
        clausulasBase.length * tipos.length +
        ' registros)'
    )
  }
}
