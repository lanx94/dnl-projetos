import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Timer, FileText, BarChart3, Clock, Target } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import type { PontosDoDia, Cronometro, RelatorioDiario, ResumoMensal, MetaSMART } from '@shared/types'

export default function Dashboard() {
  const { user } = useAuth()
  const [pontosHoje, setPontosHoje] = useState<PontosDoDia | null>(null)
  const [cronoAtivo, setCronoAtivo] = useState<Cronometro | null>(null)
  const [diarioHoje, setDiarioHoje] = useState<RelatorioDiario | null>(null)
  const [resumo, setResumo] = useState<ResumoMensal | null>(null)
  const [metasAtivas, setMetasAtivas] = useState<MetaSMART[]>([])
  const [agora, setAgora] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    carregar()
    // Recarrega a cada 30s para manter cronômetro/diário/resumo atualizados
    const t = setInterval(carregar, 30000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function carregar() {
    try {
      const [p, c, d, metas] = await Promise.all([
        api.pontos.listarHoje(),
        api.cronometro.ativo(),
        api.relatorios.obterDiarioHoje(),
        api.metas.listar('ativa')
      ])
      setPontosHoje(p)
      setCronoAtivo(c)
      setDiarioHoje(d)
      setMetasAtivas(metas.slice(0, 3))

      const agoraNovo = new Date()
      const mesAtual = `${agoraNovo.getFullYear()}-${String(agoraNovo.getMonth() + 1).padStart(2, '0')}`
      const r = await api.relatorios.resumoMensal(mesAtual)
      setResumo(r)
    } catch (e) {
      console.error('Erro ao carregar dashboard:', e)
    }
  }

  const dataAtual = agora.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
  const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <PageHeader
        numero="01"
        rotulo="Visão geral"
        titulo={`Olá, ${user?.nome.split(' ')[0]}.`}
        descricao={dataAtual.charAt(0).toUpperCase() + dataAtual.slice(1) + ' · ' + horaAtual}
      />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-7 card fade-in">
          <div className="p-7">
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
                  Hoje
                </p>
                <h3 className="font-display text-3xl text-ink-900">Status do dia</h3>
              </div>
              <Link
                to="/ponto"
                className="text-ink-600 hover:text-ink-900 text-sm flex items-center gap-1"
              >
                Bater ponto <ArrowUpRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <Marco label="Entrada" hora={pontosHoje?.entrada?.timestamp} />
              <Marco label="Almoço" hora={pontosHoje?.almoco_inicio?.timestamp} />
              <Marco label="Volta" hora={pontosHoje?.almoco_fim?.timestamp} />
              <Marco label="Saída" hora={pontosHoje?.saida?.timestamp} />
            </div>

            <div className="mt-6 pt-6 border-t border-ink-300/30 flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Total trabalhado
              </span>
              <span className="font-display text-4xl text-ink-900">
                {pontosHoje?.total_horas || '00h00'}
              </span>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 card fade-in stagger-1">
          <div className="p-7 h-full flex flex-col">
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
                  Cronômetro
                </p>
                <h3 className="font-display text-3xl text-ink-900">
                  {cronoAtivo ? 'Em andamento' : 'Inativo'}
                </h3>
              </div>
              <Timer size={20} strokeWidth={1.5} className="text-ink-400" />
            </div>

            {cronoAtivo ? (
              <>
                <p className="text-ink-700 text-sm mb-2">{cronoAtivo.projeto_nome}</p>
                <CronometroVivo inicio={cronoAtivo.inicio} />
                <Link
                  to="/cronometro"
                  className="mt-auto pt-6 text-terra-500 hover:text-terra-600 text-sm flex items-center gap-1"
                >
                  Ver detalhes <ArrowUpRight size={14} />
                </Link>
              </>
            ) : (
              <>
                <p className="text-ink-500 text-sm">Nenhum cronômetro ativo no momento.</p>
                <Link
                  to="/cronometro"
                  className="mt-auto pt-6 text-ink-700 hover:text-ink-900 text-sm flex items-center gap-1"
                >
                  Iniciar cronômetro <ArrowUpRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 card fade-in stagger-2">
          <div className="p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
              Mês atual
            </p>
            <h3 className="font-display text-2xl text-ink-900 mb-4">Resumo</h3>
            <div className="space-y-3">
              <Linha rotulo="Total de horas" valor={resumo?.total_horas || '00h00'} destaque />
              <Linha rotulo="Dias trabalhados" valor={String(resumo?.dias_trabalhados || 0)} />
              <Linha rotulo="Média diária" valor={resumo?.media_diaria || '00h00'} />
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 card fade-in stagger-2">
          <div className="p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
              Diário
            </p>
            <h3 className="font-display text-2xl text-ink-900 mb-4">
              {diarioHoje ? 'Registrado' : 'Pendente'}
            </h3>
            <p className="text-sm text-ink-600 mb-4 line-clamp-3 min-h-[60px]">
              {diarioHoje?.conteudo || 'Você ainda não registrou as atividades de hoje.'}
            </p>
            <Link
              to="/relatorio-diario"
              className="text-ink-700 hover:text-ink-900 text-sm flex items-center gap-1"
            >
              {diarioHoje ? 'Editar' : 'Registrar agora'} <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 card fade-in stagger-3">
          <div className="p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
              Atalhos
            </p>
            <h3 className="font-display text-2xl text-ink-900 mb-4">Rápido</h3>
            <div className="space-y-2">
              <Atalho to="/ponto" icon={Clock} label="Bater ponto" />
              <Atalho to="/cronometro" icon={Timer} label="Iniciar cronômetro" />
              <Atalho to="/relatorio-diario" icon={FileText} label="Relatório diário" />
              <Atalho to="/relatorio-horas" icon={BarChart3} label="Relatório de horas" />
            </div>
          </div>
        </div>

        {metasAtivas.length > 0 && (
          <div className="col-span-12 card fade-in stagger-3">
            <div className="p-6">
              <div className="flex items-baseline justify-between mb-5">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
                    Metas SMART
                  </p>
                  <h3 className="font-display text-2xl text-ink-900">Em andamento</h3>
                </div>
                <Link to="/metas" className="text-ink-600 hover:text-ink-900 text-sm flex items-center gap-1">
                  Ver todas <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {metasAtivas.map(meta => {
                  const diasRestantes = Math.ceil(
                    (new Date(meta.prazo + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000
                  )
                  return (
                    <div key={meta.id} className="bg-cream-100 rounded-lg p-4">
                      <div className="flex items-start gap-2 mb-3">
                        <Target size={14} strokeWidth={1.75} className="text-terra-500 mt-0.5 shrink-0" />
                        <p className="text-sm font-medium text-ink-900 line-clamp-2">{meta.titulo}</p>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-1.5 bg-cream-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${meta.progresso}%`,
                              backgroundColor: meta.progresso === 100 ? '#5D7B4A' : '#C75D2C'
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs text-ink-500 tabular-nums">{meta.progresso}%</span>
                      </div>
                      <p className="font-mono text-[10px] text-ink-400 mt-2">
                        {diasRestantes >= 0 ? `${diasRestantes}d restantes` : 'Prazo vencido'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function parseSQLiteDate(s: string): Date {
  return new Date(s.replace(' ', 'T'))
}

function Marco({ label, hora }: { label: string; hora?: string }) {
  const ativo = !!hora
  const horaFormatada = hora
    ? parseSQLiteDate(hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '—'
  return (
    <div
      className={`px-4 py-4 rounded-md border transition-colors
      ${ativo ? 'bg-cream-200 border-ink-300' : 'bg-cream-50 border-ink-300/40'}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">{label}</p>
      <p className={`font-display text-2xl ${ativo ? 'text-ink-900' : 'text-ink-300'}`}>
        {horaFormatada}
      </p>
    </div>
  )
}

function Linha({
  rotulo,
  valor,
  destaque
}: {
  rotulo: string
  valor: string
  destaque?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5 border-b border-ink-300/30 last:border-0">
      <span className="text-sm text-ink-600">{rotulo}</span>
      <span
        className={`font-mono ${destaque ? 'text-lg font-medium text-ink-900' : 'text-sm text-ink-700'}`}
      >
        {valor}
      </span>
    </div>
  )
}

function Atalho({ to, icon: Icon, label }: any) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-ink-700
        hover:bg-cream-200 transition-colors text-sm group"
    >
      <Icon size={14} strokeWidth={1.75} className="text-ink-400 group-hover:text-ink-700" />
      <span className="flex-1">{label}</span>
      <ArrowUpRight size={14} className="text-ink-400 group-hover:text-ink-700" />
    </Link>
  )
}

function CronometroVivo({ inicio }: { inicio: string }) {
  const [tempo, setTempo] = useState('00:00:00')
  useEffect(() => {
    const inicioMs = parseSQLiteDate(inicio).getTime()
    const calc = () => {
      const seg = Math.floor((Date.now() - inicioMs) / 1000)
      const h = String(Math.floor(seg / 3600)).padStart(2, '0')
      const m = String(Math.floor((seg % 3600) / 60)).padStart(2, '0')
      const s = String(seg % 60).padStart(2, '0')
      setTempo(`${h}:${m}:${s}`)
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [inicio])
  return (
    <p className="font-mono text-4xl tracking-tight text-terra-500 tabular-nums">{tempo}</p>
  )
}
