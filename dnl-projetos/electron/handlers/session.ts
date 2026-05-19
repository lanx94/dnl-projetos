import type { User } from '../../shared/types'

class SessionStore {
  private currentUser: User | null = null

  set(user: User | null) {
    this.currentUser = user
  }

  get(): User | null {
    return this.currentUser
  }

  requireUser(): User {
    if (!this.currentUser) throw new Error('Não autenticado')
    return this.currentUser
  }

  requireRole(...roles: User['role'][]): User {
    const u = this.requireUser()
    if (!roles.includes(u.role)) throw new Error('Sem permissão para esta operação')
    return u
  }
}

export const session = new SessionStore()

export function validarSenha(senha: string): { valido: boolean; erros: string[] } {
  const erros: string[] = []
  if (senha.length < 8) erros.push('mínimo 8 caracteres')
  if (!/[A-Z]/.test(senha)) erros.push('uma letra maiúscula')
  if (!/[a-z]/.test(senha)) erros.push('uma letra minúscula')
  if (!/[0-9]/.test(senha)) erros.push('um número')
  if (!/[^A-Za-z0-9]/.test(senha)) erros.push('um caractere especial')
  return { valido: erros.length === 0, erros }
}

export function validarEmailEmpresa(email: string): boolean {
  return /^[a-zA-Z0-9._-]+@dnlprojetos\.com$/.test(email.trim().toLowerCase())
}
