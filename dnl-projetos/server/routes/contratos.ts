import { Router } from 'express'
import { getDatabase } from '../database/db'
import { requireRole } from '../middleware/auth'
import type { Contrato, ContratoCreateInput, ClausulaContrato, ClausulaPadrao, ServicoContrato, ParcelaContrato, TipoContrato } from '../../shared/types'

const router = Router()

const CONTRATO_SELECT = `SELECT ct.*, c.nome as cliente_nome, c.tipo_pessoa as cliente_tipo_pessoa, c.cnpj as cliente_cnpj, c.endereco as cliente_endereco, c.representante_nome as cliente_representante, c.representante_rg as cliente_rg, c.representante_cpf as cliente_cpf, c.representante_estado_civil as cliente_estado_civil, c.representante_profissao as cliente_profissao, c.representante_nacionalidade as cliente_nacionalidade, c.representante_naturalidade as cliente_naturalidade, p.nome as projeto_nome, u.nome as criado_por_nome FROM contratos ct LEFT JOIN clientes c ON c.id = ct.cliente_id LEFT JOIN projetos p ON p.id = ct.projeto_id LEFT JOIN usuarios u ON u.id = ct.criado_por_id`

function parseSafe<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback
  try { return JSON.parse(json) as T } catch { return fallback }
}

function rowToContrato(row: any): Contrato {
  const tiposArr = parseSafe<TipoContrato[]>(row.tipos_contrato_json, [])
  return {
    ...row,
    servicos: parseSafe<ServicoContrato[]>(row.servicos_json, []),
    parcelas: parseSafe<ParcelaContrato[]>(row.parcelas_json, []),
    clausulas: parseSafe<ClausulaContrato[]>(row.clausulas_json, []),
    tipos_contrato: tiposArr.length > 0 ? tiposArr : (row.tipo_contrato ? [row.tipo_contrato] : ['generico'])
  }
}

function gerarNumero(db: any): string {
  const ano = new Date().getFullYear()
  const ult = db.prepare(`SELECT numero FROM contratos WHERE numero LIKE ? ORDER BY id DESC LIMIT 1`).get(`CONT-${ano}-%`) as any
  const prox = ult ? parseInt(ult.numero.split('-')[2], 10) + 1 : 1
  return `CONT-${ano}-${String(prox).padStart(4, '0')}`
}

// GET /api/contratos?status=&cliente_id=
router.get('/', requireRole('admin', 'rh'), (req, res) => {
  try {
    const { status, cliente_id } = req.query as any
    const db = getDatabase()
    const where: string[] = []
    const params: any[] = []
    if (status) { where.push('ct.status = ?'); params.push(status) }
    if (cliente_id) { where.push('ct.cliente_id = ?'); params.push(Number(cliente_id)) }
    const sql = `${CONTRATO_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ct.criado_em DESC`
    res.json((db.prepare(sql).all(...params) as any[]).map(rowToContrato))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/contratos/clausulas-padrao?tipo=
router.get('/clausulas-padrao', requireRole('admin', 'rh'), (req, res) => {
  try {
    const { tipo } = req.query as { tipo: TipoContrato }
    res.json(getDatabase().prepare('SELECT * FROM clausulas_padrao WHERE tipo_contrato = ? AND ativa = 1 ORDER BY ordem').all(tipo) as ClausulaPadrao[])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/contratos/:id
router.get('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    const row = getDatabase().prepare(`${CONTRATO_SELECT} WHERE ct.id = ?`).get(Number(req.params.id)) as any
    res.json(row ? rowToContrato(row) : null)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/contratos
router.post('/', requireRole('admin', 'rh'), (req, res) => {
  try {
    const u = req.currentUser
    const input: ContratoCreateInput = req.body
    if (!input.titulo?.trim()) throw new Error('Título obrigatório')
    if (!input.objeto?.trim()) throw new Error('Objeto do contrato obrigatório')
    const db = getDatabase()
    const numero = gerarNumero(db)
    const tiposArr = input.tipos_contrato && input.tipos_contrato.length > 0
      ? input.tipos_contrato
      : [input.tipo_contrato || 'generico']
    const r = db.prepare(`INSERT INTO contratos (numero, tipo_contrato, tipos_contrato_json, cliente_id, projeto_id, orcamento_id, titulo, objeto, endereco_imovel, valor, valor_extenso, servicos_json, parcelas_json, multa_percentual, juros_diario, forma_pagamento, prazo_execucao, data_inicio, data_fim, cidade, data_assinatura, clausulas_json, observacoes, status, contratada_qualificacao, criado_por_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(numero, tiposArr[0], JSON.stringify(tiposArr), input.cliente_id, input.projeto_id || null, input.orcamento_id || null, input.titulo, input.objeto, input.endereco_imovel || null, input.valor || 0, input.valor_extenso || null, JSON.stringify(input.servicos || []), JSON.stringify(input.parcelas || []), input.multa_percentual || null, input.juros_diario || null, input.forma_pagamento || null, input.prazo_execucao || null, input.data_inicio || null, input.data_fim || null, input.cidade || 'São Paulo', input.data_assinatura || null, JSON.stringify(input.clausulas || []), input.observacoes || null, input.status || 'rascunho', input.contratada_qualificacao || null, u.id)
    const row = db.prepare(`${CONTRATO_SELECT} WHERE ct.id = ?`).get(r.lastInsertRowid) as any
    res.json(rowToContrato(row))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/contratos/:id
router.put('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    const id = Number(req.params.id)
    const input: Partial<ContratoCreateInput> = req.body
    const db = getDatabase()
    const permitidos = new Set(['tipo_contrato','cliente_id','projeto_id','orcamento_id','titulo','objeto','endereco_imovel','valor','valor_extenso','multa_percentual','juros_diario','forma_pagamento','prazo_execucao','data_inicio','data_fim','cidade','data_assinatura','observacoes','status','contratada_qualificacao'])
    const campos: string[] = []
    const valores: any[] = []
    for (const [k, v] of Object.entries(input)) {
      if (k === 'servicos' || k === 'parcelas' || k === 'clausulas') { campos.push(`${k}_json = ?`); valores.push(JSON.stringify(v)); continue }
      if (k === 'tipos_contrato') { campos.push('tipos_contrato_json = ?'); valores.push(JSON.stringify(v || [])); continue }
      if (!permitidos.has(k)) continue
      campos.push(`${k} = ?`)
      valores.push(v === '' || v === undefined ? null : v)
    }
    if (campos.length > 0) {
      campos.push("atualizado_em = datetime('now','localtime')")
      valores.push(id)
      db.prepare(`UPDATE contratos SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    }
    const row = db.prepare(`${CONTRATO_SELECT} WHERE ct.id = ?`).get(id) as any
    res.json(rowToContrato(row))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/contratos/:id
router.delete('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    getDatabase().prepare('DELETE FROM contratos WHERE id = ?').run(Number(req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/contratos/gerar-de-orcamento/:orcamento_id
router.post('/gerar-de-orcamento/:orcamento_id', requireRole('admin', 'rh'), (req, res) => {
  try {
    const u = req.currentUser
    const orcId = Number(req.params.orcamento_id)
    const db = getDatabase()
    const orc = db.prepare(`SELECT o.*, c.nome as cliente_nome, c.cnpj as cliente_cnpj, c.endereco as cliente_endereco FROM orcamentos o LEFT JOIN clientes c ON c.id = o.cliente_id WHERE o.id = ?`).get(orcId) as any
    if (!orc) throw new Error('Orçamento não encontrado')
    const itensOrc = db.prepare('SELECT * FROM itens_orcamento WHERE orcamento_id = ?').all(orcId) as any[]
    const subtotal = itensOrc.reduce((a: number, i: any) => a + i.quantidade * i.valor_unitario, 0)
    const desconto = orc.desconto_percentual || 0
    const totalCalculado = subtotal - subtotal * (desconto / 100)
    const numero = gerarNumero(db)
    const clausulas = db.prepare('SELECT * FROM clausulas_padrao WHERE tipo_contrato = ? AND ativa = 1 ORDER BY ordem').all('generico').map((p: any) => ({ id: p.clausula_id, secao: p.secao, rotulo: p.rotulo, texto: p.texto, texto_padrao: p.texto, essencial: !!p.essencial, incluida: true, ordem: p.ordem }))
    const r = db.prepare(`INSERT INTO contratos (numero, tipo_contrato, cliente_id, projeto_id, orcamento_id, titulo, objeto, valor, clausulas_json, status, criado_por_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(numero, 'generico', orc.cliente_id, orc.projeto_id || null, orcId, orc.titulo, orc.titulo, totalCalculado, JSON.stringify(clausulas), 'rascunho', u.id)
    const row = db.prepare(`${CONTRATO_SELECT} WHERE ct.id = ?`).get(r.lastInsertRowid) as any
    res.json(rowToContrato(row))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
