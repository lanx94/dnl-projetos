import { Router } from 'express'
import { getDatabase } from '../database/db'
import type { Evento, EventoCreateInput } from '../../shared/types'

const router = Router()

// GET /api/eventos?limit=
router.get('/', (req, res) => {
  try {
    const u = req.currentUser
    const limit = Number(req.query.limit) || 50
    const db = getDatabase()
    // Eventos globais + pessoais do usuário
    const lista = db.prepare(`SELECT e.*, u.nome as autor_nome FROM eventos e LEFT JOIN usuarios u ON u.id = e.autor_id WHERE e.global = 1 OR e.autor_id = ? ORDER BY e.criado_em DESC LIMIT ?`).all(u.id, limit) as Evento[]
    res.json(lista)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/eventos/meus?limit=
router.get('/meus', (req, res) => {
  try {
    const u = req.currentUser
    const limit = Number(req.query.limit) || 50
    const lista = getDatabase().prepare(`SELECT e.*, u.nome as autor_nome FROM eventos e LEFT JOIN usuarios u ON u.id = e.autor_id WHERE e.autor_id = ? ORDER BY e.criado_em DESC LIMIT ?`).all(u.id, limit) as Evento[]
    res.json(lista)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/eventos
router.post('/', (req, res) => {
  try {
    const u = req.currentUser
    const input: EventoCreateInput = req.body
    const db = getDatabase()
    const result = db.prepare(`INSERT INTO eventos (autor_id, tipo, titulo, conteudo, global, data_evento) VALUES (?, ?, ?, ?, ?, ?)`).run(u.id, input.tipo, input.titulo, input.conteudo, input.global ? 1 : 0, input.data_evento || null)
    const ev = db.prepare(`SELECT e.*, u.nome as autor_nome FROM eventos e LEFT JOIN usuarios u ON u.id = e.autor_id WHERE e.id = ?`).get(result.lastInsertRowid) as Evento
    res.json(ev)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/eventos/:id
router.delete('/:id', (req, res) => {
  try {
    const u = req.currentUser
    const id = Number(req.params.id)
    const db = getDatabase()
    const ev = db.prepare('SELECT * FROM eventos WHERE id = ?').get(id) as Evento | undefined
    if (!ev) { res.status(404).json({ success: false, error: 'Evento não encontrado' }); return }
    if (ev.autor_id !== u.id && u.role !== 'admin') { res.status(403).json({ success: false, error: 'Sem permissão' }); return }
    db.prepare('DELETE FROM eventos WHERE id = ?').run(id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
