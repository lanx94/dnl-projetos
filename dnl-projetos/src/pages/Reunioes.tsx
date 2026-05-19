import { useEffect, useState, FormEvent } from 'react'
import {
  Plus,
  X,
  Edit2,
  Trash2,
  Eye,
  Calendar,
  GripVertical,
  ArrowLeft,
  Save,
  Check
} from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { ReuniaoSocios, ReuniaoTopico } from '@shared/types'

const CORES: Record<string, { bg: string; border: string; label: string }> = {
  azul: { bg: 'bg-blue-50', border: 'border-blue-200', label: 'Azul' },
  amarelo: { bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'Amarelo' },
  rosa: { bg: 'bg-pink-50', border: 'border-pink-200', label: 'Rosa' },
  vermelho: { bg: 'bg-red-50', border: 'border-red-200', label: 'Vermelho' },
  lilas: { bg: 'bg-purple-50', border: 'border-purple-200', label: 'Lilás' },
  verde: { bg: 'bg-green-50', border: 'border-green-200', label: 'Verde' },
  cinza: { bg: 'bg-cream-200', border: 'border-ink-300/30', label: 'Cinza' }
}

export default function ReunioesPage() {
  const [reunioes, setReunioes] = useState<ReuniaoSocios[]>([])
  const [vendoReuniao, setVendoReuniao] = useState<ReuniaoSocios | null>(null)
  const [editando, setEditando] = useState<ReuniaoSocios | null>(null)
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setReunioes(await api.reunioes.listar())
  }

  async function deletar(r: ReuniaoSocios) {
    if (!confirm(`Excluir a reunião "${r.titulo}"?`)) return
    const res = await api.reunioes.deletar(r.id)
    if (res.success) {
      carregar()
      setVendoReuniao(null)
    }
  }

  if (criando || editando) {
    return (
      <EditorReuniao
        reuniao={editando || undefined}
        onVoltar={() => {
          setCriando(false)
          setEditando(null)
        }}
        onSalvo={() => {
          setCriando(false)
          setEditando(null)
          carregar()
        }}
      />
    )
  }

  if (vendoReuniao) {
    return (
      <VisualizadorReuniao
        reuniao={vendoReuniao}
        onVoltar={() => setVendoReuniao(null)}
        onEditar={() => {
          setEditando(vendoReuniao)
          setVendoReuniao(null)
        }}
        onAtualizar={(r) => setVendoReuniao(r)}
      />
    )
  }

  return (
    <>
      <PageHeader
        numero="A8"
        rotulo="Reuniões dos sócios"
        titulo="Reuniões"
        descricao="Pauta e tópicos de cada reunião. Marque o que foi feito."
        acoes={
          <button onClick={() => setCriando(true)} className="btn-primary">
            <Plus size={14} /> Nova reunião
          </button>
        }
      />

      {reunioes.length === 0 ? (
        <div className="card p-12 text-center fade-in">
          <p className="font-display text-2xl text-ink-700 mb-2">Sem reuniões</p>
          <p className="text-ink-500 text-sm">
            Crie a primeira reunião pra começar a registrar pautas e decisões.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 fade-in">
          {reunioes.map((r) => {
            const concluidos = r.topicos.filter((t) => t.concluido).length
            const total = r.topicos.length
            const dt = new Date(r.data + 'T12:00:00')
            return (
              <button
                key={r.id}
                onClick={() => setVendoReuniao(r)}
                className="card p-5 text-left hover:shadow-lift transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500">
                    <Calendar size={10} className="inline mr-1" />
                    {dt.toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <h3 className="font-display text-xl text-ink-900 mb-3 line-clamp-2">
                  {r.titulo}
                </h3>
                <div className="flex items-center justify-between text-xs text-ink-500">
                  <span>
                    {total} {total === 1 ? 'tópico' : 'tópicos'}
                  </span>
                  {total > 0 && (
                    <span className="font-mono tabular-nums">
                      {concluidos}/{total} feitos
                    </span>
                  )}
                </div>
                {total > 0 && (
                  <div className="h-1 bg-cream-200 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-moss-500 transition-all"
                      style={{ width: `${(concluidos / total) * 100}%` }}
                    />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

// =============================================
// VISUALIZADOR (clica nos checkboxes diretamente)
// =============================================

function VisualizadorReuniao({
  reuniao,
  onVoltar,
  onEditar,
  onAtualizar
}: {
  reuniao: ReuniaoSocios
  onVoltar: () => void
  onEditar: () => void
  onAtualizar: (r: ReuniaoSocios) => void
}) {
  async function toggleTopico(topico: ReuniaoTopico) {
    const novosTopicos = reuniao.topicos.map((t) =>
      t.id === topico.id ? { ...t, concluido: !t.concluido } : t
    )
    const r = await api.reunioes.atualizar(reuniao.id, {
      topicos: novosTopicos.map((t) => ({
        texto: t.texto,
        cor: t.cor,
        ordem: t.ordem,
        concluido: t.concluido
      }))
    })
    onAtualizar(r)
  }

  // Agrupa tópicos por cor pra renderizar em "blocos"
  const grupos = new Map<string, ReuniaoTopico[]>()
  for (const t of reuniao.topicos) {
    if (!grupos.has(t.cor)) grupos.set(t.cor, [])
    grupos.get(t.cor)!.push(t)
  }

  const dt = new Date(reuniao.data + 'T12:00:00')

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onVoltar}
          className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 text-sm"
        >
          <ArrowLeft size={14} /> Voltar
        </button>
        <button onClick={onEditar} className="btn-primary">
          <Edit2 size={14} /> Editar
        </button>
      </div>

      <div className="card p-8 max-w-3xl mx-auto">
        <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500 mb-1">
          <Calendar size={10} className="inline mr-1" />
          {dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
        <h1 className="font-display text-3xl text-ink-900 mb-6">{reuniao.titulo}</h1>

        {reuniao.observacoes && (
          <p className="text-sm text-ink-600 mb-6 italic whitespace-pre-line">
            {reuniao.observacoes}
          </p>
        )}

        {reuniao.topicos.length === 0 ? (
          <p className="text-ink-500 text-sm">Sem tópicos. Edite pra adicionar.</p>
        ) : (
          <div className="space-y-2">
            {reuniao.topicos.map((t) => (
              <button
                key={t.id}
                onClick={() => toggleTopico(t)}
                className={`w-full text-left flex items-start gap-3 p-3 rounded border ${CORES[t.cor]?.bg || 'bg-cream-100'} ${CORES[t.cor]?.border || 'border-ink-300/30'} hover:opacity-80 transition`}
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center mt-0.5 shrink-0 ${
                    t.concluido
                      ? 'bg-ink-900 border-ink-900'
                      : 'bg-cream-50 border-ink-400'
                  }`}
                >
                  {t.concluido && <Check size={10} className="text-cream-50" strokeWidth={3} />}
                </span>
                <span
                  className={`text-sm flex-1 ${
                    t.concluido ? 'line-through text-ink-500' : 'text-ink-700'
                  }`}
                >
                  {t.texto}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================
// EDITOR
// =============================================

function EditorReuniao({
  reuniao,
  onVoltar,
  onSalvo
}: {
  reuniao?: ReuniaoSocios
  onVoltar: () => void
  onSalvo: () => void
}) {
  const ehEdicao = !!reuniao
  const hoje = new Date().toISOString().slice(0, 10)
  const [titulo, setTitulo] = useState(reuniao?.titulo || '')
  const [data, setData] = useState(reuniao?.data || hoje)
  const [obs, setObs] = useState(reuniao?.observacoes || '')
  const [topicos, setTopicos] = useState<
    Array<{ texto: string; cor: string; ordem: number; concluido: boolean }>
  >(
    reuniao?.topicos?.map((t) => ({
      texto: t.texto,
      cor: t.cor,
      ordem: t.ordem,
      concluido: t.concluido
    })) || []
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function adicionar(cor: string = 'azul') {
    setTopicos((t) => [...t, { texto: '', cor, ordem: t.length, concluido: false }])
  }

  function remover(idx: number) {
    setTopicos((t) => t.filter((_, i) => i !== idx).map((tp, i) => ({ ...tp, ordem: i })))
  }

  function atualizar(idx: number, campo: 'texto' | 'cor' | 'concluido', valor: any) {
    setTopicos((t) => t.map((tp, i) => (i === idx ? { ...tp, [campo]: valor } : tp)))
  }

  function mover(idx: number, dir: -1 | 1) {
    const novo = idx + dir
    if (novo < 0 || novo >= topicos.length) return
    const novos = [...topicos]
    ;[novos[idx], novos[novo]] = [novos[novo], novos[idx]]
    setTopicos(novos.map((t, i) => ({ ...t, ordem: i })))
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) {
      setErro('Título obrigatório')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      // Filtra tópicos vazios
      const topicosLimpos = topicos
        .filter((t) => t.texto.trim())
        .map((t, i) => ({ ...t, ordem: i }))

      const dados = {
        titulo: titulo.trim(),
        data,
        observacoes: obs.trim() || undefined,
        topicos: topicosLimpos
      }
      if (ehEdicao) {
        await api.reunioes.atualizar(reuniao!.id, dados)
      } else {
        await api.reunioes.criar(dados)
      }
      onSalvo()
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onVoltar}
          className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 text-sm"
        >
          <ArrowLeft size={14} /> Voltar
        </button>
      </div>

      <form onSubmit={salvar} className="space-y-5 max-w-3xl mx-auto">
        <div className="card p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500 mb-3">
            {ehEdicao ? 'Editar reunião' : 'Nova reunião'}
          </p>
          <div className="space-y-4">
            <div>
              <label className="label">Título *</label>
              <input
                className="input-field"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Reunião semanal de planejamento"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Data</label>
                <input
                  type="date"
                  className="input-field"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Observações (opcional)</label>
              <textarea
                className="input-field min-h-[60px]"
                rows={2}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Notas gerais sobre a reunião..."
              />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-xl text-ink-900">Tópicos da pauta</h3>
            <div className="flex gap-1">
              {Object.entries(CORES).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => adicionar(k)}
                  className={`px-2 py-1 text-[10px] rounded border ${v.bg} ${v.border} hover:opacity-80`}
                  title={`Adicionar tópico ${v.label}`}
                >
                  + {v.label}
                </button>
              ))}
            </div>
          </div>

          {topicos.length === 0 ? (
            <p className="text-sm text-ink-500">
              Adicione tópicos. Use cores diferentes pra agrupar (ex: rosa = pendências, verde =
              metas, amarelo = avisos).
            </p>
          ) : (
            <div className="space-y-2">
              {topicos.map((t, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 p-2 rounded border ${CORES[t.cor]?.bg} ${CORES[t.cor]?.border}`}
                >
                  <div className="flex flex-col gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => mover(idx, -1)}
                      disabled={idx === 0}
                      className="text-ink-500 hover:text-ink-900 disabled:opacity-30 text-xs"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(idx, 1)}
                      disabled={idx === topicos.length - 1}
                      className="text-ink-500 hover:text-ink-900 disabled:opacity-30 text-xs"
                    >
                      ▼
                    </button>
                  </div>
                  <input
                    type="checkbox"
                    checked={t.concluido}
                    onChange={(e) => atualizar(idx, 'concluido', e.target.checked)}
                    className="w-4 h-4 mt-1.5 accent-ink-900"
                  />
                  <input
                    className="flex-1 bg-transparent border-0 outline-none text-sm py-1.5"
                    value={t.texto}
                    onChange={(e) => atualizar(idx, 'texto', e.target.value)}
                    placeholder="Descrição do tópico..."
                  />
                  <select
                    value={t.cor}
                    onChange={(e) => atualizar(idx, 'cor', e.target.value)}
                    className="text-[10px] bg-transparent border border-ink-300/30 rounded px-1 py-1"
                  >
                    {Object.entries(CORES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => remover(idx)}
                    className="text-ink-500 hover:text-terra-500 p-1"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {erro && (
          <div className="px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md max-w-3xl mx-auto">
            <p className="text-sm text-terra-700">{erro}</p>
          </div>
        )}

        <div className="flex justify-between items-center max-w-3xl mx-auto">
          {ehEdicao && (
            <button
              type="button"
              onClick={async () => {
                if (confirm(`Excluir a reunião "${reuniao!.titulo}"?`)) {
                  await api.reunioes.deletar(reuniao!.id)
                  onSalvo()
                }
              }}
              className="text-sm text-terra-500 hover:text-terra-700 flex items-center gap-1"
            >
              <Trash2 size={12} /> Excluir
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button type="button" onClick={onVoltar} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="btn-primary">
              <Save size={14} /> {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
