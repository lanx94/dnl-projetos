import { useEffect, useState, FormEvent } from 'react'
import { Plus, X, Trash2, Megaphone, Calendar, User as UserIcon, MessageCircle, Cake } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import type { Evento, TipoEvento } from '@shared/types'

const TIPO_LABEL: Record<TipoEvento, string> = {
  aviso: 'Aviso',
  comunicado: 'Comunicado',
  pessoal: 'Pessoal',
  aniversario: 'Aniversário',
  reuniao: 'Reunião'
}

const TIPO_ICONE: Record<TipoEvento, any> = {
  aviso: Megaphone,
  comunicado: MessageCircle,
  pessoal: UserIcon,
  aniversario: Cake,
  reuniao: Calendar
}

const TIPO_COR: Record<TipoEvento, string> = {
  aviso: 'bg-terra-100 text-terra-700',
  comunicado: 'bg-ink-900 text-cream-50',
  pessoal: 'bg-cream-300 text-ink-700',
  aniversario: 'bg-moss-500/20 text-moss-600',
  reuniao: 'bg-cream-300 text-ink-700'
}

export default function FeedPage() {
  const { user } = useAuth()
  const [eventos, setEventos] = useState<Evento[]>([])
  const [showForm, setShowForm] = useState(false)
  const ehAdminOuRH = user?.role === 'admin' || user?.role === 'rh'

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const lista = await api.eventos.listar(100)
    setEventos(lista)
  }

  async function deletar(id: number) {
    if (!confirm('Excluir este evento?')) return
    const r = await api.eventos.deletar(id)
    if (r.success) carregar()
    else alert(r.error || 'Erro ao deletar')
  }

  return (
    <>
      <PageHeader
        numero="02"
        rotulo="Feed"
        titulo="Mural da equipe"
        descricao="Avisos, comunicados e eventos da DNL."
        acoes={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={14} /> Novo post
          </button>
        }
      />

      {eventos.length === 0 ? (
        <div className="card p-12 text-center fade-in">
          <p className="font-display text-2xl text-ink-700 mb-2">Mural vazio</p>
          <p className="text-ink-500 text-sm">Seja o primeiro a postar algo.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {eventos.map((e) => {
            const Icon = TIPO_ICONE[e.tipo]
            const podeDeletar = e.autor_id === user?.id || user?.role === 'admin'
            return (
              <div key={e.id} className="card p-6 fade-in">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded
                        ${TIPO_COR[e.tipo]}`}
                    >
                      <Icon size={11} />
                      {TIPO_LABEL[e.tipo]}
                    </span>
                    {e.global ? (
                      <span className="text-[10px] font-mono uppercase tracking-widest text-terra-500">
                        ● Global
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono uppercase tracking-widest text-ink-400">
                        ○ Pessoal
                      </span>
                    )}
                  </div>
                  {podeDeletar && (
                    <button
                      onClick={() => deletar(e.id)}
                      className="text-ink-400 hover:text-terra-500 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <h3 className="font-display text-2xl text-ink-900 leading-tight mb-2">
                  {e.titulo}
                </h3>
                <p className="text-sm text-ink-700 whitespace-pre-line mb-4">{e.conteudo}</p>

                <div className="flex items-center gap-3 pt-3 border-t border-ink-300/30 text-xs text-ink-500">
                  <span>Por {e.autor_nome}</span>
                  <span className="text-ink-300">·</span>
                  <span className="font-mono">
                    {new Date(e.criado_em).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  {e.data_evento && (
                    <>
                      <span className="text-ink-300">·</span>
                      <span className="font-mono text-terra-500">
                        {new Date(e.data_evento + 'T12:00').toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short'
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <ModalNovoEvento
          ehAdminOuRH={ehAdminOuRH}
          onFechar={() => setShowForm(false)}
          onCriado={() => {
            setShowForm(false)
            carregar()
          }}
        />
      )}
    </>
  )
}

function ModalNovoEvento({
  ehAdminOuRH,
  onFechar,
  onCriado
}: {
  ehAdminOuRH: boolean
  onFechar: () => void
  onCriado: () => void
}) {
  const [tipo, setTipo] = useState<TipoEvento>('aviso')
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [global, setGlobal] = useState(false)
  const [dataEvento, setDataEvento] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await api.eventos.criar({
        tipo,
        titulo,
        conteudo,
        global: ehAdminOuRH ? global : false,
        data_evento: dataEvento || undefined
      })
      onCriado()
    } catch (err: any) {
      setErro(err.message || 'Erro ao criar evento')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-2xl max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Novo</p>
            <h2 className="font-display text-3xl text-ink-900">Postar no feed</h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div>
            <label className="label">Tipo</label>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(TIPO_LABEL) as TipoEvento[]).map((t) => {
                const Icon = TIPO_ICONE[t]
                const ativo = tipo === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-md border transition-colors
                      ${ativo ? 'border-ink-700 bg-cream-200' : 'border-ink-300 hover:border-ink-500'}`}
                  >
                    <Icon size={16} strokeWidth={1.5} />
                    <span className="text-xs">{TIPO_LABEL[t]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">Título</label>
            <input
              className="input-field"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Reunião semanal de projetos"
              required
            />
          </div>

          <div>
            <label className="label">Conteúdo</label>
            <textarea
              className="input-field min-h-[120px]"
              rows={5}
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Descreva os detalhes..."
              required
            />
          </div>

          <div>
            <label className="label">Data do evento (opcional)</label>
            <input
              type="date"
              className="input-field"
              value={dataEvento}
              onChange={(e) => setDataEvento(e.target.value)}
            />
          </div>

          {ehAdminOuRH && (
            <div className="flex items-center gap-2 p-4 bg-cream-200/50 rounded-md border border-ink-300/40">
              <input
                type="checkbox"
                id="global"
                checked={global}
                onChange={(e) => setGlobal(e.target.checked)}
                className="accent-ink-900"
              />
              <label htmlFor="global" className="text-sm text-ink-700 cursor-pointer">
                <strong>Evento global</strong> — todos os funcionários verão no mural
              </label>
            </div>
          )}

          {erro && (
            <div className="px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md">
              <p className="text-sm text-terra-700">{erro}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-ink-300/40">
            <button type="button" onClick={onFechar} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="btn-primary">
              {salvando ? 'Postando…' : 'Postar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
