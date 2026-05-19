import { useEffect, useState, useRef } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Calendar } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { FluxoCaixaData } from '@shared/types'

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function brlK(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (Math.abs(v) >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`
  return `R$${v.toFixed(0)}`
}

function formatDia(d: string) {
  const [, mes, dia] = d.split('-')
  return `${dia}/${mes}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-ink-900 text-cream-50 rounded-lg px-4 py-3 text-xs shadow-xl min-w-[180px]">
      <p className="font-mono text-cream-400 mb-2 pb-2 border-b border-cream-50/10">
        {label ? new Date(label + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }) : ''}
      </p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono font-medium">{brl(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

type Preset = '30d' | '90d' | '6m' | 'mes' | 'ano' | 'custom'

function calcPreset(preset: Preset): { inicio: string; fim: string } {
  const hoje = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  if (preset === '30d') {
    const ini = new Date(hoje); ini.setDate(hoje.getDate() - 29)
    return { inicio: fmt(ini), fim: fmt(hoje) }
  }
  if (preset === '90d') {
    const ini = new Date(hoje); ini.setDate(hoje.getDate() - 89)
    return { inicio: fmt(ini), fim: fmt(hoje) }
  }
  if (preset === '6m') {
    const ini = new Date(hoje); ini.setMonth(hoje.getMonth() - 5); ini.setDate(1)
    return { inicio: fmt(ini), fim: fmt(hoje) }
  }
  if (preset === 'mes') {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fimD = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    return { inicio: fmt(ini), fim: fmt(fimD) }
  }
  if (preset === 'ano') {
    return { inicio: `${hoje.getFullYear()}-01-01`, fim: `${hoje.getFullYear()}-12-31` }
  }
  return { inicio: fmt(hoje), fim: fmt(hoje) }
}

export default function FluxoCaixaPage() {
  const hoje = new Date()
  const [preset, setPreset] = useState<Preset>('mes')
  const [inicio, setInicio] = useState(calcPreset('mes').inicio)
  const [fim, setFim] = useState(calcPreset('mes').fim)
  const [data, setData] = useState<FluxoCaixaData | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const carregandoRef = useRef(false)

  useEffect(() => { carregar() }, [inicio, fim])

  async function carregar() {
    if (carregandoRef.current) return
    carregandoRef.current = true
    setCarregando(true)
    setErro('')
    try {
      const d = await api.financeiro.fluxoCaixa(inicio, fim)
      setData(d)
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar')
    } finally {
      setCarregando(false)
      carregandoRef.current = false
    }
  }

  function aplicarPreset(p: Preset) {
    setPreset(p)
    if (p !== 'custom') {
      const { inicio: i, fim: f } = calcPreset(p)
      setInicio(i)
      setFim(f)
    }
  }

  const saldo = data ? data.total_entradas - data.total_saidas : 0
  const temDados = data && data.periodo.length > 0

  const PRESETS: { key: Preset; label: string }[] = [
    { key: 'mes', label: 'Mês atual' },
    { key: '30d', label: 'Últimos 30d' },
    { key: '90d', label: 'Últimos 90d' },
    { key: '6m', label: 'Últimos 6m' },
    { key: 'ano', label: `Ano ${hoje.getFullYear()}` },
    { key: 'custom', label: 'Personalizado' },
  ]

  return (
    <>
      <PageHeader
        numero="FC"
        rotulo="Financeiro"
        titulo="Fluxo de Caixa"
        descricao="Movimentações pagas no período — entradas, saídas e saldo acumulado."
        acoes={
          <button onClick={carregar} disabled={carregando} className="btn-secondary gap-2">
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
            Atualizar
          </button>
        }
      />

      {/* Filtros */}
      <div className="card p-5 mb-6 fade-in">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => aplicarPreset(p.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                preset === p.key
                  ? 'bg-ink-900 text-cream-50'
                  : 'bg-cream-200 text-ink-700 hover:bg-cream-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex flex-wrap items-end gap-4 pt-3 border-t border-ink-300/30">
            <div>
              <label className="label">Data início</label>
              <input type="date" className="input-field" value={inicio}
                onChange={e => { setInicio(e.target.value) }} />
            </div>
            <div>
              <label className="label">Data fim</label>
              <input type="date" className="input-field" value={fim}
                onChange={e => { setFim(e.target.value) }} />
            </div>
          </div>
        )}
        {preset !== 'custom' && (
          <p className="text-xs text-ink-400 font-mono flex items-center gap-1.5">
            <Calendar size={11} />
            {new Date(inicio + 'T12:00').toLocaleDateString('pt-BR')} até {new Date(fim + 'T12:00').toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>

      {erro && (
        <div className="card p-4 mb-4 border-red-300 bg-red-50">
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      {!data && carregando && (
        <p className="text-ink-500 text-sm">Carregando…</p>
      )}

      {data && (
        <div className={`space-y-6 transition-opacity duration-200 ${carregando ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 fade-in">
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-moss-500/10 flex items-center justify-center">
                  <TrendingUp size={14} className="text-moss-600" strokeWidth={1.75} />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Entradas</p>
              </div>
              <p className="font-display text-3xl text-moss-700 tabular-nums">{brl(data.total_entradas)}</p>
              <p className="text-xs text-ink-400 mt-1">recebimentos pagos</p>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-red-50 flex items-center justify-center">
                  <TrendingDown size={14} className="text-red-500" strokeWidth={1.75} />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Saídas</p>
              </div>
              <p className="font-display text-3xl text-red-600 tabular-nums">{brl(data.total_saidas)}</p>
              <p className="text-xs text-ink-400 mt-1">despesas pagas</p>
            </div>
            <div className={`card p-6 ${saldo >= 0 ? '' : 'border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${saldo >= 0 ? 'bg-cream-200' : 'bg-red-50'}`}>
                  <Minus size={14} className={saldo >= 0 ? 'text-ink-700' : 'text-red-500'} strokeWidth={1.75} />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Saldo</p>
              </div>
              <p className={`font-display text-3xl tabular-nums ${saldo >= 0 ? 'text-ink-900' : 'text-red-600'}`}>
                {brl(saldo)}
              </p>
              <p className="text-xs text-ink-400 mt-1">
                {saldo >= 0 ? `+${((data.total_entradas > 0 ? saldo / data.total_entradas : 0) * 100).toFixed(1).replace('.', ',')}% de margem` : 'resultado negativo'}
              </p>
            </div>
          </div>

          {!temDados ? (
            <div className="card p-12 text-center fade-in stagger-1">
              <Calendar size={32} className="text-ink-300 mx-auto mb-3" strokeWidth={1} />
              <p className="text-ink-400 text-sm">Nenhum lançamento pago no período.</p>
              <p className="text-xs text-ink-300 mt-1">Registre pagamentos em Financeiro para ver o fluxo.</p>
            </div>
          ) : (
            <>
              {/* Gráfico Entradas × Saídas */}
              <div className="card p-6 fade-in stagger-1">
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">Movimentação</p>
                <h3 className="font-display text-2xl text-ink-900 mb-6">Entradas × Saídas</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={data.periodo} margin={{ top: 4, right: 16, left: 0, bottom: 4 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e0d8" vertical={false} />
                    <XAxis
                      dataKey="data"
                      tickFormatter={formatDia}
                      tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#8c7e6a' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={brlK}
                      tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#8c7e6a' }}
                      axisLine={false}
                      tickLine={false}
                      width={68}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(44,37,32,0.04)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '12px' }} />
                    <Bar dataKey="entradas" name="Entradas" fill="#5a7a5a" radius={[3, 3, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="saidas" name="Saídas" fill="#c0574a" radius={[3, 3, 0, 0]} maxBarSize={40} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfico Saldo acumulado */}
              <div className="card p-6 fade-in stagger-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">Evolução</p>
                <h3 className="font-display text-2xl text-ink-900 mb-6">Saldo acumulado</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={data.periodo} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e0d8" vertical={false} />
                    <XAxis
                      dataKey="data"
                      tickFormatter={formatDia}
                      tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#8c7e6a' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={brlK}
                      tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#8c7e6a' }}
                      axisLine={false}
                      tickLine={false}
                      width={68}
                    />
                    <ReferenceLine y={0} stroke="#c0574a" strokeDasharray="4 4" strokeWidth={1} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(44,37,32,0.04)' }} />
                    <Line
                      type="monotone"
                      dataKey="saldo_acumulado"
                      name="Saldo acumulado"
                      stroke="#2c2520"
                      strokeWidth={2.5}
                      dot={data.periodo.length <= 31 ? { fill: '#2c2520', r: 3, strokeWidth: 0 } : false}
                      activeDot={{ r: 5, fill: '#2c2520', strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela diária */}
              <div className="card overflow-hidden fade-in stagger-3">
                <div className="px-6 py-4 border-b border-ink-300/40">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">Detalhamento</p>
                  <h3 className="font-display text-2xl text-ink-900">Movimentação diária</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-ink-300/40 bg-cream-100">
                        <th className="px-5 py-3 text-left font-mono text-[9px] uppercase tracking-widest text-ink-500">Data</th>
                        <th className="px-5 py-3 text-right font-mono text-[9px] uppercase tracking-widest text-moss-600">Entradas</th>
                        <th className="px-5 py-3 text-right font-mono text-[9px] uppercase tracking-widest text-red-600">Saídas</th>
                        <th className="px-5 py-3 text-right font-mono text-[9px] uppercase tracking-widest text-ink-500">Saldo dia</th>
                        <th className="px-5 py-3 text-right font-mono text-[9px] uppercase tracking-widest text-ink-800">Acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.periodo.map(p => (
                        <tr key={p.data} className="border-b border-ink-300/20 hover:bg-cream-100 transition-colors">
                          <td className="px-5 py-2.5 font-mono text-sm text-ink-700">
                            {new Date(p.data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono text-sm text-moss-700">
                            {p.entradas > 0 ? brl(p.entradas) : <span className="text-ink-300">—</span>}
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono text-sm text-red-600">
                            {p.saidas > 0 ? brl(p.saidas) : <span className="text-ink-300">—</span>}
                          </td>
                          <td className={`px-5 py-2.5 text-right font-mono text-sm ${p.saldo_dia >= 0 ? 'text-ink-700' : 'text-red-600'}`}>
                            {brl(p.saldo_dia)}
                          </td>
                          <td className={`px-5 py-2.5 text-right font-mono text-sm font-medium ${p.saldo_acumulado >= 0 ? 'text-ink-900' : 'text-red-700'}`}>
                            {brl(p.saldo_acumulado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-ink-900 text-cream-50">
                        <td className="px-5 py-3 font-mono text-xs uppercase tracking-wider font-medium">Total</td>
                        <td className="px-5 py-3 text-right font-mono text-sm text-moss-300 font-medium">{brl(data.total_entradas)}</td>
                        <td className="px-5 py-3 text-right font-mono text-sm text-red-300 font-medium">{brl(data.total_saidas)}</td>
                        <td className={`px-5 py-3 text-right font-mono text-sm font-bold ${saldo >= 0 ? 'text-cream-50' : 'text-red-300'}`}>{brl(saldo)}</td>
                        <td className={`px-5 py-3 text-right font-mono text-sm font-bold ${saldo >= 0 ? 'text-cream-50' : 'text-red-300'}`}>{brl(saldo)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
