import { Router } from 'express'
import { getDatabase } from '../database/db'
import type { Evento, EventoCreateInput } from '../../shared/types'

const router = Router()

function parseEvento(row: any, nomesPorId?: Map<number, string>): Evento {
  const destinatarios: number[] = JSON.parse(row.destinatarios_json || '[]')
  const cargos: string[] = JSON.parse(row.cargos_json || '[]')
  const { destinatarios_json, cargos_json, ...resto } = row
  return {
    ...resto,
    destinatarios,
    cargos,
    destinatarios_nomes: nomesPorId
      ? destinatarios.map((id) => nomesPorId.get(id)).filter(Boolean) as string[]
      : undefined
  }
}

function mapaNomes(db: ReturnType<typeof getDatabase>): Map<number, string> {
  const rows = db.prepare('SELECT id, nome FROM usuarios').all() as Array<{ id: number; nome: string }>
  return new Map(rows.map((r) => [r.id, r.nome]))
}

// GET /api/eventos?limit=
router.get('/', (req, res) => {
  try {
    const u = req.currentUser
    const limit = Number(req.query.limit) || 50
    const db = getDatabase()
    // Globais + pessoais do usuário + direcionados a ele (por id ou por cargo/setor)
    const lista = db.prepare(`
      SELECT e.*, u.nome as autor_nome FROM eventos e
      LEFT JOIN usuarios u ON u.id = e.autor_id
      WHERE e.global = 1
         OR e.autor_id = ?
         OR EXISTS (SELECT 1 FROM json_each(e.destinatarios_json) WHERE json_each.value = ?)
         OR EXISTS (SELECT 1 FROM json_each(e.cargos_json) WHERE json_each.value = ?)
      ORDER BY e.criado_em DESC LIMIT ?
    `).all(u.id, u.id, u.cargo || '', limit) as any[]
    const nomes = mapaNomes(db)
    res.json(lista.map((e) => parseEvento(e, nomes)))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/eventos/meus?limit=
router.get('/meus', (req, res) => {
  try {
    const u = req.currentUser
    const limit = Number(req.query.limit) || 50
    const db = getDatabase()
    const lista = db.prepare(`SELECT e.*, u.nome as autor_nome FROM eventos e LEFT JOIN usuarios u ON u.id = e.autor_id WHERE e.autor_id = ? ORDER BY e.criado_em DESC LIMIT ?`).all(u.id, limit) as any[]
    const nomes = mapaNomes(db)
    res.json(lista.map((e) => parseEvento(e, nomes)))
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

    const ehAdminOuRH = u.role === 'admin' || u.role === 'rh'
    const global = ehAdminOuRH && !!input.global

    // Direcionamento (funcionários e/ou cargo/setor) é restrito a admin/RH e ignorado em posts globais
    let destinatarios: number[] = []
    let cargos: string[] = []
    if (ehAdminOuRH && !global) {
      if (Array.isArray(input.destinatarios)) {
        destinatarios = input.destinatarios.map(Number).filter((n) => Number.isInteger(n) && n > 0)
      }
      if (Array.isArray(input.cargos)) {
        cargos = input.cargos.map(String).map((c) => c.trim()).filter(Boolean)
      }
    }

    const result = db.prepare(
      `INSERT INTO eventos (autor_id, tipo, titulo, conteudo, global, data_evento, destinatarios_json, cargos_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(u.id, input.tipo, input.titulo, input.conteudo, global ? 1 : 0, input.data_evento || null, JSON.stringify(destinatarios), JSON.stringify(cargos))

    const ev = db.prepare(`SELECT e.*, u.nome as autor_nome FROM eventos e LEFT JOIN usuarios u ON u.id = e.autor_id WHERE e.id = ?`).get(result.lastInsertRowid) as any
    res.json(parseEvento(ev, mapaNomes(db)))
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
