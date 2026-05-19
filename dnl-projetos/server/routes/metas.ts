import { Router } from 'express'
import { getDatabase } from '../database/db'
import type { MetaSMART, MetaCreateInput } from '../../shared/types'

const router = Router()

const SELECT = `SELECT m.*, u.nome as criado_por_nome FROM metas m LEFT JOIN usuarios u ON u.id = m.criado_por_id`

// GET /api/metas?status=
router.get('/', (req, res) => {
  try {
    const { status } = req.query as { status?: string }
    const db = getDatabase()
    const where = status ? 'WHERE m.status = ?' : ''
    const params = status ? [status] : []
    const lista = db.prepare(`${SELECT} ${where} ORDER BY m.prazo ASC, m.criado_em DESC`).all(...params) as MetaSMART[]
    res.json(lista)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/metas/:id
router.get('/:id', (req, res) => {
  try {
    const row = getDatabase().prepare(`${SELECT} WHERE m.id = ?`).get(Number(req.params.id))
    res.json(row || null)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/metas
router.post('/', (req, res) => {
  try {
    const u = req.currentUser
    const input: MetaCreateInput = req.body
    if (!input.titulo || !input.especifico || !input.mensuravel || !input.atingivel || !input.relevante || !input.prazo) {
      res.status(400).json({ error: 'Todos os campos SMART são obrigatórios' })
      return
    }
    const db = getDatabase()
    const r = db.prepare(
      `INSERT INTO metas (titulo, especifico, mensuravel, atingivel, relevante, prazo, progresso, status, criado_por_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(input.titulo, input.especifico, input.mensuravel, input.atingivel, input.relevante, input.prazo, input.progresso ?? 0, input.status ?? 'ativa', u.id)
    res.json(db.prepare(`${SELECT} WHERE m.id = ?`).get(r.lastInsertRowid) as MetaSMART)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/metas/:id
router.put('/:id', (req, res) => {
  try {
    const id = Number(req.params.id)
    const input: Partial<MetaCreateInput> = req.body
    const db = getDatabase()
    const campos: string[] = []
    const valores: any[] = []
    const permitidos = new Set(['titulo', 'especifico', 'mensuravel', 'atingivel', 'relevante', 'prazo', 'progresso', 'status'])
    for (const [k, v] of Object.entries(input)) {
      if (!permitidos.has(k)) continue
      campos.push(`${k} = ?`)
      valores.push(v)
    }
    if (campos.length > 0) {
      campos.push("atualizado_em = datetime('now','localtime')")
      valores.push(id)
      db.prepare(`UPDATE metas SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    }
    res.json(db.prepare(`${SELECT} WHERE m.id = ?`).get(id) as MetaSMART)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/metas/:id
router.delete('/:id', (req, res) => {
  try {
    getDatabase().prepare('DELETE FROM metas WHERE id = ?').run(Number(req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
