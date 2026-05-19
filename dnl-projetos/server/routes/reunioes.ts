import { Router } from 'express'
import { getDatabase } from '../database/db'
import { requireRole } from '../middleware/auth'
import type { ReuniaoSocios, ReuniaoCreateInput, ReuniaoTopico } from '../../shared/types'

const router = Router()

function buscar(db: any, id: number): ReuniaoSocios | null {
  const r = db.prepare(`SELECT re.*, u.nome as criado_por_nome FROM reunioes re LEFT JOIN usuarios u ON u.id = re.criado_por_id WHERE re.id = ?`).get(id) as any
  if (!r) return null
  const topicos = db.prepare('SELECT * FROM reuniao_topicos WHERE reuniao_id = ? ORDER BY ordem').all(id) as ReuniaoTopico[]
  return { ...r, topicos: topicos.map((t) => ({ ...t, concluido: !!t.concluido })) }
}

// GET /api/reunioes
router.get('/', requireRole('admin', 'rh'), (req, res) => {
  try {
    const db = getDatabase()
    const lista = db.prepare(`SELECT re.*, u.nome as criado_por_nome FROM reunioes re LEFT JOIN usuarios u ON u.id = re.criado_por_id ORDER BY re.data DESC`).all() as any[]
    res.json(lista.map((r) => {
      const topicos = db.prepare('SELECT * FROM reuniao_topicos WHERE reuniao_id = ? ORDER BY ordem').all(r.id) as ReuniaoTopico[]
      return { ...r, topicos: topicos.map((t) => ({ ...t, concluido: !!t.concluido })) }
    }))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/reunioes/:id
router.get('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    res.json(buscar(getDatabase(), Number(req.params.id)))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/reunioes
router.post('/', requireRole('admin', 'rh'), (req, res) => {
  try {
    const u = req.currentUser
    const input: ReuniaoCreateInput = req.body
    const db = getDatabase()
    const r = db.prepare(`INSERT INTO reunioes (titulo, data, observacoes, criado_por_id) VALUES (?, ?, ?, ?)`).run(input.titulo, input.data || new Date().toISOString().split('T')[0], input.observacoes || null, u.id)
    const id = r.lastInsertRowid as number
    if (input.topicos?.length) {
      const stmt = db.prepare('INSERT INTO reuniao_topicos (reuniao_id, texto, cor, ordem, concluido) VALUES (?, ?, ?, ?, ?)')
      for (const t of input.topicos) stmt.run(id, t.texto, t.cor || 'azul', t.ordem, t.concluido ? 1 : 0)
    }
    res.json(buscar(db, id))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/reunioes/:id
router.put('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    const id = Number(req.params.id)
    const input: Partial<ReuniaoCreateInput> = req.body
    const db = getDatabase()
    const campos: string[] = []
    const valores: any[] = []
    if (input.titulo !== undefined) { campos.push('titulo = ?'); valores.push(input.titulo) }
    if (input.data !== undefined) { campos.push('data = ?'); valores.push(input.data) }
    if (input.observacoes !== undefined) { campos.push('observacoes = ?'); valores.push(input.observacoes || null) }
    if (campos.length > 0) {
      campos.push("atualizado_em = datetime('now','localtime')")
      valores.push(id)
      db.prepare(`UPDATE reunioes SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    }
    if (input.topicos !== undefined) {
      db.prepare('DELETE FROM reuniao_topicos WHERE reuniao_id = ?').run(id)
      const stmt = db.prepare('INSERT INTO reuniao_topicos (reuniao_id, texto, cor, ordem, concluido) VALUES (?, ?, ?, ?, ?)')
      for (const t of input.topicos) stmt.run(id, t.texto, t.cor || 'azul', t.ordem, t.concluido ? 1 : 0)
    }
    res.json(buscar(db, id))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/reunioes/:id
router.delete('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    const db = getDatabase()
    db.prepare('DELETE FROM reuniao_topicos WHERE reuniao_id = ?').run(Number(req.params.id))
    db.prepare('DELETE FROM reunioes WHERE id = ?').run(Number(req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
