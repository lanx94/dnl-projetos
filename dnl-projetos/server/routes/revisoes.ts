import { Router } from 'express'
import { getDatabase } from '../database/db'
import type { RevisaoProjeto, RevisaoCreateInput } from '../../shared/types'

const router = Router()

// COALESCE: revisões vinculadas usam o nome atual do projeto cadastrado;
// registros antigos (sem vínculo) mantêm o texto digitado na época.
const SELECT = `
  SELECT r.*, COALESCE(p.nome, r.nome_projeto) as nome_projeto, c.nome as cliente_nome,
         u.nome as responsavel_nome, uc.nome as criado_por_nome
  FROM revisoes_projeto r
  LEFT JOIN projetos p ON p.id = r.projeto_id
  LEFT JOIN clientes c ON c.id = p.cliente_id
  LEFT JOIN usuarios u ON u.id = r.responsavel_id
  LEFT JOIN usuarios uc ON uc.id = r.criado_por_id`

// GET /api/revisoes?nome_projeto=
router.get('/', (req, res) => {
  try {
    const { nome_projeto } = req.query as { nome_projeto?: string }
    const db = getDatabase()
    const where = nome_projeto ? 'WHERE COALESCE(p.nome, r.nome_projeto) LIKE ?' : ''
    const params = nome_projeto ? [`%${nome_projeto}%`] : []
    const lista = db.prepare(`${SELECT} ${where} ORDER BY nome_projeto ASC, r.revisao ASC`).all(...params) as RevisaoProjeto[]
    res.json(lista)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/revisoes/:id
router.get('/:id', (req, res) => {
  try {
    const row = getDatabase().prepare(`${SELECT} WHERE r.id = ?`).get(Number(req.params.id))
    res.json(row || null)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/revisoes
router.post('/', (req, res) => {
  try {
    const u = req.currentUser
    const input: RevisaoCreateInput = req.body
    if (!input.revisao) {
      res.status(400).json({ error: 'revisao é obrigatória' })
      return
    }
    const db = getDatabase()

    let projetoId: number | null = null
    let nomeProjeto = (input.nome_projeto || '').trim()
    if (input.projeto_id) {
      const proj = db.prepare('SELECT id, nome FROM projetos WHERE id = ?').get(Number(input.projeto_id)) as { id: number; nome: string } | undefined
      if (!proj) {
        res.status(400).json({ error: 'Projeto não encontrado' })
        return
      }
      projetoId = proj.id
      nomeProjeto = proj.nome
    }
    if (!projetoId && !nomeProjeto) {
      res.status(400).json({ error: 'Selecione o projeto' })
      return
    }

    const r = db.prepare(
      `INSERT INTO revisoes_projeto (projeto_id, nome_projeto, revisao, descricao, data_revisao, responsavel_id, status, criado_por_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(projetoId, nomeProjeto, input.revisao, input.descricao || null, input.data_revisao || null, input.responsavel_id || null, input.status ?? 'pendente', u.id)
    res.json(db.prepare(`${SELECT} WHERE r.id = ?`).get(r.lastInsertRowid) as RevisaoProjeto)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/revisoes/:id
router.put('/:id', (req, res) => {
  try {
    const id = Number(req.params.id)
    const input: Partial<RevisaoCreateInput> = req.body
    const db = getDatabase()

    // Vincular/trocar o projeto: valida e sincroniza o nome
    if (input.projeto_id) {
      const proj = db.prepare('SELECT id, nome FROM projetos WHERE id = ?').get(Number(input.projeto_id)) as { id: number; nome: string } | undefined
      if (!proj) {
        res.status(400).json({ error: 'Projeto não encontrado' })
        return
      }
      input.nome_projeto = proj.nome
    }

    const campos: string[] = []
    const valores: any[] = []
    const permitidos = new Set(['projeto_id', 'nome_projeto', 'revisao', 'descricao', 'data_revisao', 'responsavel_id', 'status'])
    for (const [k, v] of Object.entries(input)) {
      if (!permitidos.has(k)) continue
      campos.push(`${k} = ?`)
      valores.push(v === '' ? null : v)
    }
    if (campos.length > 0) {
      campos.push("atualizado_em = datetime('now','localtime')")
      valores.push(id)
      db.prepare(`UPDATE revisoes_projeto SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    }
    res.json(db.prepare(`${SELECT} WHERE r.id = ?`).get(id) as RevisaoProjeto)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/revisoes/:id
router.delete('/:id', (req, res) => {
  try {
    getDatabase().prepare('DELETE FROM revisoes_projeto WHERE id = ?').run(Number(req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
