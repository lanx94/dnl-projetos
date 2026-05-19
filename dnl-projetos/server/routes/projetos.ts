import { Router } from 'express'
import { getDatabase } from '../database/db'
import { requireRole } from '../middleware/auth'
import type { Projeto, ProjetoCreateInput } from '../../shared/types'

const router = Router()

// GET /api/projetos?cliente_id=
router.get('/', (req, res) => {
  try {
    const db = getDatabase()
    const clienteId = req.query.cliente_id ? Number(req.query.cliente_id) : undefined
    let sql = `SELECT p.*, c.nome as cliente_nome FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id`
    const params: any[] = []
    if (clienteId) { sql += ' WHERE p.cliente_id = ?'; params.push(clienteId) }
    sql += ' ORDER BY p.criado_em DESC'
    res.json(db.prepare(sql).all(...params) as Projeto[])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/projetos/meus
router.get('/meus', (req, res) => {
  try {
    const u = req.currentUser
    const db = getDatabase()
    if (u.role === 'admin') {
      return res.json(db.prepare(`SELECT p.*, c.nome as cliente_nome FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id WHERE p.status NOT IN ('concluido','cancelado') ORDER BY p.criado_em DESC`).all())
    }
    res.json(db.prepare(`SELECT p.*, c.nome as cliente_nome FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id INNER JOIN projeto_funcionario pf ON pf.projeto_id = p.id WHERE pf.usuario_id = ? AND p.status NOT IN ('concluido','cancelado') ORDER BY p.criado_em DESC`).all(u.id))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/projetos/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase()
    const row = db.prepare(`SELECT p.*, c.nome as cliente_nome FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id WHERE p.id = ?`).get(Number(req.params.id))
    res.json(row || null)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/projetos
router.post('/', requireRole('admin', 'rh'), (req, res) => {
  try {
    const input: ProjetoCreateInput = req.body
    const db = getDatabase()
    const tx = db.transaction(() => {
      const result = db.prepare(`INSERT INTO projetos (cliente_id, nome, descricao, status, revisao_atual, data_inicio, data_prevista_fim, cidade) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(input.cliente_id, input.nome, input.descricao || null, input.status || 'em_andamento', input.revisao_atual || 'R00', input.data_inicio || null, input.data_prevista_fim || null, input.cidade || null)
      const id = result.lastInsertRowid as number
      if (input.funcionarios_ids?.length) {
        const stmt = db.prepare('INSERT INTO projeto_funcionario (projeto_id, usuario_id) VALUES (?, ?)')
        for (const uid of input.funcionarios_ids) stmt.run(id, uid)
      }
      return id
    })
    const id = tx()
    res.json(db.prepare(`SELECT p.*, c.nome as cliente_nome FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id WHERE p.id = ?`).get(id))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/projetos/:id
router.put('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    const id = Number(req.params.id)
    const input: Partial<ProjetoCreateInput> = req.body
    const db = getDatabase()
    const permitidos: Record<string, string> = { nome: 'nome', descricao: 'descricao', cliente_id: 'cliente_id', status: 'status', data_inicio: 'data_inicio', data_prevista_fim: 'data_prevista_fim', cidade: 'cidade' }
    const campos: string[] = []
    const valores: any[] = []
    for (const [key, value] of Object.entries(input)) {
      if (key === 'funcionarios_ids') continue
      if (!permitidos[key]) continue
      campos.push(`${permitidos[key]} = ?`)
      valores.push(value === '' || value === undefined ? null : value)
    }
    if (campos.length > 0) { valores.push(id); db.prepare(`UPDATE projetos SET ${campos.join(', ')} WHERE id = ?`).run(...valores) }
    if (input.funcionarios_ids !== undefined) {
      db.transaction(() => {
        db.prepare('DELETE FROM projeto_funcionario WHERE projeto_id = ?').run(id)
        if (input.funcionarios_ids?.length) {
          const stmt = db.prepare('INSERT INTO projeto_funcionario (projeto_id, usuario_id) VALUES (?, ?)')
          for (const uid of input.funcionarios_ids) stmt.run(id, uid)
        }
      })()
    }
    res.json(db.prepare(`SELECT p.*, c.nome as cliente_nome FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id WHERE p.id = ?`).get(id))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/projetos/:id
router.delete('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    const id = Number(req.params.id)
    const db = getDatabase()
    const usado = db.prepare('SELECT COUNT(*) as n FROM cronometros WHERE projeto_id = ?').get(id) as { n: number }
    if (usado.n > 0) {
      res.status(409).json({ success: false, error: `Projeto não pode ser excluído — ${usado.n} cronômetro(s) registrado(s).` })
      return
    }
    db.prepare('DELETE FROM projeto_funcionario WHERE projeto_id = ?').run(id)
    db.prepare('DELETE FROM projetos WHERE id = ?').run(id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/projetos/:id/funcionarios
router.get('/:id/funcionarios', (req, res) => {
  try {
    const db = getDatabase()
    res.json(db.prepare('SELECT usuario_id FROM projeto_funcionario WHERE projeto_id = ?').all(Number(req.params.id)))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})


export default router
