import { Router } from 'express'
import { getDatabase } from '../database/db'
import { requireRole } from '../middleware/auth'
import type { Cliente } from '../../shared/types'

const router = Router()

// GET /api/clientes
router.get('/', (req, res) => {
  try {
    res.json(getDatabase().prepare('SELECT * FROM clientes ORDER BY nome').all() as Cliente[])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/clientes
router.post('/', requireRole('admin', 'rh'), (req, res) => {
  try {
    const input = req.body
    const db = getDatabase()
    const tp = input.tipo_pessoa || 'juridica'
    if (tp !== 'fisica' && tp !== 'juridica') throw new Error('Tipo de pessoa inválido')
    const result = db.prepare(`INSERT INTO clientes (tipo_pessoa,nome,email,telefone,cnpj,inscricao_estadual,cpf,rg,endereco,contato_responsavel,observacoes,representante_nome,representante_nacionalidade,representante_naturalidade,representante_estado_civil,representante_profissao,representante_rg,representante_cpf) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(tp, input.nome, input.email || null, input.telefone || null, input.cnpj || null, input.inscricao_estadual || null, input.cpf || null, input.rg || null, input.endereco || null, input.contato_responsavel || null, input.observacoes || null, input.representante_nome || null, input.representante_nacionalidade || null, input.representante_naturalidade || null, input.representante_estado_civil || null, input.representante_profissao || null, input.representante_rg || null, input.representante_cpf || null)
    res.json(db.prepare('SELECT * FROM clientes WHERE id = ?').get(result.lastInsertRowid))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/clientes/:id
router.put('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    const id = Number(req.params.id)
    const input = req.body
    const db = getDatabase()
    const permitidos = new Set(['tipo_pessoa','nome','email','telefone','cnpj','inscricao_estadual','cpf','rg','endereco','contato_responsavel','observacoes','representante_nome','representante_nacionalidade','representante_naturalidade','representante_estado_civil','representante_profissao','representante_rg','representante_cpf'])
    const campos: string[] = []
    const valores: any[] = []
    for (const [k, v] of Object.entries(input)) {
      if (!permitidos.has(k)) continue
      campos.push(`${k} = ?`)
      valores.push(v === '' || v === undefined ? null : v)
    }
    if (campos.length > 0) { valores.push(id); db.prepare(`UPDATE clientes SET ${campos.join(', ')} WHERE id = ?`).run(...valores) }
    res.json(db.prepare('SELECT * FROM clientes WHERE id = ?').get(id))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/clientes/:id
router.delete('/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    const id = Number(req.params.id)
    const db = getDatabase()
    const impedimentos: string[] = []
    const proj = (db.prepare('SELECT COUNT(*) as n FROM projetos WHERE cliente_id = ?').get(id) as any).n
    const cont = (db.prepare('SELECT COUNT(*) as n FROM contratos WHERE cliente_id = ?').get(id) as any).n
    const orc  = (db.prepare('SELECT COUNT(*) as n FROM orcamentos WHERE cliente_id = ?').get(id) as any).n
    if (proj > 0) impedimentos.push(`${proj} projeto(s)`)
    if (cont > 0) impedimentos.push(`${cont} contrato(s)`)
    if (orc  > 0) impedimentos.push(`${orc} orçamento(s)`)
    if (impedimentos.length > 0) {
      res.status(409).json({ success: false, error: `Não é possível excluir: cliente possui ${impedimentos.join(', ')} vinculado(s)` })
      return
    }
    db.prepare('DELETE FROM clientes WHERE id = ?').run(id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
