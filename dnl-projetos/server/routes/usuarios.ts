import { Router } from 'express'
import { getDatabase } from '../database/db'
import { requireRole } from '../middleware/auth'

const router = Router()

// GET /api/usuarios — ativos (visível a todos para dropdowns de projetos/CRM)
// Campos sensíveis (cpf, telefone, data_admissao) só para admin/rh — evita expor PII de colegas.
router.get('/', (req, res) => {
  try {
    const u = req.currentUser
    const ehAdminOuRH = u.role === 'admin' || u.role === 'rh'
    const cols = ehAdminOuRH
      ? 'id,email,nome,cargo,role,cpf,telefone,data_admissao,ativo,criado_em'
      : 'id,email,nome,cargo,role,ativo,criado_em'
    res.json(getDatabase().prepare(`SELECT ${cols} FROM usuarios WHERE ativo = 1 ORDER BY nome`).all())
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/usuarios/todos — inclui inativos
router.get('/todos', requireRole('admin', 'rh'), (req, res) => {
  try {
    res.json(getDatabase().prepare(`SELECT id,email,nome,cargo,role,cpf,telefone,data_admissao,ativo,criado_em FROM usuarios ORDER BY ativo DESC, nome`).all())
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
