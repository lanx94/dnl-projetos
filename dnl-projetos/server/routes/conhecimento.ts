import { Router } from 'express'
import { getDatabase } from '../database/db'
import type { ArtigoConhecimento, ArtigoCreateInput, CategoriaConhecimento } from '../../shared/types'

const router = Router()

const SELECT = `SELECT a.*, u.nome as autor_nome FROM artigos_conhecimento a LEFT JOIN usuarios u ON u.id = a.autor_id`

// GET /api/conhecimento?categoria=&busca=
router.get('/', (req, res) => {
  try {
    const { categoria, busca } = req.query as { categoria?: string; busca?: string }
    const db = getDatabase()
    const where: string[] = []
    const params: any[] = []
    if (categoria) { where.push('a.categoria = ?'); params.push(categoria) }
    if (busca) {
      where.push('(a.titulo LIKE ? OR a.conteudo LIKE ? OR a.tags LIKE ?)')
      const term = `%${busca}%`
      params.push(term, term, term)
    }
    const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.atualizado_em DESC`
    res.json(db.prepare(sql).all(...params) as ArtigoConhecimento[])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/conhecimento/:id
router.get('/:id', (req, res) => {
  try {
    const row = getDatabase().prepare(`${SELECT} WHERE a.id = ?`).get(Number(req.params.id))
    res.json(row || null)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/conhecimento
router.post('/', (req, res) => {
  try {
    const u = req.currentUser
    const input: ArtigoCreateInput = req.body
    const db = getDatabase()
    const r = db.prepare(`INSERT INTO artigos_conhecimento (categoria, titulo, conteudo, tags, autor_id) VALUES (?, ?, ?, ?, ?)`).run(input.categoria, input.titulo, input.conteudo, input.tags || null, u.id)
    res.json(db.prepare(`${SELECT} WHERE a.id = ?`).get(r.lastInsertRowid) as ArtigoConhecimento)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/conhecimento/:id
router.put('/:id', (req, res) => {
  try {
    const u = req.currentUser
    const id = Number(req.params.id)
    const input: Partial<ArtigoCreateInput> = req.body
    const db = getDatabase()
    const art = db.prepare('SELECT * FROM artigos_conhecimento WHERE id = ?').get(id) as any
    if (!art) { res.status(404).json({ error: 'Artigo não encontrado' }); return }
    if (art.autor_id !== u.id && u.role !== 'admin') { res.status(403).json({ error: 'Sem permissão' }); return }
    const campos: string[] = []
    const valores: any[] = []
    const permitidos = new Set(['categoria', 'titulo', 'conteudo', 'tags'])
    for (const [k, v] of Object.entries(input)) {
      if (!permitidos.has(k)) continue
      campos.push(`${k} = ?`)
      valores.push(v === '' ? null : v)
    }
    if (campos.length > 0) {
      campos.push("atualizado_em = datetime('now','localtime')")
      valores.push(id)
      db.prepare(`UPDATE artigos_conhecimento SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    }
    res.json(db.prepare(`${SELECT} WHERE a.id = ?`).get(id) as ArtigoConhecimento)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/conhecimento/:id
router.delete('/:id', (req, res) => {
  try {
    const u = req.currentUser
    const id = Number(req.params.id)
    const db = getDatabase()
    const art = db.prepare('SELECT * FROM artigos_conhecimento WHERE id = ?').get(id) as any
    if (!art) { res.status(404).json({ success: false, error: 'Artigo não encontrado' }); return }
    if (art.autor_id !== u.id && u.role !== 'admin') { res.status(403).json({ success: false, error: 'Sem permissão' }); return }
    db.prepare('DELETE FROM artigos_conhecimento WHERE id = ?').run(id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
