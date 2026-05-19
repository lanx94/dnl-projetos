import { useEffect, useState } from 'react'
import { Printer, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { DREMensal } from '@shared/types'

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(v: number) {
  return `${v.toFixed(2).replace('.', ',')}%`
}

export default function DREPage() {
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const [mes, setMes] = useState(mesAtual)
  const [dre, setDre] = useState<DREMensal | null>(null)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    carregar()
  }, [mes])

  async function carregar() {
    setCarregando(true)
    try {
      const d = await api.financeiro.dreMensal(mes)
      setDre(d)
    } finally {
      setCarregando(false)
    }
  }

  const nomeMes = new Date(mes + '-01T12:00').toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  })

  return (
    <>
      <PageHeader
        numero="A5"
        rotulo="DRE"
        titulo="Demonstração do Resultado"
        descricao="Análise mensal de receitas, custos, despesas e resultado operacional."
        acoes={
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer size={14} /> Imprimir
          </button>
        }
      />

      <div className="card p-5 mb-6 fade-in print:hidden">
        <label className="label">Mês de referência</label>
        <input
          type="month"
          className="input-field max-w-[200px]"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
        />
      </div>

      {!dre || carregando ? (
        <p className="text-ink-500 text-sm">Carregando…</p>
      ) : (
        <>
          <div className="card p-10 fade-in stagger-1 print:shadow-none print:p-0">
            <div className="text-center mb-8">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
                DRE — Demonstração do Resultado
              </p>
              <h2 className="font-display text-4xl text-ink-900">
                {nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}
              </h2>
            </div>

            <table className="w-full">
              <tbody>
                <Linha rotulo="(=) RECEITA BRUTA" valor={dre.receita_bruta} positivo destaque />
                <Linha rotulo="(−) Deduções (impostos)" valor={-dre.deducoes} />
                <Linha
                  rotulo="(=) RECEITA LÍQUIDA"
                  valor={dre.receita_liquida}
                  positivo
                  destaque
                  divisor
                />
                <Linha rotulo="(−) Custos operacionais" valor={-dre.custos_operacionais} />
                <Linha
                  rotulo="(=) LUCRO BRUTO"
                  valor={dre.lucro_bruto}
                  positivo={dre.lucro_bruto >= 0}
                  destaque
                  divisor
                />
                <Linha rotulo="(−) Despesas administrativas" valor={-dre.despesas_administrativas} />
                <Linha rotulo="(−) Despesas operacionais" valor={-dre.despesas_operacionais} />
                <tr className="border-t-2 border-ink-700">
                  <td className="py-4 font-display text-2xl text-ink-900">
                    (=) RESULTADO OPERACIONAL
                  </td>
                  <td className="py-4 text-right font-display text-3xl tabular-nums">
                    <span
                      className={
                        dre.resultado_operacional >= 0 ? 'text-moss-600' : 'text-terra-500'
                      }
                    >
                      {brl(dre.resultado_operacional)}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-sm text-ink-600">Margem operacional</td>
                  <td className="py-2 text-right font-mono text-sm text-ink-700 tabular-nums">
                    {pct(dre.margem_operacional)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {(dre.detalhamento.receitas_por_categoria.length > 0 ||
            dre.detalhamento.despesas_por_categoria.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 fade-in stagger-2 print:hidden">
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={14} className="text-moss-600" />
                  <h3 className="font-display text-xl text-ink-900">Receitas por categoria</h3>
                </div>
                {dre.detalhamento.receitas_por_categoria.length === 0 ? (
                  <p className="text-sm text-ink-500">Sem receitas no período.</p>
                ) : (
                  <div className="space-y-2">
                    {dre.detalhamento.receitas_por_categoria.map((r, i) => {
                      const pct = (r.valor / dre.receita_bruta) * 100
                      return (
                        <div key={i}>
                          <div className="flex justify-between mb-1 text-sm">
                            <span className="text-ink-700">{r.nome}</span>
                            <span className="font-mono text-ink-900">{brl(r.valor)}</span>
                          </div>
                          <div className="h-1 bg-cream-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-moss-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown size={14} className="text-terra-500" />
                  <h3 className="font-display text-xl text-ink-900">Despesas por categoria</h3>
                </div>
                {dre.detalhamento.despesas_por_categoria.length === 0 ? (
                  <p className="text-sm text-ink-500">Sem despesas no período.</p>
                ) : (
                  <div className="space-y-2">
                    {dre.detalhamento.despesas_por_categoria.map((d, i) => {
                      const totalDespesas =
                        dre.deducoes +
                        dre.custos_operacionais +
                        dre.despesas_administrativas +
                        dre.despesas_operacionais
                      const pctVal = totalDespesas > 0 ? (d.valor / totalDespesas) * 100 : 0
                      return (
                        <div key={i}>
                          <div className="flex justify-between mb-1 text-sm">
                            <span className="text-ink-700">{d.nome}</span>
                            <span className="font-mono text-ink-900">{brl(d.valor)}</span>
                          </div>
                          <div className="h-1 bg-cream-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-terra-500"
                              style={{ width: `${pctVal}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

function Linha({
  rotulo,
  valor,
  positivo,
  destaque,
  divisor
}: {
  rotulo: string
  valor: number
  positivo?: boolean
  destaque?: boolean
  divisor?: boolean
}) {
  return (
    <tr className={divisor ? 'border-t border-ink-300/40' : ''}>
      <td
        className={`py-2 ${destaque ? 'font-medium text-ink-900' : 'text-ink-600 pl-6'} text-sm`}
      >
        {rotulo}
      </td>
      <td
        className={`py-2 text-right font-mono tabular-nums ${
          destaque ? 'font-medium text-ink-900' : 'text-ink-700'
        } text-sm`}
      >
        <span className={positivo ? 'text-moss-600' : valor < 0 ? 'text-terra-500' : ''}>
          {brl(valor)}
        </span>
      </td>
    </tr>
  )
}
