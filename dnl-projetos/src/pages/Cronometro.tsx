import { useEffect, useState } from 'react'
import { Play, Square, Pencil, Plus, User as UserIcon, X } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import type { Projeto, Cronometro, User } from '@shared/types'

function parseSQLiteDate(s: string): Date {
  return new Date(s.replace(' ', 'T'))
}

function paraInputs(ts?: string): { data: string; hora: string } {
  const d = ts ? parseSQLiteDate(ts) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    data: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
}

function formatarSegundos(seg: number): string {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function CronometroPage() {
  const { user } = useAuth()
  const ehAdminOuRH = user?.role === 'admin' || user?.role === 'rh'

  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [ativo, setAtivo] = useState<Cronometro | null>(null)
  const [historico, setHistorico] = useState<Cronometro[]>([])
  const [projetoSelecionado, setProjetoSelecionado] = useState<number | ''>('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [usuarioAlvo, setUsuarioAlvo] = useState<number | ''>('')
  const [modal, setModal] = useState<{ modo: 'criar' | 'editar'; sessao?: Cronometro } | null>(null)

  const souEuMesmo = usuarioAlvo === ''

  useEffect(() => {
    if (ehAdminOuRH) api.usuarios.listar().then((us) => setUsuarios(us as User[]))
  }, [ehAdminOuRH])

  useEffect(() => {
    carregar()
  }, [usuarioAlvo])

  async function carregar() {
    try {
      const alvo = usuarioAlvo ? Number(usuarioAlvo) : undefined
      const [ps, at, hist] = await Promise.all([
        alvo ? api.projetos.listar() : api.projetos.listarMeus(),
        api.cronometro.ativo(alvo),
        api.cronometro.historico(20, alvo)
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

      {ehAdminOuRH && (
        <div className="card p-5 mb-6 fade-in">
          <label className="label flex items-center gap-1">
            <UserIcon size={11} /> Ver/corrigir cronômetro de
          </label>
          <select
            className="input-field max-w-xs"
            value={usuarioAlvo}
            onChange={(e) => setUsuarioAlvo(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">— Eu mesmo —</option>
            {usuarios
              .filter((u) => u.id !== user?.id)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
          </select>
          {!souEuMesmo && (
            <p className="text-xs text-ink-500 mt-2">
              Você está corrigindo o cronômetro de outra pessoa. Só é possível editar ou
              registrar uma sessão manual — iniciar/parar em tempo real é feito pelo próprio
              funcionário.
            </p>
          )}
        </div>
      )}

      {souEuMesmo &&
        (ativo ? (
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
        ))}

      {!souEuMesmo && erro && (
        <div className="px-4 py-3 mb-6 bg-terra-50 border border-terra-400/40 rounded-md fade-in">
          <p className="text-sm text-terra-700">{erro}</p>
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
          <button
            type="button"
            onClick={() => setModal({ modo: 'criar' })}
            className="btn-secondary"
            title="Registrar sessão esquecida"
          >
            <Plus size={14} /> Registrar sessão
          </button>
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
                  className="flex items-baseline gap-4 py-3 border-b border-ink-300/30 last:border-0 group"
                >
                  <span className="font-mono text-xs text-ink-500 w-16 uppercase tracking-wider">
                    {data}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-900 truncate">
                      {c.projeto_nome}
                      {c.origem === 'manual' && (
                        <span className="ml-2 text-[10px] font-mono uppercase tracking-widest text-ink-400">
                          editado
                        </span>
                      )}
                    </p>
                    {c.observacao && (
                      <p className="text-xs text-ink-500 truncate">{c.observacao}</p>
                    )}
                  </div>
                  <span className="font-mono text-xs text-ink-500">{horaInicio}</span>
                  <span className="font-mono text-sm text-ink-900 tabular-nums w-20 text-right">
                    {formatarSegundos(c.duracao_segundos || 0)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setModal({ modo: 'editar', sessao: c })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-400 hover:text-ink-900"
                    title="Editar esta sessão"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <ModalCronometro
          modo={modal.modo}
          sessao={modal.sessao}
          projetos={projetos}
          usuarioId={usuarioAlvo ? Number(usuarioAlvo) : undefined}
          onFechar={() => setModal(null)}
          onSalvo={() => {
            setModal(null)
            carregar()
          }}
        />
      )}
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
  // Semente vem do servidor (duracao_segundos, calculado com o mesmo relogio
  // que gravou o inicio) — o front so incrementa localmente a partir dai,
  // sem comparar o relogio do navegador com o do servidor.
  const [tempo, setTempo] = useState(cronometro.duracao_segundos ?? 0)

  useEffect(() => {
    setTempo(cronometro.duracao_segundos ?? 0)
    const t = setInterval(() => setTempo((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [cronometro.id, cronometro.duracao_segundos])

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

function ModalCronometro({
  modo,
  sessao,
  projetos,
  usuarioId,
  onFechar,
  onSalvo
}: {
  modo: 'criar' | 'editar'
  sessao?: Cronometro
  projetos: Projeto[]
  usuarioId?: number
  onFechar: () => void
  onSalvo: () => void
}) {
  const iniciaisInicio = paraInputs(sessao?.inicio)
  const iniciaisFim = paraInputs(sessao?.fim)
  const [projetoId, setProjetoId] = useState<number | ''>(sessao?.projeto_id || '')
  const [dataInicio, setDataInicio] = useState(iniciaisInicio.data)
  const [horaInicio, setHoraInicio] = useState(iniciaisInicio.hora)
  const [dataFim, setDataFim] = useState(iniciaisFim.data)
  const [horaFim, setHoraFim] = useState(iniciaisFim.hora)
  const [observacao, setObservacao] = useState(sessao?.observacao || '')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setErro('')
    if (!motivo.trim()) {
      setErro('Informe o motivo da correção')
      return
    }
    setSalvando(true)
    try {
      const inicio = `${dataInicio} ${horaInicio}`
      const fim = `${dataFim} ${horaFim}`
      if (modo === 'editar' && sessao) {
        await api.cronometro.corrigir(sessao.id, { inicio, fim, motivo: motivo.trim() })
      } else {
        if (!projetoId) throw new Error('Selecione o projeto')
        await api.cronometro.criarManual({
          projeto_id: Number(projetoId),
          inicio,
          fim,
          motivo: motivo.trim(),
          observacao: observacao || undefined,
          usuario_id: usuarioId
        })
      }
      onSalvo()
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!sessao) return
    setErro('')
    if (!motivo.trim()) {
      setErro('Informe o motivo da exclusão')
      return
    }
    setSalvando(true)
    try {
      await api.cronometro.excluir(sessao.id, motivo.trim())
      onSalvo()
    } catch (e: any) {
      setErro(e.message || 'Erro ao excluir')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-7">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-2xl text-ink-900">
            {modo === 'editar' ? 'Corrigir sessão' : 'Registrar sessão esquecida'}
          </h3>
          <button onClick={onFechar} className="text-ink-400 hover:text-ink-900">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {modo === 'criar' && (
            <div>
              <label className="label">Projeto</label>
              <select
                className="input-field"
                value={projetoId}
                onChange={(e) => setProjetoId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Selecione...</option>
                {projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {p.cliente_nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Início — data</label>
              <input
                type="date"
                className="input-field"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="label">Início — hora</label>
              <input
                type="time"
                className="input-field"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Fim — data</label>
              <input
                type="date"
                className="input-field"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="label">Fim — hora</label>
              <input
                type="time"
                className="input-field"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
              />
            </div>
          </div>

          {modo === 'criar' && (
            <div>
              <label className="label">Observação (opcional)</label>
              <input
                className="input-field"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="label">Motivo da correção</label>
            <input
              type="text"
              className="input-field"
              placeholder="Ex: esqueci de parar o cronômetro"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
            />
          </div>

          {erro && <p className="text-sm text-terra-700">{erro}</p>}

          <div className="flex items-center justify-between pt-2">
            {modo === 'editar' ? (
              <button onClick={excluir} disabled={salvando} className="btn-secondary text-terra-600">
                Excluir
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button onClick={onFechar} disabled={salvando} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando} className="btn-primary">
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
