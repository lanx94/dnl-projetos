import { useEffect, useState } from 'react'
import { LogIn, Coffee, Utensils, LogOut, Pause, Play } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { PontosDoDia, TipoPonto, Ponto } from '@shared/types'

function parseSQLiteDate(s: string): Date {
  return new Date(s.replace(' ', 'T'))
}

export default function PontoPage() {
  const [estado, setEstado] = useState<PontosDoDia | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [agora, setAgora] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    recarregar()
  }, [])

  async function recarregar() {
    try {
      const p = await api.pontos.listarHoje()
      setEstado(p)
    } catch (e) {
      console.error('Erro ao carregar pontos:', e)
    }
  }

  async function bater(tipo: TipoPonto) {
    setErro('')
    setCarregando(true)
    try {
      await api.pontos.bater(tipo)
      await recarregar()
    } catch (e: any) {
      setErro(e.message || 'Erro ao bater ponto')
    } finally {
      setCarregando(false)
    }
  }

  const tem = (k: keyof PontosDoDia) => !!estado?.[k]
  const paradaAtiva = estado?.paradas_extras.find((p) => !p.fim)

  const naoIniciou = !tem('entrada')
  const podeAlmoco = tem('entrada') && !tem('almoco_inicio') && !tem('saida') && !paradaAtiva
  const podeVoltar = tem('almoco_inicio') && !tem('almoco_fim')
  const podeSair =
    tem('entrada') && !tem('saida') && !paradaAtiva && (tem('almoco_fim') || !tem('almoco_inicio'))
  const podeIniciarParada =
    tem('entrada') && !tem('saida') && !paradaAtiva && (!tem('almoco_inicio') || tem('almoco_fim'))

  return (
    <>
      <PageHeader
        numero="02"
        rotulo="Ponto"
        titulo="Registro do dia"
        descricao="Bata entrada, almoço, paradas extras e saída."
        acoes={
          <button
            type="button"
            onClick={async () => {
              const hoje = new Date()
              const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
              const fimMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
              const r = await api.exports.pontosExcel({
                inicio: inicioMes,
                fim: fimMes
              })
              if (r.success) alert(`Exportado: ${r.arquivo}`)
              else if (r.error && r.error !== 'Exportação cancelada') alert(`Erro: ${r.error}`)
            }}
            className="btn-secondary"
          >
            📊 Excel (mês)
          </button>
        }
      />

      <div className="text-center py-10 mb-8 fade-in">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-3">
          Hora atual
        </p>
        <p className="font-display text-8xl tracking-tightest text-ink-900 tabular-nums">
          {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="font-mono text-xs text-ink-500 mt-2">
          {agora.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 fade-in stagger-1">
        <BotaoPonto
          icon={LogIn}
          label="Entrada"
          onClick={() => bater('entrada')}
          disabled={!naoIniciou || carregando}
          variant={naoIniciou ? 'primary' : 'done'}
          hora={estado?.entrada?.timestamp}
        />
        <BotaoPonto
          icon={Coffee}
          label="Almoço"
          onClick={() => bater('almoco_inicio')}
          disabled={!podeAlmoco || carregando}
          variant={tem('almoco_inicio') ? 'done' : 'normal'}
          hora={estado?.almoco_inicio?.timestamp}
        />
        <BotaoPonto
          icon={Utensils}
          label="Volta do almoço"
          onClick={() => bater('almoco_fim')}
          disabled={!podeVoltar || carregando}
          variant={tem('almoco_fim') ? 'done' : 'normal'}
          hora={estado?.almoco_fim?.timestamp}
        />
        <BotaoPonto
          icon={LogOut}
          label="Saída"
          onClick={() => bater('saida')}
          disabled={!podeSair || carregando}
          variant={tem('saida') ? 'done' : 'normal'}
          hora={estado?.saida?.timestamp}
        />
      </div>

      <div className="card p-6 mb-6 fade-in stagger-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
              Parada extra
            </p>
            <h3 className="font-display text-2xl text-ink-900">
              {paradaAtiva ? 'Parada em andamento' : 'Banheiro, café, ligação...'}
            </h3>
          </div>
          {paradaAtiva ? (
            <button
              onClick={() => bater('parada_fim')}
              disabled={carregando}
              className="btn-accent"
            >
              <Play size={14} /> Retomar trabalho
            </button>
          ) : (
            <button
              onClick={() => bater('parada_inicio')}
              disabled={!podeIniciarParada || carregando}
              className="btn-secondary"
            >
              <Pause size={14} /> Iniciar parada
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="px-4 py-3 mb-6 bg-terra-50 border border-terra-400/40 rounded-md fade-in">
          <p className="text-sm text-terra-700">{erro}</p>
        </div>
      )}

      <div className="card p-7 fade-in stagger-3">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
              Linha do tempo
            </p>
            <h3 className="font-display text-2xl text-ink-900">Hoje</h3>
          </div>
          <p className="font-mono text-3xl text-ink-900 tabular-nums">
            {estado?.total_horas || '00h00'}
          </p>
        </div>
        <Timeline estado={estado} />
      </div>
    </>
  )
}

function BotaoPonto({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant,
  hora
}: {
  icon: any
  label: string
  onClick: () => void
  disabled: boolean
  variant: 'primary' | 'normal' | 'done'
  hora?: string
}) {
  const horaFormatada = hora
    ? parseSQLiteDate(hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  const baseClasses = 'group relative w-full p-6 rounded-lg border transition-all text-left'
  const variantClasses = {
    primary: 'bg-ink-900 border-ink-900 text-cream-50 hover:bg-ink-800',
    normal: 'bg-cream-50 border-ink-300 text-ink-900 hover:border-ink-700 hover:shadow-lift',
    done: 'bg-cream-200 border-ink-300/50 text-ink-500 cursor-not-allowed'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} disabled:cursor-not-allowed disabled:hover:shadow-none`}
    >
      <Icon size={20} strokeWidth={1.5} className="mb-3 opacity-70" />
      <p className="font-display text-2xl leading-none mb-1">{label}</p>
      <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">
        {horaFormatada || (variant === 'done' ? 'concluído' : 'aguardando')}
      </p>
      {horaFormatada && <p className="font-mono text-sm mt-2 tabular-nums">{horaFormatada}</p>}
    </button>
  )
}

function Timeline({ estado }: { estado: PontosDoDia | null }) {
  if (!estado) return <p className="text-ink-500 text-sm">Carregando...</p>

  const eventos: Array<{ tipo: string; rotulo: string; ponto: Ponto }> = []
  if (estado.entrada) eventos.push({ tipo: 'entrada', rotulo: 'Entrada', ponto: estado.entrada })
  if (estado.almoco_inicio)
    eventos.push({ tipo: 'almoco_inicio', rotulo: 'Almoço', ponto: estado.almoco_inicio })
  if (estado.almoco_fim)
    eventos.push({ tipo: 'almoco_fim', rotulo: 'Volta do almoço', ponto: estado.almoco_fim })
  for (const p of estado.paradas_extras) {
    eventos.push({ tipo: 'parada_inicio', rotulo: 'Parada extra', ponto: p.inicio })
    if (p.fim) eventos.push({ tipo: 'parada_fim', rotulo: 'Retomada', ponto: p.fim })
  }
  if (estado.saida) eventos.push({ tipo: 'saida', rotulo: 'Saída', ponto: estado.saida })

  eventos.sort(
    (a, b) => parseSQLiteDate(a.ponto.timestamp).getTime() - parseSQLiteDate(b.ponto.timestamp).getTime()
  )

  if (eventos.length === 0) {
    return <p className="text-ink-500 text-sm">Nenhum ponto registrado hoje.</p>
  }

  return (
    <div className="space-y-3">
      {eventos.map((e, i) => {
        const hora = parseSQLiteDate(e.ponto.timestamp).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        })
        const ehSaida = e.tipo === 'saida'
        const ehParada = e.tipo.includes('parada')
        return (
          <div key={i} className="flex items-baseline gap-4 py-1">
            <span
              className={`font-mono text-sm tabular-nums w-16
              ${ehSaida ? 'text-terra-500' : 'text-ink-700'}`}
            >
              {hora}
            </span>
            <span
              className={`h-px flex-1 ${ehParada ? 'bg-ink-300/30 border-t border-dashed border-ink-300' : 'bg-ink-300/40'}`}
            />
            <span className={`text-sm ${ehSaida ? 'font-medium text-terra-500' : 'text-ink-700'}`}>
              {e.rotulo}
            </span>
          </div>
        )
      })}
    </div>
  )
}
