import { useEffect, useState, FormEvent } from 'react'
import { Plus, X, Search, Edit2, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import type { Projeto, Cliente, User, StatusProjeto } from '@shared/types'

const STATUS_LABEL: Record<StatusProjeto, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  pausado: 'Pausado',
  concluido: 'Concluído',
  cancelado: 'Cancelado'
}

const STATUS_COR: Record<StatusProjeto, string> = {
  planejamento: 'bg-cream-300 text-ink-700',
  em_andamento: 'bg-moss-500/15 text-moss-600',
  pausado: 'bg-cream-300 text-ink-600',
  concluido: 'bg-ink-900 text-cream-50',
  cancelado: 'bg-terra-100 text-terra-700'
}

export default function ProjetosPage() {
  const { user } = useAuth()
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [funcionarios, setFuncionarios] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Projeto | null>(null)

  // Filtros
  const [filtroCliente, setFiltroCliente] = useState<number | ''>('')
  const [filtroStatus, setFiltroStatus] = useState<'' | StatusProjeto>('')
  const [busca, setBusca] = useState('')

  const podeCriar = user?.role === 'admin' || user?.role === 'rh'

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const lista = podeCriar
      ? await api.projetos.listar()
      : await api.projetos.listarMeus()
    setProjetos(lista)

    if (podeCriar) {
      const [cs, us] = await Promise.all([
        api.clientes.listar(),
        api.usuarios.listar()
      ])
      setClientes(cs)
      setFuncionarios(us as User[])
    }
  }

  async function deletar(p: Projeto) {
    if (!confirm(`Excluir o projeto "${p.nome}"?`)) return
    const r = await api.projetos.deletar(p.id)
    if (r.success) carregar()
    else alert(r.error || 'Erro ao excluir')
  }

  // Aplicar filtros
  const projetosFiltrados = projetos.filter((p) => {
    if (filtroCliente && p.cliente_id !== Number(filtroCliente)) return false
    if (filtroStatus && p.status !== filtroStatus) return false
    if (busca) {
      const termo = busca.toLowerCase()
      if (
        !p.nome.toLowerCase().includes(termo) &&
        !(p.cliente_nome || '').toLowerCase().includes(termo)
      )
        return false
    }
    return true
  })

  return (
    <>
      <PageHeader
        numero="03"
        rotulo="Projetos"
        titulo="Projetos"
        descricao={
          podeCriar
            ? 'Cadastre e gerencie os projetos da empresa.'
            : 'Projetos aos quais você tem acesso.'
        }
        acoes={
          podeCriar && (
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus size={14} /> Novo projeto
            </button>
          )
        }
      />

      {/* Filtros */}
      {podeCriar && projetos.length > 0 && (
        <div className="card p-4 mb-6 fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                type="text"
                className="input-field pl-9"
                placeholder="Buscar por nome ou cliente..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div>
              <select
                className="input-field"
                value={filtroCliente}
                onChange={(e) =>
                  setFiltroCliente(e.target.value ? Number(e.target.value) : '')
                }
              >
                <option value="">Todos os clientes</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                className="input-field"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as any)}
              >
                <option value="">Todos os status</option>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(filtroCliente || filtroStatus || busca) && (
            <div className="mt-3 flex items-center gap-2 text-xs text-ink-500">
              <span>
                {projetosFiltrados.length} de {projetos.length} projeto(s)
              </span>
              <button
                onClick={() => {
                  setFiltroCliente('')
                  setFiltroStatus('')
                  setBusca('')
                }}
                className="text-terra-500 hover:text-terra-600"
              >
                limpar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {projetosFiltrados.length === 0 ? (
        <div className="card p-12 text-center fade-in">
          <p className="font-display text-2xl text-ink-700 mb-2">
            {projetos.length === 0 ? 'Nenhum projeto ainda' : 'Nenhum projeto encontrado'}
          </p>
          <p className="text-ink-500 text-sm">
            {projetos.length === 0
              ? podeCriar
                ? 'Cadastre o primeiro projeto para começar.'
                : 'Você ainda não foi adicionado a nenhum projeto.'
              : 'Tente outros filtros.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projetosFiltrados.map((p) => (
            <div key={p.id} className="card p-6 fade-in group relative">
              {podeCriar && (
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditando(p)}
                    className="p-1.5 bg-cream-100 hover:bg-cream-200 rounded text-ink-600 hover:text-ink-900"
                    title="Editar"
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    onClick={() => deletar(p)}
                    className="p-1.5 bg-cream-100 hover:bg-terra-100 rounded text-ink-600 hover:text-terra-600"
                    title="Excluir"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
              <div className="flex items-start justify-between mb-3 pr-16">
                <span
                  className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded
                  ${STATUS_COR[p.status]}`}
                >
                  {STATUS_LABEL[p.status]}
                </span>
                <span className="font-mono text-xs text-ink-500">{p.revisao_atual}</span>
              </div>
              <h3 className="font-display text-2xl text-ink-900 leading-tight mb-1">{p.nome}</h3>
              <p className="text-xs text-ink-500 font-mono uppercase tracking-wider mb-4">
                {p.cliente_nome}
              </p>
              {p.descricao && (
                <p className="text-sm text-ink-600 line-clamp-2 mb-4">{p.descricao}</p>
              )}
              {p.data_prevista_fim && (
                <p className="text-xs text-ink-500 pt-3 border-t border-ink-300/30">
                  Previsão:{' '}
                  <span className="font-mono">
                    {new Date(p.data_prevista_fim).toLocaleDateString('pt-BR')}
                  </span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ModalNovoProjeto
          clientes={clientes}
          funcionarios={funcionarios}
          onFechar={() => setShowForm(false)}
          onCriado={() => {
            setShowForm(false)
            carregar()
          }}
        />
      )}

      {editando && (
        <ModalEditarProjeto
          projeto={editando}
          clientes={clientes}
          funcionarios={funcionarios}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null)
            carregar()
          }}
        />
      )}
    </>
  )
}

function ModalNovoProjeto({
  clientes,
  funcionarios,
  onFechar,
  onCriado
}: {
  clientes: Cliente[]
  funcionarios: User[]
  onFechar: () => void
  onCriado: () => void
}) {
  const [nome, setNome] = useState('')
  const [clienteId, setClienteId] = useState<number | ''>('')
  const [descricao, setDescricao] = useState('')
  const [revisao, setRevisao] = useState('R00')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [funcsIds, setFuncsIds] = useState<number[]>([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [showCliente, setShowCliente] = useState(false)
  const [novoCliente, setNovoCliente] = useState('')
  const [clientesLocal, setClientesLocal] = useState(clientes)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!clienteId) return setErro('Selecione um cliente')
    setErro('')
    setSalvando(true)
    try {
      await api.projetos.criar({
        cliente_id: Number(clienteId),
        nome,
        descricao: descricao || undefined,
        revisao_atual: revisao,
        data_inicio: dataInicio || undefined,
        data_prevista_fim: dataFim || undefined,
        funcionarios_ids: funcsIds
      })
      onCriado()
    } catch (err: any) {
      setErro(err.message || 'Erro ao criar projeto')
    } finally {
      setSalvando(false)
    }
  }

  async function criarCliente() {
    if (!novoCliente.trim()) return
    try {
      const c = await api.clientes.criar({
        tipo_pessoa: 'juridica',
        nome: novoCliente.trim()
      })
      setClientesLocal([...clientesLocal, c])
      setClienteId(c.id)
      setNovoCliente('')
      setShowCliente(false)
    } catch (err: any) {
      setErro(err.message || 'Erro ao criar cliente')
    }
  }

  function toggleFuncionario(id: number) {
    setFuncsIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-2xl max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Novo</p>
            <h2 className="font-display text-3xl text-ink-900">Cadastrar projeto</h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div>
            <label className="label">Nome do projeto</label>
            <input
              className="input-field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="label !mb-0">Cliente</label>
              <button
                type="button"
                onClick={() => setShowCliente(!showCliente)}
                className="text-xs text-terra-500 hover:text-terra-600"
              >
                {showCliente ? 'Cancelar' : '+ novo cliente'}
              </button>
            </div>
            {showCliente ? (
              <div className="flex gap-2">
                <input
                  className="input-field"
                  placeholder="Nome do cliente"
                  value={novoCliente}
                  onChange={(e) => setNovoCliente(e.target.value)}
                  autoFocus
                />
                <button type="button" onClick={criarCliente} className="btn-secondary">
                  Adicionar
                </button>
              </div>
            ) : (
              <select
                className="input-field"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">Selecione...</option>
                {clientesLocal.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Revisão</label>
              <input
                className="input-field"
                value={revisao}
                onChange={(e) => setRevisao(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Início</label>
              <input
                type="date"
                className="input-field"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Previsão fim</label>
              <input
                type="date"
                className="input-field"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Descrição</label>
            <textarea
              className="input-field min-h-[80px]"
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Funcionários com acesso</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-auto p-2 border border-ink-300 rounded-md">
              {funcionarios.length === 0 && (
                <p className="text-sm text-ink-500 col-span-2 text-center py-3">
                  Nenhum funcionário cadastrado
                </p>
              )}
              {funcionarios.map((f) => (
                <label
                  key={f.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-cream-200 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={funcsIds.includes(f.id)}
                    onChange={() => toggleFuncionario(f.id)}
                    className="accent-ink-900"
                  />
                  <span className="truncate">{f.nome}</span>
                </label>
              ))}
            </div>
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
              {salvando ? 'Salvando…' : 'Criar projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===========================================
// MODAL DE EDIÇÃO DE PROJETO
// ===========================================

function ModalEditarProjeto({
  projeto,
  clientes,
  funcionarios,
  onFechar,
  onSalvo
}: {
  projeto: Projeto
  clientes: Cliente[]
  funcionarios: User[]
  onFechar: () => void
  onSalvo: () => void
}) {
  const [nome, setNome] = useState(projeto.nome)
  const [descricao, setDescricao] = useState(projeto.descricao || '')
  const [clienteId, setClienteId] = useState<number>(projeto.cliente_id)
  const [status, setStatus] = useState<StatusProjeto>(projeto.status)
  const [dataInicio, setDataInicio] = useState(projeto.data_inicio || '')
  const [dataPrev, setDataPrev] = useState(projeto.data_prevista_fim || '')
  const [funcionariosIds, setFuncionariosIds] = useState<number[]>([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Carrega funcionários atuais do projeto
  useEffect(() => {
    api.projetos.funcionariosDoProjeto(projeto.id).then((rows) => {
      setFuncionariosIds(rows.map((r) => r.usuario_id))
    })
  }, [projeto.id])

  function toggleFuncionario(id: number) {
    setFuncionariosIds((arr) =>
      arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return setErro('Nome é obrigatório')
    setErro('')
    setSalvando(true)
    try {
      await api.projetos.atualizar(projeto.id, {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        cliente_id: clienteId,
        status,
        data_inicio: dataInicio || undefined,
        data_prevista_fim: dataPrev || undefined,
        funcionarios_ids: funcionariosIds
      })
      onSalvo()
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-2xl max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              Editar projeto
            </p>
            <h2 className="font-display text-3xl text-ink-900">{projeto.nome}</h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-4">
          <div>
            <label className="label">Nome do projeto *</label>
            <input
              className="input-field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Descrição</label>
            <textarea
              className="input-field min-h-[80px]"
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cliente</label>
              <select
                className="input-field"
                value={clienteId}
                onChange={(e) => setClienteId(Number(e.target.value))}
              >
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input-field"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusProjeto)}
              >
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Data de início</label>
              <input
                type="date"
                className="input-field"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Previsão de conclusão</label>
              <input
                type="date"
                className="input-field"
                value={dataPrev}
                onChange={(e) => setDataPrev(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Funcionários no projeto</label>
            <div className="space-y-1 max-h-48 overflow-auto border border-ink-300/30 rounded-md p-2">
              {funcionarios.length === 0 ? (
                <p className="text-sm text-ink-500 p-2">Nenhum funcionário cadastrado.</p>
              ) : (
                funcionarios.map((f) => (
                  <label
                    key={f.id}
                    className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-cream-200 rounded"
                  >
                    <input
                      type="checkbox"
                      className="accent-ink-900"
                      checked={funcionariosIds.includes(f.id)}
                      onChange={() => toggleFuncionario(f.id)}
                    />
                    <span className="text-sm text-ink-700">
                      {f.nome}
                      <span className="text-ink-500 ml-2 text-xs">({f.cargo})</span>
                    </span>
                  </label>
                ))
              )}
            </div>
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
