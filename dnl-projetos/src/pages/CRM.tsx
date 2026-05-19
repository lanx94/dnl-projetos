import { useEffect, useState, FormEvent, DragEvent } from 'react'
import { Plus, X, Edit2, Trash2, Calendar, Building2, User, GripVertical } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { Lead, LeadCreateInput, StatusLead, Cliente, User as Usuario } from '@shared/types'

const COLUNAS: Array<{
  status: StatusLead
  titulo: string
  bg: string
  border: string
  badge: string
}> = [
  {
    status: 'lead',
    titulo: 'Lead',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    badge: 'bg-pink-100 text-pink-800'
  },
  {
    status: 'reuniao',
    titulo: 'Reunião / Ligação',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-800'
  },
  {
    status: 'proposta',
    titulo: 'Proposta',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800'
  },
  {
    status: 'aguardando',
    titulo: 'Aguardando',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    badge: 'bg-cyan-100 text-cyan-800'
  },
  {
    status: 'orcamento',
    titulo: 'Orçamento',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-800'
  },
  {
    status: 'fechado',
    titulo: 'Fechado',
    bg: 'bg-green-50',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-800'
  },
  {
    status: 'perdido',
    titulo: 'Perdido',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800'
  }
]

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Lead | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const [l, c, u] = await Promise.all([
      api.leads.listar(),
      api.clientes.listar(),
      api.usuarios.listar()
    ])
    setLeads(l)
    setClientes(c)
    setUsuarios(u)
  }

  async function moverLead(lead: Lead, novoStatus: StatusLead) {
    if (lead.status === novoStatus) return
    // Vai pro topo da nova coluna (ordem = 0)
    await api.leads.mover(lead.id, novoStatus, 0)
    carregar()
  }

  function handleDragStart(e: DragEvent, lead: Lead) {
    setDraggingId(lead.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e: DragEvent, novoStatus: StatusLead) {
    e.preventDefault()
    if (draggingId === null) return
    const lead = leads.find((l) => l.id === draggingId)
    if (lead) await moverLead(lead, novoStatus)
    setDraggingId(null)
  }

  // Total por coluna
  const totalPorColuna = (status: StatusLead) =>
    leads
      .filter((l) => l.status === status)
      .reduce((acc, l) => acc + l.valor_estimado, 0)

  return (
    <>
      <PageHeader
        numero="A9"
        rotulo="CRM · Pipeline"
        titulo="Banco de leads"
        descricao="Pipeline de orçamentos e propostas. Arraste os cards entre colunas."
        acoes={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={14} /> Novo lead
          </button>
        }
      />

      <div className="overflow-x-auto pb-4 fade-in">
        <div className="flex gap-3 min-w-max">
          {COLUNAS.map((col) => {
            const itens = leads.filter((l) => l.status === col.status)
            return (
              <div
                key={col.status}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.status)}
                className={`w-72 shrink-0 rounded-md border ${col.border} ${col.bg} flex flex-col`}
                style={{ minHeight: 400 }}
              >
                <div className="p-3 border-b border-ink-300/20">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded ${col.badge}`}
                    >
                      {col.titulo}
                    </span>
                    <span className="text-xs text-ink-600 font-mono">{itens.length}</span>
                  </div>
                  {totalPorColuna(col.status) > 0 && (
                    <p className="text-xs text-ink-700 font-mono tabular-nums">
                      R$ {totalPorColuna(col.status).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
                <div className="p-2 space-y-2 flex-1">
                  {itens.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead)}
                      onClick={() => setEditando(lead)}
                      className={`p-3 bg-cream-50 rounded border border-ink-300/30 cursor-pointer hover:shadow-soft transition ${
                        draggingId === lead.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical size={12} className="text-ink-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink-900 truncate">
                            {lead.nome}
                          </p>
                          {lead.valor_estimado > 0 && (
                            <p className="text-xs text-ink-700 font-mono tabular-nums mt-1">
                              R$ {lead.valor_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                          {lead.cliente_nome && (
                            <p className="text-[10px] text-ink-500 mt-1 truncate flex items-center gap-1">
                              <Building2 size={9} /> {lead.cliente_nome}
                            </p>
                          )}
                          {lead.responsavel_nome && (
                            <p className="text-[10px] text-ink-500 truncate flex items-center gap-1">
                              <User size={9} /> {lead.responsavel_nome}
                            </p>
                          )}
                          {lead.contatado_em && (
                            <p className="text-[10px] text-ink-500 truncate flex items-center gap-1">
                              <Calendar size={9} />{' '}
                              {new Date(lead.contatado_em + 'T12:00:00').toLocaleDateString(
                                'pt-BR'
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {itens.length === 0 && (
                    <p className="text-xs text-ink-400 italic text-center py-4">
                      arraste leads pra cá
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {(showForm || editando) && (
        <ModalLead
          lead={editando || undefined}
          clientes={clientes}
          usuarios={usuarios}
          onFechar={() => {
            setShowForm(false)
            setEditando(null)
          }}
          onSalvo={() => {
            setShowForm(false)
            setEditando(null)
            carregar()
          }}
        />
      )}
    </>
  )
}

// ============================================
// MODAL DE LEAD
// ============================================

function ModalLead({
  lead,
  clientes,
  usuarios,
  onFechar,
  onSalvo
}: {
  lead?: Lead
  clientes: Cliente[]
  usuarios: Usuario[]
  onFechar: () => void
  onSalvo: () => void
}) {
  const ehEdicao = !!lead
  const [nome, setNome] = useState(lead?.nome || '')
  const [status, setStatus] = useState<StatusLead>(lead?.status || 'lead')
  const [valor, setValor] = useState(lead?.valor_estimado?.toString() || '')
  const [responsavelId, setResponsavelId] = useState<number | ''>(lead?.responsavel_id || '')
  const [clienteId, setClienteId] = useState<number | ''>(lead?.cliente_id || '')
  const [contatadoEm, setContatadoEm] = useState(lead?.contatado_em || '')
  const [dataAlvo, setDataAlvo] = useState(lead?.data_alvo || '')
  const [obs, setObs] = useState(lead?.observacoes || '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('Nome obrigatório')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      const dados: LeadCreateInput = {
        nome: nome.trim(),
        status,
        valor_estimado: parseFloat(valor.replace(',', '.')) || 0,
        responsavel_id: responsavelId ? Number(responsavelId) : undefined,
        cliente_id: clienteId ? Number(clienteId) : undefined,
        contatado_em: contatadoEm || undefined,
        data_alvo: dataAlvo || undefined,
        observacoes: obs.trim() || undefined
      }
      if (ehEdicao) {
        await api.leads.atualizar(lead!.id, dados)
      } else {
        await api.leads.criar(dados)
      }
      onSalvo()
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir o lead "${lead!.nome}"?`)) return
    await api.leads.deletar(lead!.id)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-lg max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-4 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              {ehEdicao ? 'Editar lead' : 'Novo lead'}
            </p>
            <h2 className="font-display text-3xl text-ink-900">
              {ehEdicao ? lead.nome : 'Novo lead'}
            </h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-4">
          <div>
            <label className="label">Nome / descrição *</label>
            <input
              className="input-field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Galpão Jordao, Erika - shanasis..."
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select
                className="input-field"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusLead)}
              >
                {COLUNAS.map((c) => (
                  <option key={c.status} value={c.status}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Valor estimado (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                className="input-field font-mono"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Responsável</label>
              <select
                className="input-field"
                value={responsavelId}
                onChange={(e) => setResponsavelId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— Nenhum —</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Cliente</label>
              <select
                className="input-field"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— Nenhum —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Último contato</label>
              <input
                type="date"
                className="input-field"
                value={contatadoEm}
                onChange={(e) => setContatadoEm(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Data alvo / fechamento</label>
              <input
                type="date"
                className="input-field"
                value={dataAlvo}
                onChange={(e) => setDataAlvo(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea
              className="input-field min-h-[80px]"
              rows={3}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Notas sobre o lead..."
            />
          </div>

          {erro && (
            <div className="px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md">
              <p className="text-sm text-terra-700">{erro}</p>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-ink-300/40">
            {ehEdicao ? (
              <button
                type="button"
                onClick={handleDelete}
                className="text-sm text-terra-500 hover:text-terra-700 flex items-center gap-1"
              >
                <Trash2 size={12} /> Excluir
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <button type="button" onClick={onFechar} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" disabled={salvando} className="btn-primary">
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
