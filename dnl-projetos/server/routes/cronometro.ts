import { Router } from 'express'
import { getDatabase } from '../database/db'
import type { Cronometro } from '../../shared/types'

const router = Router()

function calcDuracao(inicio: string, fim: string | null | undefined): number | undefined {
  if (!fim) return undefined
  return Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 1000)
}

// POST /api/cronometro/iniciar
router.post('/iniciar', (req, res) => {
  try {
    const u = req.currentUser
    const { projeto_id, observacao } = req.body
    if (!projeto_id) throw new Error('projeto_id é obrigatório')
    const db = getDatabase()

    const projetoExiste = db.prepare('SELECT id FROM projetos WHERE id = ?').get(Number(projeto_id))
    if (!projetoExiste) throw new Error('Projeto não encontrado')

    const ativo = db.prepare('SELECT * FROM cronometros WHERE usuario_id = ? AND fim IS NULL').get(u.id) as Cronometro | undefined
    if (ativo) throw new Error('Você já tem um cronômetro ativo. Pare-o antes de iniciar outro.')

    const result = db.prepare('INSERT INTO cronometros (usuario_id, projeto_id, inicio, observacao) VALUES (?, ?, datetime(\'now\',\'localtime\'), ?)').run(u.id, projeto_id, observacao || null)
    const c = db.prepare(`SELECT cr.*, p.nome as projeto_nome FROM cronometros cr LEFT JOIN projetos p ON p.id = cr.projeto_id WHERE cr.id = ?`).get(result.lastInsertRowid) as any
    c.duracao_segundos = undefined
    res.json(c)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/cronometro/parar/:id
router.post('/parar/:id', (req, res) => {
  try {
    const u = req.currentUser
    const id = Number(req.params.id)
    const db = getDatabase()
    const c = db.prepare('SELECT * FROM cronometros WHERE id = ? AND usuario_id = ?').get(id, u.id) as Cronometro | undefined
    if (!c) throw new Error('Cronômetro não encontrado')
    if (c.fim) throw new Error('Cronômetro já foi parado')
    db.prepare("UPDATE cronometros SET fim = datetime('now','localtime') WHERE id = ?").run(id)
    const updated = db.prepare(`SELECT cr.*, p.nome as projeto_nome FROM cronometros cr LEFT JOIN projetos p ON p.id = cr.projeto_id WHERE cr.id = ?`).get(id) as any
    updated.duracao_segundos = calcDuracao(updated.inicio, updated.fim)
    res.json(updated)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/cronometro/ativo
router.get('/ativo', (req, res) => {
  try {
    const u = req.currentUser
    const c = getDatabase().prepare(`SELECT cr.*, p.nome as projeto_nome FROM cronometros cr LEFT JOIN projetos p ON p.id = cr.projeto_id WHERE cr.usuario_id = ? AND cr.fim IS NULL`).get(u.id) as any
    res.json(c || null)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/cronometro/historico?limit=
router.get('/historico', (req, res) => {
  try {
    const u = req.currentUser
    const limit = Number(req.query.limit) || 20
    const lista = getDatabase().prepare(`SELECT cr.*, p.nome as projeto_nome FROM cronometros cr LEFT JOIN projetos p ON p.id = cr.projeto_id WHERE cr.usuario_id = ? ORDER BY cr.inicio DESC LIMIT ?`).all(u.id, limit) as any[]
    const result = lista.map((c) => ({ ...c, duracao_segundos: calcDuracao(c.inicio, c.fim) }))
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
