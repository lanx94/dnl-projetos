import { ipcMain } from 'electron'
import bcrypt from 'bcryptjs'
import { getDatabase } from '../database/db'
import { session, validarSenha, validarEmailEmpresa } from './session'
import type { User, UserCreateInput, UserUpdateInput, AuthResponse } from '../../shared/types'

interface UsuarioRow {
  id: number
  email: string
  senha_hash: string
  nome: string
  cargo: string
  role: User['role']
  cpf: string | null
  telefone: string | null
  data_admissao: string | null
  ativo: number
  criado_em: string
}

function rowToUser(r: UsuarioRow): User {
  return {
    id: r.id,
    email: r.email,
    nome: r.nome,
    cargo: r.cargo,
    role: r.role,
    cpf: r.cpf || undefined,
    telefone: r.telefone || undefined,
    data_admissao: r.data_admissao || undefined,
    ativo: !!r.ativo,
    criado_em: r.criado_em
  }
}

// Rate limiting in-memory contra brute force (não persiste reinício do app)
const tentativasLogin = new Map<string, { count: number; ultima: number }>()
const MAX_TENTATIVAS = 5
const JANELA_MS = 15 * 60 * 1000 // 15 minutos

function checarRateLimit(email: string): { bloqueado: boolean; tentativasRestantes: number } {
  const e = email.trim().toLowerCase()
  const agora = Date.now()
  const reg = tentativasLogin.get(e)
  // Limpa registros antigos
  if (reg && agora - reg.ultima > JANELA_MS) {
    tentativasLogin.delete(e)
    return { bloqueado: false, tentativasRestantes: MAX_TENTATIVAS }
  }
  if (reg && reg.count >= MAX_TENTATIVAS) {
    return { bloqueado: true, tentativasRestantes: 0 }
  }
  return { bloqueado: false, tentativasRestantes: MAX_TENTATIVAS - (reg?.count || 0) }
}

function registrarTentativaFalha(email: string) {
  const e = email.trim().toLowerCase()
  const agora = Date.now()
  const reg = tentativasLogin.get(e)
  if (reg && agora - reg.ultima < JANELA_MS) {
    reg.count++
    reg.ultima = agora
  } else {
    tentativasLogin.set(e, { count: 1, ultima: agora })
  }
}

function limparTentativas(email: string) {
  tentativasLogin.delete(email.trim().toLowerCase())
}

export function registrarHandlersAuth() {
  ipcMain.handle(
    'auth:login',
    async (_e, email: string, senha: string): Promise<AuthResponse> => {
      try {
        // Validação de entrada
        if (!email || typeof email !== 'string' || email.length > 100) {
          return { success: false, error: 'Email inválido' }
        }
        if (!senha || typeof senha !== 'string' || senha.length > 200) {
          return { success: false, error: 'Senha inválida' }
        }

        // Rate limit
        const limite = checarRateLimit(email)
        if (limite.bloqueado) {
          return {
            success: false,
            error: 'Muitas tentativas falhas. Aguarde 15 minutos e tente novamente.'
          }
        }

        const db = getDatabase()
        const row = db
          .prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1')
          .get(email.trim().toLowerCase()) as UsuarioRow | undefined

        if (!row) {
          registrarTentativaFalha(email)
          // Pequeno delay para mitigar timing attacks (verificar usuário inexistente)
          await new Promise((r) => setTimeout(r, 200))
          return { success: false, error: 'Email ou senha incorretos' }
        }

        const ok = bcrypt.compareSync(senha, row.senha_hash)
        if (!ok) {
          registrarTentativaFalha(email)
          return { success: false, error: 'Email ou senha incorretos' }
        }

        // Login OK — limpa tentativas
        limparTentativas(email)
        const user = rowToUser(row)
        session.set(user)
        return { success: true, user }
      } catch (err: any) {
        return { success: false, error: err.message || 'Erro no login' }
      }
    }
  )

  ipcMain.handle('auth:logout', async () => {
    session.set(null)
  })

  ipcMain.handle('auth:current', async (): Promise<User | null> => {
    return session.get()
  })

  ipcMain.handle(
    'auth:register',
    async (_e, input: UserCreateInput): Promise<AuthResponse> => {
      try {
        session.requireRole('admin', 'rh')

        if (!validarEmailEmpresa(input.email)) {
          return { success: false, error: 'Email deve ser do domínio @dnlprojetos.com' }
        }

        const v = validarSenha(input.senha)
        if (!v.valido) {
          return { success: false, error: 'Senha deve ter ' + v.erros.join(', ') }
        }

        const db = getDatabase()
        const exists = db
          .prepare('SELECT id FROM usuarios WHERE email = ?')
          .get(input.email.trim().toLowerCase())
        if (exists) return { success: false, error: 'Email já cadastrado' }

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
            input.role,
            input.cpf || null,
            input.telefone || null,
            input.data_admissao || null
          )

        const created = db
          .prepare('SELECT * FROM usuarios WHERE id = ?')
          .get(result.lastInsertRowid) as UsuarioRow
        return { success: true, user: rowToUser(created) }
      } catch (err: any) {
        return { success: false, error: err.message || 'Erro no cadastro' }
      }
    }
  )

  ipcMain.handle('auth:atualizarUsuario', async (_e, input: UserUpdateInput) => {
    try {
      const atual = session.requireUser()
      const ehAdminOuRH = atual.role === 'admin' || atual.role === 'rh'

      // Admin/RH editam qualquer um. Funcionário só edita a si mesmo (e não pode mudar role/cargo)
      if (!ehAdminOuRH && atual.id !== input.id) {
        return { success: false, error: 'Sem permissão para editar este usuário' }
      }

      const db = getDatabase()
      const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(input.id) as
        | UsuarioRow
        | undefined
      if (!row) return { success: false, error: 'Usuário não encontrado' }

      const campos: string[] = []
      const valores: any[] = []

      if (input.nome !== undefined) {
        campos.push('nome = ?')
        valores.push(input.nome)
      }
      // Cargo: só admin/RH pode alterar
      if (input.cargo !== undefined && ehAdminOuRH) {
        campos.push('cargo = ?')
        valores.push(input.cargo)
      }
      if (input.cpf !== undefined) {
        campos.push('cpf = ?')
        valores.push(input.cpf || null)
      }
      if (input.telefone !== undefined) {
        campos.push('telefone = ?')
        valores.push(input.telefone || null)
      }
      // Data admissão: só admin/RH
      if (input.data_admissao !== undefined && ehAdminOuRH) {
        campos.push('data_admissao = ?')
        valores.push(input.data_admissao || null)
      }
      if (input.role !== undefined && ehAdminOuRH) {
        campos.push('role = ?')
        valores.push(input.role)
      }
      if (input.ativo !== undefined && ehAdminOuRH) {
        campos.push('ativo = ?')
        valores.push(input.ativo ? 1 : 0)
      }

      if (campos.length === 0) return { success: true }

      valores.push(input.id)
      db.prepare(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`).run(...valores)

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao atualizar' }
    }
  })

  ipcMain.handle(
    'auth:resetarSenha',
    async (_e, usuario_id: number, nova_senha: string) => {
      try {
        session.requireRole('admin', 'rh')

        const v = validarSenha(nova_senha)
        if (!v.valido) {
          return { success: false, error: 'Senha deve ter ' + v.erros.join(', ') }
        }

        const db = getDatabase()
        const hash = bcrypt.hashSync(nova_senha, 10)
        db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hash, usuario_id)
        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message || 'Erro ao resetar senha' }
      }
    }
  )

  ipcMain.handle('auth:desativarUsuario', async (_e, usuario_id: number) => {
    try {
      const atual = session.requireRole('admin', 'rh')
      if (atual.id === usuario_id) {
        return { success: false, error: 'Você não pode desativar a si mesmo' }
      }
      const db = getDatabase()
      db.prepare('UPDATE usuarios SET ativo = 0 WHERE id = ?').run(usuario_id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao desativar' }
    }
  })

  ipcMain.handle('auth:reativarUsuario', async (_e, usuario_id: number) => {
    try {
      session.requireRole('admin', 'rh')
      const db = getDatabase()
      db.prepare('UPDATE usuarios SET ativo = 1 WHERE id = ?').run(usuario_id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao reativar' }
    }
  })

  // Usuário troca a própria senha (precisa fornecer a senha atual)
  ipcMain.handle(
    'auth:trocarMinhaSenha',
    async (_e, senha_atual: string, nova_senha: string) => {
      try {
        const u = session.requireUser()
        if (!senha_atual || !nova_senha) {
          return { success: false, error: 'Informe senha atual e nova senha' }
        }

        const v = validarSenha(nova_senha)
        if (!v.valido) {
          return { success: false, error: 'Senha nova deve ter ' + v.erros.join(', ') }
        }

        const db = getDatabase()
        const row = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(u.id) as
          | { senha_hash: string }
          | undefined
        if (!row) return { success: false, error: 'Usuário não encontrado' }

        const ok = bcrypt.compareSync(senha_atual, row.senha_hash)
        if (!ok) return { success: false, error: 'Senha atual incorreta' }

        const hash = bcrypt.hashSync(nova_senha, 10)
        db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hash, u.id)
        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message || 'Erro ao trocar senha' }
      }
    }
  )
}
