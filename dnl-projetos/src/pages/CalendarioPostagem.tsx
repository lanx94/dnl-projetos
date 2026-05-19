import { useEffect, useState, DragEvent } from 'react'
import { Plus, X, Pencil, Trash2, Copy, Check, Calendar, GripVertical } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { CalendarioPostagem, CalendarioCreateInput, StatusPostagem } from '@shared/types'

// ── Configuração das colunas ──────────────────────────────────────────────────

type ColConfig = { status: StatusPostagem; label: string; cor: string; bg: string; dot: string }

const COLUNAS: ColConfig[] = [
  { status: 'ideia',     label: 'Ideia',     cor: 'text-ink-600',    bg: 'bg-ink-100',     dot: 'bg-ink-400' },
  { status: 'roteiro',   label: 'Roteiro',   cor: 'text-blue-700',   bg: 'bg-blue-50',     dot: 'bg-blue-500' },
  { status: 'gravando',  label: 'Gravando',  cor: 'text-terra-700',  bg: 'bg-terra-50',    dot: 'bg-terra-500' },
  { status: 'editando',  label: 'Editando',  cor: 'text-yellow-700', bg: 'bg-yellow-50',   dot: 'bg-yellow-500' },
  { status: 'agendado',  label: 'Agendado',  cor: 'text-purple-700', bg: 'bg-purple-50',   dot: 'bg-purple-500' },
  { status: 'publicado', label: 'Publicado', cor: 'text-green-700',  bg: 'bg-green-50',    dot: 'bg-green-500' },
]

const REDES: Record<string, { label: string; cor: string }> = {
  instagram: { label: 'Instagram',  cor: 'bg-pink-100 text-pink-700' },
  youtube:   { label: 'YouTube',    cor: 'bg-red-100 text-red-700' },
  linkedin:  { label: 'LinkedIn',   cor: 'bg-blue-100 text-blue-700' },
  tiktok:    { label: 'TikTok',     cor: 'bg-ink-100 text-ink-700' },
  facebook:  { label: 'Facebook',   cor: 'bg-blue-100 text-blue-800' },
  outro:     { label: 'Outro',      cor: 'bg-cream-200 text-ink-600' },
}

const FORMATOS = ['Reels', 'Shorts', 'Carrossel', 'Feed', 'Stories', 'Vídeo', 'Outro']
const OBJETIVOS = ['Conhecer', 'Engajar', 'Converter', 'Entreter', 'Educar']

const VAZIO: CalendarioCreateInput = {
  nome: '', status: 'ideia', rede_social: '', objetivo: '',
  servico: '', roteiro: '', legenda: '', formato: '', data_postagem: ''
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CalendarioPostagem() {
  const [cards, setCards] = useState<CalendarioPostagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [detalheAberto, setDetalheAberto] = useState<CalendarioPostagem | null>(null)
  const [editando, setEditando] = useState<CalendarioPostagem | null>(null)
  const [form, setForm] = useState<CalendarioCreateInput>(VAZIO)
  const [colunaInicial, setColunaInicial] = useState<StatusPostagem>('ideia')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState<number | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<StatusPostagem | null>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      setCarregando(true)
      setCards(await api.calendario.listar())
    } catch (e) {
      console.error('Erro ao carregar calendário:', e)
    } finally {
      setCarregando(false)
    }
  }

  function abrirNovo(status: StatusPostagem) {
    setEditando(null)
    setForm({ ...VAZIO, status })
    setColunaInicial(status)
    setErro('')
    setModalAberto(true)
  }

  function abrirEdicao(card: CalendarioPostagem) {
    setDetalheAberto(null)
    setEditando(card)
    setForm({
      nome: card.nome, status: card.status,
      rede_social: card.rede_social || '', objetivo: card.objetivo || '',
      servico: card.servico || '', roteiro: card.roteiro || '',
      legenda: card.legenda || '', formato: card.formato || '',
      data_postagem: card.data_postagem || ''
    })
    setErro('')
    setModalAberto(true)
  }

  async function salvar() {
    setErro('')
    setSalvando(true)
    try {
      const payload = {
        ...form,
        rede_social: form.rede_social || undefined,
        objetivo: form.objetivo || undefined,
        servico: form.servico || undefined,
        roteiro: form.roteiro || undefined,
        legenda: form.legenda || undefined,
        formato: form.formato || undefined,
        data_postagem: form.data_postagem || undefined,
      }
      if (editando) {
        await api.calendario.atualizar(editando.id, payload)
      } else {
        await api.calendario.criar(payload)
      }
      setModalAberto(false)
      await carregar()
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  function handleDragStart(e: DragEvent, card: CalendarioPostagem) {
    setDraggingId(card.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: DragEvent, status: StatusPostagem) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(status)
  }

  async function handleDrop(e: DragEvent, novoStatus: StatusPostagem) {
    e.preventDefault()
    setDragOverCol(null)
    if (draggingId === null) return
    const card = cards.find(c => c.id === draggingId)
    if (card) await mover(card, novoStatus)
    setDraggingId(null)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverCol(null)
  }

  async function mover(card: CalendarioPostagem, novoStatus: StatusPostagem) {
    if (card.status === novoStatus) return
    try {
      const atualizado = await api.calendario.mover(card.id, novoStatus)
      setCards(prev => prev.map(c => c.id === card.id ? atualizado : c))
    } catch (e) {
      console.error('Erro ao mover card:', e)
    }
  }

  async function deletar(id: number) {
    if (!confirm('Excluir este card?')) return
    try {
      await api.calendario.deletar(id)
      setDetalheAberto(null)
      await carregar()
    } catch (e: any) {
      alert(e.message || 'Erro ao excluir')
    }
  }

  function copiarLegenda(card: CalendarioPostagem) {
    if (!card.legenda) return
    navigator.clipboard.writeText(card.legenda)
    setCopiado(card.id)
    setTimeout(() => setCopiado(null), 2000)
  }

  const total = cards.length

  return (
    <>
      <PageHeader
        numero="CN"
        rotulo="Marketing"
        titulo="Calendário de Postagem"
        descricao={`${total} conteúdo${total !== 1 ? 's' : ''} no pipeline`}
      />

      {carregando ? (
        <div className="text-center py-20 text-ink-400 font-mono text-sm">Carregando…</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 -mx-1 px-1">
          {COLUNAS.map((col) => {
            const colCards = cards.filter(c => c.status === col.status)
            const isDragTarget = dragOverCol === col.status && draggingId !== null
            return (
              <div
                key={col.status}
                className="flex-shrink-0 w-72"
                onDragOver={e => handleDragOver(e, col.status)}
                onDrop={e => handleDrop(e, col.status)}
                onDragLeave={() => setDragOverCol(null)}
              >
                {/* Cabeçalho da coluna */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className={`font-mono text-[11px] uppercase tracking-widest font-medium ${col.cor}`}>
                    {col.label}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-ink-400 bg-cream-200 px-1.5 py-0.5 rounded">
                    {colCards.length}
                  </span>
                </div>

                {/* Área de drop */}
                <div
                  className={`space-y-2 min-h-[200px] rounded-xl p-2 transition-colors
                    ${isDragTarget ? 'bg-ink-900/5 ring-2 ring-ink-300 ring-dashed' : ''}`}
                >
                  {colCards.map(card => (
                    <KanbanCard
                      key={card.id}
                      card={card}
                      dragging={draggingId === card.id}
                      copiado={copiado === card.id}
                      onAbrir={() => { if (draggingId === null) setDetalheAberto(card) }}
                      onMoverPara={status => mover(card, status)}
                      onCopiar={() => copiarLegenda(card)}
                      onDragStart={e => handleDragStart(e, card)}
                      onDragEnd={handleDragEnd}
                    />
                  ))}

                  {colCards.length === 0 && !isDragTarget && (
                    <p className="text-xs text-ink-400 italic text-center py-6">
                      arraste cards pra cá
                    </p>
                  )}

                  {/* Botão adicionar */}
                  <button
                    onClick={() => abrirNovo(col.status)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed
                      border-ink-300/40 text-ink-400 hover:border-ink-400 hover:text-ink-600
                      transition-colors text-sm mt-1"
                  >
                    <Plus size={13} strokeWidth={2} />
                    Adicionar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de criação/edição */}
      {modalAberto && (
        <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-cream-50 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-ink-300/30 flex items-center justify-between">
              <h2 className="font-display text-2xl text-ink-900">
                {editando ? 'Editar conteúdo' : 'Novo conteúdo'}
              </h2>
              <button onClick={() => setModalAberto(false)} className="text-ink-400 hover:text-ink-700">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="label">Nome / Título</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder='Ex: "Usucapião é só pra invasor?"'
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Rede social</label>
                  <select className="input-field" value={form.rede_social} onChange={e => setForm(f => ({ ...f, rede_social: e.target.value }))}>
                    <option value="">— Selecionar —</option>
                    {Object.entries(REDES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Formato</label>
                  <select className="input-field" value={form.formato} onChange={e => setForm(f => ({ ...f, formato: e.target.value }))}>
                    <option value="">— Selecionar —</option>
                    {FORMATOS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Qual objetivo?</label>
                  <select className="input-field" value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}>
                    <option value="">— Selecionar —</option>
                    {OBJETIVOS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Qual serviço?</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ex: Usucapião, Inventário…"
                    value={form.servico}
                    onChange={e => setForm(f => ({ ...f, servico: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Status</label>
                  <select className="input-field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusPostagem }))}>
                    {COLUNAS.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Data de postagem</label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.data_postagem}
                    onChange={e => setForm(f => ({ ...f, data_postagem: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="label">Link ou Roteiro</label>
                <textarea
                  className="input-field min-h-[140px] resize-none font-mono text-xs"
                  placeholder="Tema, Gancho, Desenvolvimento, Cena, CTA…"
                  value={form.roteiro}
                  onChange={e => setForm(f => ({ ...f, roteiro: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Legenda — copiar e colar</label>
                <textarea
                  className="input-field min-h-[100px] resize-none text-sm"
                  placeholder="Legenda completa para publicação…"
                  value={form.legenda}
                  onChange={e => setForm(f => ({ ...f, legenda: e.target.value }))}
                />
              </div>

              {erro && (
                <div className="px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md">
                  <p className="text-sm text-terra-700">{erro}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-ink-300/30 flex justify-end gap-3">
              <button onClick={() => setModalAberto(false)} className="btn-secondary" disabled={salvando}>
                Cancelar
              </button>
              <button onClick={salvar} className="btn-primary" disabled={salvando}>
                {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar card'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalhe */}
      {detalheAberto && (
        <DetalheCard
          card={detalheAberto}
          copiado={copiado === detalheAberto.id}
          onFechar={() => setDetalheAberto(null)}
          onEditar={() => abrirEdicao(detalheAberto)}
          onDeletar={() => deletar(detalheAberto.id)}
          onCopiar={() => copiarLegenda(detalheAberto)}
        />
      )}
    </>
  )
}

// ── Card Kanban ───────────────────────────────────────────────────────────────

function KanbanCard({
  card, copiado, dragging,
  onAbrir, onMoverPara, onCopiar, onDragStart, onDragEnd
}: {
  card: CalendarioPostagem
  copiado: boolean
  dragging: boolean
  onAbrir: () => void
  onMoverPara: (status: StatusPostagem) => void
  onCopiar: () => void
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
}) {
  const rede = card.rede_social ? REDES[card.rede_social] : null
  const [tooltip, setTooltip] = useState<string | null>(null)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-cream-50 border border-ink-300/30 rounded-lg p-3 shadow-sm
        hover:shadow-md hover:border-ink-300/60 transition-all cursor-grab active:cursor-grabbing group
        ${dragging ? 'opacity-40 scale-95' : ''}`}
      onClick={onAbrir}
    >
      {/* Grip + badges */}
      <div className="flex items-start gap-2 mb-2">
        <GripVertical size={12} className="text-ink-300 mt-0.5 shrink-0 group-hover:text-ink-400 transition-colors" />
        <div className="flex flex-wrap gap-1.5 flex-1">
          {rede && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${rede.cor}`}>
              {rede.label}
            </span>
          )}
          {card.formato && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cream-200 text-ink-600">
              {card.formato}
            </span>
          )}
          {card.objetivo && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ink-100 text-ink-500">
              {card.objetivo}
            </span>
          )}
        </div>
      </div>

      {/* Título */}
      <p className="text-sm font-medium text-ink-900 leading-snug mb-2 line-clamp-2 pl-5">
        {card.nome}
      </p>

      {/* Serviço */}
      {card.servico && (
        <p className="text-xs text-ink-500 mb-2">{card.servico}</p>
      )}

      {/* Data */}
      {card.data_postagem && (
        <div className="flex items-center gap-1 text-[10px] font-mono text-ink-400 mb-2">
          <Calendar size={10} />
          {new Date(card.data_postagem + 'T00:00:00').toLocaleDateString('pt-BR')}
        </div>
      )}

      {/* Rodapé: pipeline dots + copiar */}
      <div
        className="flex items-center justify-between mt-2 pt-2 border-t border-ink-300/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Dots de status clicáveis */}
        <div className="relative flex items-center gap-1">
          {COLUNAS.map((col, i) => {
            const ativo = col.status === card.status
            const passado = COLUNAS.findIndex(c => c.status === card.status) > i
            return (
              <button
                key={col.status}
                onClick={() => onMoverPara(col.status)}
                onMouseEnter={() => setTooltip(col.label)}
                onMouseLeave={() => setTooltip(null)}
                className="relative group/dot"
                title={col.label}
              >
                <span
                  className={`block rounded-full transition-all duration-200
                    ${ativo
                      ? `w-3 h-3 ${col.dot} ring-2 ring-offset-1 ring-offset-cream-50 ring-current`
                      : passado
                        ? `w-2 h-2 ${col.dot} opacity-40`
                        : `w-2 h-2 bg-ink-200 hover:${col.dot} hover:opacity-70`
                    }`}
                  style={ativo ? { boxShadow: 'none' } : undefined}
                />
              </button>
            )
          })}
          {tooltip && (
            <span className="absolute -top-7 left-0 bg-ink-900 text-cream-50 text-[10px] font-mono
              px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10">
              {tooltip}
            </span>
          )}
        </div>

        {card.legenda && (
          <button
            onClick={onCopiar}
            className="p-1 rounded hover:bg-cream-200 text-ink-400 hover:text-ink-700 transition-colors"
            title="Copiar legenda"
          >
            {copiado ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Modal de detalhe ──────────────────────────────────────────────────────────

function DetalheCard({
  card, copiado,
  onFechar, onEditar, onDeletar, onCopiar
}: {
  card: CalendarioPostagem
  copiado: boolean
  onFechar: () => void
  onEditar: () => void
  onDeletar: () => void
  onCopiar: () => void
}) {
  const rede = card.rede_social ? REDES[card.rede_social] : null
  const col = COLUNAS.find(c => c.status === card.status)!

  return (
    <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-cream-50 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-ink-300/30 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${col.bg} ${col.cor}`}>
                {col.label}
              </span>
              {rede && <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${rede.cor}`}>{rede.label}</span>}
              {card.formato && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cream-200 text-ink-600">{card.formato}</span>}
            </div>
            <h2 className="font-display text-2xl text-ink-900">{card.nome}</h2>
          </div>
          <button onClick={onFechar} className="text-ink-400 hover:text-ink-700 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {(card.objetivo || card.servico || card.data_postagem) && (
            <div className="grid grid-cols-3 gap-4">
              {card.objetivo && <Info label="Objetivo" valor={card.objetivo} />}
              {card.servico && <Info label="Serviço" valor={card.servico} />}
              {card.data_postagem && (
                <Info
                  label="Data de postagem"
                  valor={new Date(card.data_postagem + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                />
              )}
            </div>
          )}

          {card.roteiro && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">
                Link ou Roteiro
              </p>
              <div className="bg-cream-100 rounded-lg p-4 text-sm text-ink-700 whitespace-pre-wrap leading-relaxed font-mono">
                {card.roteiro}
              </div>
            </div>
          )}

          {card.legenda && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  Legenda — copiar e colar
                </p>
                <button
                  onClick={onCopiar}
                  className="flex items-center gap-1.5 text-xs text-ink-600 hover:text-ink-900 transition-colors"
                >
                  {copiado
                    ? <><Check size={12} className="text-green-600" /> Copiado!</>
                    : <><Copy size={12} /> Copiar</>
                  }
                </button>
              </div>
              <div className="bg-cream-100 rounded-lg p-4 text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">
                {card.legenda}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-ink-300/30 flex justify-between">
          <button
            onClick={onDeletar}
            className="flex items-center gap-2 text-sm text-terra-600 hover:text-terra-700 transition-colors"
          >
            <Trash2 size={14} />
            Excluir
          </button>
          <button onClick={onEditar} className="btn-primary flex items-center gap-2">
            <Pencil size={14} />
            Editar
          </button>
        </div>
      </div>
    </div>
  )
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">{label}</p>
      <p className="text-sm text-ink-800">{valor}</p>
    </div>
  )
}
