import { ipcMain } from 'electron'
import { getDatabase } from '../database/db'
import { session } from './session'
import type {
  Contrato,
  ContratoCreateInput,
  StatusContrato,
  TipoContrato,
  ClausulaContrato,
  ClausulaPadrao,
  ServicoContrato,
  ParcelaContrato
} from '../../shared/types'

const TIPOS_VALIDOS: TipoContrato[] = [
  'laudo_vizinhanca',
  'eletrica',
  'hidraulica',
  'gas',
  'regularizacao',
  'manual_proprietario',
  'generico'
]

function gerarNumeroContrato(db: any): string {
  const ano = new Date().getFullYear()
  const ultimo = db
    .prepare(`SELECT numero FROM contratos WHERE numero LIKE ? ORDER BY id DESC LIMIT 1`)
    .get(`CONT-${ano}-%`) as { numero: string } | undefined

  let prox = 1
  if (ultimo) {
    const partes = ultimo.numero.split('-')
    prox = parseInt(partes[2], 10) + 1
  }
  return `CONT-${ano}-${String(prox).padStart(4, '0')}`
}

function parseSafe<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

interface ContratoRow {
  id: number
  numero: string
  tipo_contrato: TipoContrato
  cliente_id: number
  cliente_nome: string | null
  cliente_cnpj: string | null
  cliente_endereco: string | null
  cliente_representante: string | null
  cliente_rg: string | null
  cliente_cpf: string | null
  projeto_id: number | null
  projeto_nome: string | null
  orcamento_id: number | null
  titulo: string
  objeto: string
  endereco_imovel: string | null
  valor: number
  valor_extenso: string | null
  servicos_json: string
  parcelas_json: string
  multa_percentual: string | null
  juros_diario: string | null
  forma_pagamento: string | null
  prazo_execucao: string | null
  data_inicio: string | null
  data_fim: string | null
  cidade: string
  data_assinatura: string | null
  clausulas_json: string
  observacoes: string | null
  status: StatusContrato
  criado_por_id: number
  criado_por_nome: string | null
  criado_em: string
  atualizado_em: string
}

function rowToContrato(row: ContratoRow): Contrato {
  return {
    id: row.id,
    numero: row.numero,
    tipo_contrato: row.tipo_contrato,
    cliente_id: row.cliente_id,
    cliente_nome: row.cliente_nome || undefined,
    cliente_cnpj: row.cliente_cnpj || undefined,
    cliente_endereco: row.cliente_endereco || undefined,
    cliente_representante: row.cliente_representante || undefined,
    cliente_rg: row.cliente_rg || undefined,
    cliente_cpf: row.cliente_cpf || undefined,
    projeto_id: row.projeto_id || undefined,
    projeto_nome: row.projeto_nome || undefined,
    orcamento_id: row.orcamento_id || undefined,
    titulo: row.titulo,
    objeto: row.objeto,
    endereco_imovel: row.endereco_imovel || undefined,
    valor: row.valor,
    valor_extenso: row.valor_extenso || undefined,
    servicos: parseSafe<ServicoContrato[]>(row.servicos_json, []),
    parcelas: parseSafe<ParcelaContrato[]>(row.parcelas_json, []),
    multa_percentual: row.multa_percentual || undefined,
    juros_diario: row.juros_diario || undefined,
    forma_pagamento: row.forma_pagamento || undefined,
    prazo_execucao: row.prazo_execucao || undefined,
    data_inicio: row.data_inicio || undefined,
    data_fim: row.data_fim || undefined,
    cidade: row.cidade,
    data_assinatura: row.data_assinatura || undefined,
    clausulas: parseSafe<ClausulaContrato[]>(row.clausulas_json, []),
    observacoes: row.observacoes || undefined,
    status: row.status,
    criado_por_id: row.criado_por_id,
    criado_por_nome: row.criado_por_nome || undefined,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em
  }
}

function buscarContrato(db: any, id: number): Contrato | null {
  const row = db
    .prepare(
      `SELECT ct.*,
              c.nome as cliente_nome, c.cnpj as cliente_cnpj, c.endereco as cliente_endereco,
              c.representante_nome as cliente_representante,
              c.representante_rg as cliente_rg, c.representante_cpf as cliente_cpf,
              p.nome as projeto_nome,
              u.nome as criado_por_nome
       FROM contratos ct
       LEFT JOIN clientes c ON c.id = ct.cliente_id
       LEFT JOIN projetos p ON p.id = ct.projeto_id
       LEFT JOIN usuarios u ON u.id = ct.criado_por_id
       WHERE ct.id = ?`
    )
    .get(id) as ContratoRow | undefined
  return row ? rowToContrato(row) : null
}

// Carrega cláusulas padrão de um tipo e converte para ClausulaContrato (incluida=true)
function carregarClausulasIniciais(db: any, tipo: TipoContrato): ClausulaContrato[] {
  const padroes = db
    .prepare(
      'SELECT * FROM clausulas_padrao WHERE tipo_contrato = ? AND ativa = 1 ORDER BY ordem'
    )
    .all(tipo) as ClausulaPadrao[]

  return padroes.map((p) => ({
    id: p.clausula_id,
    secao: p.secao,
    rotulo: p.rotulo,
    texto: p.texto,
    texto_padrao: p.texto,
    essencial: !!p.essencial,
    incluida: true,
    ordem: p.ordem
  }))
}

export function registrarHandlersContratos() {
  ipcMain.handle(
    'contratos:listar',
    async (_e, status?: StatusContrato, cliente_id?: number): Promise<Contrato[]> => {
      session.requireRole('admin', 'rh')
      const db = getDatabase()

      const where: string[] = []
      const params: any[] = []
      if (status) {
        where.push('ct.status = ?')
        params.push(status)
      }
      if (cliente_id) {
        where.push('ct.cliente_id = ?')
        params.push(cliente_id)
      }
      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

      const rows = db
        .prepare(
          `SELECT ct.*,
                  c.nome as cliente_nome, c.cnpj as cliente_cnpj, c.endereco as cliente_endereco,
                  c.representante_nome as cliente_representante,
                  c.representante_rg as cliente_rg, c.representante_cpf as cliente_cpf,
                  p.nome as projeto_nome,
                  u.nome as criado_por_nome
           FROM contratos ct
           LEFT JOIN clientes c ON c.id = ct.cliente_id
           LEFT JOIN projetos p ON p.id = ct.projeto_id
           LEFT JOIN usuarios u ON u.id = ct.criado_por_id
           ${whereClause}
           ORDER BY ct.criado_em DESC`
        )
        .all(...params) as ContratoRow[]

      return rows.map(rowToContrato)
    }
  )

  ipcMain.handle('contratos:obter', async (_e, id: number): Promise<Contrato | null> => {
    session.requireRole('admin', 'rh')
    return buscarContrato(getDatabase(), id)
  })

  ipcMain.handle(
    'contratos:listarClausulasPadrao',
    async (_e, tipo: TipoContrato): Promise<ClausulaPadrao[]> => {
      session.requireRole('admin', 'rh')
      if (!TIPOS_VALIDOS.includes(tipo)) throw new Error('Tipo de contrato inválido')
      const db = getDatabase()
      return db
        .prepare(
          'SELECT * FROM clausulas_padrao WHERE tipo_contrato = ? AND ativa = 1 ORDER BY ordem'
        )
        .all(tipo) as ClausulaPadrao[]
    }
  )

  ipcMain.handle('contratos:criar', async (_e, input: ContratoCreateInput): Promise<Contrato> => {
    const u = session.requireRole('admin', 'rh')
    const db = getDatabase()

    if (!input.titulo?.trim()) throw new Error('Título obrigatório')
    if (!input.objeto?.trim()) throw new Error('Objeto do contrato obrigatório')
    if (!input.cliente_id) throw new Error('Cliente obrigatório')
    if (!TIPOS_VALIDOS.includes(input.tipo_contrato)) {
      throw new Error('Tipo de contrato inválido')
    }
    if (input.titulo.length > 200) throw new Error('Título muito longo (máx 200 caracteres)')

    // Cláusulas: se não vier nada, carrega padrão do tipo
    const clausulas =
      input.clausulas && input.clausulas.length > 0
        ? input.clausulas
        : carregarClausulasIniciais(db, input.tipo_contrato)

    const numero = gerarNumeroContrato(db)

    const result = db
      .prepare(
        `INSERT INTO contratos
         (numero, tipo_contrato, cliente_id, projeto_id, orcamento_id, titulo, objeto,
          endereco_imovel, valor, valor_extenso, servicos_json, parcelas_json,
          multa_percentual, juros_diario, forma_pagamento, prazo_execucao,
          data_inicio, data_fim, cidade, data_assinatura, clausulas_json,
          observacoes, status, criado_por_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        numero,
        input.tipo_contrato,
        input.cliente_id,
        input.projeto_id || null,
        input.orcamento_id || null,
        input.titulo.trim(),
        input.objeto.trim(),
        input.endereco_imovel || null,
        input.valor || 0,
        input.valor_extenso || null,
        JSON.stringify(input.servicos || []),
        JSON.stringify(input.parcelas || []),
        input.multa_percentual || null,
        input.juros_diario || null,
        input.forma_pagamento || null,
        input.prazo_execucao || null,
        input.data_inicio || null,
        input.data_fim || null,
        input.cidade || 'São Paulo',
        input.data_assinatura || null,
        JSON.stringify(clausulas),
        input.observacoes || null,
        input.status || 'rascunho',
        u.id
      )

    return buscarContrato(db, result.lastInsertRowid as number) as Contrato
  })

  ipcMain.handle(
    'contratos:atualizar',
    async (_e, id: number, input: Partial<ContratoCreateInput>): Promise<Contrato> => {
      session.requireRole('admin', 'rh')
      const db = getDatabase()

      if (input.titulo && input.titulo.length > 200) {
        throw new Error('Título muito longo (máx 200 caracteres)')
      }
      if (input.tipo_contrato && !TIPOS_VALIDOS.includes(input.tipo_contrato)) {
        throw new Error('Tipo de contrato inválido')
      }

      const campos: string[] = []
      const valores: any[] = []

      // Whitelist de campos diretos (string/number/null)
      const mapaSimples: Record<string, string> = {
        tipo_contrato: 'tipo_contrato',
        cliente_id: 'cliente_id',
        projeto_id: 'projeto_id',
        orcamento_id: 'orcamento_id',
        titulo: 'titulo',
        objeto: 'objeto',
        endereco_imovel: 'endereco_imovel',
        valor: 'valor',
        valor_extenso: 'valor_extenso',
        multa_percentual: 'multa_percentual',
        juros_diario: 'juros_diario',
        forma_pagamento: 'forma_pagamento',
        prazo_execucao: 'prazo_execucao',
        data_inicio: 'data_inicio',
        data_fim: 'data_fim',
        cidade: 'cidade',
        data_assinatura: 'data_assinatura',
        observacoes: 'observacoes',
        status: 'status'
      }

      for (const [key, value] of Object.entries(input)) {
        if (mapaSimples[key]) {
          campos.push(`${mapaSimples[key]} = ?`)
          if (value === '' || value === undefined) valores.push(null)
          else valores.push(value)
        }
      }

      // Campos JSON
      if (input.servicos !== undefined) {
        campos.push('servicos_json = ?')
        valores.push(JSON.stringify(input.servicos))
      }
      if (input.parcelas !== undefined) {
        campos.push('parcelas_json = ?')
        valores.push(JSON.stringify(input.parcelas))
      }
      if (input.clausulas !== undefined) {
        campos.push('clausulas_json = ?')
        valores.push(JSON.stringify(input.clausulas))
      }

      campos.push("atualizado_em = datetime('now', 'localtime')")
      valores.push(id)

      db.prepare(`UPDATE contratos SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
      return buscarContrato(db, id) as Contrato
    }
  )

  ipcMain.handle('contratos:deletar', async (_e, id: number) => {
    try {
      session.requireRole('admin', 'rh')
      const db = getDatabase()
      db.prepare('DELETE FROM contratos WHERE id = ?').run(id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao deletar' }
    }
  })

  ipcMain.handle(
    'contratos:gerarDeOrcamento',
    async (_e, orcamento_id: number): Promise<Contrato> => {
      const u = session.requireRole('admin', 'rh')
      const db = getDatabase()

      const orc = db
        .prepare(
          `SELECT o.*, c.nome as cliente_nome FROM orcamentos o
           LEFT JOIN clientes c ON c.id = o.cliente_id
           WHERE o.id = ?`
        )
        .get(orcamento_id) as any

      if (!orc) throw new Error('Orçamento não encontrado')

      const itens = db
        .prepare('SELECT * FROM itens_orcamento WHERE orcamento_id = ? ORDER BY ordem')
        .all(orcamento_id) as any[]

      const subtotal = itens.reduce((acc: number, i: any) => acc + i.valor_total, 0)
      const total = subtotal - subtotal * (orc.desconto_percentual / 100)

      const objeto = `Prestação de serviços de engenharia conforme orçamento ${orc.numero}, contemplando: ${itens
        .map((i: any) => i.descricao)
        .join('; ')}.`

      const servicos: ServicoContrato[] = itens.map((i: any, idx: number) => ({
        ordem: idx,
        descricao: i.descricao
      }))

      const numero = gerarNumeroContrato(db)
      const tipoContrato: TipoContrato = 'generico'
      const clausulas = carregarClausulasIniciais(db, tipoContrato)

      const result = db
        .prepare(
          `INSERT INTO contratos
           (numero, tipo_contrato, cliente_id, projeto_id, orcamento_id, titulo, objeto, valor,
            forma_pagamento, prazo_execucao, servicos_json, parcelas_json, clausulas_json,
            cidade, status, criado_por_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'rascunho', ?)`
        )
        .run(
          numero,
          tipoContrato,
          orc.cliente_id,
          orc.projeto_id || null,
          orcamento_id,
          orc.titulo,
          objeto,
          total,
          orc.forma_pagamento || null,
          orc.prazo_execucao || null,
          JSON.stringify(servicos),
          '[]',
          JSON.stringify(clausulas),
          'São Paulo',
          u.id
        )

      return buscarContrato(db, result.lastInsertRowid as number) as Contrato
    }
  )
}
