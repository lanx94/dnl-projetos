import { useEffect, useState, FormEvent } from 'react'
import {
  Edit2, Trash2, ChevronLeft, ChevronRight, BarChart2, LayoutGrid,
  Calendar, AlertTriangle, X, Columns, Palette, User as UserIcon,
  ChevronDown, ChevronUp, Clock
} from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import type { Projeto, Cliente, User, StatusProjeto } from '@shared/types'

// ── Constantes ────────────────────────────────────────────────────────────────

const LEFT_W = 232
const MONTH_W = 130
const WEEK_W = 52
const ROW_H = 54
const BAR_H = 22
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const NUM_MONTHS = 10
const NUM_WEEKS = 16

const EMPLOYEE_PALETTE = [
  '#4B7BE5','#E5644B','#2ECC71','#F39C12','#9B59B6',
  '#1ABC9C','#E74C3C','#3498DB','#D35400','#27AE60',
  '#8E44AD','#16A085','#C0392B','#2980B9','#E67E22',
]

const STATUS_ORDER: StatusProjeto[] = ['planejamento','em_andamento','pausado','concluido','cancelado']

const STATUS_LABEL: Record<StatusProjeto, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  pausado: 'Pausado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

const STATUS_BADGE: Record<StatusProjeto, string> = {
  planejamento: 'bg-cream-300 text-ink-700',
  em_andamento: 'bg-moss-500/15 text-moss-600',
  pausado: 'bg-amber-100 text-amber-700',
  concluido: 'bg-ink-900 text-cream-50',
  cancelado: 'bg-terra-100 text-terra-700',
}

const STATUS_BAR: Record<StatusProjeto, string> = {
  planejamento: '#B0ADA8',
  em_andamento: '#5D7B4A',
  pausado: '#F59E0B',
  concluido: '#2C2B27',
  cancelado: '#C75D2C',
}

const STATUS_KANBAN_COL: Record<StatusProjeto, string> = {
  planejamento: 'border-t-cream-400',
  em_andamento: 'border-t-moss-500',
  pausado: 'border-t-amber-400',
  concluido: 'border-t-ink-700',
  cancelado: 'border-t-terra-500',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pd(s?: string): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

function diffDays(a: Date, b: Date) {
  return (b.getTime() - a.getTime()) / 86400000
}

function isAtrasado(p: Projeto) {
  if (p.status !== 'em_andamento') return false
  const fim = pd(p.data_prevista_fim)
  return !!fim && fim < new Date()
}

function startOfWeek(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)) // segunda
  r.setHours(0, 0, 0, 0)
  return r
}

function fmtShort(d: Date) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Visao = 'gantt' | 'kanban' | 'cards'
type Escala = 'semana' | 'mes'
type CorMode = 'status' | 'funcionario'

// ── Página principal ──────────────────────────────────────────────────────────

export default function GestorProjetos() {
  const { user } = useAuth()
  const podeEditar = user?.role === 'admin' || user?.role === 'rh'

  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [funcionarios, setFuncionarios] = useState<User[]>([])
  const [projetoFuncs, setProjetoFuncs] = useState<Record<number, number[]>>({})

  const [visao, setVisao] = useState<Visao>('gantt')
  const [escala, setEscala] = useState<Escala>('mes')
  const [corMode, setCorMode] = useState<CorMode>('status')
  const [filtroStatus, setFiltroStatus] = useState<'' | StatusProjeto>('')
  const [editando, setEditando] = useState<Projeto | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    try {
      const lista = podeEditar ? await api.projetos.listar() : await api.projetos.listarMeus()
      setProjetos(lista)

      // Carrega funcionários de cada projeto em paralelo
      if (lista.length > 0) {
        const assigns = await Promise.all(
          lista.map(p => api.projetos.funcionariosDoProjeto(p.id).then(rows => ({ id: p.id, ids: rows.map(r => r.usuario_id) })))
        )
        const map: Record<number, number[]> = {}
        assigns.forEach(a => { map[a.id] = a.ids })
        setProjetoFuncs(map)
      }

      if (podeEditar) {
        const [cs, us] = await Promise.all([api.clientes.listar(), api.usuarios.listar()])
        setClientes(cs)
        setFuncionarios(us as User[])
      }
    } finally {
      setCarregando(false)
    }
  }

  async function deletar(p: Projeto) {
    if (!confirm(`Excluir "${p.nome}"?`)) return
    const r = await api.projetos.deletar(p.id)
    if (r.success) carregar()
    else alert(r.error || 'Erro ao excluir')
  }

  async function mudarStatus(p: Projeto, novo: StatusProjeto) {
    await api.projetos.atualizar(p.id, { status: novo })
    carregar()
  }

  // Mapa funcionário → cor
  const todosIds = [...new Set(Object.values(projetoFuncs).flat())]
  const funcColorMap: Record<number, string> = {}
  todosIds.forEach((id, i) => { funcColorMap[id] = EMPLOYEE_PALETTE[i % EMPLOYEE_PALETTE.length] })

  const lista = projetos.filter(p => !filtroStatus || p.status === filtroStatus)

  const stats = [
    { label: 'Total', valor: projetos.length, cor: 'text-ink-900' },
    { label: 'Em andamento', valor: projetos.filter(p => p.status === 'em_andamento').length, cor: 'text-moss-600' },
    { label: 'Atrasados', valor: projetos.filter(isAtrasado).length, cor: projetos.some(isAtrasado) ? 'text-terra-600' : 'text-ink-400' },
    { label: 'Concluídos', valor: projetos.filter(p => p.status === 'concluido').length, cor: 'text-ink-500' },
  ]

  return (
    <>
      <PageHeader
        numero="A0"
        rotulo="Gestão"
        titulo="Gestão de Projetos"
        descricao="Gantt com escala semana/mês, coloração por funcionário e quadro Kanban."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="card p-5 fade-in">
            <p className={`font-display text-4xl font-bold ${s.cor}`}>{s.valor}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controles */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">

        {/* Visão */}
        <div className="flex items-center gap-1 bg-cream-200 p-1 rounded-lg">
          {([
            ['gantt', BarChart2, 'Gantt'],
            ['kanban', Columns, 'Kanban'],
            ['cards', LayoutGrid, 'Cards'],
          ] as const).map(([v, Icon, label]) => (
            <button key={v} onClick={() => setVisao(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                visao === v ? 'bg-cream-50 text-ink-900 shadow-sm font-medium' : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Escala (só no Gantt) */}
        {visao === 'gantt' && (
          <div className="flex items-center gap-1 bg-cream-200 p-1 rounded-lg">
            {([['mes', 'Mês'], ['semana', 'Semana']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setEscala(v)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  escala === v ? 'bg-cream-50 text-ink-900 shadow-sm font-medium' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                <Clock size={12} /> {label}
              </button>
            ))}
          </div>
        )}

        {/* Coloração (só no Gantt) */}
        {visao === 'gantt' && (
          <div className="flex items-center gap-1 bg-cream-200 p-1 rounded-lg">
            {([['status', Palette, 'Por status'], ['funcionario', UserIcon, 'Por funcionário']] as const).map(([v, Icon, label]) => (
              <button key={v} onClick={() => setCorMode(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  corMode === v ? 'bg-cream-50 text-ink-900 shadow-sm font-medium' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        )}

        {/* Filtro status */}
        <div className="flex items-center gap-2 ml-auto">
          <select className="input-field w-auto text-sm" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as any)}>
            <option value="">Todos os status</option>
            {STATUS_ORDER.map(k => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
          </select>
          {filtroStatus && <button onClick={() => setFiltroStatus('')} className="text-xs text-terra-500 hover:text-terra-700">limpar</button>}
        </div>
      </div>

      {carregando ? (
        <div className="card p-12 text-center"><p className="text-ink-500 text-sm">Carregando projetos…</p></div>
      ) : lista.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="font-display text-2xl text-ink-700 mb-2">Nenhum projeto</p>
          <p className="text-ink-500 text-sm">{filtroStatus ? 'Nenhum projeto com esse status.' : 'Cadastre projetos na seção Projetos.'}</p>
        </div>
      ) : visao === 'gantt' ? (
        <GanttView
          projetos={lista}
          escala={escala}
          corMode={corMode}
          projetoFuncs={projetoFuncs}
          funcColorMap={funcColorMap}
          funcionarios={funcionarios}
          onEditar={podeEditar ? setEditando : undefined}
        />
      ) : visao === 'kanban' ? (
        <KanbanView
          projetos={lista}
          onEditar={podeEditar ? setEditando : undefined}
          onDeletar={podeEditar ? deletar : undefined}
          onStatusChange={podeEditar ? mudarStatus : undefined}
        />
      ) : (
        <CardsView
          projetos={lista}
          onEditar={podeEditar ? setEditando : undefined}
          onDeletar={podeEditar ? deletar : undefined}
        />
      )}

      {editando && (
        <ModalEditar
          projeto={editando}
          clientes={clientes}
          funcionarios={funcionarios}
          onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); carregar() }}
        />
      )}
    </>
  )
}

// ── Gantt ─────────────────────────────────────────────────────────────────────

function GanttView({ projetos, escala, corMode, projetoFuncs, funcColorMap, funcionarios, onEditar }: {
  projetos: Projeto[]
  escala: Escala
  corMode: CorMode
  projetoFuncs: Record<number, number[]>
  funcColorMap: Record<number, string>
  funcionarios: User[]
  onEditar?: (p: Projeto) => void
}) {
  const hoje = new Date()
  const colW = escala === 'semana' ? WEEK_W : MONTH_W
  const numCols = escala === 'semana' ? NUM_WEEKS : NUM_MONTHS

  // Calcular início padrão
  const inicios = projetos.map(p => pd(p.data_inicio)).filter(Boolean) as Date[]
  const minInicio = inicios.length ? new Date(Math.min(...inicios.map(d => d.getTime()))) : hoje

  function defaultRangeStart(): Date {
    if (escala === 'mes') {
      const d = new Date(Math.min(minInicio.getTime(), hoje.getTime()))
      d.setDate(1)
      d.setMonth(d.getMonth() - 1)
      return d
    } else {
      const d = new Date(Math.min(minInicio.getTime(), hoje.getTime()))
      const sw = startOfWeek(d)
      sw.setDate(sw.getDate() - 7)
      return sw
    }
  }

  const [rangeStart, setRangeStart] = useState<Date>(defaultRangeStart)

  // Gerar colunas
  type Col = { label: string; start: Date; end: Date }
  const cols: Col[] = []
  for (let i = 0; i < numCols; i++) {
    if (escala === 'mes') {
      const s = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1)
      const e = new Date(s.getFullYear(), s.getMonth() + 1, 0)
      cols.push({ label: `${MESES[s.getMonth()]} ${s.getFullYear()}`, start: s, end: e })
    } else {
      const s = new Date(rangeStart)
      s.setDate(s.getDate() + i * 7)
      const e = new Date(s)
      e.setDate(e.getDate() + 6)
      cols.push({ label: `${fmtShort(s)}–${fmtShort(e)}`, start: s, end: e })
    }
  }

  const rangeEnd = cols[cols.length - 1].end
  const totalDias = diffDays(rangeStart, rangeEnd)
  const totalW = numCols * colW

  function xPx(d: Date) { return (diffDays(rangeStart, d) / totalDias) * totalW }

  const hojeX = xPx(hoje)
  const hojeVisivel = hojeX >= 0 && hojeX <= totalW

  function navCols(delta: number) {
    setRangeStart(d => {
      if (escala === 'mes') return new Date(d.getFullYear(), d.getMonth() + delta * 3, 1)
      const n = new Date(d)
      n.setDate(n.getDate() + delta * 4 * 7)
      return n
    })
  }

  function goHoje() { setRangeStart(defaultRangeStart()) }

  // Função de cor da barra
  function barColor(p: Projeto): string {
    if (corMode === 'funcionario') {
      const ids = projetoFuncs[p.id] || []
      if (ids.length > 0 && funcColorMap[ids[0]]) return funcColorMap[ids[0]]
      return '#B0ADA8'
    }
    return isAtrasado(p) ? '#C75D2C' : STATUS_BAR[p.status]
  }

  const comData = projetos.filter(p => p.data_inicio || p.data_prevista_fim)
  const semData = projetos.filter(p => !p.data_inicio && !p.data_prevista_fim)

  // Legenda dinâmica
  const legendaItems: Array<{ cor: string; label: string }> = corMode === 'funcionario'
    ? todosIdsEmProjetos(projetoFuncs, projetos).map(id => ({
        cor: funcColorMap[id] || '#B0ADA8',
        label: funcionarios.find(f => f.id === id)?.nome || `ID ${id}`,
      })).concat(temSemFunc(projetoFuncs, projetos) ? [{ cor: '#B0ADA8', label: 'Sem funcionário' }] : [])
    : Object.entries(STATUS_BAR).map(([s, c]) => ({ cor: c, label: STATUS_LABEL[s as StatusProjeto] }))
      .concat([{ cor: '#C75D2C', label: 'Atrasado' }])

  return (
    <div className="card overflow-hidden fade-in">
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-ink-300/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <button onClick={() => navCols(-1)} className="p-1.5 rounded hover:bg-cream-200 text-ink-500"><ChevronLeft size={14} /></button>
          <button onClick={goHoje} className="text-xs font-mono px-2 py-1 rounded hover:bg-cream-200 text-ink-600 hover:text-ink-900">hoje</button>
          <button onClick={() => navCols(1)} className="p-1.5 rounded hover:bg-cream-200 text-ink-500"><ChevronRight size={14} /></button>
          <span className="ml-2 font-mono text-[11px] text-ink-500">
            {cols[0].label} — {cols[numCols - 1].label}
          </span>
        </div>
        {/* Legenda */}
        <div className="flex items-center gap-2 flex-wrap">
          {legendaItems.slice(0, 8).map((l, i) => (
            <span key={i} className="flex items-center gap-1 text-[10px] text-ink-500">
              <span className="w-3 h-2 rounded-sm inline-block shrink-0" style={{ background: l.cor }} />
              <span className="max-w-[90px] truncate">{l.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Tabela Gantt */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: LEFT_W + totalW }}>

          {/* Cabeçalho */}
          <div className="flex sticky top-0 z-20 bg-cream-100 border-b border-ink-300/30" style={{ height: 40 }}>
            <div className="flex items-center px-4 shrink-0 border-r border-ink-300/30 sticky left-0 bg-cream-100 z-20" style={{ width: LEFT_W }}>
              <span className="font-mono text-[9px] uppercase tracking-widest text-ink-400">Projeto</span>
            </div>
            <div className="flex" style={{ width: totalW }}>
              {cols.map((c, i) => (
                <div key={i} className="flex items-center justify-center border-r border-ink-300/20 shrink-0" style={{ width: colW }}>
                  <span className="font-mono text-[10px] text-ink-500 truncate px-1">{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Linhas com data */}
          {comData.map(p => (
            <GanttRow
              key={p.id} p={p} xPx={xPx} totalW={totalW} cols={cols} colW={colW}
              hojeX={hojeX} hojeVisivel={hojeVisivel}
              cor={barColor(p)} onEditar={onEditar}
              funcsNomes={(projetoFuncs[p.id] || []).map(id => funcionarios.find(f => f.id === id)?.nome).filter(Boolean) as string[]}
            />
          ))}

          {/* Sem data */}
          {semData.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-4 py-2 bg-cream-200/50 border-b border-t border-ink-300/20">
                <Calendar size={11} className="text-ink-400" />
                <span className="font-mono text-[9px] uppercase tracking-widest text-ink-400">
                  Sem datas · {semData.length} projeto{semData.length > 1 ? 's' : ''}
                </span>
              </div>
              {semData.map(p => (
                <div key={p.id} className="flex border-b border-ink-300/20 hover:bg-cream-200/20 group" style={{ height: ROW_H }}>
                  <div className="flex flex-col justify-center px-4 shrink-0 border-r border-ink-300/20 sticky left-0 bg-cream-50 group-hover:bg-cream-200/40 z-10" style={{ width: LEFT_W }}>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-ink-900 truncate flex-1">{p.nome}</p>
                      {onEditar && <button onClick={() => onEditar(p)} className="opacity-0 group-hover:opacity-100 p-1 text-ink-400 hover:text-ink-900"><Edit2 size={10} /></button>}
                    </div>
                    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded w-fit mt-0.5 tracking-wider ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  </div>
                  <div className="relative flex items-center shrink-0" style={{ width: totalW, height: ROW_H }}>
                    {cols.map((_, i) => <div key={i} className="absolute top-0 bottom-0" style={{ left: (i + 1) * colW - 1, width: 1, background: 'rgba(0,0,0,0.04)' }} />)}
                    {hojeVisivel && <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: hojeX, width: 1.5, background: '#C75D2C', opacity: 0.35 }} />}
                    <span className="ml-4 text-xs text-ink-400 italic">Sem datas — edite para definir o cronograma</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function GanttRow({ p, xPx, totalW, cols, colW, hojeX, hojeVisivel, cor, onEditar, funcsNomes }: {
  p: Projeto; xPx: (d: Date) => number; totalW: number
  cols: Array<{ label: string; start: Date; end: Date }>; colW: number
  hojeX: number; hojeVisivel: boolean; cor: string
  onEditar?: (p: Projeto) => void; funcsNomes: string[]
}) {
  const atrasado = isAtrasado(p)
  const inicio = pd(p.data_inicio)
  const fim = pd(p.data_prevista_fim)

  let barLeft = 0, barW = 0, temBarra = false
  if (inicio && fim) {
    const l = xPx(inicio), r = xPx(fim)
    barLeft = Math.max(0, l)
    barW = Math.max(Math.min(r, totalW) - barLeft, 6)
    temBarra = r > 0 && l < totalW
  } else if (inicio) {
    barLeft = Math.max(0, xPx(inicio)); barW = 6; temBarra = barLeft < totalW
  } else if (fim) {
    const r = xPx(fim); barLeft = 0; barW = Math.max(Math.min(r, totalW), 6); temBarra = r > 0
  }

  const dur = inicio && fim ? Math.round(diffDays(inicio, fim)) : null
  const tooltip = [
    p.nome,
    p.cliente_nome,
    inicio ? `Início: ${inicio.toLocaleDateString('pt-BR')}` : '',
    fim ? `Fim: ${fim.toLocaleDateString('pt-BR')}` : '',
    dur ? `Duração: ${dur} dias` : '',
    funcsNomes.length ? `Equipe: ${funcsNomes.join(', ')}` : '',
  ].filter(Boolean).join('\n')

  return (
    <div className="flex border-b border-ink-300/20 hover:bg-cream-200/20 group" style={{ height: ROW_H }}>
      <div className="flex flex-col justify-center px-4 shrink-0 border-r border-ink-300/20 sticky left-0 bg-cream-50 group-hover:bg-cream-200/40 z-10" style={{ width: LEFT_W }}>
        <div className="flex items-center gap-1.5">
          {atrasado && <AlertTriangle size={9} className="text-terra-500 shrink-0" />}
          <p className="text-sm font-medium text-ink-900 truncate flex-1 leading-tight">{p.nome}</p>
          {onEditar && <button onClick={() => onEditar(p)} className="opacity-0 group-hover:opacity-100 shrink-0 p-1 text-ink-400 hover:text-ink-900"><Edit2 size={10} /></button>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${atrasado ? 'bg-terra-100 text-terra-700' : STATUS_BADGE[p.status]}`}>
            {atrasado ? 'Atrasado' : STATUS_LABEL[p.status]}
          </span>
          {dur !== null && <span className="text-[9px] text-ink-400">{dur}d</span>}
        </div>
      </div>

      <div className="relative shrink-0" style={{ width: totalW, height: ROW_H }}>
        {cols.map((_, i) => <div key={i} className="absolute top-0 bottom-0" style={{ left: (i + 1) * colW - 1, width: 1, background: 'rgba(0,0,0,0.04)' }} />)}
        {hojeVisivel && <div className="absolute top-0 bottom-0 pointer-events-none z-10" style={{ left: hojeX, width: 1.5, background: '#C75D2C', opacity: 0.5 }} />}
        {temBarra && (
          <div
            className="absolute rounded-md cursor-pointer hover:brightness-105 transition-all"
            style={{ left: barLeft, top: (ROW_H - BAR_H) / 2, width: barW, height: BAR_H, background: cor, opacity: p.status === 'cancelado' ? 0.45 : 0.9 }}
            title={tooltip}
            onClick={() => onEditar?.(p)}
          >
            {barW > 60 && (
              <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white/90 truncate select-none">{p.nome}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Helpers para legenda de funcionários
function todosIdsEmProjetos(map: Record<number, number[]>, projetos: Projeto[]): number[] {
  const ids: number[] = []
  projetos.forEach(p => { (map[p.id] || []).forEach(id => { if (!ids.includes(id)) ids.push(id) }) })
  return ids
}
function temSemFunc(map: Record<number, number[]>, projetos: Projeto[]): boolean {
  return projetos.some(p => (map[p.id] || []).length === 0)
}

// ── Kanban ────────────────────────────────────────────────────────────────────

function KanbanView({ projetos, onEditar, onDeletar, onStatusChange }: {
  projetos: Projeto[]
  onEditar?: (p: Projeto) => void
  onDeletar?: (p: Projeto) => void
  onStatusChange?: (p: Projeto, s: StatusProjeto) => void
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 fade-in">
      {STATUS_ORDER.map(status => {
        const cards = projetos.filter(p => p.status === status)
        const idx = STATUS_ORDER.indexOf(status)
        return (
          <div key={status} className={`shrink-0 w-64 flex flex-col rounded-lg border border-ink-300/30 border-t-4 bg-cream-50 ${STATUS_KANBAN_COL[status]}`}>
            {/* Cabeçalho da coluna */}
            <div className="px-4 py-3 border-b border-ink-300/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-900">{STATUS_LABEL[status]}</span>
                <span className="font-mono text-xs bg-cream-200 text-ink-600 px-1.5 py-0.5 rounded-full">{cards.length}</span>
              </div>
            </div>

            {/* Cards */}
            <div className="flex-1 p-3 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
              {cards.length === 0 && (
                <p className="text-xs text-ink-400 italic text-center py-4">Nenhum projeto</p>
              )}
              {cards.map(p => {
                const atrasado = isAtrasado(p)
                const inicio = pd(p.data_inicio)
                const fim = pd(p.data_prevista_fim)
                const prevIdx = idx - 1
                const nextIdx = idx + 1
                return (
                  <div key={p.id} className="bg-white rounded-lg border border-ink-300/30 p-3 shadow-sm hover:shadow-md transition-shadow group">
                    {/* Header card */}
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <p className="text-sm font-medium text-ink-900 leading-tight flex-1">{p.nome}</p>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                        {onEditar && (
                          <button onClick={() => onEditar(p)} className="p-1 text-ink-400 hover:text-ink-900 rounded hover:bg-cream-100"><Edit2 size={10} /></button>
                        )}
                        {onDeletar && (
                          <button onClick={() => onDeletar(p)} className="p-1 text-ink-400 hover:text-terra-500 rounded hover:bg-terra-50"><Trash2 size={10} /></button>
                        )}
                      </div>
                    </div>

                    {/* Cliente */}
                    <p className="font-mono text-[10px] uppercase tracking-wider text-ink-500 mb-2 truncate">{p.cliente_nome}</p>

                    {/* Datas */}
                    {(inicio || fim) && (
                      <div className={`flex items-center gap-1 text-[10px] mb-2 ${atrasado ? 'text-terra-600' : 'text-ink-400'}`}>
                        <Calendar size={9} className="shrink-0" />
                        {inicio && <span>{inicio.toLocaleDateString('pt-BR')}</span>}
                        {inicio && fim && <span>→</span>}
                        {fim && <span className={atrasado ? 'font-medium' : ''}>{fim.toLocaleDateString('pt-BR')}</span>}
                        {atrasado && <AlertTriangle size={9} className="ml-auto text-terra-500" />}
                      </div>
                    )}

                    {/* Mover entre status */}
                    {onStatusChange && (prevIdx >= 0 || nextIdx < STATUS_ORDER.length) && (
                      <div className="flex items-center gap-1 pt-2 border-t border-ink-300/20">
                        {prevIdx >= 0 && (
                          <button
                            onClick={() => onStatusChange(p, STATUS_ORDER[prevIdx])}
                            className="flex items-center gap-1 text-[10px] text-ink-500 hover:text-ink-900 px-1.5 py-1 rounded hover:bg-cream-100 transition-colors"
                            title={`Mover para ${STATUS_LABEL[STATUS_ORDER[prevIdx]]}`}
                          >
                            <ChevronUp size={10} /> {STATUS_LABEL[STATUS_ORDER[prevIdx]]}
                          </button>
                        )}
                        <div className="flex-1" />
                        {nextIdx < STATUS_ORDER.length && (
                          <button
                            onClick={() => onStatusChange(p, STATUS_ORDER[nextIdx])}
                            className="flex items-center gap-1 text-[10px] text-ink-500 hover:text-ink-900 px-1.5 py-1 rounded hover:bg-cream-100 transition-colors"
                            title={`Mover para ${STATUS_LABEL[STATUS_ORDER[nextIdx]]}`}
                          >
                            {STATUS_LABEL[STATUS_ORDER[nextIdx]]} <ChevronDown size={10} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Cards View ────────────────────────────────────────────────────────────────

function CardsView({ projetos, onEditar, onDeletar }: {
  projetos: Projeto[]
  onEditar?: (p: Projeto) => void
  onDeletar?: (p: Projeto) => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projetos.map(p => {
        const atrasado = isAtrasado(p)
        const inicio = pd(p.data_inicio)
        const fim = pd(p.data_prevista_fim)
        return (
          <div key={p.id} className="card p-6 group relative fade-in">
            {(onEditar || onDeletar) && (
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEditar && <button onClick={() => onEditar(p)} className="p-1.5 bg-cream-100 hover:bg-cream-200 rounded text-ink-600"><Edit2 size={11} /></button>}
                {onDeletar && <button onClick={() => onDeletar(p)} className="p-1.5 bg-cream-100 hover:bg-terra-100 rounded text-ink-600 hover:text-terra-600"><Trash2 size={11} /></button>}
              </div>
            )}
            <div className="flex items-center gap-2 mb-3 pr-16">
              {atrasado && <AlertTriangle size={12} className="text-terra-500" />}
              <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded ${atrasado ? 'bg-terra-100 text-terra-700' : STATUS_BADGE[p.status]}`}>
                {atrasado ? 'Atrasado' : STATUS_LABEL[p.status]}
              </span>
              <span className="font-mono text-xs text-ink-500 ml-auto">{p.revisao_atual}</span>
            </div>
            <h3 className="font-display text-2xl text-ink-900 leading-tight mb-1">{p.nome}</h3>
            <p className="text-xs text-ink-500 font-mono uppercase tracking-wider mb-3">{p.cliente_nome}</p>
            {p.descricao && <p className="text-sm text-ink-600 line-clamp-2 mb-3">{p.descricao}</p>}
            {(inicio || fim) && (
              <div className="flex items-center gap-2 pt-3 border-t border-ink-300/30 text-xs">
                <Calendar size={11} className="text-ink-400" />
                {inicio && <span className="text-ink-500">{inicio.toLocaleDateString('pt-BR')}</span>}
                {inicio && fim && <span className="text-ink-400">→</span>}
                {fim && <span className={atrasado ? 'text-terra-600 font-medium' : 'text-ink-500'}>{fim.toLocaleDateString('pt-BR')}</span>}
                {inicio && fim && <span className="text-ink-400 ml-auto">{Math.round(diffDays(inicio, fim))}d</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Modal Editar ──────────────────────────────────────────────────────────────

function ModalEditar({ projeto, clientes, funcionarios, onFechar, onSalvo }: {
  projeto: Projeto; clientes: Cliente[]; funcionarios: User[]
  onFechar: () => void; onSalvo: () => void
}) {
  const [nome, setNome] = useState(projeto.nome)
  const [descricao, setDescricao] = useState(projeto.descricao || '')
  const [clienteId, setClienteId] = useState(projeto.cliente_id)
  const [status, setStatus] = useState<StatusProjeto>(projeto.status)
  const [dataInicio, setDataInicio] = useState(projeto.data_inicio || '')
  const [dataFim, setDataFim] = useState(projeto.data_prevista_fim || '')
  const [cidade, setCidade] = useState(projeto.cidade || '')
  const [funcsIds, setFuncsIds] = useState<number[]>([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.projetos.funcionariosDoProjeto(projeto.id).then(rows => setFuncsIds(rows.map(r => r.usuario_id)))
  }, [projeto.id])

  function toggleFunc(id: number) {
    setFuncsIds(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return setErro('Nome é obrigatório')
    setErro(''); setSalvando(true)
    try {
      await api.projetos.atualizar(projeto.id, {
        nome: nome.trim(), descricao: descricao.trim() || undefined, cliente_id: clienteId,
        status, data_inicio: dataInicio || undefined, data_prevista_fim: dataFim || undefined,
        cidade: cidade.trim() || undefined,
        funcionarios_ids: funcsIds,
      })
      onSalvo()
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-xl max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Editar projeto</p>
            <h2 className="font-display text-2xl text-ink-900">{projeto.nome}</h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-4">
          <div>
            <label className="label">Nome *</label>
            <input className="input-field" value={nome} onChange={e => setNome(e.target.value)} required />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input-field min-h-[70px]" rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cliente</label>
              <select className="input-field" value={clienteId} onChange={e => setClienteId(Number(e.target.value))}>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input-field" value={status} onChange={e => setStatus(e.target.value as StatusProjeto)}>
                {STATUS_ORDER.map(k => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Data de início</label>
              <input type="date" className="input-field" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div>
              <label className="label">Previsão de conclusão</label>
              <input type="date" className="input-field" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Cidade / Comarca</label>
            <input className="input-field" placeholder="Ex: São Paulo, Itaim Paulista…" value={cidade} onChange={e => setCidade(e.target.value)} />
          </div>
          {funcionarios.length > 0 && (
            <div>
              <label className="label">Equipe</label>
              <div className="grid grid-cols-2 gap-1 max-h-36 overflow-auto border border-ink-300/30 rounded-md p-2">
                {funcionarios.map(f => (
                  <label key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-cream-200 cursor-pointer text-sm">
                    <input type="checkbox" className="accent-ink-900" checked={funcsIds.includes(f.id)} onChange={() => toggleFunc(f.id)} />
                    <span className="truncate">{f.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {erro && <div className="px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md"><p className="text-sm text-terra-700">{erro}</p></div>}
          <div className="flex justify-end gap-3 pt-4 border-t border-ink-300/40">
            <button type="button" onClick={onFechar} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-primary">{salvando ? 'Salvando…' : 'Salvar alterações'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
