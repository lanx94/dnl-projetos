import { useEffect, useState } from 'react'
import {
  AlertTriangle, Clock, TrendingUp, FolderKanban,
  MapPin, Users, RefreshCw, AlertCircle
} from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { AnalyticsDashboard } from '@shared/types'

const STATUS_LABEL: Record<string, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  pausado: 'Pausado',
  concluido: 'Concluído',
  cancelado: 'Cancelado'
}

const STATUS_COR: Record<string, string> = {
  planejamento: 'bg-blue-100 text-blue-800',
  em_andamento: 'bg-moss-500/15 text-moss-700',
  pausado: 'bg-amber-100 text-amber-700',
  concluido: 'bg-ink-900 text-cream-50',
  cancelado: 'bg-red-100 text-red-700'
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function nomeMes(mes: string) {
  return new Date(mes + '-15').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

function diasAtraso(data: string) {
  return Math.ceil((new Date().getTime() - new Date(data + 'T12:00').getTime()) / 86400000)
}

function diasRestantes(data: string) {
  return Math.ceil((new Date(data + 'T12:00').getTime() - new Date().getTime()) / 86400000)
}

export default function DashboardsPage() {
  const [data, setData] = useState<AnalyticsDashboard | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [atualizado, setAtualizado] = useState<Date | null>(null)
  const [mesesFat, setMesesFat] = useState(6)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const d = await api.admin.analytics()
      setData(d)
      setAtualizado(new Date())
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar dados')
    } finally {
      setCarregando(false)
    }
  }

  const totalAtivos = data?.projetos_status.find(s => s.status === 'em_andamento')?.count ?? 0
  const totalAtrasados = data?.projetos_atrasados.length ?? 0
  const totalPrazos = data?.projetos_prazo_proximo.length ?? 0

  // Faturamento filtrado por quantidade de meses selecionada
  const fatFiltrado = data?.faturamento_mensal.slice(-mesesFat) ?? []
  const receitaMesAtual = fatFiltrado.slice(-1)[0]?.total ?? 0
  const maxFat = Math.max(...fatFiltrado.map(m => m.total), 1)
  const maxCid = Math.max(...(data?.projetos_por_cidade.map(c => c.count) ?? [1]), 1)

  return (
    <>
      <PageHeader
        numero="DA"
        rotulo="Analytics"
        titulo="Dashboards"
        descricao={atualizado
          ? `Atualizado às ${atualizado.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
          : 'Carregando dados…'}
        acoes={
          <button onClick={carregar} disabled={carregando} className="btn-secondary gap-2">
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
            Atualizar
          </button>
        }
      />

      {erro && (
        <div className="card p-4 mb-6 border border-red-300 bg-red-50 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-500 shrink-0" strokeWidth={1.75} />
          <p className="text-sm text-red-700">{erro}</p>
          <button onClick={carregar} className="ml-auto text-xs text-red-600 hover:text-red-900 font-medium">Tentar novamente</button>
        </div>
      )}

      {!data && carregando && (
        <p className="text-ink-500 text-sm">Carregando…</p>
      )}

      {data && (
        <div className={`space-y-8 transition-opacity duration-200 ${carregando ? 'opacity-50 pointer-events-none' : ''}`}>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-in">
            <KPI icon={FolderKanban} label="Em andamento" valor={String(totalAtivos)} cor="text-moss-600" bg="bg-moss-500/10" />
            <KPI
              icon={AlertTriangle}
              label="Atrasados"
              valor={String(totalAtrasados)}
              cor={totalAtrasados > 0 ? 'text-red-600' : 'text-moss-600'}
              bg={totalAtrasados > 0 ? 'bg-red-50' : 'bg-moss-500/10'}
              detalhe={totalAtrasados > 0 ? 'gargalos críticos' : 'tudo em dia ✓'}
            />
            <KPI
              icon={Clock}
              label="Vencendo em 30d"
              valor={String(totalPrazos)}
              cor={totalPrazos > 0 ? 'text-terra-600' : 'text-ink-500'}
              bg={totalPrazos > 0 ? 'bg-terra-500/10' : 'bg-cream-200'}
              detalhe="prazos próximos"
            />
            <KPI
              icon={TrendingUp}
              label="Receita (último mês)"
              valor={brl(receitaMesAtual)}
              cor="text-ink-900"
              bg="bg-cream-200"
              pequeno
            />
          </div>

          {/* Gargalos + Prazos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in stagger-1">

            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-ink-300/40 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500" strokeWidth={1.75} />
                <p className="font-mono text-[10px] uppercase tracking-widest text-red-600">Gargalos</p>
                <span className={`ml-auto font-mono text-[10px] px-2 py-0.5 rounded ${totalAtrasados > 0 ? 'bg-red-100 text-red-700' : 'bg-moss-500/10 text-moss-700'}`}>
                  {totalAtrasados} projeto{totalAtrasados !== 1 ? 's' : ''}
                </span>
              </div>
              {data.projetos_atrasados.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-2xl mb-1">✓</p>
                  <p className="text-sm text-ink-400">Nenhum projeto atrasado.</p>
                </div>
              ) : (
                <ul className="divide-y divide-ink-300/20 max-h-72 overflow-y-auto">
                  {data.projetos_atrasados.map(p => (
                    <li key={p.id} className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-cream-100 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900 truncate">{p.nome}</p>
                        <p className="text-xs text-ink-500 truncate">{p.cliente_nome}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-xs text-red-600 font-medium">+{diasAtraso(p.data_prevista_fim!)}d</p>
                        <p className="font-mono text-[10px] text-ink-400">
                          {new Date(p.data_prevista_fim! + 'T12:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-ink-300/40 flex items-center gap-2">
                <Clock size={14} className="text-terra-500" strokeWidth={1.75} />
                <p className="font-mono text-[10px] uppercase tracking-widest text-terra-600">Prazos vencendo</p>
                <span className="ml-auto font-mono text-[10px] bg-terra-500/10 text-terra-700 px-2 py-0.5 rounded">
                  próximos 30 dias
                </span>
              </div>
              {data.projetos_prazo_proximo.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-2xl mb-1">✓</p>
                  <p className="text-sm text-ink-400">Sem prazos nos próximos 30 dias.</p>
                </div>
              ) : (
                <ul className="divide-y divide-ink-300/20 max-h-72 overflow-y-auto">
                  {data.projetos_prazo_proximo.map(p => {
                    const dias = diasRestantes(p.data_prevista_fim!)
                    return (
                      <li key={p.id} className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-cream-100 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-900 truncate">{p.nome}</p>
                          <p className="text-xs text-ink-500 truncate">{p.cliente_nome}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`font-mono text-xs font-medium ${dias <= 7 ? 'text-red-600' : dias <= 14 ? 'text-terra-600' : 'text-ink-700'}`}>
                            {dias}d restantes
                          </p>
                          <p className="font-mono text-[10px] text-ink-400">
                            {new Date(p.data_prevista_fim! + 'T12:00').toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Status dos projetos */}
          <div className="card p-6 fade-in stagger-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">Projetos</p>
            <h3 className="font-display text-2xl text-ink-900 mb-5">Distribuição por status</h3>
            {data.projetos_status.length === 0 ? (
              <p className="text-sm text-ink-400">Nenhum projeto cadastrado.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {data.projetos_status.map(s => (
                  <div key={s.status} className={`flex items-center gap-3 px-4 py-3 rounded-lg ${STATUS_COR[s.status] || 'bg-cream-200 text-ink-700'}`}>
                    <span className="font-display text-3xl tabular-nums leading-none">{s.count}</span>
                    <span className="text-xs font-medium leading-tight">{STATUS_LABEL[s.status] || s.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Faturamento mensal + Ticket por cliente */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in stagger-3">

            <div className="card p-6">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} strokeWidth={1.75} className="text-ink-400" />
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Financeiro</p>
                </div>
                {/* Filtro de período */}
                <div className="flex gap-1">
                  {[3, 6, 12].map(n => (
                    <button
                      key={n}
                      onClick={() => setMesesFat(n)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        mesesFat === n ? 'bg-ink-900 text-cream-50' : 'bg-cream-200 text-ink-600 hover:bg-cream-300'
                      }`}
                    >
                      {n}m
                    </button>
                  ))}
                </div>
              </div>
              <h3 className="font-display text-2xl text-ink-900 mb-5">Faturamento mensal</h3>
              {fatFiltrado.length === 0 ? (
                <p className="text-sm text-ink-400 py-4">Sem lançamentos de receita registrados.</p>
              ) : (
                <div className="space-y-3">
                  {fatFiltrado.map(m => (
                    <div key={m.mes} className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-ink-500 w-14 shrink-0 uppercase">{nomeMes(m.mes)}</span>
                      <div className="flex-1 bg-cream-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-ink-900 rounded-full transition-all duration-500"
                          style={{ width: `${(m.total / maxFat) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-ink-700 w-28 text-right shrink-0">{brl(m.total)}</span>
                    </div>
                  ))}
                  {fatFiltrado.length > 1 && (
                    <div className="pt-2 border-t border-ink-300/20 flex items-center justify-between">
                      <span className="text-xs text-ink-500">Total {mesesFat}m</span>
                      <span className="font-mono text-sm font-medium text-ink-900">{brl(fatFiltrado.reduce((s, m) => s + m.total, 0))}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="card overflow-hidden">
              <div className="px-6 pt-6 pb-4 border-b border-ink-300/40">
                <div className="flex items-center gap-2 mb-1">
                  <Users size={14} strokeWidth={1.75} className="text-ink-400" />
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Contratos</p>
                </div>
                <h3 className="font-display text-2xl text-ink-900">Ticket médio por cliente</h3>
              </div>
              {data.ticket_por_cliente.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-ink-400">Sem contratos registrados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-ink-300/30 bg-cream-100">
                        <th className="px-5 py-2.5 text-left font-mono text-[9px] uppercase tracking-widest text-ink-500">Cliente</th>
                        <th className="px-5 py-2.5 text-center font-mono text-[9px] uppercase tracking-widest text-ink-500">Qtd</th>
                        <th className="px-5 py-2.5 text-right font-mono text-[9px] uppercase tracking-widest text-ink-500">Ticket médio</th>
                        <th className="px-5 py-2.5 text-right font-mono text-[9px] uppercase tracking-widest text-ink-500">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ticket_por_cliente.map((c, i) => (
                        <tr key={i} className="border-b border-ink-300/20 hover:bg-cream-100 transition-colors">
                          <td className="px-5 py-2.5 text-sm text-ink-900 font-medium max-w-[140px] truncate">{c.cliente_nome || '—'}</td>
                          <td className="px-5 py-2.5 text-center font-mono text-sm text-ink-500">{c.total_contratos}</td>
                          <td className="px-5 py-2.5 text-right font-mono text-sm text-ink-800 font-medium">{brl(c.media_valor)}</td>
                          <td className="px-5 py-2.5 text-right font-mono text-xs text-ink-500">{brl(c.total_valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Projetos por comarca/região */}
          <div className="card p-6 fade-in stagger-3">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} strokeWidth={1.75} className="text-ink-400" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Distribuição geográfica</p>
            </div>
            <h3 className="font-display text-2xl text-ink-900 mb-6">Projetos por comarca / região</h3>
            {data.projetos_por_cidade.filter(c => c.cidade !== 'Não informada').length === 0 ? (
              <p className="text-sm text-ink-400">
                Nenhum projeto com cidade registrada.{' '}
                <span className="text-ink-300">Configure em Gestão / Gantt → editar projeto.</span>
              </p>
            ) : (
              <div className="space-y-3">
                {data.projetos_por_cidade.map(c => (
                  <div key={c.cidade} className="flex items-center gap-3">
                    <span className={`text-sm w-44 shrink-0 truncate ${c.cidade === 'Não informada' ? 'text-ink-300 italic' : 'text-ink-700'}`}>
                      {c.cidade}
                    </span>
                    <div className="flex-1 bg-cream-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${c.cidade === 'Não informada' ? 'bg-ink-300' : 'bg-terra-500'}`}
                        style={{ width: `${(c.count / maxCid) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs font-medium text-ink-900 w-6 text-right shrink-0">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </>
  )
}

function KPI({ icon: Icon, label, valor, cor, bg, detalhe, pequeno }: {
  icon: any; label: string; valor: string; cor: string; bg: string; detalhe?: string; pequeno?: boolean
}) {
  return (
    <div className="card p-6">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${bg} mb-3`}>
        <Icon size={16} strokeWidth={1.75} className={cor} />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">{label}</p>
      <p className={`font-display ${pequeno ? 'text-lg' : 'text-4xl'} text-ink-900 tabular-nums leading-none`}>{valor}</p>
      {detalhe && <p className="text-xs text-ink-500 mt-2">{detalhe}</p>}
    </div>
  )
}
