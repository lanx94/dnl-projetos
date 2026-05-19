import { useEffect, useState } from 'react'
import { Target, Plus, Pencil, Trash2, ChevronDown, ChevronUp, CheckCircle2, Circle, XCircle } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { MetaSMART, MetaCreateInput, StatusMeta } from '@shared/types'

const STATUS_LABEL: Record<StatusMeta, string> = {
  ativa: 'Ativa',
  concluida: 'Concluída',
  cancelada: 'Cancelada'
}

const STATUS_COLOR: Record<StatusMeta, string> = {
  ativa: 'bg-green-100 text-green-800 border-green-200',
  concluida: 'bg-blue-100 text-blue-800 border-blue-200',
  cancelada: 'bg-red-100 text-red-700 border-red-200'
}

const CAMPOS_SMART = [
  { key: 'especifico', letra: 'S', nome: 'Específico', dica: 'O que exatamente precisa ser alcançado? Quem está envolvido?' },
  { key: 'mensuravel', letra: 'M', nome: 'Mensurável', dica: 'Como você saberá que alcançou? Qual é o indicador de sucesso?' },
  { key: 'atingivel', letra: 'A', nome: 'Atingível', dica: 'Como será alcançado? Quais recursos e habilidades são necessários?' },
  { key: 'relevante', letra: 'R', nome: 'Relevante', dica: 'Por que isso é importante agora? Está alinhado com as prioridades?' },
] as const

const VAZIO: MetaCreateInput = {
  titulo: '',
  especifico: '',
  mensuravel: '',
  atingivel: '',
  relevante: '',
  prazo: '',
  progresso: 0,
  status: 'ativa'
}

export default function Metas() {
  const [metas, setMetas] = useState<MetaSMART[]>([])
  const [filtro, setFiltro] = useState<StatusMeta | ''>('')
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<MetaSMART | null>(null)
  const [form, setForm] = useState<MetaCreateInput>(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [expandida, setExpandida] = useState<number | null>(null)

  useEffect(() => { carregar() }, [filtro])

  async function carregar() {
    try {
      setCarregando(true)
      const lista = await api.metas.listar(filtro || undefined)
      setMetas(lista)
    } catch (e) {
      console.error('Erro ao carregar metas:', e)
    } finally {
      setCarregando(false)
    }
  }

  function abrirNova() {
    setEditando(null)
    setForm(VAZIO)
    setErro('')
    setModalAberto(true)
  }

  function abrirEdicao(meta: MetaSMART) {
    setEditando(meta)
    setForm({
      titulo: meta.titulo,
      especifico: meta.especifico,
      mensuravel: meta.mensuravel,
      atingivel: meta.atingivel,
      relevante: meta.relevante,
      prazo: meta.prazo,
      progresso: meta.progresso,
      status: meta.status
    })
    setErro('')
    setModalAberto(true)
  }

  async function salvar() {
    setErro('')
    setSalvando(true)
    try {
      if (editando) {
        await api.metas.atualizar(editando.id, form)
      } else {
        await api.metas.criar(form)
      }
      setModalAberto(false)
      await carregar()
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar meta')
    } finally {
      setSalvando(false)
    }
  }

  async function deletar(id: number) {
    if (!confirm('Excluir esta meta?')) return
    try {
      await api.metas.deletar(id)
      await carregar()
    } catch (e: any) {
      alert(e.message || 'Erro ao excluir')
    }
  }

  async function atualizarProgresso(meta: MetaSMART, novoProgresso: number) {
    try {
      await api.metas.atualizar(meta.id, { progresso: novoProgresso })
      setMetas(prev => prev.map(m => m.id === meta.id ? { ...m, progresso: novoProgresso } : m))
    } catch (e) {
      console.error('Erro ao atualizar progresso:', e)
    }
  }

  const metasAtivas = metas.filter(m => m.status === 'ativa').length
  const metasConcluidas = metas.filter(m => m.status === 'concluida').length

  return (
    <>
      <PageHeader
        numero="09"
        rotulo="Metas"
        titulo="Metas SMART"
        descricao="Defina objetivos Específicos, Mensuráveis, Atingíveis, Relevantes e com Prazo definido."
      />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex gap-2">
          {(['', 'ativa', 'concluida', 'cancelada'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFiltro(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-colors
                ${filtro === s ? 'bg-ink-900 text-cream-50' : 'bg-cream-200 text-ink-600 hover:bg-cream-300'}`}
            >
              {s === '' ? 'Todas' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="font-mono text-2xl text-ink-900">{metasAtivas}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Ativas</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-2xl text-ink-900">{metasConcluidas}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Concluídas</p>
          </div>
          <button onClick={abrirNova} className="btn-primary flex items-center gap-2">
            <Plus size={14} strokeWidth={2} />
            Nova meta
          </button>
        </div>
      </div>

      {carregando ? (
        <div className="text-center py-16 text-ink-400 font-mono text-sm">Carregando…</div>
      ) : metas.length === 0 ? (
        <div className="card p-16 text-center">
          <Target size={36} className="mx-auto mb-4 text-ink-300" strokeWidth={1} />
          <p className="font-display text-2xl text-ink-700 mb-2">Nenhuma meta cadastrada</p>
          <p className="text-ink-500 text-sm mb-6">Comece definindo sua primeira meta SMART.</p>
          <button onClick={abrirNova} className="btn-primary mx-auto flex items-center gap-2 w-fit">
            <Plus size={14} strokeWidth={2} />
            Nova meta
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {metas.map(meta => {
            const aberta = expandida === meta.id
            const prazoDate = new Date(meta.prazo + 'T00:00:00')
            const hoje = new Date()
            hoje.setHours(0, 0, 0, 0)
            const diasRestantes = Math.ceil((prazoDate.getTime() - hoje.getTime()) / 86400000)
            const prazoVencido = diasRestantes < 0 && meta.status === 'ativa'

            return (
              <div key={meta.id} className="card fade-in">
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${STATUS_COLOR[meta.status]}`}>
                          {STATUS_LABEL[meta.status]}
                        </span>
                        {prazoVencido && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-terra-50 text-terra-700 border border-terra-200">
                            Prazo vencido
                          </span>
                        )}
                        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-400">
                          Prazo: {prazoDate.toLocaleDateString('pt-BR')}
                          {meta.status === 'ativa' && !prazoVencido && (
                            <span className="ml-1 text-ink-300">· {diasRestantes}d restantes</span>
                          )}
                        </span>
                      </div>
                      <h3 className="font-display text-xl text-ink-900 mb-3">{meta.titulo}</h3>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-cream-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${meta.progresso}%`,
                              backgroundColor: meta.progresso === 100 ? '#5D7B4A' : '#C75D2C'
                            }}
                          />
                        </div>
                        <span className="font-mono text-sm text-ink-700 tabular-nums w-10 text-right">
                          {meta.progresso}%
                        </span>
                      </div>

                      {meta.status === 'ativa' && (
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={meta.progresso}
                          onChange={e => atualizarProgresso(meta, Number(e.target.value))}
                          className="w-full mt-2 accent-terra-500"
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setExpandida(aberta ? null : meta.id)}
                        className="p-2 rounded-md hover:bg-cream-200 text-ink-500 transition-colors"
                        title={aberta ? 'Recolher' : 'Ver detalhes SMART'}
                      >
                        {aberta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <button
                        onClick={() => abrirEdicao(meta)}
                        className="p-2 rounded-md hover:bg-cream-200 text-ink-500 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deletar(meta.id)}
                        className="p-2 rounded-md hover:bg-terra-50 text-terra-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {aberta && (
                    <div className="mt-5 pt-5 border-t border-ink-300/30 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {CAMPOS_SMART.map(({ key, letra, nome }) => (
                        <div key={key} className="flex gap-3">
                          <div className="shrink-0 w-7 h-7 rounded-full bg-ink-900 text-cream-50 flex items-center justify-center font-mono text-xs font-bold">
                            {letra}
                          </div>
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">{nome}</p>
                            <p className="text-sm text-ink-700 leading-relaxed">{meta[key as keyof MetaSMART] as string}</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-3">
                        <div className="shrink-0 w-7 h-7 rounded-full bg-ink-900 text-cream-50 flex items-center justify-center font-mono text-xs font-bold">
                          T
                        </div>
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">Temporal</p>
                          <p className="text-sm text-ink-700">{prazoDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-cream-50 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-ink-300/30">
              <h2 className="font-display text-2xl text-ink-900">
                {editando ? 'Editar meta' : 'Nova meta SMART'}
              </h2>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="label">Título da meta</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ex: Aumentar receita de projetos em 20%"
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                />
              </div>

              {CAMPOS_SMART.map(({ key, letra, nome, dica }) => (
                <div key={key}>
                  <label className="label flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-ink-900 text-cream-50 flex items-center justify-center font-mono text-[10px] font-bold">
                      {letra}
                    </span>
                    {nome}
                  </label>
                  <p className="text-xs text-ink-500 mb-1">{dica}</p>
                  <textarea
                    className="input-field min-h-[72px] resize-none"
                    value={form[key as keyof MetaCreateInput] as string}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-ink-900 text-cream-50 flex items-center justify-center font-mono text-[10px] font-bold">
                      T
                    </span>
                    Prazo
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.prazo}
                    onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    className="input-field"
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusMeta }))}
                  >
                    <option value="ativa">Ativa</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Progresso atual: {form.progresso}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.progresso}
                  onChange={e => setForm(f => ({ ...f, progresso: Number(e.target.value) }))}
                  className="w-full accent-terra-500"
                />
              </div>

              {erro && (
                <div className="px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md">
                  <p className="text-sm text-terra-700">{erro}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-ink-300/30 flex justify-end gap-3">
              <button
                onClick={() => setModalAberto(false)}
                className="btn-secondary"
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                className="btn-primary"
                disabled={salvando}
              >
                {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar meta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
