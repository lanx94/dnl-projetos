import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { getDatabase } from '../database/db'
import { requireRole } from '../middleware/auth'
import type { UserCreateInput, UserUpdateInput, AuthResponse } from '../../shared/types'

const router = Router()

// Rate limiting simples em memória para login (max 10 tentativas / 15 min por IP)
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const LOGIN_MAX = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
    return true
  }
  if (entry.count >= LOGIN_MAX) return false
  entry.count++
  return true
}

function clearRateLimit(ip: string) {
  loginAttempts.delete(ip)
}

// POST /api/auth/login — público (antes do authMiddleware no index.ts)
router.post('/login', async (req, res) => {
  try {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown')
    if (!checkRateLimit(ip)) {
      res.status(429).json({ success: false, error: 'Muitas tentativas de login. Aguarde 15 minutos.' } as AuthResponse)
      return
    }
    const { email, senha } = req.body
    if (!email || !senha) {
      res.status(400).json({ success: false, error: 'Email e senha obrigatórios' } as AuthResponse)
      return
    }
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1').get(email.trim().toLowerCase()) as any
    if (!row || !row.senha_hash || !bcrypt.compareSync(senha, row.senha_hash)) {
      res.status(401).json({ success: false, error: 'Email ou senha incorretos' } as AuthResponse)
      return
    }
    const jwtKey = process.env.JWT_SECRET
    if (!jwtKey) { res.status(500).json({ success: false, error: 'JWT_SECRET não configurado' }); return }
    const secret = new TextEncoder().encode(jwtKey)
    clearRateLimit(ip)
    const token = await new SignJWT({ sub: String(row.id), email: row.email, nome: row.nome, role: row.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(secret)
    res.json({
      success: true,
      token,
      user: { id: row.id, email: row.email, nome: row.nome, cargo: row.cargo, role: row.role, ativo: !!row.ativo, criado_em: row.criado_em }
    } as AuthResponse)
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message } as AuthResponse)
  }
})

function validarSenha(senha: string): { valido: boolean; erros: string[] } {
  const erros: string[] = []
  if (senha.length < 8) erros.push('mínimo 8 caracteres')
  if (!/[A-Z]/.test(senha)) erros.push('uma letra maiúscula')
  if (!/[a-z]/.test(senha)) erros.push('uma letra minúscula')
  if (!/[0-9]/.test(senha)) erros.push('um número')
  if (!/[^A-Za-z0-9]/.test(senha)) erros.push('um caractere especial')
  return { valido: erros.length === 0, erros }
}

// Usuário atual (perfil próprio)
router.get('/current-user', (req, res) => {
  res.json(req.currentUser)
})

// Criar usuário (admin/rh)
router.post('/register', requireRole('admin', 'rh'), async (req, res) => {
  try {
    const input: UserCreateInput = req.body

    if (!input.email?.trim()) {
      res.status(400).json({ success: false, error: 'Email é obrigatório' } as AuthResponse)
      return
    }
    if (!input.nome?.trim()) {
      res.status(400).json({ success: false, error: 'Nome é obrigatório' } as AuthResponse)
      return
    }
    if (!input.senha) {
      res.status(400).json({ success: false, error: 'Senha é obrigatória' } as AuthResponse)
      return
    }

    const db = getDatabase()
    const exists = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(input.email.trim().toLowerCase())
    if (exists) {
      res.status(400).json({ success: false, error: 'Email já cadastrado' } as AuthResponse)
      return
    }

    const hash = bcrypt.hashSync(input.senha, 10)
    const result = db
      .prepare(
        `INSERT INTO usuarios (email, senha_hash, nome, cargo, role, cpf, telefone, data_admissao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.email.trim().toLowerCase(),
        hash,
        input.nome,
        input.cargo,
        input.role || 'funcionario',
        input.cpf || null,
        input.telefone || null,
        input.data_admissao || null
      )

    const created = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(result.lastInsertRowid) as any
    res.json({ success: true, user: created } as AuthResponse)
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message } as AuthResponse)
  }
})

// Atualizar usuário
router.put('/usuario', async (req, res) => {
  try {
    const atual = req.currentUser
    const input: UserUpdateInput = req.body
    const ehAdminOuRH = atual.role === 'admin' || atual.role === 'rh'

    if (!ehAdminOuRH && atual.id !== input.id) {
      res.status(403).json({ success: false, error: 'Sem permissão para editar este usuário' })
      return
    }

    const db = getDatabase()
    const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(input.id) as any
    if (!row) {
      res.status(404).json({ success: false, error: 'Usuário não encontrado' })
      return
    }

    const campos: string[] = []
    const valores: any[] = []

    if (input.nome !== undefined) { campos.push('nome = ?'); valores.push(input.nome) }
    if (input.cargo !== undefined && ehAdminOuRH) { campos.push('cargo = ?'); valores.push(input.cargo) }
    if (input.cpf !== undefined) { campos.push('cpf = ?'); valores.push(input.cpf || null) }
    if (input.telefone !== undefined) { campos.push('telefone = ?'); valores.push(input.telefone || null) }
    if (input.data_admissao !== undefined && ehAdminOuRH) { campos.push('data_admissao = ?'); valores.push(input.data_admissao || null) }
    if (input.role !== undefined && ehAdminOuRH) { campos.push('role = ?'); valores.push(input.role) }
    if (input.ativo !== undefined && ehAdminOuRH) { campos.push('ativo = ?'); valores.push(input.ativo ? 1 : 0) }

    if (campos.length > 0) {
      valores.push(input.id)
      db.prepare(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    }

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Resetar senha (admin/rh)
router.post('/resetar-senha', requireRole('admin', 'rh'), (req, res) => {
  try {
    const { usuario_id, nova_senha } = req.body
    if (!usuario_id || !nova_senha) {
      res.status(400).json({ success: false, error: 'usuario_id e nova_senha são obrigatórios' })
      return
    }
    const v = validarSenha(String(nova_senha))
    if (!v.valido) {
      res.status(400).json({ success: false, error: 'Senha deve ter ' + v.erros.join(', ') })
      return
    }
    const db = getDatabase()
    const hash = bcrypt.hashSync(nova_senha, 10)
    db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hash, usuario_id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Desativar usuário
router.post('/desativar/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    const atual = req.currentUser
    const id = Number(req.params.id)
    if (atual.id === id) {
      res.status(400).json({ success: false, error: 'Você não pode desativar a si mesmo' })
      return
    }
    getDatabase().prepare('UPDATE usuarios SET ativo = 0 WHERE id = ?').run(id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Reativar usuário
router.post('/reativar/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    getDatabase().prepare('UPDATE usuarios SET ativo = 1 WHERE id = ?').run(Number(req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Trocar própria senha
router.post('/trocar-senha', async (req, res) => {
  try {
    const u = req.currentUser
    const { senha_atual, nova_senha } = req.body

    if (!senha_atual || !nova_senha) {
      res.status(400).json({ success: false, error: 'Informe senha atual e nova senha' })
      return
    }
    const v = validarSenha(nova_senha)
    if (!v.valido) {
      res.status(400).json({ success: false, error: 'Senha nova deve ter ' + v.erros.join(', ') })
      return
    }

    const db = getDatabase()
    const row = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(u.id) as any
    if (!row) {
      res.status(404).json({ success: false, error: 'Usuário não encontrado' })
      return
    }

    if (!row.senha_hash || !row.senha_hash.startsWith('$2')) {
      res.status(400).json({ success: false, error: 'Troca de senha não suportada para este usuário. Altere sua senha pelo portal do Keycloak.' })
      return
    }

    const ok = bcrypt.compareSync(senha_atual, row.senha_hash)
    if (!ok) {
      res.status(400).json({ success: false, error: 'Senha atual incorreta' })
      return
    }

    const hash = bcrypt.hashSync(nova_senha, 10)
    db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hash, u.id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
