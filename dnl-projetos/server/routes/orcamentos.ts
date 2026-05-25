import { Router } from 'express'
import { getDatabase } from '../database/db'
import { requireRole } from '../middleware/auth'
import type { Orcamento, OrcamentoCreateInput, ItemOrcamento } from '../../shared/types'

const router = Router()

function gerarNumero(db: any): string {
  const ano = new Date().getFullYear()
  const ultimo = db.prepare(`SELECT numero FROM orcamentos WHERE numero LIKE ? ORDER BY id DESC LIMIT 1`).get(`ORC-${ano}-%`) as any
  const prox = ultimo ? parseInt(ultimo.numero.split('-')[2], 10) + 1 : 1
  return `ORC-${ano}-${String(prox).padStart(4, '0')}`
}

function calcTotais(itens: any[], desconto: number) {
  const subtotal = itens.reduce((a, i) => a + i.quantidade * i.valor_unitario, 0)
  const desconto_valor = subtotal * (desconto / 100)
  return { subtotal, desconto_valor, total: subtotal - desconto_valor }
}

function buscar(db: any, id: number): Orcamento | null {
  const o = db.prepare(`SELECT o.*, c.nome as cliente_nome, c.cnpj as cliente_cnpj, c.endereco as cliente_endereco, p.nome as projeto_nome, u.nome as criado_por_nome FROM orcamentos o LEFT JOIN clientes c ON c.id = o.cliente_id LEFT JOIN projetos p ON p.id = o.projeto_id LEFT JOIN usuarios u ON u.id = o.criado_por_id WHERE o.id = ?`).get(id) as any
  if (!o) return null
  const itens = db.prepare('SELECT * FROM itens_orcamento WHERE orcamento_id = ? ORDER BY ordem').all(id) as ItemOrcamento[]
  return { ...o, itens, ...calcTotais(itens, o.desconto_percentual) }
}

// GET /api/orcamentos?status=&cliente_id=
router.get('/', requireRole('admin', 'rh'), (req, res) => {
  try {
    const { status, cliente_id } = req.query as any
    const db = getDatabase()
    const where: string[] = []
    const params: any[] = []
    if (status) { where.push('o.status = ?'); params.push(status) }
    if (cliente_id) { where.push('o.cliente_id = ?'); params.push(Number(cliente_id)) }
    const sql = `SELECT o.*, c.nome as cliente_nome, c.cnpj as cliente_cnpj, p.nome as projeto_nome, u.nome as criado_por_nome FROM orcamentos o LEFT JOIN clientes c ON c.id = o.cliente_id LEFT JOIN projetos p ON p.id = o.projeto_id LEFT JOIN usuarios u ON u.id = o.criado_por_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.criado_em DESC`
    const orcs = db.prepare(sql).all(...params) as any[]
    res.json(orcs.map((o) => { const itens = db.prepare('SELECT * FROM itens_orcamento WHERE orcamento_id = ? ORDER BY ordem').all(o.id) as ItemOrcamento[]; return { ...o, itens, ...calcTotais(itens, o.desconto_percentual) } }))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/orcamentos/:id
router.get('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    res.json(buscar(getDatabase(), Number(req.params.id)))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/orcamentos
router.post('/', requireRole('admin', 'rh'), (req, res) => {
  try {
    const u = req.currentUser
    const input: OrcamentoCreateInput = req.body
    const db = getDatabase()
    const numero = gerarNumero(db)
    const r = db.prepare(`INSERT INTO orcamentos (numero, cliente_id, projeto_id, titulo, descricao, status, data_emissao, validade_dias, desconto_percentual, forma_pagamento, prazo_execucao, observacoes, projetos_necessarios, incluso, criado_por_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(numero, input.cliente_id, input.projeto_id || null, input.titulo, input.descricao || null, input.status || 'rascunho', input.data_emissao || new Date().toISOString().split('T')[0], input.validade_dias ?? 15, input.desconto_percentual ?? 0, input.forma_pagamento || null, input.prazo_execucao || null, input.observacoes || null, input.projetos_necessarios || null, input.incluso || null, u.id)
    const id = r.lastInsertRowid as number
    if (input.itens?.length) {
      const stmt = db.prepare('INSERT INTO itens_orcamento (orcamento_id, ordem, descricao, quantidade, unidade, valor_unitario, valor_total) VALUES (?, ?, ?, ?, ?, ?, ?)')
      for (const it of input.itens) {
        const vt = it.quantidade * it.valor_unitario
        stmt.run(id, it.ordem, it.descricao, it.quantidade, it.unidade, it.valor_unitario, vt)
      }
    }
    res.json(buscar(db, id))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/orcamentos/:id
router.put('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    const id = Number(req.params.id)
    const input: Partial<OrcamentoCreateInput> = req.body
    const db = getDatabase()
    const permitidos = new Set(['cliente_id', 'projeto_id', 'titulo', 'descricao', 'status', 'data_emissao', 'validade_dias', 'desconto_percentual', 'forma_pagamento', 'prazo_execucao', 'observacoes', 'projetos_necessarios', 'incluso'])
    const campos: string[] = []
    const valores: any[] = []
    for (const [k, v] of Object.entries(input)) {
      if (k === 'itens') continue
      if (!permitidos.has(k)) continue
      campos.push(`${k} = ?`)
      valores.push(v === '' || v === undefined ? null : v)
    }
    if (campos.length > 0) {
      campos.push("atualizado_em = datetime('now','localtime')")
      valores.push(id)
      db.prepare(`UPDATE orcamentos SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    }
    if (input.itens !== undefined) {
      db.prepare('DELETE FROM itens_orcamento WHERE orcamento_id = ?').run(id)
      const stmt = db.prepare('INSERT INTO itens_orcamento (orcamento_id, ordem, descricao, quantidade, unidade, valor_unitario, valor_total) VALUES (?, ?, ?, ?, ?, ?, ?)')
      for (const it of input.itens) stmt.run(id, it.ordem, it.descricao, it.quantidade, it.unidade, it.valor_unitario, it.quantidade * it.valor_unitario)
    }
    res.json(buscar(db, id))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/orcamentos/:id
router.delete('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    const db = getDatabase()
    db.prepare('DELETE FROM itens_orcamento WHERE orcamento_id = ?').run(Number(req.params.id))
    db.prepare('DELETE FROM orcamentos WHERE id = ?').run(Number(req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/orcamentos/:id/duplicar
router.post('/:id/duplicar', requireRole('admin', 'rh'), (req, res) => {
  try {
    const u = req.currentUser
    const original = buscar(getDatabase(), Number(req.params.id))
    if (!original) { res.status(404).json({ error: 'Orçamento não encontrado' }); return }
    const db = getDatabase()
    const numero = gerarNumero(db)
    const r = db.prepare(`INSERT INTO orcamentos (numero, cliente_id, projeto_id, titulo, descricao, status, data_emissao, validade_dias, desconto_percentual, forma_pagamento, prazo_execucao, observacoes, projetos_necessarios, incluso, criado_por_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(numero, original.cliente_id, original.projeto_id || null, `${original.titulo} (cópia)`, original.descricao || null, 'rascunho', new Date().toISOString().split('T')[0], original.validade_dias, original.desconto_percentual, original.forma_pagamento || null, original.prazo_execucao || null, original.observacoes || null, original.projetos_necessarios || null, original.incluso || null, u.id)
    const newId = r.lastInsertRowid as number
    if (original.itens?.length) {
      const stmt = db.prepare('INSERT INTO itens_orcamento (orcamento_id, ordem, descricao, quantidade, unidade, valor_unitario, valor_total) VALUES (?, ?, ?, ?, ?, ?, ?)')
      for (const it of original.itens) stmt.run(newId, it.ordem, it.descricao, it.quantidade, it.unidade, it.valor_unitario, it.valor_total)
    }
    res.json(buscar(db, newId))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
