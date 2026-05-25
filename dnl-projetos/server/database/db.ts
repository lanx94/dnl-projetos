import Database from 'better-sqlite3'
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
    const dbDir = process.env.DB_PATH
      ? path.dirname(process.env.DB_PATH)
      : path.join(process.cwd(), 'data')

    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

    const dbPath = process.env.DB_PATH || path.join(dbDir, 'dnl-projetos.db')
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
      senha_hash TEXT NOT NULL DEFAULT '',
      nome TEXT NOT NULL,
      cargo TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'rh', 'funcionario')),
      cpf TEXT,
      telefone TEXT,
      data_admissao TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      keycloak_id TEXT,
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
      tipo_contrato TEXT NOT NULL DEFAULT 'generico',
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

    CREATE TABLE IF NOT EXISTS clausulas_padrao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_contrato TEXT NOT NULL,
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

    CREATE TABLE IF NOT EXISTS metas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      especifico TEXT NOT NULL,
      mensuravel TEXT NOT NULL,
      atingivel TEXT NOT NULL,
      relevante TEXT NOT NULL,
      prazo TEXT NOT NULL,
      progresso INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ativa'
        CHECK(status IN ('ativa','concluida','cancelada')),
      criado_por_id INTEGER NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (criado_por_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS revisoes_projeto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_projeto TEXT NOT NULL,
      revisao TEXT NOT NULL,
      descricao TEXT,
      data_revisao TEXT,
      responsavel_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pendente'
        CHECK(status IN ('pendente','em_andamento','concluida')),
      criado_por_id INTEGER NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (responsavel_id) REFERENCES usuarios(id) ON DELETE SET NULL,
      FOREIGN KEY (criado_por_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_revisoes_projeto ON revisoes_projeto(nome_projeto);

    CREATE TABLE IF NOT EXISTS calendario_postagem (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ideia'
        CHECK(status IN ('ideia','roteiro','gravando','editando','agendado','publicado')),
      rede_social TEXT,
      objetivo TEXT,
      servico TEXT,
      roteiro TEXT,
      legenda TEXT,
      formato TEXT,
      data_postagem TEXT,
      ordem INTEGER NOT NULL DEFAULT 0,
      criado_por_id INTEGER NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (criado_por_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_calendario_status ON calendario_postagem(status, ordem);

    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL DEFAULT ''
    );
  `)

  migrarColunasNovas(db)
}

function migrarColunasNovas(db: Database.Database) {
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

  adicionar('usuarios', 'keycloak_id', 'TEXT')
  adicionar('clientes', 'representante_nome', 'TEXT')
  adicionar('clientes', 'representante_nacionalidade', 'TEXT')
  adicionar('clientes', 'representante_naturalidade', 'TEXT')
  adicionar('clientes', 'representante_estado_civil', 'TEXT')
  adicionar('clientes', 'representante_profissao', 'TEXT')
  adicionar('clientes', 'representante_rg', 'TEXT')
  adicionar('clientes', 'representante_cpf', 'TEXT')
  adicionar('clientes', 'tipo_pessoa', "TEXT NOT NULL DEFAULT 'juridica'")
  adicionar('clientes', 'cpf', 'TEXT')
  adicionar('clientes', 'rg', 'TEXT')
  adicionar('clientes', 'inscricao_estadual', 'TEXT')
  adicionar('contratos', 'tipo_contrato', "TEXT NOT NULL DEFAULT 'generico'")
  adicionar('contratos', 'endereco_imovel', 'TEXT')
  adicionar('contratos', 'valor_extenso', 'TEXT')
  adicionar('contratos', 'servicos_json', "TEXT NOT NULL DEFAULT '[]'")
  adicionar('contratos', 'parcelas_json', "TEXT NOT NULL DEFAULT '[]'")
  adicionar('contratos', 'multa_percentual', 'TEXT')
  adicionar('contratos', 'juros_diario', 'TEXT')
  adicionar('contratos', 'cidade', "TEXT NOT NULL DEFAULT 'São Paulo'")
  adicionar('contratos', 'data_assinatura', 'TEXT')
  adicionar('contratos', 'clausulas_json', "TEXT NOT NULL DEFAULT '[]'")
  adicionar('contratos', 'tipos_contrato_json', "TEXT NOT NULL DEFAULT '[]'")
  adicionar('contratos', 'contratada_qualificacao', 'TEXT')
  adicionar('projetos', 'cidade', 'TEXT')
  adicionar('leads', 'orcamento_id', 'INTEGER')
  adicionar('orcamentos', 'projetos_necessarios', 'TEXT')
  adicionar('orcamentos', 'incluso', 'TEXT')
}

export function seedInitialData(db: Database.Database) {
  const userCount = db.prepare('SELECT COUNT(*) as n FROM usuarios').get() as { n: number }
  if (userCount.n === 0) {
    const senhaAdmin = bcrypt.hashSync('Admin@2025', 10)
    db.prepare(
      `INSERT INTO usuarios (email, senha_hash, nome, cargo, role) VALUES (?, ?, ?, ?, ?)`
    ).run('admin@dnlprojetos.com', senhaAdmin, 'Administrador', 'Diretor', 'admin')
    console.log('[DB] Admin criado: admin@dnlprojetos.com — sincronize com Keycloak')

    db.prepare(`INSERT INTO clientes (nome, email) VALUES (?, ?)`).run(
      'DNL Projetos (Interno)',
      'contato@dnlprojetos.com'
    )
  }

  const catCount = db.prepare('SELECT COUNT(*) as n FROM categorias_financeiras').get() as { n: number }
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
    const stmt = db.prepare('INSERT INTO categorias_financeiras (nome, tipo, cor) VALUES (?, ?, ?)')
    for (const [nome, tipo, cor] of cats) stmt.run(nome, tipo, cor)
  }

  seedClausulas(db)
  seedDadosExemplo(db)
}

function seedDadosExemplo(db: Database.Database) {
  const clienteCount = db.prepare('SELECT COUNT(*) as n FROM clientes').get() as { n: number }
  if (clienteCount.n > 1) return // Já tem dados além do cliente interno

  // 5 clientes de exemplo
  const ic = db.prepare(`INSERT INTO clientes (tipo_pessoa, nome, email, telefone, cpf, rg, endereco, representante_nome, representante_rg, representante_cpf, representante_estado_civil, representante_profissao, representante_nacionalidade) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

  const r1 = ic.run('fisica', 'Maria José Ferreira', 'maria.ferreira@email.com', '(11) 98765-4321', '234.567.890-12', '34.567.890-8', 'Rua das Acácias, 45, Jardim Paulista, São Paulo – SP, CEP 01310-000', 'Maria José Ferreira', '34.567.890-8', '234.567.890-12', 'casada', 'professora', 'brasileira')
  const r2 = ic.run('fisica', 'Roberto Carlos Almeida', 'roberto.almeida@email.com', '(11) 97654-3210', '345.678.901-23', '45.678.901-9', 'Av. Brigadeiro Faria Lima, 789, Itaim Bibi, São Paulo – SP, CEP 01451-000', 'Roberto Carlos Almeida', '45.678.901-9', '345.678.901-23', 'solteiro', 'engenheiro', 'brasileiro')
  const r3 = ic.run('juridica', 'Construtora Horizonte Ltda', 'contato@horizonte.com.br', '(11) 3456-7890', null, null, 'Av. Paulista, 1234, Bela Vista, São Paulo – SP, CEP 01310-100', 'Ana Paula Corrêa', '56.789.012-0', '456.789.012-34', 'casada', 'diretora', 'brasileira')
  const r4 = ic.run('fisica', 'João Paulo Santos', 'joao.santos@email.com', '(11) 96543-2109', '456.789.012-34', '56.789.012-0', 'Rua Augusta, 567, Consolação, São Paulo – SP, CEP 01305-000', 'João Paulo Santos', '56.789.012-0', '456.789.012-34', 'divorciado', 'comerciante', 'brasileiro')
  const r5 = ic.run('juridica', 'Incorporadora Bela Vista S/A', 'contato@belavista.com.br', '(11) 2345-6789', null, null, 'Rua do Bosque, 321, Lapa, São Paulo – SP, CEP 05023-000', 'Marcos Antônio Lima', '67.890.123-1', '567.890.123-45', 'casado', 'diretor', 'brasileiro')

  const ids = [r1.lastInsertRowid, r2.lastInsertRowid, r3.lastInsertRowid, r4.lastInsertRowid, r5.lastInsertRowid]

  // 5 projetos de exemplo
  const ip = db.prepare(`INSERT INTO projetos (cliente_id, nome, descricao, status, data_inicio) VALUES (?, ?, ?, ?, date('now','localtime'))`)
  ip.run(ids[0], 'Projeto Elétrico — Residência Ferreira', 'Elaboração de projeto elétrico residencial para aprovação junto à concessionária.', 'em_andamento')
  ip.run(ids[1], 'Manual As-Built — Residência Almeida', 'Levantamento As-Built in loco e elaboração do Manual do Proprietário.', 'planejamento')
  ip.run(ids[2], 'Laudo de Vizinhança — Construtora Horizonte', 'Laudo técnico de vizinhança para emissão de alvará de demolição.', 'em_andamento')
  ip.run(ids[3], 'Regularização — Residência Santos', 'Projeto de regularização de edificação junto à Prefeitura de São Paulo.', 'planejamento')
  ip.run(ids[4], 'Usucapião — Lote Bela Vista', 'Instrução técnica de processo de usucapião: memorial descritivo e planta georreferenciada.', 'em_andamento')

  // 2 funcionários de exemplo
  const senhaFunc = bcrypt.hashSync('Func@2025', 10)
  db.prepare(`INSERT OR IGNORE INTO usuarios (email, senha_hash, nome, cargo, role, data_admissao) VALUES (?, ?, ?, ?, ?, date('now','localtime'))`)
    .run('ana.mendes@dnlprojetos.com', senhaFunc, 'Ana Paula Mendes', 'Engenheira Civil', 'funcionario')
  db.prepare(`INSERT OR IGNORE INTO usuarios (email, senha_hash, nome, cargo, role, data_admissao) VALUES (?, ?, ?, ?, ?, date('now','localtime'))`)
    .run('carlos.santos@dnlprojetos.com', senhaFunc, 'Carlos Eduardo Santos', 'Técnico em Edificações', 'funcionario')

  console.log('[DB] Dados de exemplo criados: 5 clientes, 5 projetos, 2 funcionários')
}

function seedClausulas(db: Database.Database) {
  const stmt = db.prepare(`INSERT OR IGNORE INTO clausulas_padrao (tipo_contrato, clausula_id, secao, rotulo, texto, essencial, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)`)

  function ins(tipo: string, id: string, secao: string, rotulo: string, texto: string, essencial: number, ordem: number) {
    stmt.run(tipo, id, secao, rotulo, texto, essencial, ordem)
  }

  // === CLÁUSULAS BASE (tipos legados) ===
  const PRECO_TEXTO = 'O valor total do serviço contratado é de R$ {{valor_numero}} ({{valor_extenso}}), conforme a seguir:\n\n{{parcelas_lista}}\n\nO pagamento deverá ser realizado via PIX para a chave CNPJ 51.212.533/0001-78, em nome de "Desenvolvendo Novos Lares" – Banco Nubank.'
  const FORO_TEXTO = 'Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes elegem o foro da comarca de {{cidade}}, com renúncia expressa a qualquer outro, por mais privilegiado que seja.'

  const clausulasBase = [
    { id: 'objeto', secao: 'DO OBJETO DO CONTRATO', rotulo: 'Objeto do contrato', essencial: 1, ordem: 1, texto: 'É objeto do presente contrato a {{objeto_descricao}}{{objeto_endereco}}, conforme orçamento no valor de R$ {{valor_numero}} ({{valor_extenso}}), parte integrante deste contrato.' },
    { id: 'servicos', secao: 'DOS SERVIÇOS', rotulo: 'Lista dos serviços contratados', essencial: 1, ordem: 2, texto: 'Os serviços contratados pelo CONTRATANTE são:\n{{servicos_lista}}\n\nParágrafo Único – Todos os documentos serão entregues em formato digital (.PDF).' },
    { id: 'nao_incluso', secao: 'DOS SERVIÇOS', rotulo: 'Itens NÃO inclusos', essencial: 0, ordem: 3, texto: 'Não está incluso no presente contrato:\n• O reconhecimento de firma;\n• Impressão das folhas dos projetos;\n• Os valores referentes às taxas da prefeitura municipal;\n• Quaisquer custos de multas e encargos;\n• Taxas de solicitação de documentos faltantes;\n• Acompanhamento de obra, execução e administração.' },
    { id: 'preco', secao: 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO', rotulo: 'Preço total e parcelas', essencial: 1, ordem: 11, texto: PRECO_TEXTO },
    { id: 'atraso', secao: 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO', rotulo: 'Multa e juros por atraso', essencial: 0, ordem: 12, texto: 'O atraso no pagamento acarretará multa de {{multa}}% ao mês e juros de {{juros}}% ao dia, calculados sobre o valor em aberto.' },
    { id: 'rescisao', secao: 'DA RESCISÃO', rotulo: 'Rescisão contratual', essencial: 0, ordem: 13, texto: 'O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de 7 (sete) dias, sem prejuízo das obrigações já assumidas.\n\nParágrafo Único – Em caso de descumprimento das cláusulas contratuais, o contrato poderá ser rescindido de imediato.' },
    { id: 'foro', secao: 'DO FORO', rotulo: 'Foro de eleição', essencial: 1, ordem: 21, texto: FORO_TEXTO }
  ]
  for (const tipo of ['laudo_vizinhanca', 'eletrica', 'hidraulica', 'gas', 'regularizacao', 'manual_proprietario', 'generico']) {
    for (const c of clausulasBase) ins(tipo, c.id, c.secao, c.rotulo, c.texto, c.essencial, c.ordem)
  }

  // === PROJETO ELÉTRICO, HIDRÁULICO E DE GÁS ===
  const EHG = 'eletrica_hidraulica_gas'
  ins(EHG, 'objeto',                 'DO OBJETO',                                 'Objeto do contrato',              'É objeto do presente contrato a elaboração dos projetos de instalações elétricas, hidrossanitárias e de gás do imóvel localizado na {{objeto_endereco}}, conforme orçamento no valor de R$ {{valor_numero}} ({{valor_extenso}}), parte integrante deste contrato.',                                                                                                                                                                                              1, 1)
  ins(EHG, 'servicos',               'DOS SERVIÇOS',                              'Serviços contratados',            'Os serviços contratados pelo CONTRATANTE são:\n{{servicos_lista}}\n\nParágrafo Único – Todos os documentos serão entregues em formato digital (.PDF e .DWG).',                                                                                                                                                                                                                                                                                              1, 2)
  ins(EHG, 'incluso',                'DOS SERVIÇOS',                              'Itens inclusos',                  'Está incluso no presente contrato:\n• Elaboração do(s) projeto(s) conforme normas técnicas vigentes;\n• Anotação de Responsabilidade Técnica (ART) ou Registro de Responsabilidade Técnica (RRT);\n• Arquivos digitais em formato PDF e DWG;\n• 1 (uma) revisão gratuita.',                                                                                                                                                                             0, 3)
  ins(EHG, 'nao_incluso',            'DOS SERVIÇOS',                              'Itens NÃO inclusos',              'Não está incluso no presente contrato:\n• Reconhecimento de firma;\n• Impressão das folhas dos projetos;\n• Taxas de aprovação junto à prefeitura municipal ou concessionárias;\n• Quaisquer custos de multas e encargos;\n• Taxas de solicitação de documentos;\n• Acompanhamento de obra, execução e administração;\n• Revisões adicionais além da prevista.',                                                                                           0, 4)
  ins(EHG, 'obrigacoes_contratante', 'DAS OBRIGAÇÕES',                            'Obrigações do CONTRATANTE',       'São obrigações do CONTRATANTE:\n• Fornecer todas as informações e documentos necessários para a elaboração dos projetos (plantas, cotas, medições, etc.);\n• Realizar os pagamentos nas datas acordadas;\n• Comunicar qualquer alteração nas especificações do imóvel antes da entrega dos projetos.',                                                                                                                                                   0, 5)
  ins(EHG, 'prazo',                  'DO PRAZO',                                  'Prazo de entrega',                'O prazo de entrega dos projetos será de até 20 (vinte) dias úteis, contados a partir do recebimento de todas as informações e documentos necessários e da confirmação do pagamento da entrada.\n\nParágrafo Único – O prazo poderá ser prorrogado por motivos de força maior ou em caso de solicitação de alterações pelo CONTRATANTE.',                                                                                                                   1, 10)
  ins(EHG, 'preco',                  'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Preço total e parcelas',          PRECO_TEXTO,                                                                                                                                                                                                                                                                                                                                                                                                                                               1, 11)
  ins(EHG, 'atraso',                 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Multa e juros por atraso',        'O atraso no pagamento acarretará multa de {{multa}}% ao mês e juros de {{juros}}% ao dia, calculados sobre o valor em aberto.',                                                                                                                                                                                                                                                                                                                           0, 12)
  ins(EHG, 'desistencia',            'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Desistência do CONTRATANTE',      'Em caso de desistência por parte do CONTRATANTE após o início dos serviços, será retido 50% (cinquenta por cento) do valor já recebido pela CONTRATADA, a título de ressarcimento dos trabalhos realizados e reserva de agenda.',                                                                                                                                                                                                                          0, 13)
  ins(EHG, 'rescisao',               'DA RESCISÃO',                               'Rescisão contratual',             'O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de 7 (sete) dias, sem prejuízo das obrigações já assumidas.\n\nParágrafo Único – Em caso de descumprimento das cláusulas contratuais, o contrato poderá ser rescindido de imediato.',                                                                                                                                                                           0, 14)
  ins(EHG, 'responsabilidade',       'DAS CONDIÇÕES GERAIS',                      'Responsabilidade técnica',        'Os projetos serão elaborados sob responsabilidade técnica do Eng. Civil Lucas Cardoso da Silva, inscrito no CREA-SP nº 5070747868, com emissão de ART/RRT junto ao conselho profissional competente.',                                                                                                                                                                                                                                                     0, 15)
  ins(EHG, 'foro',                   'DO FORO',                                   'Foro de eleição',                 FORO_TEXTO,                                                                                                                                                                                                                                                                                                                                                                                                                                               1, 21)

  // === LAUDO DE ENTREGA DE APARTAMENTO ===
  const LENT = 'laudo_entrega'
  ins(LENT, 'objeto',                'DO OBJETO',                                 'Objeto do contrato',              'É objeto do presente contrato a elaboração de Laudo Técnico de Vistoria de Entrega do imóvel situado na {{objeto_endereco}}, compreendendo a verificação das condições de entrega e o apontamento de eventuais inconformidades, conforme orçamento no valor de R$ {{valor_numero}} ({{valor_extenso}}), parte integrante deste contrato.',                                                                                                                 1, 1)
  ins(LENT, 'incluso',               'DOS SERVIÇOS',                              'Itens inclusos',                  'Está incluso no presente contrato:\n• Vistoria técnica presencial no imóvel;\n• Verificação das instalações elétricas, hidráulicas, esquadrias, pisos, revestimentos e acabamentos;\n• Elaboração do laudo técnico com registro fotográfico;\n• Apontamento de inconformidades e não conformidades;\n• Anotação de Responsabilidade Técnica (ART) ou RRT.',                                                                                           0, 2)
  ins(LENT, 'nao_incluso',           'DOS SERVIÇOS',                              'Itens NÃO inclusos',              'Não está incluso no presente contrato:\n• Análise estrutural ou de fundações;\n• Análise de projetos aprovados;\n• Acompanhamento das correções apontadas;\n• Laudos específicos de patologias (objeto de contrato separado);\n• Mais de 1 (uma) visita técnica ao imóvel;\n• Impressão do laudo;\n• Reconhecimento de firma.',                                                                                                                       0, 3)
  ins(LENT, 'obrigacoes_contratante','DAS OBRIGAÇÕES',                            'Obrigações do CONTRATANTE',       'São obrigações do CONTRATANTE:\n• Garantir acesso irrestrito ao imóvel na data acordada para a realização da vistoria;\n• Fornecer planta do imóvel e documentação disponível;\n• Comunicar qualquer restrição de acesso a ambientes;\n• Realizar os pagamentos nas datas acordadas.',                                                                                                                                                               0, 4)
  ins(LENT, 'prazo',                 'DO PRAZO',                                  'Prazo de entrega',                'O laudo técnico será entregue em até 10 (dez) dias úteis após a realização da vistoria presencial ao imóvel.',                                                                                                                                                                                                                                                                                                                                           1, 10)
  ins(LENT, 'preco',                 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Preço total e parcelas',          PRECO_TEXTO,                                                                                                                                                                                                                                                                                                                                                                                                                                               1, 11)
  ins(LENT, 'atraso',                'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Multa e juros por atraso',        'O atraso no pagamento acarretará multa de {{multa}}% ao mês e juros de {{juros}}% ao dia, calculados sobre o valor em aberto.',                                                                                                                                                                                                                                                                                                                           0, 12)
  ins(LENT, 'desistencia',           'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Desistência do CONTRATANTE',      'Em caso de desistência por parte do CONTRATANTE após a realização da vistoria, o valor integral será cobrado, uma vez que o serviço principal terá sido executado.',                                                                                                                                                                                                                                                                                      0, 13)
  ins(LENT, 'rescisao',              'DA RESCISÃO',                               'Rescisão contratual',             'O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de 7 (sete) dias, sem prejuízo das obrigações já assumidas.',                                                                                                                                                                                                                                                                                                    0, 14)
  ins(LENT, 'autorizacao_imagem',    'DAS CONDIÇÕES GERAIS',                      'Autorização de uso de imagens',   'O CONTRATANTE autoriza a CONTRATADA a utilizar as imagens obtidas durante a vistoria para fins de divulgação técnica e portfólio, desde que omitidos dados pessoais e a identificação do imóvel.',                                                                                                                                                                                                                                                        0, 15)
  ins(LENT, 'foro',                  'DO FORO',                                   'Foro de eleição',                 FORO_TEXTO,                                                                                                                                                                                                                                                                                                                                                                                                                                               1, 21)

  // === LAUDO DE APONTAMENTO DE PATOLOGIAS ===
  const LAPT = 'laudo_apontamento'
  ins(LAPT, 'objeto',                'DO OBJETO',                                 'Objeto do contrato',              'É objeto do presente contrato a elaboração de Laudo de Apontamento das Patologias apresentadas no imóvel localizado na {{objeto_endereco}}, compreendendo a identificação, documentação fotográfica e análise das manifestações patológicas existentes, conforme orçamento no valor de R$ {{valor_numero}} ({{valor_extenso}}), parte integrante deste contrato.',                                                                                       1, 1)
  ins(LAPT, 'incluso',               'DOS SERVIÇOS',                              'Itens inclusos',                  'Está incluso no presente contrato:\n• Vistoria técnica presencial no imóvel;\n• Identificação e registro fotográfico das patologias;\n• Elaboração de laudo técnico com descrição das manifestações patológicas;\n• Indicação das possíveis causas e recomendações de intervenção;\n• Anotação de Responsabilidade Técnica (ART) ou RRT.',                                                                                                             0, 2)
  ins(LAPT, 'limitacoes',            'DOS SERVIÇOS',                              'Limitações da avaliação',         'Limitações da avaliação:\n• O laudo é de caráter visual e não destrutivo;\n• Não estão inclusos ensaios laboratoriais, sondagens ou abertura de paredes;\n• O laudo não substitui projeto de recuperação estrutural;\n• A vistoria limita-se às áreas acessíveis e visíveis no momento da inspeção;\n• Não está incluso acompanhamento das obras de reparo.',                                                                                         0, 3)
  ins(LAPT, 'nao_incluso',           'DOS SERVIÇOS',                              'Itens NÃO inclusos',              'Não está incluso no presente contrato:\n• Reconhecimento de firma;\n• Impressão do laudo;\n• Ensaios destrutivos ou laboratoriais;\n• Projeto de recuperação estrutural;\n• Mais de 1 (uma) visita técnica.',                                                                                                                                                                                                                                          0, 4)
  ins(LAPT, 'prazo',                 'DO PRAZO',                                  'Prazo de entrega',                'O laudo técnico será entregue em até 10 (dez) dias úteis após a realização da vistoria técnica ao imóvel.',                                                                                                                                                                                                                                                                                                                                              1, 10)
  ins(LAPT, 'preco',                 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Preço total e parcelas',          PRECO_TEXTO,                                                                                                                                                                                                                                                                                                                                                                                                                                               1, 11)
  ins(LAPT, 'atraso',                'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Multa e juros por atraso',        'O atraso no pagamento acarretará multa de {{multa}}% ao mês e juros de {{juros}}% ao dia, calculados sobre o valor em aberto.',                                                                                                                                                                                                                                                                                                                           0, 12)
  ins(LAPT, 'desistencia',           'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Desistência do CONTRATANTE',      'Em caso de desistência por parte do CONTRATANTE após o início dos serviços, será retido 50% (cinquenta por cento) do valor já recebido pela CONTRATADA, a título de ressarcimento dos trabalhos realizados e reserva de agenda.',                                                                                                                                                                                                                          0, 13)
  ins(LAPT, 'rescisao',              'DA RESCISÃO',                               'Rescisão contratual',             'O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de 7 (sete) dias, sem prejuízo das obrigações já assumidas.',                                                                                                                                                                                                                                                                                                    0, 14)
  ins(LAPT, 'autorizacao_imagem',    'DAS CONDIÇÕES GERAIS',                      'Autorização de uso de imagens',   'O CONTRATANTE autoriza a CONTRATADA a utilizar as imagens obtidas durante a vistoria para fins de divulgação técnica e portfólio, desde que omitidos dados pessoais e a identificação do imóvel.',                                                                                                                                                                                                                                                        0, 15)
  ins(LAPT, 'foro',                  'DO FORO',                                   'Foro de eleição',                 FORO_TEXTO,                                                                                                                                                                                                                                                                                                                                                                                                                                               1, 21)

  // === MANUAL DO PROPRIETÁRIO COM AS-BUILT ===
  const MAB = 'manual_asbuilt'
  ins(MAB, 'objeto',                 'DO OBJETO',                                 'Objeto do contrato',              'É objeto do presente contrato a elaboração do Manual do Proprietário e a execução do Levantamento As-Built in loco do imóvel localizado na {{objeto_endereco}}, conforme orçamento no valor de R$ {{valor_numero}} ({{valor_extenso}}), parte integrante deste contrato.',                                                                                                                                                                              1, 1)
  ins(MAB, 'servicos',               'DOS SERVIÇOS',                              'Serviços contratados',            'Os serviços contratados pelo CONTRATANTE são:\n{{servicos_lista}}\n\nParágrafo Único – Todos os documentos serão entregues em formato digital (.PDF).',                                                                                                                                                                                                                                                                                                    1, 2)
  ins(MAB, 'incluso_asbuilt',        'DOS SERVIÇOS',                              'Escopo do As-Built',              'O levantamento As-Built contempla:\n• Levantamento dimensional in loco de todos os ambientes do imóvel;\n• Mapeamento das instalações hidrossanitárias: elevações das paredes com indicação dos pontos de água, esgoto e tubulações aparentes;\n• Mapeamento das instalações elétricas: localização de tomadas, interruptores, pontos de iluminação e quadros de distribuição;\n• Levantamento das esquadrias (portas e janelas): dimensões e posicionamento;\n• Elaboração de planta baixa As-Built em formato PDF e DWG;\n• Registro fotográfico;\n• ART/RRT.',                                                                                                                                                                                       0, 3)
  ins(MAB, 'nao_incluso_asbuilt',    'DOS SERVIÇOS',                              'Itens NÃO inclusos no As-Built',  'Não está incluso no levantamento As-Built:\n• Abertura de paredes, forros ou pisos para localização de tubulações ocultas;\n• Levantamento de instalações de gás;\n• Análise estrutural e de fundações;\n• Mais de 1 (uma) visita técnica ao imóvel;\n• Impressão dos documentos;\n• Levantamento topográfico externo.',                                                                                                                              0, 4)
  ins(MAB, 'incluso_manual',         'DOS SERVIÇOS',                              'Escopo do Manual do Proprietário','O Manual do Proprietário contempla:\n• Informações técnicas sobre os sistemas e instalações do imóvel;\n• Instruções de uso, operação e manutenção preventiva;\n• Vida útil estimada dos sistemas e componentes;\n• Periodicidade das manutenções recomendadas;\n• Orientações para situações de emergência;\n• Documentação consolidada das instalações.',                                                                                             0, 5)
  ins(MAB, 'obrigacoes_contratante', 'DAS OBRIGAÇÕES',                            'Obrigações do CONTRATANTE',       'São obrigações do CONTRATANTE:\n• Disponibilizar acesso total ao imóvel na data acordada para realização do levantamento;\n• Garantir que o imóvel esteja acessível em todos os ambientes;\n• Fornecer informações e documentos disponíveis sobre o imóvel;\n• Realizar os pagamentos nas datas acordadas.',                                                                                                                                              0, 6)
  ins(MAB, 'prazo',                  'DO PRAZO',                                  'Prazo de entrega',                'O prazo de entrega do Manual do Proprietário e do As-Built será de até 20 (vinte) dias úteis após a realização do levantamento técnico in loco e confirmação do pagamento.',                                                                                                                                                                                                                                                                               1, 10)
  ins(MAB, 'preco',                  'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Preço total e parcelas',          PRECO_TEXTO,                                                                                                                                                                                                                                                                                                                                                                                                                                               1, 11)
  ins(MAB, 'atraso',                 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Multa e juros por atraso',        'O atraso no pagamento acarretará multa de {{multa}}% ao mês e juros de {{juros}}% ao dia, calculados sobre o valor em aberto.',                                                                                                                                                                                                                                                                                                                           0, 12)
  ins(MAB, 'desistencia',            'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Desistência do CONTRATANTE',      'Em caso de desistência por parte do CONTRATANTE após a visita técnica ao imóvel, será retido 50% (cinquenta por cento) do valor já recebido pela CONTRATADA, a título de ressarcimento dos trabalhos realizados.',                                                                                                                                                                                                                                        0, 13)
  ins(MAB, 'rescisao',               'DA RESCISÃO',                               'Rescisão contratual',             'O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de 7 (sete) dias, sem prejuízo das obrigações já assumidas.',                                                                                                                                                                                                                                                                                                    0, 14)
  ins(MAB, 'autorizacao_imagem',     'DAS CONDIÇÕES GERAIS',                      'Autorização de uso de imagens',   'O CONTRATANTE autoriza a CONTRATADA a utilizar imagens e informações técnicas obtidas durante o levantamento para fins de divulgação e portfólio, desde que omitidos dados pessoais e a identificação do imóvel.',                                                                                                                                                                                                                                        0, 15)
  ins(MAB, 'foro',                   'DO FORO',                                   'Foro de eleição',                 FORO_TEXTO,                                                                                                                                                                                                                                                                                                                                                                                                                                               1, 21)

  // === USUCAPIÃO ===
  const USC = 'usucapiao'
  ins(USC, 'objeto',                 'DO OBJETO',                                 'Objeto do contrato',              'É objeto do presente contrato a prestação de serviços de engenharia para instrução de processo de Usucapião do imóvel localizado na {{objeto_endereco}}, compreendendo a elaboração de memorial descritivo, planta de situação e locação georreferenciada, conforme orçamento no valor de R$ {{valor_numero}} ({{valor_extenso}}), parte integrante deste contrato.',                                                                                     1, 1)
  ins(USC, 'servicos',               'DOS SERVIÇOS',                              'Serviços contratados',            'Os serviços contratados pelo CONTRATANTE são:\n{{servicos_lista}}\n\nParágrafo Único – Os documentos serão entregues em formato digital (.PDF) e impresso quando exigido pelo Cartório de Registro de Imóveis.',                                                                                                                                                                                                                                           1, 2)
  ins(USC, 'incluso',                'DOS SERVIÇOS',                              'Itens inclusos',                  'Está incluso no presente contrato:\n• Memorial descritivo do imóvel com descrição dos confrontantes;\n• Planta de situação e locação georreferenciada;\n• Anotação de Responsabilidade Técnica (ART) no CREA;\n• Acompanhamento técnico junto ao Cartório de Registro de Imóveis (somente em dúvidas de cunho técnico);\n• 1 (uma) revisão gratuita caso o cartório solicite ajustes técnicos.',                                                       0, 3)
  ins(USC, 'nao_incluso',            'DOS SERVIÇOS',                              'Itens NÃO inclusos',              'Não está incluso no presente contrato:\n• Serviços jurídicos e advocatícios;\n• Taxas cartorárias, emolumentos e custas processuais;\n• Reconhecimento de firma;\n• Acompanhamento judicial do processo;\n• Mais de 2 (duas) revisões do memorial e da planta;\n• Levantamento topográfico com equipamentos especiais não previstos.',                                                                                                                  0, 4)
  ins(USC, 'obrigacoes_contratante', 'DAS OBRIGAÇÕES',                            'Obrigações do CONTRATANTE',       'São obrigações do CONTRATANTE:\n• Fornecer toda documentação disponível do imóvel (IPTU, escritura, contratos, comprovantes de posse, etc.);\n• Fornecer os dados de identificação dos confrontantes do imóvel;\n• Disponibilizar acesso ao imóvel para realização do levantamento;\n• Realizar os pagamentos nas datas acordadas;\n• Assinar a documentação necessária quando solicitado pela CONTRATADA.',                                           0, 5)
  ins(USC, 'prazo',                  'DO PRAZO',                                  'Prazo de entrega',                'O prazo de entrega dos documentos será de até 30 (trinta) dias úteis após o recebimento de toda a documentação necessária e da confirmação do pagamento da entrada.\n\nParágrafo Único – O prazo está condicionado à entrega completa dos documentos pelo CONTRATANTE, podendo ser prorrogado em caso de pendências documentais.',                                                                                                                        1, 10)
  ins(USC, 'preco',                  'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Preço total e parcelas',          PRECO_TEXTO,                                                                                                                                                                                                                                                                                                                                                                                                                                               1, 11)
  ins(USC, 'atraso',                 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Multa e juros por atraso',        'O atraso no pagamento acarretará multa de {{multa}}% ao mês e juros de {{juros}}% ao dia, calculados sobre o valor em aberto.',                                                                                                                                                                                                                                                                                                                           0, 12)
  ins(USC, 'desistencia',            'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO',     'Desistência do CONTRATANTE',      'Em caso de desistência por parte do CONTRATANTE após o início dos serviços, será retido 50% (cinquenta por cento) do valor já recebido pela CONTRATADA, a título de ressarcimento dos trabalhos realizados.',                                                                                                                                                                                                                                             0, 13)
  ins(USC, 'rescisao',               'DA RESCISÃO',                               'Rescisão contratual',             'O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de 30 (trinta) dias, sem prejuízo das obrigações já assumidas.\n\nParágrafo Único – Em caso de descumprimento das cláusulas contratuais, o contrato poderá ser rescindido de imediato, cabendo indenização pelos danos causados.',                                                                                                                               0, 14)
  ins(USC, 'condicoes_gerais',       'DAS CONDIÇÕES GERAIS',                      'Condições gerais',                'Os documentos elaborados são de uso exclusivo do CONTRATANTE para os fins previstos neste contrato. O reaproveitamento para outros fins ou imóveis depende de nova contratação e emissão de nova ART.\n\nParágrafo Único – A CONTRATADA não se responsabiliza por eventual indeferimento cartorário em razão de documentação incompleta fornecida pelo CONTRATANTE.',                                                                                     0, 15)
  ins(USC, 'foro',                   'DO FORO',                                   'Foro de eleição',                 FORO_TEXTO,                                                                                                                                                                                                                                                                                                                                                                                                                                               1, 21)
}
