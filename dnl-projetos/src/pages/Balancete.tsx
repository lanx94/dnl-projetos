import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'
import { TrendingUp, TrendingDown, Scale, RefreshCw, CheckCircle, Clock } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { BalanceteData } from '@shared/types'

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function brlK(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (Math.abs(v) >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`
  return `R$${v.toFixed(0)}`
}

function pct(v: number) {
  return `${v.toFixed(1).replace('.', ',')}%`
}

function nomeMes(mes: string) {
  return new Date(mes + '-15').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
}

const CORES_REC = ['#4a7a5a', '#5d9470', '#70ae86', '#83c89c', '#96e2b2', '#a9fcca']
const CORES_DES = ['#c0574a', '#d4685b', '#e8796c', '#f08a80', '#f89b94', '#ffaca8']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-ink-900 text-cream-50 rounded-lg px-4 py-3 text-xs shadow-xl min-w-[180px]">
      <p className="font-mono text-cream-400 mb-2 pb-2 border-b border-cream-50/10">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono font-medium">{brl(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

type Preset = 'mes' | 'tri' | 'ano' | 'ano_ant' | 'custom'

function calcPreset(preset: Preset): { inicio: string; fim: string } {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth() + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  const mesStr = `${ano}-${pad(mes)}`

  if (preset === 'mes') return { inicio: mesStr, fim: mesStr }
  if (preset === 'tri') {
    const iniM = mes - 2 <= 0 ? mes - 2 + 12 : mes - 2
    const iniA = mes - 2 <= 0 ? ano - 1 : ano
    return { inicio: `${iniA}-${pad(iniM)}`, fim: mesStr }
  }
  if (preset === 'ano') return { inicio: `${ano}-01`, fim: `${ano}-${pad(mes)}` }
  if (preset === 'ano_ant') return { inicio: `${ano - 1}-01`, fim: `${ano - 1}-12` }
  return { inicio: mesStr, fim: mesStr }
}

export default function BalancetePage() {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth() + 1
  const mesAtual = `${ano}-${String(mes).padStart(2, '0')}`

  const [preset, setPreset] = useState<Preset>('ano')
  const [inicio, setInicio] = useState(calcPreset('ano').inicio)
  const [fim, setFim] = useState(calcPreset('ano').fim)
  const [data, setData] = useState<BalanceteData | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, [inicio, fim])

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const d = await api.financeiro.balancete(inicio, fim)
      setData(d)
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar')
    } finally {
      setCarregando(false)
    }
  }

  function aplicarPreset(p: Preset) {
    setPreset(p)
    if (p !== 'custom') {
      const { inicio: i, fim: f } = calcPreset(p)
      setInicio(i); setFim(f)
    }
  }

  const resultado = data ? data.resultado_total : 0
  const positivo = resultado >= 0

  const PRESETS: { key: Preset; label: string }[] = [
    { key: 'mes', label: 'Mês atual' },
    { key: 'tri', label: 'Trimestre' },
    { key: 'ano', label: `${ano}` },
    { key: 'ano_ant', label: `${ano - 1}` },
    { key: 'custom', label: 'Personalizado' },
  ]

  // Recharts Bar: color resultado by positive/negative
  const dadosMensais = data?.meses.map(m => ({
    ...m,
    mes: nomeMes(m.mes),
    resultado_pos: m.resultado >= 0 ? m.resultado : 0,
    resultado_neg: m.resultado < 0 ? m.resultado : 0,
  })) ?? []

  return (
    <>
      <PageHeader
        numero="BA"
        rotulo="Financeiro"
        titulo="Balancete"
        descricao="Resumo completo de receitas, despesas e resultado por período."
        acoes={
          <button onClick={carregar} disabled={carregando} className="btn-secondary gap-2">
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
            Atualizar
          </button>
        }
      />

      {/* Filtros */}
      <div className="card p-5 mb-6 fade-in">
        <div className="flex flex-wrap items-center gap-2 mb-3">
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
        {preset === 'custom' ? (
          <div className="flex flex-wrap items-end gap-4 pt-3 border-t border-ink-300/30">
            <div>
              <label className="label">Mês início</label>
              <input type="month" className="input-field" value={inicio} onChange={e => setInicio(e.target.value)} />
            </div>
            <div>
              <label className="label">Mês fim</label>
              <input type="month" className="input-field" value={fim} max={mesAtual} onChange={e => setFim(e.target.value)} />
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-400 font-mono">
            {new Date(inicio + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            {inicio !== fim && ` até ${new Date(fim + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`}
          </p>
        )}
      </div>

      {erro && (
        <div className="card p-4 mb-4 border border-red-300 bg-red-50">
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      {!data && carregando && <p className="text-ink-500 text-sm">Carregando…</p>}

      {data && (
        <div className={`space-y-6 transition-opacity duration-200 ${carregando ? 'opacity-50 pointer-events-none' : ''}`}>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-in">
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-moss-500/10 flex items-center justify-center">
                  <TrendingUp size={14} className="text-moss-600" strokeWidth={1.75} />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Receitas</p>
              </div>
              <p className="font-display text-2xl text-moss-700 tabular-nums">{brl(data.total_receitas)}</p>
              <div className="mt-3 space-y-1">
                <p className="flex items-center gap-1.5 text-xs text-ink-500">
                  <CheckCircle size={10} className="text-moss-600" /> {brl(data.receitas_pagas)} recebido
                </p>
                <p className="flex items-center gap-1.5 text-xs text-ink-400">
                  <Clock size={10} /> {brl(data.receitas_pendentes)} pendente
                </p>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-red-50 flex items-center justify-center">
                  <TrendingDown size={14} className="text-red-500" strokeWidth={1.75} />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Despesas</p>
              </div>
              <p className="font-display text-2xl text-red-600 tabular-nums">{brl(data.total_despesas)}</p>
              <div className="mt-3 space-y-1">
                <p className="flex items-center gap-1.5 text-xs text-ink-500">
                  <CheckCircle size={10} className="text-red-500" /> {brl(data.despesas_pagas)} pago
                </p>
                <p className="flex items-center gap-1.5 text-xs text-ink-400">
                  <Clock size={10} /> {brl(data.despesas_pendentes)} a pagar
                </p>
              </div>
            </div>

            <div className={`card p-6 lg:col-span-2 border ${positivo ? 'border-moss-500/20 bg-moss-500/5' : 'border-red-300 bg-red-50/40'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${positivo ? 'bg-ink-900' : 'bg-red-100'}`}>
                  <Scale size={14} className={positivo ? 'text-cream-50' : 'text-red-600'} strokeWidth={1.75} />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Resultado do período</p>
              </div>
              <p className={`font-display text-4xl tabular-nums ${positivo ? 'text-ink-900' : 'text-red-600'}`}>{brl(resultado)}</p>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-xs text-ink-500">
                  {data.total_receitas > 0
                    ? `Margem: ${pct((resultado / data.total_receitas) * 100)}`
                    : 'Sem receitas no período'}
                </p>
                {data.total_receitas > 0 && (
                  <div className="flex-1 bg-cream-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${positivo ? 'bg-moss-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, Math.abs((resultado / data.total_receitas) * 100))}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Gráfico mensal */}
          {dadosMensais.length > 0 && (
            <div className="card p-6 fade-in stagger-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">Evolução</p>
              <h3 className="font-display text-2xl text-ink-900 mb-6">Receitas × Despesas × Resultado</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={dadosMensais} margin={{ top: 4, right: 16, left: 0, bottom: 4 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e0d8" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#8c7e6a' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={brlK} tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#8c7e6a' }} axisLine={false} tickLine={false} width={68} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(44,37,32,0.04)' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '12px' }} />
                  <Bar dataKey="receitas" name="Receitas" fill="#4a7a5a" radius={[3, 3, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="despesas" name="Despesas" fill="#c0574a" radius={[3, 3, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="resultado_pos" name="Lucro" stackId="res" fill="#2c2520" radius={[3, 3, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="resultado_neg" name="Prejuízo" stackId="res" fill="#e74c3c" radius={[0, 0, 3, 3]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Pizza receitas + despesas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in stagger-2">
            <PizzaCategoria
              titulo="Receitas por categoria"
              rotulo="Receitas"
              items={data.categorias_receita}
              cores={CORES_REC}
              vazio="Sem receitas no período."
            />
            <PizzaCategoria
              titulo="Despesas por categoria"
              rotulo="Despesas"
              items={data.categorias_despesa}
              cores={CORES_DES}
              vazio="Sem despesas no período."
            />
          </div>

          {/* Tabela mensal */}
          {dadosMensais.length > 0 && (
            <div className="card overflow-hidden fade-in stagger-3">
              <div className="px-6 py-4 border-b border-ink-300/40">
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">Detalhamento</p>
                <h3 className="font-display text-2xl text-ink-900">Resultado mensal</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-ink-300/40 bg-cream-100">
                      <th className="px-5 py-3 text-left font-mono text-[9px] uppercase tracking-widest text-ink-500">Mês</th>
                      <th className="px-5 py-3 text-right font-mono text-[9px] uppercase tracking-widest text-moss-600">Receitas</th>
                      <th className="px-5 py-3 text-right font-mono text-[9px] uppercase tracking-widest text-red-600">Despesas</th>
                      <th className="px-5 py-3 text-right font-mono text-[9px] uppercase tracking-widest text-ink-800">Resultado</th>
                      <th className="px-5 py-3 text-right font-mono text-[9px] uppercase tracking-widest text-ink-500">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.meses.map(m => {
                      const res = m.receitas - m.despesas
                      const margem = m.receitas > 0 ? (res / m.receitas) * 100 : 0
                      return (
                        <tr key={m.mes} className="border-b border-ink-300/20 hover:bg-cream-100 transition-colors">
                          <td className="px-5 py-2.5 text-sm font-medium text-ink-900 capitalize">
                            {new Date(m.mes + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono text-sm text-moss-700">{brl(m.receitas)}</td>
                          <td className="px-5 py-2.5 text-right font-mono text-sm text-red-600">{brl(m.despesas)}</td>
                          <td className={`px-5 py-2.5 text-right font-mono text-sm font-medium ${res >= 0 ? 'text-ink-900' : 'text-red-700'}`}>
                            {brl(res)}
                          </td>
                          <td className={`px-5 py-2.5 text-right font-mono text-xs ${margem >= 0 ? 'text-ink-500' : 'text-red-500'}`}>
                            {m.receitas > 0 ? pct(margem) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-ink-900 text-cream-50">
                      <td className="px-5 py-3 font-mono text-xs uppercase tracking-wider font-medium">Total</td>
                      <td className="px-5 py-3 text-right font-mono text-sm text-moss-300 font-medium">{brl(data.total_receitas)}</td>
                      <td className="px-5 py-3 text-right font-mono text-sm text-red-300 font-medium">{brl(data.total_despesas)}</td>
                      <td className={`px-5 py-3 text-right font-mono text-sm font-bold ${positivo ? 'text-cream-50' : 'text-red-300'}`}>{brl(resultado)}</td>
                      <td className={`px-5 py-3 text-right font-mono text-xs ${positivo ? 'text-cream-300' : 'text-red-300'}`}>
                        {data.total_receitas > 0 ? pct((resultado / data.total_receitas) * 100) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {dadosMensais.length === 0 && (
            <div className="card p-12 text-center">
              <Scale size={32} className="text-ink-300 mx-auto mb-3" strokeWidth={1} />
              <p className="text-ink-400 text-sm">Nenhum lançamento no período selecionado.</p>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function PizzaCategoria({
  titulo, rotulo, items, cores, vazio
}: {
  titulo: string; rotulo: string; items: { nome: string; total: number; pct: number }[]; cores: string[]; vazio: string
}) {
  return (
    <div className="card p-6">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">{rotulo}</p>
      <h3 className="font-display text-2xl text-ink-900 mb-4">{titulo.replace(/^.*\s/, '')}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-400 py-8 text-center">{vazio}</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={items}
                dataKey="total"
                nameKey="nome"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {items.map((_, i) => (
                  <Cell key={i} fill={cores[i % cores.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => brl(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {items.map((c, i) => (
              <div key={c.nome} className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cores[i % cores.length] }} />
                <span className="text-xs text-ink-700 flex-1 truncate">{c.nome}</span>
                <span className="font-mono text-[10px] text-ink-400 shrink-0">{pct(c.pct)}</span>
                <span className="font-mono text-xs text-ink-900 font-medium shrink-0 w-24 text-right">{brl(c.total)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
