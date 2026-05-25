import { Router } from 'express'
import { getDatabase } from '../database/db'
import { requireRole } from '../middleware/auth'
import type { Lead, LeadCreateInput, StatusLead } from '../../shared/types'

const router = Router()

const SELECT = `SELECT l.*, u.nome as responsavel_nome, c.nome as cliente_nome, o.numero as orcamento_numero FROM leads l LEFT JOIN usuarios u ON u.id = l.responsavel_id LEFT JOIN clientes c ON c.id = l.cliente_id LEFT JOIN orcamentos o ON o.id = l.orcamento_id`

// GET /api/leads?status=
router.get('/', requireRole('admin', 'rh'), (req, res) => {
  try {
    const { status } = req.query as { status?: string }
    const db = getDatabase()
    const sql = `${SELECT} ${status ? 'WHERE l.status = ?' : ''} ORDER BY l.ordem, l.criado_em DESC`
    res.json(status ? db.prepare(sql).all(status) : db.prepare(sql).all())
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/leads
router.post('/', requireRole('admin', 'rh'), (req, res) => {
  try {
    const input: LeadCreateInput = req.body
    const db = getDatabase()
    const maxOrdem = (db.prepare(`SELECT MAX(ordem) as m FROM leads WHERE status = ?`).get(input.status || 'lead') as any)?.m || 0
    const r = db.prepare(`INSERT INTO leads (nome, status, valor_estimado, responsavel_id, cliente_id, orcamento_id, contatado_em, data_alvo, observacoes, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.nome, input.status || 'lead', input.valor_estimado || 0, input.responsavel_id || null, input.cliente_id || null, input.orcamento_id || null, input.contatado_em || null, input.data_alvo || null, input.observacoes || null, maxOrdem + 1)
    res.json(db.prepare(`${SELECT} WHERE l.id = ?`).get(r.lastInsertRowid) as Lead)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/leads/:id
router.put('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    const id = Number(req.params.id)
    const input: Partial<LeadCreateInput> = req.body
    const db = getDatabase()
    const permitidos = new Set(['nome', 'status', 'valor_estimado', 'responsavel_id', 'cliente_id', 'orcamento_id', 'contatado_em', 'data_alvo', 'observacoes'])
    const campos: string[] = []
    const valores: any[] = []
    for (const [k, v] of Object.entries(input)) {
      if (!permitidos.has(k)) continue
      campos.push(`${k} = ?`)
      valores.push(v === '' || v === undefined ? null : v)
    }
    if (campos.length > 0) {
      campos.push("atualizado_em = datetime('now','localtime')")
      valores.push(id)
      db.prepare(`UPDATE leads SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    }
    res.json(db.prepare(`${SELECT} WHERE l.id = ?`).get(id) as Lead)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/leads/:id/mover
router.post('/:id/mover', requireRole('admin', 'rh'), (req, res) => {
  try {
    const id = Number(req.params.id)
    const { novo_status, nova_ordem } = req.body
    const db = getDatabase()
    db.prepare("UPDATE leads SET status = ?, ordem = ?, atualizado_em = datetime('now','localtime') WHERE id = ?").run(novo_status, nova_ordem, id)
    res.json(db.prepare(`${SELECT} WHERE l.id = ?`).get(id) as Lead)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/leads/:id
router.delete('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    getDatabase().prepare('DELETE FROM leads WHERE id = ?').run(Number(req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
