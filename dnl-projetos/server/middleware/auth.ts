import { Request, Response, NextFunction } from 'express'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { getDatabase } from '../database/db'
import type { User, UserRole } from '../../shared/types'

declare global {
  namespace Express {
    interface Request {
      currentUser: User
    }
  }
}

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null

function getJWKS() {
  if (!jwksCache) {
    const url = `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/certs`
    jwksCache = createRemoteJWKSet(new URL(url))
  }
  return jwksCache
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    nome: row.nome,
    cargo: row.cargo,
    role: row.role as UserRole,
    cpf: row.cpf || undefined,
    telefone: row.telefone || undefined,
    data_admissao: row.data_admissao || undefined,
    ativo: !!row.ativo,
    criado_em: row.criado_em
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Login endpoint is public
  if (req.method === 'POST' && req.path.toLowerCase() === '/auth/login') return next()

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação ausente' })
    return
  }

  const token = header.slice(7)
  const db = getDatabase()

  // Path 1: local JWT signed with JWT_SECRET (HS256)
  const jwtSecret = process.env.JWT_SECRET
  if (jwtSecret) {
    try {
      const secret = new TextEncoder().encode(jwtSecret)
      const { payload } = await jwtVerify(token, secret)
      const userId = Number(payload.sub)
      const row = db.prepare('SELECT * FROM usuarios WHERE id = ? AND ativo = 1').get(userId) as any
      if (row) {
        req.currentUser = rowToUser(row)
        return next()
      }
    } catch {
      // Not a local JWT — fall through to Keycloak
    }
  }

  // Path 2: Keycloak JWKS
  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`,
      audience: process.env.KEYCLOAK_CLIENT_ID
    })

    const kp = payload as any
    const email = (kp.email || kp.preferred_username || '').toLowerCase()
    if (!email) throw new Error('No email in token')

    let row = db.prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1').get(email) as any
    if (!row) {
      const roles: string[] = kp.realm_access?.roles || []
      const role: UserRole = roles.includes('admin') ? 'admin' : roles.includes('rh') ? 'rh' : 'funcionario'
      const r = db.prepare(`INSERT INTO usuarios (email, nome, cargo, role, keycloak_id) VALUES (?, ?, ?, ?, ?)`)
        .run(email, email.split('@')[0], 'Funcionário', role, kp.sub)
      row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(r.lastInsertRowid) as any
    } else if (!row.keycloak_id) {
      db.prepare('UPDATE usuarios SET keycloak_id = ? WHERE id = ?').run(kp.sub, row.id)
    }

    if (!row) throw new Error('User not found')
    req.currentUser = rowToUser(row)
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.currentUser
    if (!user) { res.status(401).json({ error: 'Não autenticado' }); return }
    if (!roles.includes(user.role)) { res.status(403).json({ error: 'Sem permissão para esta operação' }); return }
    next()
  }
}
