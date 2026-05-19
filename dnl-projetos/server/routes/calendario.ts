import { Router } from 'express'
import { getDatabase } from '../database/db'
import type { CalendarioPostagem, CalendarioCreateInput, StatusPostagem } from '../../shared/types'

const router = Router()

const SELECT = `SELECT c.*, u.nome as criado_por_nome FROM calendario_postagem c LEFT JOIN usuarios u ON u.id = c.criado_por_id`

// GET /api/calendario
router.get('/', (req, res) => {
  try {
    const lista = getDatabase().prepare(`${SELECT} ORDER BY c.status, c.ordem ASC, c.criado_em DESC`).all() as CalendarioPostagem[]
    res.json(lista)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/calendario
router.post('/', (req, res) => {
  try {
    const u = req.currentUser
    const input: CalendarioCreateInput = req.body
    if (!input.nome) { res.status(400).json({ error: 'nome é obrigatório' }); return }
    const db = getDatabase()
    const maxOrdem = db.prepare(`SELECT COALESCE(MAX(ordem),0) as m FROM calendario_postagem WHERE status = ?`).get(input.status ?? 'ideia') as { m: number }
    const r = db.prepare(
      `INSERT INTO calendario_postagem (nome, status, rede_social, objetivo, servico, roteiro, legenda, formato, data_postagem, ordem, criado_por_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.nome, input.status ?? 'ideia',
      input.rede_social || null, input.objetivo || null, input.servico || null,
      input.roteiro || null, input.legenda || null, input.formato || null,
      input.data_postagem || null, maxOrdem.m + 1, u.id
    )
    res.json(db.prepare(`${SELECT} WHERE c.id = ?`).get(r.lastInsertRowid) as CalendarioPostagem)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/calendario/:id
router.put('/:id', (req, res) => {
  try {
    const id = Number(req.params.id)
    const input: Partial<CalendarioCreateInput> = req.body
    const db = getDatabase()
    const campos: string[] = []
    const valores: any[] = []
    const permitidos = new Set(['nome', 'status', 'rede_social', 'objetivo', 'servico', 'roteiro', 'legenda', 'formato', 'data_postagem', 'ordem'])
    for (const [k, v] of Object.entries(input)) {
      if (!permitidos.has(k)) continue
      campos.push(`${k} = ?`)
      valores.push(v === '' ? null : v)
    }
    if (campos.length > 0) {
      campos.push("atualizado_em = datetime('now','localtime')")
      valores.push(id)
      db.prepare(`UPDATE calendario_postagem SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    }
    res.json(db.prepare(`${SELECT} WHERE c.id = ?`).get(id) as CalendarioPostagem)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/calendario/:id/mover — muda de coluna
router.post('/:id/mover', (req, res) => {
  try {
    const id = Number(req.params.id)
    const { novo_status } = req.body as { novo_status: StatusPostagem }
    const db = getDatabase()
    const maxOrdem = db.prepare(`SELECT COALESCE(MAX(ordem),0) as m FROM calendario_postagem WHERE status = ?`).get(novo_status) as { m: number }
    db.prepare(`UPDATE calendario_postagem SET status = ?, ordem = ?, atualizado_em = datetime('now','localtime') WHERE id = ?`)
      .run(novo_status, maxOrdem.m + 1, id)
    res.json(db.prepare(`${SELECT} WHERE c.id = ?`).get(id) as CalendarioPostagem)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/calendario/:id
router.delete('/:id', (req, res) => {
  try {
    getDatabase().prepare('DELETE FROM calendario_postagem WHERE id = ?').run(Number(req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
