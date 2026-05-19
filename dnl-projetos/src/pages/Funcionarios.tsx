import { useEffect, useState, FormEvent } from 'react'
import { Plus, X, Edit2, KeyRound, UserX, UserCheck } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { User, UserRole } from '@shared/types'
import { maskCPF, maskTelefone } from '../utils/masks'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  rh: 'RH',
  funcionario: 'Funcionário'
}

const ROLE_COR: Record<UserRole, string> = {
  admin: 'bg-ink-900 text-cream-50',
  rh: 'bg-terra-100 text-terra-700',
  funcionario: 'bg-cream-300 text-ink-700'
}

export default function FuncionariosPage() {
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [showCadastro, setShowCadastro] = useState(false)
  const [editando, setEditando] = useState<User | null>(null)
  const [resetandoSenha, setResetandoSenha] = useState<User | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const lista = await api.usuarios.listarTodos()
    setUsuarios(lista as User[])
  }

  async function desativar(u: User) {
    if (!confirm(`Desativar ${u.nome}? Ele não poderá mais fazer login.`)) return
    const r = await api.auth.desativarUsuario(u.id)
    if (r.success) carregar()
    else alert(r.error || 'Erro ao desativar')
  }

  async function reativar(u: User) {
    const r = await api.auth.reativarUsuario(u.id)
    if (r.success) carregar()
    else alert(r.error || 'Erro ao reativar')
  }

  return (
    <>
      <PageHeader
        numero="A2"
        rotulo="Funcionários"
        titulo="Equipe DNL"
        descricao="Cadastre, edite e gerencie os funcionários da empresa."
        acoes={
          <button onClick={() => setShowCadastro(true)} className="btn-primary">
            <Plus size={14} /> Novo funcionário
          </button>
        }
      />

      <div className="card overflow-hidden fade-in">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ink-300/40 text-left">
              <Th>Nome</Th>
              <Th>Email</Th>
              <Th>Cargo</Th>
              <Th>Acesso</Th>
              <Th>Status</Th>
              <Th align="right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-ink-500 text-sm">
                  Nenhum funcionário cadastrado
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b border-ink-300/20 hover:bg-cream-200/50 ${
                    !u.ativo ? 'opacity-50' : ''
                  }`}
                >
                  <Td>
                    <span className="font-medium text-ink-900">{u.nome}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-ink-600">{u.email}</span>
                  </Td>
                  <Td>
                    <span className="text-sm text-ink-700">{u.cargo}</span>
                  </Td>
                  <Td>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded ${ROLE_COR[u.role]}`}
                    >
                      {ROLE_LABEL[u.role]}
                    </span>
                  </Td>
                  <Td>
                    {u.ativo ? (
                      <span className="text-xs text-moss-600 font-medium">● Ativo</span>
                    ) : (
                      <span className="text-xs text-ink-400">○ Desativado</span>
                    )}
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditando(u)}
                        className="text-ink-500 hover:text-ink-900 transition-colors p-1"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setResetandoSenha(u)}
                        className="text-ink-500 hover:text-terra-500 transition-colors p-1"
                        title="Resetar senha"
                      >
                        <KeyRound size={14} />
                      </button>
                      {u.ativo ? (
                        <button
                          onClick={() => desativar(u)}
                          className="text-ink-500 hover:text-terra-500 transition-colors p-1"
                          title="Desativar"
                        >
                          <UserX size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => reativar(u)}
                          className="text-ink-500 hover:text-moss-600 transition-colors p-1"
                          title="Reativar"
                        >
                          <UserCheck size={14} />
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCadastro && (
        <ModalCadastro
          onFechar={() => setShowCadastro(false)}
          onCriado={() => {
            setShowCadastro(false)
            carregar()
          }}
        />
      )}

      {editando && (
        <ModalEditar
          usuario={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null)
            carregar()
          }}
        />
      )}

      {resetandoSenha && (
        <ModalResetSenha
          usuario={resetandoSenha}
          onFechar={() => setResetandoSenha(null)}
          onResetado={() => setResetandoSenha(null)}
        />
      )}
    </>
  )
}

function Th({ children, align = 'left' }: any) {
  return (
    <th
      className={`px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-ink-500 font-normal text-${align}`}
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: any) {
  return <td className={`px-5 py-3 text-${align}`}>{children}</td>
}

function ModalCadastro({ onFechar, onCriado }: { onFechar: () => void; onCriado: () => void }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [cargo, setCargo] = useState('')
  const [role, setRole] = useState<UserRole>('funcionario')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [dataAdmissao, setDataAdmissao] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const r = await api.auth.register({
        email,
        senha,
        nome,
        cargo,
        role,
        cpf: cpf || undefined,
        telefone: telefone || undefined,
        data_admissao: dataAdmissao || undefined
      })
      if (r.success) onCriado()
      else setErro(r.error || 'Erro ao cadastrar')
    } catch (err: any) {
      setErro(err.message || 'Erro inesperado')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-2xl max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Novo</p>
            <h2 className="font-display text-3xl text-ink-900">Cadastrar funcionário</h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nome completo *</label>
              <input
                className="input-field"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Cargo *</label>
              <input
                className="input-field"
                placeholder="Ex: Engenheiro Civil"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Email corporativo *</label>
            <input
              type="email"
              className="input-field"
              placeholder="nome.sobrenome@dnlprojetos.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-xs text-ink-500 mt-1">
              Domínio obrigatório: <span className="font-mono">@dnlprojetos.com</span>
            </p>
          </div>

          <div>
            <label className="label">Senha inicial *</label>
            <input
              type="password"
              className="input-field"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            <p className="text-xs text-ink-500 mt-1">
              Mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial.
            </p>
          </div>

          <div>
            <label className="label">Tipo de acesso *</label>
            <div className="grid grid-cols-3 gap-2">
              {(['funcionario', 'rh', 'admin'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`p-3 rounded-md border transition-colors text-sm
                    ${role === r ? 'border-ink-700 bg-cream-200 font-medium' : 'border-ink-300 hover:border-ink-500'}`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">CPF</label>
              <input
                className="input-field font-mono"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(maskCPF(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input
                className="input-field"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(maskTelefone(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="label">Data de admissão</label>
            <input
              type="date"
              className="input-field"
              value={dataAdmissao}
              onChange={(e) => setDataAdmissao(e.target.value)}
            />
          </div>

          {erro && (
            <div className="px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md">
              <p className="text-sm text-terra-700">{erro}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-ink-300/40">
            <button type="button" onClick={onFechar} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="btn-primary">
              {salvando ? 'Salvando…' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalEditar({
  usuario,
  onFechar,
  onSalvo
}: {
  usuario: User
  onFechar: () => void
  onSalvo: () => void
}) {
  const [nome, setNome] = useState(usuario.nome)
  const [cargo, setCargo] = useState(usuario.cargo)
  const [role, setRole] = useState<UserRole>(usuario.role)
  const [cpf, setCpf] = useState(usuario.cpf || '')
  const [telefone, setTelefone] = useState(usuario.telefone || '')
  const [dataAdmissao, setDataAdmissao] = useState(usuario.data_admissao || '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    const r = await api.auth.atualizarUsuario({
      id: usuario.id,
      nome,
      cargo,
      role,
      // Strings vazias viram undefined para que o backend não force NULL desnecessariamente
      cpf: cpf.trim() || undefined,
      telefone: telefone.trim() || undefined,
      data_admissao: dataAdmissao || undefined
    })
    setSalvando(false)
    if (r.success) onSalvo()
    else setErro(r.error || 'Erro ao salvar')
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-2xl max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Editar</p>
            <h2 className="font-display text-3xl text-ink-900">{usuario.nome}</h2>
            <p className="text-xs text-ink-500 mt-1 font-mono">{usuario.email}</p>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nome completo</label>
              <input
                className="input-field"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Cargo</label>
              <input
                className="input-field"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Tipo de acesso</label>
            <div className="grid grid-cols-3 gap-2">
              {(['funcionario', 'rh', 'admin'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`p-3 rounded-md border transition-colors text-sm
                    ${role === r ? 'border-ink-700 bg-cream-200 font-medium' : 'border-ink-300 hover:border-ink-500'}`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">CPF</label>
              <input
                className="input-field font-mono"
                value={cpf}
                onChange={(e) => setCpf(maskCPF(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input
                className="input-field"
                value={telefone}
                onChange={(e) => setTelefone(maskTelefone(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="label">Data de admissão</label>
            <input
              type="date"
              className="input-field"
              value={dataAdmissao}
              onChange={(e) => setDataAdmissao(e.target.value)}
            />
          </div>

          {erro && (
            <div className="px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md">
              <p className="text-sm text-terra-700">{erro}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-ink-300/40">
            <button type="button" onClick={onFechar} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="btn-primary">
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalResetSenha({
  usuario,
  onFechar,
  onResetado
}: {
  usuario: User
  onFechar: () => void
  onResetado: () => void
}) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    const r = await api.auth.resetarSenha(usuario.id, senha)
    setSalvando(false)
    if (r.success) {
      setSucesso(true)
      setTimeout(() => onResetado(), 1500)
    } else {
      setErro(r.error || 'Erro ao resetar senha')
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-md fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              Resetar senha
            </p>
            <h2 className="font-display text-2xl text-ink-900">{usuario.nome}</h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div>
            <label className="label">Nova senha</label>
            <input
              type="password"
              className="input-field"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoFocus
              required
            />
            <p className="text-xs text-ink-500 mt-1">
              Mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial.
            </p>
          </div>

          {erro && (
            <div className="px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md">
              <p className="text-sm text-terra-700">{erro}</p>
            </div>
          )}

          {sucesso && (
            <div className="px-4 py-3 bg-moss-500/10 border border-moss-500/40 rounded-md">
              <p className="text-sm text-moss-600">Senha resetada com sucesso</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-ink-300/40">
            <button type="button" onClick={onFechar} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={salvando || sucesso} className="btn-primary">
              {salvando ? 'Resetando…' : sucesso ? 'Pronto!' : 'Resetar senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
