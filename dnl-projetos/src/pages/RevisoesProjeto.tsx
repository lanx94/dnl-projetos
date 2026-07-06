import { useEffect, useState } from 'react'
import { ClipboardList, Plus, Pencil, Trash2, Search, Link2Off } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { RevisaoProjeto, RevisaoCreateInput, StatusRevisao, User, Projeto } from '@shared/types'

const STATUS_LABEL: Record<StatusRevisao, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída'
}

const STATUS_COLOR: Record<StatusRevisao, string> = {
  pendente: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  em_andamento: 'bg-blue-50 text-blue-800 border-blue-200',
  concluida: 'bg-green-50 text-green-800 border-green-200'
}

const VAZIO: RevisaoCreateInput = {
  projeto_id: undefined,
  revisao: '',
  descricao: '',
  data_revisao: '',
  responsavel_id: undefined,
  status: 'pendente'
}

export default function RevisoesProjeto() {
  const [revisoes, setRevisoes] = useState<RevisaoProjeto[]>([])
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<RevisaoProjeto | null>(null)
  const [form, setForm] = useState<RevisaoCreateInput>(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, [])
  useEffect(() => {
    api.usuarios.listar().then(setUsuarios).catch(() => {})
    api.projetos.listar().then(setProjetos).catch(() => {})
  }, [])

  async function carregar() {
    try {
      setCarregando(true)
      const lista = await api.revisoes.listar()
      setRevisoes(lista)
    } catch (e) {
      console.error('Erro ao carregar revisões:', e)
    } finally {
      setCarregando(false)
    }
  }

  function abrirNova(projetoId?: number) {
    setEditando(null)
    setForm({ ...VAZIO, projeto_id: projetoId })
    setErro('')
    setModalAberto(true)
  }

  function abrirEdicao(rev: RevisaoProjeto) {
    setEditando(rev)
    setForm({
      projeto_id: rev.projeto_id,
      revisao: rev.revisao,
      descricao: rev.descricao || '',
      data_revisao: rev.data_revisao || '',
      responsavel_id: rev.responsavel_id,
      status: rev.status
    })
    setErro('')
    setModalAberto(true)
  }

  async function salvar() {
    setErro('')
    if (!form.projeto_id) {
      setErro('Selecione o projeto')
      return
    }
    if (!form.revisao.trim()) {
      setErro('Informe a revisão (ex: Rev. 01)')
      return
    }
    setSalvando(true)
    try {
      const payload = {
        ...form,
        descricao: form.descricao || undefined,
        data_revisao: form.data_revisao || undefined,
        responsavel_id: form.responsavel_id || undefined
      }
      if (editando) {
        await api.revisoes.atualizar(editando.id, payload)
      } else {
        await api.revisoes.criar(payload)
      }
      setModalAberto(false)
      await carregar()
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar revisão')
    } finally {
      setSalvando(false)
    }
  }

  async function deletar(id: number) {
    if (!confirm('Excluir esta revisão?')) return
    try {
      await api.revisoes.deletar(id)
      await carregar()
    } catch (e: any) {
      alert(e.message || 'Erro ao excluir')
    }
  }

  const revisoesFiltradas = busca
    ? revisoes.filter(r =>
        r.nome_projeto.toLowerCase().includes(busca.toLowerCase()) ||
        r.revisao.toLowerCase().includes(busca.toLowerCase())
      )
    : revisoes

  // Agrupa por projeto vinculado (id); revisões antigas sem vínculo agrupam pelo nome digitado
  const grupos = new Map<string, { titulo: string; cliente?: string; projetoId?: number; revs: RevisaoProjeto[] }>()
  for (const r of revisoesFiltradas) {
    const chave = r.projeto_id ? `p${r.projeto_id}` : `n${r.nome_projeto}`
    if (!grupos.has(chave)) {
      grupos.set(chave, { titulo: r.nome_projeto, cliente: r.cliente_nome, projetoId: r.projeto_id, revs: [] })
    }
    grupos.get(chave)!.revs.push(r)
  }
  const listaGrupos = Array.from(grupos.values()).sort((a, b) => a.titulo.localeCompare(b.titulo))

  return (
    <>
      <PageHeader
        numero="RV"
        rotulo="Gestão"
        titulo="Revisões de Projeto"
        descricao="Controle as revisões de cada projeto cadastrado e seu status atual."
      />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            className="input-field pl-9"
            placeholder="Buscar projeto…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <button onClick={() => abrirNova()} className="btn-primary flex items-center gap-2">
          <Plus size={14} strokeWidth={2} />
          Nova revisão
        </button>
      </div>

      {carregando ? (
        <div className="text-center py-16 text-ink-400 font-mono text-sm">Carregando…</div>
      ) : listaGrupos.length === 0 ? (
        <div className="card p-16 text-center">
          <ClipboardList size={36} className="mx-auto mb-4 text-ink-300" strokeWidth={1} />
          <p className="font-display text-2xl text-ink-700 mb-2">
            {busca ? 'Nenhum resultado encontrado' : 'Nenhuma revisão cadastrada'}
          </p>
          {!busca && (
            <button onClick={() => abrirNova()} className="btn-primary mx-auto flex items-center gap-2 w-fit mt-6">
              <Plus size={14} strokeWidth={2} />
              Nova revisão
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {listaGrupos.map(grupo => (
            <div key={grupo.projetoId ? `p${grupo.projetoId}` : grupo.titulo} className="card">
              <div className="px-6 py-4 border-b border-ink-300/30 flex items-center gap-3 flex-wrap">
                <ClipboardList size={16} strokeWidth={1.75} className="text-ink-500" />
                <div>
                  <h3 className="font-display text-lg text-ink-900">{grupo.titulo}</h3>
                  {grupo.cliente && (
                    <p className="text-xs text-ink-500">{grupo.cliente}</p>
                  )}
                </div>
                {!grupo.projetoId && (
                  <span
                    className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded"
                    title="Revisão antiga sem vínculo com projeto cadastrado — edite para vincular"
                  >
                    <Link2Off size={10} /> sem vínculo
                  </span>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-400">
                    {grupo.revs.length} revisão{grupo.revs.length !== 1 ? 'ões' : ''}
                  </span>
                  {grupo.projetoId && (
                    <button
                      onClick={() => abrirNova(grupo.projetoId)}
                      className="text-xs text-terra-500 hover:text-terra-700 flex items-center gap-1"
                      title="Adicionar revisão a este projeto"
                    >
                      <Plus size={12} /> revisão
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-ink-300/20">
                      <th className="px-6 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">Revisão</th>
                      <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">Status</th>
                      <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">Data</th>
                      <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">Responsável</th>
                      <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">Descrição</th>
                      <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-ink-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.revs.map((rev, i) => (
                      <tr
                        key={rev.id}
                        className={`border-b border-ink-300/20 last:border-0 transition-colors hover:bg-cream-100
                          ${i % 2 === 0 ? 'bg-transparent' : 'bg-cream-50/50'}`}
                      >
                        <td className="px-6 py-3">
                          <span className="font-mono text-sm text-ink-900 font-medium">{rev.revisao}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${STATUS_COLOR[rev.status]}`}>
                            {STATUS_LABEL[rev.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-ink-600">
                          {rev.data_revisao
                            ? new Date(rev.data_revisao + 'T00:00:00').toLocaleDateString('pt-BR')
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-600">
                          {rev.responsavel_nome || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-500 max-w-xs truncate">
                          {rev.descricao || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => abrirEdicao(rev)}
                              className="p-1.5 rounded hover:bg-cream-200 text-ink-500 transition-colors"
                              title="Editar revisão"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => deletar(rev.id)}
                              className="p-1.5 rounded hover:bg-terra-50 text-terra-500 transition-colors"
                              title="Excluir revisão"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-cream-50 rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-ink-300/30">
              <h2 className="font-display text-2xl text-ink-900">
                {editando ? 'Editar revisão' : 'Nova revisão'}
              </h2>
              {editando && !editando.projeto_id && (
                <p className="text-xs text-amber-600 mt-1">
                  Esta revisão foi criada sem vínculo ("{editando.nome_projeto}"). Selecione o
                  projeto cadastrado para vincular.
                </p>
              )}
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="label">Projeto</label>
                <select
                  className="input-field"
                  value={form.projeto_id || ''}
                  onChange={e => setForm(f => ({ ...f, projeto_id: e.target.value ? Number(e.target.value) : undefined }))}
                >
                  <option value="">Selecione o projeto...</option>
                  {projetos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome}{p.cliente_nome ? ` — ${p.cliente_nome}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Revisão</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ex: Rev. 01, Rev. A, Revisão Final"
                  value={form.revisao}
                  onChange={e => setForm(f => ({ ...f, revisao: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Status</label>
                  <select
                    className="input-field"
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusRevisao }))}
                  >
                    <option value="pendente">Pendente</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluida">Concluída</option>
                  </select>
                </div>
                <div>
                  <label className="label">Data da revisão</label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.data_revisao || ''}
                    onChange={e => setForm(f => ({ ...f, data_revisao: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="label">Responsável</label>
                <select
                  className="input-field"
                  value={form.responsavel_id || ''}
                  onChange={e => setForm(f => ({ ...f, responsavel_id: e.target.value ? Number(e.target.value) : undefined }))}
                >
                  <option value="">— Sem responsável —</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Descrição</label>
                <textarea
                  className="input-field min-h-[80px] resize-none"
                  placeholder="Observações sobre esta revisão…"
                  value={form.descricao || ''}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
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
                {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar revisão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
