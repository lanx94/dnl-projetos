import { useEffect, useState, FormEvent } from 'react'
import {
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Trash2,
  Edit2,
  Check,
  Clock as ClockIcon
} from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type {
  Lancamento,
  CategoriaFinanceira,
  TipoLancamento,
  ResumoFinanceiro,
  Projeto,
  Cliente
} from '@shared/types'

function inicioDoMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function fimDoMes(): string {
  const d = new Date()
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
}
function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function FinanceiroPage() {
  const [inicio, setInicio] = useState(inicioDoMes())
  const [fim, setFim] = useState(fimDoMes())
  const [filtroTipo, setFiltroTipo] = useState<'' | TipoLancamento>('')
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Lancamento | null>(null)

  async function carregar() {
    try {
      const [lancs, res] = await Promise.all([
        api.financeiro.listarLancamentos({ inicio, fim, tipo: filtroTipo || undefined }),
        api.financeiro.resumoFinanceiro(inicio, fim)
      ])
      setLancamentos(lancs)
      setResumo(res)
    } catch (e) {
      console.error('Erro ao carregar financeiro:', e)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function carregarComGuarda() {
      try {
        const [lancs, res] = await Promise.all([
          api.financeiro.listarLancamentos({ inicio, fim, tipo: filtroTipo || undefined }),
          api.financeiro.resumoFinanceiro(inicio, fim)
        ])
        if (cancelled) return
        setLancamentos(lancs)
        setResumo(res)
      } catch (e) {
        if (!cancelled) console.error('Erro ao carregar financeiro:', e)
      }
    }
    carregarComGuarda()
    return () => { cancelled = true }
  }, [inicio, fim, filtroTipo])

  async function togglePago(l: Lancamento) {
    try {
      await api.financeiro.atualizarLancamento(l.id, { pago: !l.pago })
      const [lancs, res] = await Promise.all([
        api.financeiro.listarLancamentos({ inicio, fim, tipo: filtroTipo || undefined }),
        api.financeiro.resumoFinanceiro(inicio, fim)
      ])
      setLancamentos(lancs)
      setResumo(res)
    } catch (e: any) {
      alert(e.message || 'Erro ao atualizar lançamento')
    }
  }

  async function deletar(l: Lancamento) {
    if (!confirm(`Deletar lançamento "${l.descricao}"?`)) return
    try {
      const r = await api.financeiro.deletarLancamento(l.id)
      if (!r.success) { alert(r.error || 'Erro ao deletar'); return }
      const [lancs, res] = await Promise.all([
        api.financeiro.listarLancamentos({ inicio, fim, tipo: filtroTipo || undefined }),
        api.financeiro.resumoFinanceiro(inicio, fim)
      ])
      setLancamentos(lancs)
      setResumo(res)
    } catch (e: any) {
      alert(e.message || 'Erro ao deletar')
    }
  }

  return (
    <>
      <PageHeader
        numero="A4"
        rotulo="Financeiro"
        titulo="Fluxo de caixa"
        descricao="Controle de receitas, despesas e fluxo de caixa."
        acoes={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={14} /> Novo lançamento
          </button>
        }
      />

      <div className="card p-5 mb-6 fade-in">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">De</label>
            <input
              type="date"
              className="input-field"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Até</label>
            <input
              type="date"
              className="input-field"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select
              className="input-field"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as any)}
            >
              <option value="">Todos</option>
              <option value="receita">Receitas</option>
              <option value="despesa">Despesas</option>
            </select>
          </div>
        </div>
      </div>

      {resumo && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 fade-in stagger-1">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className="text-moss-600" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Receitas
              </p>
            </div>
            <p className="font-display text-4xl text-moss-600 tabular-nums">
              {brl(resumo.total_receitas)}
            </p>
            <div className="text-xs text-ink-500 mt-2 flex justify-between">
              <span>Pago: {brl(resumo.receitas_pagas)}</span>
              <span>Pendente: {brl(resumo.receitas_pendentes)}</span>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={14} className="text-terra-500" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Despesas
              </p>
            </div>
            <p className="font-display text-4xl text-terra-500 tabular-nums">
              {brl(resumo.total_despesas)}
            </p>
            <div className="text-xs text-ink-500 mt-2 flex justify-between">
              <span>Pago: {brl(resumo.despesas_pagas)}</span>
              <span>Pendente: {brl(resumo.despesas_pendentes)}</span>
            </div>
          </div>

          <div className="card p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">
              Saldo
            </p>
            <p
              className={`font-display text-4xl tabular-nums ${resumo.saldo >= 0 ? 'text-ink-900' : 'text-terra-500'}`}
            >
              {brl(resumo.saldo)}
            </p>
            <p className="text-xs text-ink-500 mt-2">
              {resumo.saldo >= 0 ? 'Resultado positivo' : 'Resultado negativo'}
            </p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden fade-in stagger-2">
        <div className="px-7 py-5 border-b border-ink-300/40">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
            Lançamentos
          </p>
          <h3 className="font-display text-2xl text-ink-900">
            {lancamentos.length} {lancamentos.length === 1 ? 'item' : 'itens'}
          </h3>
        </div>

        {lancamentos.length === 0 ? (
          <p className="px-7 py-12 text-center text-ink-500 text-sm">
            Nenhum lançamento neste período.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-300/40 text-left">
                <Th>Data</Th>
                <Th>Descrição</Th>
                <Th>Categoria</Th>
                <Th>Projeto/Cliente</Th>
                <Th align="right">Valor</Th>
                <Th>Status</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((l) => (
                <tr key={l.id} className="border-b border-ink-300/20 hover:bg-cream-200/50">
                  <Td>
                    <span className="font-mono text-xs uppercase tracking-wider">
                      {new Date(l.data + 'T12:00').toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short'
                      })}
                    </span>
                  </Td>
                  <Td>
                    <div>
                      <span className="text-sm text-ink-900">{l.descricao}</span>
                      {l.observacoes && (
                        <p className="text-xs text-ink-500 italic mt-0.5">{l.observacoes}</p>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-600">{l.categoria_nome || '—'}</span>
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-600">
                      {l.projeto_nome || l.cliente_nome || '—'}
                    </span>
                  </Td>
                  <Td align="right">
                    <span
                      className={`font-mono text-sm font-medium tabular-nums
                      ${l.tipo === 'receita' ? 'text-moss-600' : 'text-terra-500'}`}
                    >
                      {l.tipo === 'receita' ? '+' : '−'} {brl(l.valor)}
                    </span>
                  </Td>
                  <Td>
                    <button
                      onClick={() => togglePago(l)}
                      className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded transition-colors
                        ${l.pago ? 'bg-moss-500/15 text-moss-600 hover:bg-moss-500/25' : 'bg-cream-300 text-ink-500 hover:bg-cream-400'}`}
                    >
                      {l.pago ? (
                        <>
                          <Check size={9} className="inline mr-1" />
                          Pago
                        </>
                      ) : (
                        <>
                          <ClockIcon size={9} className="inline mr-1" />
                          Pendente
                        </>
                      )}
                    </button>
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditando(l)}
                        className="p-1 text-ink-500 hover:text-ink-900"
                        title="Editar"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => deletar(l)}
                        className="p-1 text-ink-500 hover:text-terra-500"
                        title="Deletar"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <ModalLancamento
          onFechar={() => setShowForm(false)}
          onSalvo={() => {
            setShowForm(false)
            carregar()
          }}
        />
      )}

      {editando && (
        <ModalLancamento
          lancamento={editando}
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

function ModalLancamento({
  lancamento,
  onFechar,
  onSalvo
}: {
  lancamento?: Lancamento
  onFechar: () => void
  onSalvo: () => void
}) {
  const [tipo, setTipo] = useState<TipoLancamento>(lancamento?.tipo || 'despesa')
  const [descricao, setDescricao] = useState(lancamento?.descricao || '')
  const [valor, setValor] = useState(lancamento?.valor.toString() || '')
  const [data, setData] = useState(
    lancamento?.data || new Date().toISOString().slice(0, 10)
  )
  const [categoriaId, setCategoriaId] = useState<number | ''>(lancamento?.categoria_id || '')
  const [projetoId, setProjetoId] = useState<number | ''>(lancamento?.projeto_id || '')
  const [clienteId, setClienteId] = useState<number | ''>(lancamento?.cliente_id || '')
  const [pago, setPago] = useState(lancamento?.pago || false)
  const [obs, setObs] = useState(lancamento?.observacoes || '')
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const ehEdicao = !!lancamento

  useEffect(() => {
    Promise.all([
      api.financeiro.listarCategorias(),
      api.projetos.listar(),
      api.clientes.listar()
    ]).then(([cats, ps, cs]) => {
      setCategorias(cats)
      setProjetos(ps)
      setClientes(cs)
    })
  }, [])

  const categoriasFiltradas = categorias.filter((c) => c.tipo === tipo)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const dados = {
        tipo,
        descricao,
        valor: parseFloat(valor.replace(',', '.')),
        data,
        categoria_id: categoriaId ? Number(categoriaId) : undefined,
        projeto_id: projetoId ? Number(projetoId) : undefined,
        cliente_id: clienteId ? Number(clienteId) : undefined,
        pago,
        observacoes: obs || undefined
      }
      if (ehEdicao) {
        await api.financeiro.atualizarLancamento(lancamento.id, dados)
      } else {
        await api.financeiro.criarLancamento(dados)
      }
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
              {ehEdicao ? 'Editar' : 'Novo'}
            </p>
            <h2 className="font-display text-3xl text-ink-900">Lançamento</h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div>
            <label className="label">Tipo *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTipo('receita')
                  setCategoriaId('')
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-md border transition-colors text-sm
                  ${tipo === 'receita' ? 'border-moss-600 bg-moss-500/10 text-moss-600 font-medium' : 'border-ink-300 hover:border-ink-500'}`}
              >
                <TrendingUp size={14} />
                Receita
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipo('despesa')
                  setCategoriaId('')
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-md border transition-colors text-sm
                  ${tipo === 'despesa' ? 'border-terra-500 bg-terra-50 text-terra-700 font-medium' : 'border-ink-300 hover:border-ink-500'}`}
              >
                <TrendingDown size={14} />
                Despesa
              </button>
            </div>
          </div>

          <div>
            <label className="label">Descrição *</label>
            <input
              className="input-field"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={tipo === 'receita' ? 'Ex: Pagamento Projeto X - parcela 1' : 'Ex: Aluguel março'}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Valor (R$) *</label>
              <input
                type="text"
                inputMode="decimal"
                className="input-field font-mono"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div>
              <label className="label">Data *</label>
              <input
                type="date"
                className="input-field"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Categoria</label>
            <select
              className="input-field"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— Sem categoria —</option>
              {categoriasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Projeto vinculado</label>
              <select
                className="input-field"
                value={projetoId}
                onChange={(e) => setProjetoId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— Nenhum —</option>
                {projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Cliente vinculado</label>
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

          <div className="flex items-center gap-2 p-4 bg-cream-200/50 rounded-md border border-ink-300/40">
            <input
              type="checkbox"
              id="pago"
              checked={pago}
              onChange={(e) => setPago(e.target.checked)}
              className="accent-ink-900"
            />
            <label htmlFor="pago" className="text-sm text-ink-700 cursor-pointer">
              <strong>Já {tipo === 'receita' ? 'recebido' : 'pago'}</strong> — marca como
              quitado
            </label>
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea
              className="input-field min-h-[60px]"
              rows={2}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
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
              {salvando ? 'Salvando…' : ehEdicao ? 'Salvar alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
