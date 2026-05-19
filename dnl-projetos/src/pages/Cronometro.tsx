import { useEffect, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { Projeto, Cronometro } from '@shared/types'

function parseSQLiteDate(s: string): Date {
  return new Date(s.replace(' ', 'T'))
}

function formatarSegundos(seg: number): string {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function CronometroPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [ativo, setAtivo] = useState<Cronometro | null>(null)
  const [historico, setHistorico] = useState<Cronometro[]>([])
  const [projetoSelecionado, setProjetoSelecionado] = useState<number | ''>('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    try {
      const [ps, at, hist] = await Promise.all([
        api.projetos.listarMeus(),
        api.cronometro.ativo(),
        api.cronometro.historico(20)
      ])
      setProjetos(ps)
      setAtivo(at)
      setHistorico(hist)
    } catch (e) {
      console.error('Erro ao carregar cronômetro:', e)
    }
  }

  async function iniciar() {
    if (!projetoSelecionado) return
    setErro('')
    try {
      await api.cronometro.iniciar(Number(projetoSelecionado), observacao || undefined)
      setObservacao('')
      await carregar()
    } catch (e: any) {
      setErro(e.message || 'Erro ao iniciar')
    }
  }

  async function parar() {
    if (!ativo) return
    setErro('')
    try {
      await api.cronometro.parar(ativo.id)
      await carregar()
    } catch (e: any) {
      setErro(e.message || 'Erro ao parar')
    }
  }

  return (
    <>
      <PageHeader
        numero="04"
        rotulo="Cronômetro"
        titulo="Tempo por projeto"
        descricao="Cronometre as horas dedicadas a cada projeto."
      />

      {ativo ? (
        <CronometroAtivo cronometro={ativo} onParar={parar} />
      ) : (
        <div className="card p-8 mb-8 fade-in">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">
            Iniciar contagem
          </p>
          <h3 className="font-display text-3xl text-ink-900 mb-6">Selecione um projeto</h3>

          <div className="space-y-4">
            <div>
              <label className="label">Projeto</label>
              <select
                className="input-field"
                value={projetoSelecionado}
                onChange={(e) =>
                  setProjetoSelecionado(e.target.value ? Number(e.target.value) : '')
                }
              >
                <option value="">Selecione...</option>
                {projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {p.cliente_nome}
                  </option>
                ))}
              </select>
              {projetos.length === 0 && (
                <p className="text-xs text-ink-500 mt-2">
                  Nenhum projeto disponível. Peça ao admin para te incluir em um.
                </p>
              )}
            </div>

            <div>
              <label className="label">Observação (opcional)</label>
              <input
                className="input-field"
                placeholder="O que você está fazendo agora?"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>

            {erro && (
              <div className="px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md">
                <p className="text-sm text-terra-700">{erro}</p>
              </div>
            )}

            <button
              onClick={iniciar}
              disabled={!projetoSelecionado}
              className="btn-accent w-full md:w-auto"
            >
              <Play size={14} /> Iniciar cronômetro
            </button>
          </div>
        </div>
      )}

      <div className="card p-7 fade-in stagger-2">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
              Últimas sessões
            </p>
            <h3 className="font-display text-2xl text-ink-900">Histórico</h3>
          </div>
        </div>

        {historico.length === 0 ? (
          <p className="text-ink-500 text-sm py-4 text-center">
            Nenhuma sessão concluída ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {historico.map((c) => {
              const inicio = parseSQLiteDate(c.inicio)
              const data = inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
              const horaInicio = inicio.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
              })
              return (
                <div
                  key={c.id}
                  className="flex items-baseline gap-4 py-3 border-b border-ink-300/30 last:border-0"
                >
                  <span className="font-mono text-xs text-ink-500 w-16 uppercase tracking-wider">
                    {data}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-900 truncate">{c.projeto_nome}</p>
                    {c.observacao && (
                      <p className="text-xs text-ink-500 truncate">{c.observacao}</p>
                    )}
                  </div>
                  <span className="font-mono text-xs text-ink-500">{horaInicio}</span>
                  <span className="font-mono text-sm text-ink-900 tabular-nums w-20 text-right">
                    {formatarSegundos(c.duracao_segundos || 0)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function CronometroAtivo({
  cronometro,
  onParar
}: {
  cronometro: Cronometro
  onParar: () => void
}) {
  const [tempo, setTempo] = useState(0)

  useEffect(() => {
    const inicioMs = parseSQLiteDate(cronometro.inicio).getTime()
    const calc = () => {
      setTempo(Math.floor((Date.now() - inicioMs) / 1000))
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [cronometro.inicio])

  return (
    <div className="relative card p-10 mb-8 overflow-hidden fade-in">
      <div
        className="absolute -right-24 -top-24 w-72 h-72 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #C75D2C 0%, transparent 70%)' }}
      />

      <div className="relative">
        <div className="flex items-baseline justify-between mb-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500">
            ● Em andamento
          </p>
          <p className="font-mono text-xs text-ink-500">
            Início:{' '}
            {parseSQLiteDate(cronometro.inicio).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>

        <h3 className="font-display text-3xl text-ink-900 mb-1">{cronometro.projeto_nome}</h3>
        {cronometro.observacao ? (
          <p className="text-sm text-ink-600 mb-6">{cronometro.observacao}</p>
        ) : (
          <div className="mb-6" />
        )}

        <p className="font-display text-7xl md:text-8xl text-ink-900 tabular-nums tracking-tightest mb-6">
          {formatarSegundos(tempo)}
        </p>

        <button onClick={onParar} className="btn-primary">
          <Square size={14} fill="currentColor" /> Parar cronômetro
        </button>
      </div>
    </div>
  )
}
