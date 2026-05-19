import { useEffect, useState } from 'react'
import { Users, FolderKanban, Clock, Timer } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { DashboardAdmin } from '@shared/types'

const STATUS_LABEL: Record<string, string> = {
  trabalhando: 'Trabalhando',
  almoco: 'No almoço',
  parada: 'Em parada',
  finalizado: 'Finalizado',
  ausente: 'Ausente'
}

const STATUS_COR: Record<string, string> = {
  trabalhando: 'bg-moss-500/15 text-moss-600',
  almoco: 'bg-cream-300 text-ink-700',
  parada: 'bg-cream-300 text-ink-600',
  finalizado: 'bg-ink-900 text-cream-50',
  ausente: 'bg-cream-200 text-ink-400'
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardAdmin | null>(null)
  const [agora, setAgora] = useState(new Date())

  useEffect(() => {
    carregar()
    const t = setInterval(() => setAgora(new Date()), 1000)
    const reload = setInterval(carregar, 30000) // recarrega a cada 30s
    return () => {
      clearInterval(t)
      clearInterval(reload)
    }
  }, [])

  async function carregar() {
    const d = await api.admin.dashboard()
    setData(d)
  }

  return (
    <>
      <PageHeader
        numero="A1"
        rotulo="Painel administrativo"
        titulo="Visão geral da equipe"
        descricao={`Atualizado às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
      />

      {!data ? (
        <p className="text-ink-500">Carregando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 fade-in">
            <CardEstatistica
              icon={Users}
              rotulo="Funcionários"
              valor={String(data.total_funcionarios)}
              detalhe={`${data.funcionarios_trabalhando} trabalhando agora`}
            />
            <CardEstatistica
              icon={FolderKanban}
              rotulo="Projetos ativos"
              valor={String(data.total_projetos_ativos)}
            />
            <CardEstatistica
              icon={Clock}
              rotulo="Horas no mês"
              valor={data.total_horas_mes}
            />
            <CardEstatistica
              icon={Timer}
              rotulo="Cronômetros ativos"
              valor={String(data.cronometros_ativos.length)}
            />
          </div>

          {data.cronometros_ativos.length > 0 && (
            <div className="card p-7 mb-6 fade-in stagger-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500 mb-1">
                ● Em andamento agora
              </p>
              <h3 className="font-display text-2xl text-ink-900 mb-5">Cronômetros ativos</h3>
              <div className="space-y-2">
                {data.cronometros_ativos.map((c, i) => (
                  <CronometroLinha key={i} cronometro={c} />
                ))}
              </div>
            </div>
          )}

          <div className="card overflow-hidden fade-in stagger-2">
            <div className="px-7 py-5 border-b border-ink-300/40">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
                Hoje
              </p>
              <h3 className="font-display text-2xl text-ink-900">Status da equipe</h3>
            </div>

            {data.pontos_hoje.length === 0 ? (
              <p className="px-7 py-12 text-center text-ink-500 text-sm">
                Nenhum funcionário cadastrado.
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-ink-300/40 text-left">
                    <Th>Funcionário</Th>
                    <Th>Status</Th>
                    <Th>Entrada</Th>
                    <Th>Saída</Th>
                    <Th align="right">Horas hoje</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.pontos_hoje.map((p) => (
                    <tr
                      key={p.usuario_id}
                      className="border-b border-ink-300/20 hover:bg-cream-200/50"
                    >
                      <Td>
                        <span className="font-medium text-ink-900">{p.usuario_nome}</span>
                      </Td>
                      <Td>
                        <span
                          className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded ${STATUS_COR[p.status]}`}
                        >
                          {STATUS_LABEL[p.status]}
                        </span>
                      </Td>
                      <Td>
                        {p.entrada ? (
                          <span className="font-mono text-sm text-ink-700 tabular-nums">
                            {new Date(p.entrada).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </Td>
                      <Td>
                        {p.saida ? (
                          <span className="font-mono text-sm text-terra-500 tabular-nums">
                            {new Date(p.saida).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-sm font-medium text-ink-900 tabular-nums">
                          {p.horas}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  )
}

function CardEstatistica({
  icon: Icon,
  rotulo,
  valor,
  detalhe
}: {
  icon: any
  rotulo: string
  valor: string
  detalhe?: string
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} strokeWidth={1.5} className="text-ink-400" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{rotulo}</p>
      </div>
      <p className="font-display text-4xl text-ink-900 tabular-nums">{valor}</p>
      {detalhe && <p className="text-xs text-ink-500 mt-2">{detalhe}</p>}
    </div>
  )
}

function CronometroLinha({
  cronometro
}: {
  cronometro: { usuario_nome: string; projeto_nome: string; inicio: string }
}) {
  const [tempo, setTempo] = useState('00:00:00')

  useEffect(() => {
    const calc = () => {
      const seg = Math.floor((Date.now() - new Date(cronometro.inicio).getTime()) / 1000)
      const h = String(Math.floor(seg / 3600)).padStart(2, '0')
      const m = String(Math.floor((seg % 3600) / 60)).padStart(2, '0')
      const s = String(seg % 60).padStart(2, '0')
      setTempo(`${h}:${m}:${s}`)
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [cronometro.inicio])

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md bg-cream-200/50">
      <div>
        <p className="text-sm font-medium text-ink-900">{cronometro.usuario_nome}</p>
        <p className="text-xs text-ink-500">{cronometro.projeto_nome}</p>
      </div>
      <span className="font-mono text-lg text-terra-500 tabular-nums">{tempo}</span>
    </div>
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
