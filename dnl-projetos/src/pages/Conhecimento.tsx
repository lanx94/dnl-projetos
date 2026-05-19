import { useEffect, useState, FormEvent } from 'react'
import {
  Plus,
  X,
  Search,
  Edit2,
  Trash2,
  Calculator,
  Wind,
  Droplets,
  Zap,
  Building2,
  BookOpen,
  FileText,
  ArrowLeft,
  Flame,
  ScrollText,
  ClipboardCheck
} from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import type { ArtigoConhecimento, CategoriaConhecimento } from '@shared/types'

const CATEGORIAS: Array<{ valor: CategoriaConhecimento; label: string; icon: any; cor: string }> = [
  { valor: 'climatizacao', label: 'Climatização', icon: Wind, cor: 'bg-cream-300 text-ink-700' },
  { valor: 'hidraulica', label: 'Hidráulica', icon: Droplets, cor: 'bg-cream-300 text-ink-700' },
  { valor: 'eletrica', label: 'Elétrica', icon: Zap, cor: 'bg-cream-300 text-ink-700' },
  { valor: 'gas', label: 'Gás', icon: Flame, cor: 'bg-cream-300 text-ink-700' },
  { valor: 'estrutural', label: 'Estrutural', icon: Building2, cor: 'bg-cream-300 text-ink-700' },
  { valor: 'regularizacao', label: 'Regularização', icon: ScrollText, cor: 'bg-cream-300 text-ink-700' },
  { valor: 'laudos', label: 'Laudos', icon: ClipboardCheck, cor: 'bg-cream-300 text-ink-700' },
  { valor: 'normas', label: 'Normas', icon: BookOpen, cor: 'bg-cream-300 text-ink-700' },
  { valor: 'outro', label: 'Outro', icon: FileText, cor: 'bg-cream-300 text-ink-700' }
]

export default function ConhecimentoPage() {
  const { user } = useAuth()
  const [artigos, setArtigos] = useState<ArtigoConhecimento[]>([])
  const [categoria, setCategoria] = useState<CategoriaConhecimento | ''>('')
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<ArtigoConhecimento | null>(null)
  const [vendoArtigo, setVendoArtigo] = useState<ArtigoConhecimento | null>(null)
  const [calculadora, setCalculadora] = useState<
    'btu' | 'caixa-dagua' | 'disjuntor' | 'esgoto' | 'carga-eletrica' | 'gas-glp' | null
  >(null)

  useEffect(() => {
    carregar()
  }, [categoria, busca])

  async function carregar() {
    const lista = await api.conhecimento.listar(categoria || undefined, busca || undefined)
    setArtigos(lista)
  }

  async function deletar(a: ArtigoConhecimento) {
    if (!confirm(`Excluir o artigo "${a.titulo}"?`)) return
    const r = await api.conhecimento.deletar(a.id)
    if (r.success) {
      setVendoArtigo(null)
      carregar()
    } else alert(r.error || 'Erro ao excluir')
  }

  if (vendoArtigo) {
    return (
      <ArtigoView
        artigo={vendoArtigo}
        onVoltar={() => setVendoArtigo(null)}
        onEditar={() => {
          setEditando(vendoArtigo)
          setVendoArtigo(null)
        }}
        onDeletar={() => deletar(vendoArtigo)}
        podeEditar={user?.role === 'admin' || user?.role === 'rh' || vendoArtigo.autor_id === user?.id}
      />
    )
  }

  return (
    <>
      <PageHeader
        numero="08"
        rotulo="Base técnica"
        titulo="Base de conhecimento"
        descricao="Cálculos, normas, alturas e referências para o dia a dia."
        acoes={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={14} /> Novo artigo
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 fade-in">
        <CardCalculadora
          titulo="BTU"
          subtitulo="Ar-condicionado"
          icon={Wind}
          onClick={() => setCalculadora('btu')}
        />
        <CardCalculadora
          titulo="Caixa d'água"
          subtitulo="Reservatório"
          icon={Droplets}
          onClick={() => setCalculadora('caixa-dagua')}
        />
        <CardCalculadora
          titulo="Disjuntor"
          subtitulo="Cabo + DR"
          icon={Zap}
          onClick={() => setCalculadora('disjuntor')}
        />
        <CardCalculadora
          titulo="Esgoto"
          subtitulo="Diâmetro + UH"
          icon={Droplets}
          onClick={() => setCalculadora('esgoto')}
        />
        <CardCalculadora
          titulo="Carga Elétrica"
          subtitulo="Padrão de entrada"
          icon={Zap}
          onClick={() => setCalculadora('carga-eletrica')}
        />
        <CardCalculadora
          titulo="Gás GLP"
          subtitulo="Tubulação + central"
          icon={Flame}
          onClick={() => setCalculadora('gas-glp')}
        />
      </div>

      <div className="card p-5 mb-6 fade-in stagger-1">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[250px]">
            <label className="label flex items-center gap-1.5">
              <Search size={11} />
              Busca
            </label>
            <input
              className="input-field"
              placeholder="Buscar por título, conteúdo ou tag…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Categoria</label>
            <select
              className="input-field"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as any)}
            >
              <option value="">Todas</option>
              {CATEGORIAS.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {artigos.length === 0 ? (
        <div className="card p-12 text-center fade-in">
          <p className="font-display text-2xl text-ink-700 mb-2">Nada encontrado</p>
          <p className="text-ink-500 text-sm">Tente outro filtro ou crie um novo artigo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 fade-in stagger-2">
          {artigos.map((a) => {
            const cat = CATEGORIAS.find((c) => c.valor === a.categoria)
            const Icon = cat?.icon || FileText
            return (
              <button
                key={a.id}
                onClick={() => setVendoArtigo(a)}
                className="card p-6 text-left hover:shadow-lift transition-shadow"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-md bg-cream-200 flex items-center justify-center text-ink-600 shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
                      {cat?.label}
                    </p>
                    <h3 className="font-display text-xl text-ink-900 leading-tight">
                      {a.titulo}
                    </h3>
                  </div>
                </div>
                {a.tags && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {a.tags.split(',').slice(0, 4).map((t, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono text-ink-500 bg-cream-200 px-1.5 py-0.5 rounded"
                      >
                        {t.trim()}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-ink-500 pt-3 border-t border-ink-300/30">
                  Por {a.autor_nome} · atualizado{' '}
                  {new Date(a.atualizado_em).toLocaleDateString('pt-BR')}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {showForm && (
        <ModalArtigo
          onFechar={() => setShowForm(false)}
          onSalvo={() => {
            setShowForm(false)
            carregar()
          }}
        />
      )}

      {editando && (
        <ModalArtigo
          artigo={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null)
            carregar()
          }}
        />
      )}

      {calculadora === 'btu' && <CalculadoraBTU onFechar={() => setCalculadora(null)} />}
      {calculadora === 'caixa-dagua' && <CalculadoraCaixaDagua onFechar={() => setCalculadora(null)} />}
      {calculadora === 'disjuntor' && <CalculadoraDisjuntor onFechar={() => setCalculadora(null)} />}
      {calculadora === 'esgoto' && <CalculadoraEsgoto onFechar={() => setCalculadora(null)} />}
      {calculadora === 'carga-eletrica' && <CalculadoraCargaEletrica onFechar={() => setCalculadora(null)} />}
      {calculadora === 'gas-glp' && <CalculadoraGasGLP onFechar={() => setCalculadora(null)} />}
    </>
  )
}

function ArtigoView({
  artigo,
  onVoltar,
  onEditar,
  onDeletar,
  podeEditar
}: {
  artigo: ArtigoConhecimento
  onVoltar: () => void
  onEditar: () => void
  onDeletar: () => void
  podeEditar: boolean
}) {
  const cat = CATEGORIAS.find((c) => c.valor === artigo.categoria)
  return (
    <div className="fade-in">
      <button
        onClick={onVoltar}
        className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 text-sm mb-6"
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="flex items-start justify-between mb-6 pb-6 border-b border-ink-300/40">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">
            {cat?.label}
          </p>
          <h1 className="font-display text-5xl tracking-tightest text-ink-900 leading-none mb-3">
            {artigo.titulo}
          </h1>
          {artigo.tags && (
            <div className="flex flex-wrap gap-1.5">
              {artigo.tags.split(',').map((t, i) => (
                <span
                  key={i}
                  className="text-xs font-mono text-ink-500 bg-cream-200 px-2 py-0.5 rounded"
                >
                  {t.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
        {podeEditar && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onEditar}
              className="p-2 text-ink-500 hover:text-ink-900 transition-colors"
              title="Editar"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={onDeletar}
              className="p-2 text-ink-500 hover:text-terra-500 transition-colors"
              title="Excluir"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="prose-content max-w-3xl">
        <RenderMarkdown texto={artigo.conteudo} />
      </div>

      <p className="mt-12 pt-6 border-t border-ink-300/30 text-xs text-ink-500">
        Por {artigo.autor_nome} · atualizado em{' '}
        {new Date(artigo.atualizado_em).toLocaleDateString('pt-BR')}
      </p>
    </div>
  )
}

function RenderMarkdown({ texto }: { texto: string }) {
  // Renderizador markdown super simples (suficiente para os artigos seed)
  const linhas = texto.split('\n')
  const elementos: any[] = []
  let dentroTabela = false
  let tabela: string[][] = []
  let listaAtual: { tipo: 'ul' | 'ol'; itens: any[] } | null = null

  function flushTabela() {
    if (tabela.length === 0) return
    const [header, _separador, ...corpo] = tabela
    elementos.push(
      <table key={`t${elementos.length}`} className="w-full my-4 border border-ink-300/40 rounded-md overflow-hidden">
        <thead className="bg-cream-200">
          <tr>
            {header.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-xs font-medium text-ink-700 border-r border-ink-300/30 last:border-r-0">
                {h.trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {corpo.map((row, i) => (
            <tr key={i} className="border-t border-ink-300/30">
              {row.map((cel, j) => (
                <td key={j} className="px-3 py-2 text-sm text-ink-700 border-r border-ink-300/20 last:border-r-0">
                  {cel.trim()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
    tabela = []
    dentroTabela = false
  }

  function flushLista() {
    if (!listaAtual) return
    const Tag = listaAtual.tipo
    elementos.push(
      <Tag
        key={`l${elementos.length}`}
        className={`my-3 ml-6 ${Tag === 'ul' ? 'list-disc' : 'list-decimal'} space-y-1`}
      >
        {listaAtual.itens}
      </Tag>
    )
    listaAtual = null
  }

  linhas.forEach((linha, idx) => {
    if (linha.trim().startsWith('|')) {
      flushLista()
      const colunas = linha.split('|').slice(1, -1)
      tabela.push(colunas)
      dentroTabela = true
      return
    }
    if (dentroTabela) flushTabela()

    if (linha.startsWith('- ')) {
      // Item de lista não-ordenada
      if (!listaAtual || listaAtual.tipo !== 'ul') {
        flushLista()
        listaAtual = { tipo: 'ul', itens: [] }
      }
      listaAtual.itens.push(
        <li key={idx} className="text-ink-700 text-sm leading-relaxed">
          {parseInline(linha.replace('- ', ''))}
        </li>
      )
      return
    }
    if (/^\d+\.\s/.test(linha)) {
      if (!listaAtual || listaAtual.tipo !== 'ol') {
        flushLista()
        listaAtual = { tipo: 'ol', itens: [] }
      }
      listaAtual.itens.push(
        <li key={idx} className="text-ink-700 text-sm leading-relaxed">
          {parseInline(linha.replace(/^\d+\.\s/, ''))}
        </li>
      )
      return
    }

    // Não é item de lista — finaliza lista anterior
    flushLista()

    if (linha.startsWith('## ')) {
      elementos.push(
        <h2 key={idx} className="font-display text-3xl text-ink-900 mt-8 mb-3">
          {linha.replace('## ', '')}
        </h2>
      )
    } else if (linha.startsWith('### ')) {
      elementos.push(
        <h3 key={idx} className="font-display text-xl text-ink-900 mt-6 mb-2">
          {linha.replace('### ', '')}
        </h3>
      )
    } else if (linha.startsWith('> ')) {
      elementos.push(
        <blockquote
          key={idx}
          className="border-l-2 border-terra-500 pl-4 my-3 text-ink-600 italic"
        >
          {linha.replace('> ', '')}
        </blockquote>
      )
    } else if (linha.trim() === '') {
      elementos.push(<div key={idx} className="h-2" />)
    } else {
      elementos.push(
        <p key={idx} className="text-ink-700 text-sm leading-relaxed mb-2">
          {parseInline(linha)}
        </p>
      )
    }
  })
  if (dentroTabela) flushTabela()
  flushLista()

  return <>{elementos}</>
}

function parseInline(texto: string) {
  // **negrito** apenas (markdown super reduzido)
  const partes: any[] = []
  let resto = texto
  let i = 0
  while (resto.length > 0) {
    const matchBold = resto.match(/\*\*(.+?)\*\*/)
    if (matchBold && matchBold.index !== undefined) {
      if (matchBold.index > 0) {
        partes.push(<span key={`s${i++}`}>{resto.slice(0, matchBold.index)}</span>)
      }
      partes.push(
        <strong key={`b${i++}`} className="font-semibold text-ink-900">
          {matchBold[1]}
        </strong>
      )
      resto = resto.slice(matchBold.index + matchBold[0].length)
    } else {
      partes.push(<span key={`s${i++}`}>{resto}</span>)
      break
    }
  }
  return <>{partes}</>
}

function ModalArtigo({
  artigo,
  onFechar,
  onSalvo
}: {
  artigo?: ArtigoConhecimento
  onFechar: () => void
  onSalvo: () => void
}) {
  const [categoria, setCategoria] = useState<CategoriaConhecimento>(
    artigo?.categoria || 'outro'
  )
  const [titulo, setTitulo] = useState(artigo?.titulo || '')
  const [conteudo, setConteudo] = useState(artigo?.conteudo || '')
  const [tags, setTags] = useState(artigo?.tags || '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const ehEdicao = !!artigo

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      if (ehEdicao) {
        await api.conhecimento.atualizar(artigo.id, {
          categoria,
          titulo,
          conteudo,
          tags
        })
      } else {
        await api.conhecimento.criar({ categoria, titulo, conteudo, tags })
      }
      onSalvo()
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-3xl max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              {ehEdicao ? 'Editar' : 'Novo'}
            </p>
            <h2 className="font-display text-3xl text-ink-900">Artigo técnico</h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div>
            <label className="label">Categoria</label>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
              {CATEGORIAS.map((c) => {
                const Icon = c.icon
                const ativo = categoria === c.valor
                return (
                  <button
                    key={c.valor}
                    type="button"
                    onClick={() => setCategoria(c.valor)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-md border transition-colors
                      ${ativo ? 'border-ink-700 bg-cream-200' : 'border-ink-300 hover:border-ink-500'}`}
                  >
                    <Icon size={14} strokeWidth={1.5} />
                    <span className="text-[11px]">{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">Título *</label>
            <input
              className="input-field"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Tags (separadas por vírgula)</label>
            <input
              className="input-field font-mono text-xs"
              placeholder="ex: btu, ar condicionado, dimensionamento"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Conteúdo (markdown simples)</label>
            <textarea
              className="input-field font-mono text-xs min-h-[300px]"
              rows={15}
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="## Título da seção&#10;&#10;Texto normal aqui...&#10;&#10;### Subseção&#10;&#10;- Item de lista&#10;- Outro item&#10;&#10;**Negrito** e *itálico* funcionam.&#10;&#10;| Coluna 1 | Coluna 2 |&#10;|----------|----------|&#10;| Valor 1  | Valor 2  |"
              required
            />
            <p className="text-xs text-ink-500 mt-1">
              Suporta: ## títulos, listas com -, **negrito**, &gt; citações e tabelas com |
            </p>
          </div>

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
              {salvando ? 'Salvando…' : ehEdicao ? 'Salvar alterações' : 'Publicar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// =============================================
// CALCULADORAS
// =============================================

function CalculadoraBTU({ onFechar }: { onFechar: () => void }) {
  const [area, setArea] = useState('')
  const [pessoas, setPessoas] = useState('2')
  const [eletronicos, setEletronicos] = useState('0')
  const [solDireto, setSolDireto] = useState(false)
  const [janelas, setJanelas] = useState('1')
  const [cozinha, setCozinha] = useState(false)

  const a = parseFloat(area) || 0
  const p = parseInt(pessoas) || 0
  const e = parseInt(eletronicos) || 0
  const j = parseInt(janelas) || 0

  let btu = a * 600
  if (p > 2) btu += (p - 2) * 600
  btu += e * 600
  if (solDireto) btu += 800
  btu += j * 400
  if (cozinha) btu += 1000

  const capComercial = [7500, 9000, 12000, 18000, 22000, 24000, 30000, 36000, 48000, 60000]
  const recomendada = capComercial.find((c) => c >= btu) || btu

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-lg max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500">
              Calculadora
            </p>
            <h2 className="font-display text-3xl text-ink-900">Dimensionamento de BTU</h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <div className="p-7 space-y-4">
          <div>
            <label className="label">Área do ambiente (m²)</label>
            <input
              type="number"
              className="input-field font-mono"
              value={area}
              onChange={(ev) => setArea(ev.target.value)}
              placeholder="Ex: 15"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nº de pessoas</label>
              <input
                type="number"
                className="input-field font-mono"
                value={pessoas}
                onChange={(ev) => setPessoas(ev.target.value)}
                min="1"
              />
            </div>
            <div>
              <label className="label">Eletrônicos (TV, PC...)</label>
              <input
                type="number"
                className="input-field font-mono"
                value={eletronicos}
                onChange={(ev) => setEletronicos(ev.target.value)}
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="label">Nº de janelas</label>
            <input
              type="number"
              className="input-field font-mono"
              value={janelas}
              onChange={(ev) => setJanelas(ev.target.value)}
              min="0"
            />
          </div>

          <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-cream-200 rounded-md">
            <input
              type="checkbox"
              checked={solDireto}
              onChange={(ev) => setSolDireto(ev.target.checked)}
              className="accent-ink-900"
            />
            <span className="text-sm text-ink-700">Ambiente recebe sol direto</span>
          </label>

          <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-cream-200 rounded-md">
            <input
              type="checkbox"
              checked={cozinha}
              onChange={(ev) => setCozinha(ev.target.checked)}
              className="accent-ink-900"
            />
            <span className="text-sm text-ink-700">Cozinha (com fogão)</span>
          </label>

          {a > 0 && (
            <div className="mt-6 pt-6 border-t border-ink-300/30 space-y-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
                  BTU calculado
                </p>
                <p className="font-display text-3xl text-ink-700 tabular-nums">
                  {btu.toLocaleString('pt-BR')} BTU/h
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500 mb-1">
                  Capacidade comercial recomendada
                </p>
                <p className="font-display text-5xl text-terra-500 tabular-nums">
                  {recomendada.toLocaleString('pt-BR')}{' '}
                  <span className="text-2xl text-ink-600">BTU/h</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CalculadoraCaixaDagua({ onFechar }: { onFechar: () => void }) {
  const [pessoas, setPessoas] = useState('4')
  const [tipo, setTipo] = useState<'popular' | 'medio' | 'alto' | 'apartamento' | 'escritorio'>(
    'medio'
  )
  const [comCisterna, setComCisterna] = useState(false)

  const consumoTipo = {
    popular: 120,
    medio: 150,
    alto: 200,
    apartamento: 200,
    escritorio: 50
  }

  const p = parseInt(pessoas) || 0
  const consumoDiario = p * consumoTipo[tipo]
  const reservaTotal = consumoDiario // 24h

  const capComercial = [310, 500, 750, 1000, 1500, 2000, 2500, 3000, 5000, 10000]
  const recomendada = capComercial.find((c) => c >= reservaTotal) || reservaTotal

  const cisterna = Math.round(recomendada * 0.6)
  const superior = recomendada - cisterna

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-lg max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500">
              Calculadora
            </p>
            <h2 className="font-display text-3xl text-ink-900">Caixa d'água</h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <div className="p-7 space-y-4">
          <div>
            <label className="label">Número de pessoas / usuários</label>
            <input
              type="number"
              className="input-field font-mono"
              value={pessoas}
              onChange={(e) => setPessoas(e.target.value)}
              min="1"
            />
          </div>

          <div>
            <label className="label">Tipo de uso</label>
            <select
              className="input-field"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as any)}
            >
              <option value="popular">Residência popular (120 L/dia)</option>
              <option value="medio">Residência média (150 L/dia)</option>
              <option value="alto">Residência alto padrão (200 L/dia)</option>
              <option value="apartamento">Apartamento (200 L/dia)</option>
              <option value="escritorio">Escritório (50 L/dia)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-cream-200 rounded-md">
            <input
              type="checkbox"
              checked={comCisterna}
              onChange={(e) => setComCisterna(e.target.checked)}
              className="accent-ink-900"
            />
            <span className="text-sm text-ink-700">Dividir entre cisterna + superior</span>
          </label>

          {p > 0 && (
            <div className="mt-6 pt-6 border-t border-ink-300/30 space-y-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
                  Consumo diário estimado
                </p>
                <p className="font-display text-2xl text-ink-700 tabular-nums">
                  {consumoDiario.toLocaleString('pt-BR')} L
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500 mb-1">
                  Reservatório total recomendado (24h)
                </p>
                <p className="font-display text-5xl text-terra-500 tabular-nums">
                  {recomendada.toLocaleString('pt-BR')}{' '}
                  <span className="text-2xl text-ink-600">L</span>
                </p>
              </div>

              {comCisterna && (
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-ink-300/30">
                  <div className="bg-cream-200 p-3 rounded-md">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                      Cisterna (60%)
                    </p>
                    <p className="font-display text-xl text-ink-900 tabular-nums">
                      {cisterna.toLocaleString('pt-BR')} L
                    </p>
                  </div>
                  <div className="bg-cream-200 p-3 rounded-md">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                      Caixa superior (40%)
                    </p>
                    <p className="font-display text-xl text-ink-900 tabular-nums">
                      {superior.toLocaleString('pt-BR')} L
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================
// CARD COMPONENTE
// =============================================

function CardCalculadora({
  titulo,
  subtitulo,
  icon: Icon,
  onClick
}: {
  titulo: string
  subtitulo: string
  icon: any
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="card p-4 text-left hover:shadow-lift transition-shadow group"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-terra-100 flex items-center justify-center text-terra-500 shrink-0">
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-widest text-ink-500">
            Calculadora
          </p>
          <h3 className="font-display text-lg text-ink-900 leading-tight truncate">
            {titulo}
          </h3>
          <p className="text-[10px] text-ink-500 truncate">{subtitulo}</p>
        </div>
      </div>
    </button>
  )
}

// =============================================
// CALCULADORA: DISJUNTOR + CABO
// =============================================

function CalculadoraDisjuntor({ onFechar }: { onFechar: () => void }) {
  const [potencia, setPotencia] = useState('')
  const [tensao, setTensao] = useState<'127' | '220' | '380'>('220')
  const [fatorPotencia, setFatorPotencia] = useState('1.0')
  const [areaMolhada, setAreaMolhada] = useState(false)

  const p = parseFloat(potencia) || 0
  const v = parseInt(tensao)
  const fp = parseFloat(fatorPotencia) || 1.0

  const corrente = v > 0 ? p / (v * fp) : 0
  const correnteSeg = corrente * 1.25 // fator 25% segurança

  // Tabela de disjuntores comerciais
  const disjuntores = [10, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125]
  const disjuntor = disjuntores.find((d) => d >= correnteSeg) || correnteSeg

  // Tabela cabos NBR 5410 (eletroduto, 30°C)
  const cabosTabela: Array<{ secao: number; corrente: number }> = [
    { secao: 1.5, corrente: 15.5 },
    { secao: 2.5, corrente: 21 },
    { secao: 4, corrente: 28 },
    { secao: 6, corrente: 36 },
    { secao: 10, corrente: 50 },
    { secao: 16, corrente: 68 },
    { secao: 25, corrente: 89 },
    { secao: 35, corrente: 110 },
    { secao: 50, corrente: 134 }
  ]
  const cabo = cabosTabela.find((c) => c.corrente >= disjuntor) || cabosTabela[cabosTabela.length - 1]

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-lg max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500">
              Calculadora
            </p>
            <h2 className="font-display text-3xl text-ink-900">Disjuntor + Cabo</h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <div className="p-7 space-y-4">
          <div>
            <label className="label">Potência do circuito (W)</label>
            <input
              type="number"
              className="input-field font-mono"
              value={potencia}
              onChange={(e) => setPotencia(e.target.value)}
              placeholder="Ex: 5500 (chuveiro)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tensão (V)</label>
              <select
                className="input-field"
                value={tensao}
                onChange={(e) => setTensao(e.target.value as any)}
              >
                <option value="127">127 V (mono)</option>
                <option value="220">220 V (bi/tri)</option>
                <option value="380">380 V (tri)</option>
              </select>
            </div>
            <div>
              <label className="label">Fator de potência</label>
              <select
                className="input-field"
                value={fatorPotencia}
                onChange={(e) => setFatorPotencia(e.target.value)}
              >
                <option value="1.0">1,0 (resistivo)</option>
                <option value="0.92">0,92 (motor pequeno)</option>
                <option value="0.85">0,85 (motor grande)</option>
                <option value="0.8">0,80 (típico misto)</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-cream-200 rounded-md">
            <input
              type="checkbox"
              checked={areaMolhada}
              onChange={(e) => setAreaMolhada(e.target.checked)}
              className="accent-ink-900"
            />
            <span className="text-sm text-ink-700">
              Circuito em área molhada (banheiro, cozinha, área externa)
            </span>
          </label>

          {p > 0 && (
            <div className="mt-6 pt-6 border-t border-ink-300/30 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                    Corrente nominal
                  </p>
                  <p className="font-display text-2xl text-ink-700 tabular-nums">
                    {corrente.toFixed(1)} A
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                    Com 25% segurança
                  </p>
                  <p className="font-display text-2xl text-ink-700 tabular-nums">
                    {correnteSeg.toFixed(1)} A
                  </p>
                </div>
              </div>

              <div className="bg-cream-200 p-4 rounded-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500 mb-1">
                  Disjuntor recomendado
                </p>
                <p className="font-display text-4xl text-terra-500 tabular-nums">
                  {disjuntor} <span className="text-2xl text-ink-600">A</span>
                </p>
              </div>

              <div className="bg-cream-200 p-4 rounded-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
                  Cabo recomendado
                </p>
                <p className="font-display text-3xl text-ink-900 tabular-nums">
                  {cabo.secao} <span className="text-xl text-ink-600">mm²</span>
                </p>
                <p className="text-xs text-ink-500 mt-1">
                  Capacidade: {cabo.corrente} A (eletroduto 30°C)
                </p>
              </div>

              {areaMolhada && (
                <div className="bg-terra-50 border border-terra-400/40 p-3 rounded-md">
                  <p className="text-xs text-terra-700">
                    <strong>DR obrigatório (NBR 5410):</strong> instalar dispositivo diferencial
                    residual de 30 mA neste circuito.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================
// CALCULADORA: ESGOTO (UH)
// =============================================

const APARELHOS_UH: Array<{
  nome: string
  uh: number
  diam: number
}> = [
  { nome: 'Bacia sanitária', uh: 6, diam: 100 },
  { nome: 'Lavatório', uh: 1, diam: 40 },
  { nome: 'Chuveiro residencial', uh: 2, diam: 40 },
  { nome: 'Banheira', uh: 3, diam: 40 },
  { nome: 'Bidê', uh: 1, diam: 40 },
  { nome: 'Pia cozinha residencial', uh: 3, diam: 50 },
  { nome: 'Pia cozinha industrial', uh: 6, diam: 75 },
  { nome: 'Tanque', uh: 3, diam: 40 },
  { nome: 'Máquina de lavar roupa', uh: 3, diam: 50 },
  { nome: 'Máquina de lavar pratos', uh: 2, diam: 50 },
  { nome: 'Mictório c/ válvula', uh: 6, diam: 75 },
  { nome: 'Mictório c/ sifão', uh: 5, diam: 75 },
  { nome: 'Bebedouro', uh: 0.5, diam: 40 }
]

function CalculadoraEsgoto({ onFechar }: { onFechar: () => void }) {
  const [aparelhos, setAparelhos] = useState<Record<string, number>>({})

  function alterar(nome: string, qtd: number) {
    setAparelhos((a) => ({ ...a, [nome]: qtd }))
  }

  const totalUH = APARELHOS_UH.reduce(
    (acc, ap) => acc + (aparelhos[ap.nome] || 0) * ap.uh,
    0
  )

  // Diâmetro do coletor predial conforme tabela NBR 8160
  let coletor = 0
  if (totalUH <= 6) coletor = 50
  else if (totalUH <= 20) coletor = 75
  else if (totalUH <= 160) coletor = 100
  else if (totalUH <= 300) coletor = 125
  else if (totalUH <= 500) coletor = 150
  else coletor = 200

  const declividade = coletor <= 75 ? '2%' : '1%'

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-2xl max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500">
              Calculadora
            </p>
            <h2 className="font-display text-3xl text-ink-900">Esgoto Predial (NBR 8160)</h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <div className="p-7 space-y-4">
          <p className="text-sm text-ink-600">
            Informe a quantidade de cada aparelho. O cálculo segue o método das Unidades Hunter de
            Contribuição (UH).
          </p>

          <div className="space-y-2">
            {APARELHOS_UH.map((ap) => (
              <div
                key={ap.nome}
                className="grid grid-cols-12 gap-2 items-center py-2 border-b border-ink-300/20"
              >
                <div className="col-span-7">
                  <p className="text-sm text-ink-700">{ap.nome}</p>
                  <p className="text-[10px] text-ink-500 font-mono">
                    {ap.uh} UH · DN {ap.diam}
                  </p>
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    min="0"
                    className="input-field font-mono text-sm"
                    value={aparelhos[ap.nome] || ''}
                    onChange={(e) => alterar(ap.nome, parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div className="col-span-2 text-right">
                  <span className="font-mono text-xs text-ink-500">
                    {((aparelhos[ap.nome] || 0) * ap.uh).toFixed(1)} UH
                  </span>
                </div>
              </div>
            ))}
          </div>

          {totalUH > 0 && (
            <div className="mt-6 pt-6 border-t border-ink-300/30 space-y-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
                  Total de UH
                </p>
                <p className="font-display text-3xl text-ink-700 tabular-nums">
                  {totalUH.toFixed(1)} UH
                </p>
              </div>

              <div className="bg-cream-200 p-4 rounded-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500 mb-1">
                  Coletor predial recomendado
                </p>
                <p className="font-display text-4xl text-terra-500 tabular-nums">
                  DN {coletor}
                </p>
                <p className="text-xs text-ink-600 mt-1">
                  Declividade mín.: <strong>{declividade}</strong>
                </p>
              </div>

              <div className="text-xs text-ink-500 space-y-1">
                <p>
                  <strong>Lembrar:</strong> caixa de inspeção a cada 25m e em mudanças de direção.
                </p>
                <p>
                  Coluna de ventilação obrigatória — diâmetro mín. igual ao do tubo de queda (até
                  125mm) ou 100mm.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================
// CALCULADORA: CARGA ELÉTRICA RESIDENCIAL
// =============================================

function CalculadoraCargaEletrica({ onFechar }: { onFechar: () => void }) {
  const [iluminacao, setIluminacao] = useState('')
  const [tug, setTug] = useState('') // tomadas uso geral
  const [chuveiro, setChuveiro] = useState('')
  const [arCondicionados, setArCondicionados] = useState('')
  const [forno, setForno] = useState('')
  const [outros, setOutros] = useState('')

  const il = parseFloat(iluminacao) || 0
  const tg = (parseInt(tug) || 0) * 100 // 100W por TUG mín
  const ch = parseFloat(chuveiro) || 0
  const ar = parseFloat(arCondicionados) || 0
  const fo = parseFloat(forno) || 0
  const out = parseFloat(outros) || 0

  // Carga instalada
  const cargaInstalada = il + tg + ch + ar + fo + out

  // Aplicação de fatores de demanda (simplificada NBR 5410)
  const demandaIl = il * 0.86 // primeira faixa
  const demandaTug = tg * 0.5 // primeiros circuitos
  const demandaTUE = (ch + ar + fo + out) * 0.7 // demanda agrupada
  const demandaTotal = demandaIl + demandaTug + demandaTUE

  // Recomendação de padrão
  let tipoEntrada = 'Monofásica'
  let disjuntorEntrada = 40
  if (demandaTotal > 8000 && demandaTotal <= 14000) {
    tipoEntrada = 'Bifásica'
    disjuntorEntrada = 50
  } else if (demandaTotal > 14000 && demandaTotal <= 22000) {
    tipoEntrada = 'Bifásica'
    disjuntorEntrada = 70
  } else if (demandaTotal > 22000 && demandaTotal <= 35000) {
    tipoEntrada = 'Trifásica'
    disjuntorEntrada = 60
  } else if (demandaTotal > 35000 && demandaTotal <= 50000) {
    tipoEntrada = 'Trifásica'
    disjuntorEntrada = 80
  } else if (demandaTotal > 50000) {
    tipoEntrada = 'Trifásica'
    disjuntorEntrada = 125
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-lg max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500">
              Calculadora
            </p>
            <h2 className="font-display text-3xl text-ink-900">Carga Elétrica</h2>
            <p className="text-xs text-ink-500 mt-1">
              Padrão de entrada (residencial)
            </p>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <div className="p-7 space-y-4">
          <div>
            <label className="label">Iluminação total (W)</label>
            <input
              type="number"
              className="input-field font-mono"
              value={iluminacao}
              onChange={(e) => setIluminacao(e.target.value)}
              placeholder="Ex: 1500 (15 lâmpadas 100W)"
            />
          </div>

          <div>
            <label className="label">Quantidade de tomadas TUG</label>
            <input
              type="number"
              className="input-field font-mono"
              value={tug}
              onChange={(e) => setTug(e.target.value)}
              placeholder="Ex: 30 (100W cada)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Chuveiro (W)</label>
              <input
                type="number"
                className="input-field font-mono"
                value={chuveiro}
                onChange={(e) => setChuveiro(e.target.value)}
                placeholder="5500"
              />
            </div>
            <div>
              <label className="label">Ar-condicionados (W)</label>
              <input
                type="number"
                className="input-field font-mono"
                value={arCondicionados}
                onChange={(e) => setArCondicionados(e.target.value)}
                placeholder="Soma de todos"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Forno elétrico (W)</label>
              <input
                type="number"
                className="input-field font-mono"
                value={forno}
                onChange={(e) => setForno(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Outros TUE (W)</label>
              <input
                type="number"
                className="input-field font-mono"
                value={outros}
                onChange={(e) => setOutros(e.target.value)}
                placeholder="Microondas, lava-louças..."
              />
            </div>
          </div>

          {cargaInstalada > 0 && (
            <div className="mt-6 pt-6 border-t border-ink-300/30 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                    Carga instalada
                  </p>
                  <p className="font-display text-2xl text-ink-700 tabular-nums">
                    {(cargaInstalada / 1000).toFixed(2)} kW
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                    Demanda estimada
                  </p>
                  <p className="font-display text-2xl text-ink-700 tabular-nums">
                    {(demandaTotal / 1000).toFixed(2)} kW
                  </p>
                </div>
              </div>

              <div className="bg-cream-200 p-4 rounded-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500 mb-1">
                  Padrão de entrada recomendado
                </p>
                <p className="font-display text-3xl text-terra-500">{tipoEntrada}</p>
                <p className="text-xs text-ink-600 mt-1">
                  Disjuntor geral: <strong>{disjuntorEntrada} A</strong>
                </p>
              </div>

              <p className="text-xs text-ink-500">
                <strong>Atenção:</strong> consulte a norma técnica da concessionária local
                (CEMIG, Enel, Light...) para especificações precisas. Estes valores são
                estimativos.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================
// CALCULADORA: GÁS GLP
// =============================================

const APARELHOS_GAS: Array<{ nome: string; potencia: number }> = [
  { nome: 'Fogão 4 bocas + forno', potencia: 8500 },
  { nome: 'Fogão 6 bocas + forno', potencia: 12500 },
  { nome: 'Aquecedor passagem 7,5 L/min', potencia: 17000 },
  { nome: 'Aquecedor passagem 12 L/min', potencia: 27000 },
  { nome: 'Aquecedor passagem 18 L/min', potencia: 41000 },
  { nome: 'Aquecedor acumulação 100L', potencia: 23000 },
  { nome: 'Secadora de roupa', potencia: 8000 },
  { nome: 'Lareira a gás', potencia: 6000 }
]

function CalculadoraGasGLP({ onFechar }: { onFechar: () => void }) {
  const [aparelhos, setAparelhos] = useState<Record<string, number>>({})

  function alterar(nome: string, qtd: number) {
    setAparelhos((a) => ({ ...a, [nome]: qtd }))
  }

  const potenciaTotal = APARELHOS_GAS.reduce(
    (acc, ap) => acc + (aparelhos[ap.nome] || 0) * ap.potencia,
    0
  )

  // Conversão potência (kcal/h) → consumo GLP (kg/h): divide por 11.700 kcal/kg
  const consumoKgH = potenciaTotal / 11700

  // Recomendação de cilindros (autonomia 30 dias, uso médio 8h/dia)
  const consumo30dias = consumoKgH * 8 * 30

  let recomendCilindro = 'P-13'
  let qtdCilindros = 1
  if (consumo30dias <= 13) {
    recomendCilindro = 'P-13'
    qtdCilindros = 1
  } else if (consumo30dias <= 26) {
    recomendCilindro = 'P-13'
    qtdCilindros = 2
  } else if (consumo30dias <= 45) {
    recomendCilindro = 'P-45'
    qtdCilindros = 1
  } else if (consumo30dias <= 90) {
    recomendCilindro = 'P-45'
    qtdCilindros = 2
  } else {
    recomendCilindro = 'P-90'
    qtdCilindros = Math.ceil(consumo30dias / 90)
  }

  // Central obrigatória se > 6 kg/h ou > 13 kg total
  const centralObrigatoria = consumoKgH > 6 || qtdCilindros * 13 > 13

  // Tubulação principal
  let tubulacao = '15mm (1/2")'
  if (potenciaTotal > 30000) tubulacao = '22mm (3/4")'
  if (potenciaTotal > 60000) tubulacao = '28mm (1")'
  if (potenciaTotal > 100000) tubulacao = '35mm (1.1/4")'

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-2xl max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500">
              Calculadora
            </p>
            <h2 className="font-display text-3xl text-ink-900">Gás GLP</h2>
            <p className="text-xs text-ink-500 mt-1">Tubulação e cilindros (NBR 13932/13523)</p>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <div className="p-7 space-y-4">
          <p className="text-sm text-ink-600">
            Informe a quantidade de cada aparelho. O cálculo considera potência total e estima
            consumo + central.
          </p>

          <div className="space-y-2">
            {APARELHOS_GAS.map((ap) => (
              <div
                key={ap.nome}
                className="grid grid-cols-12 gap-2 items-center py-2 border-b border-ink-300/20"
              >
                <div className="col-span-7">
                  <p className="text-sm text-ink-700">{ap.nome}</p>
                  <p className="text-[10px] text-ink-500 font-mono">
                    {ap.potencia.toLocaleString('pt-BR')} kcal/h
                  </p>
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    min="0"
                    className="input-field font-mono text-sm"
                    value={aparelhos[ap.nome] || ''}
                    onChange={(e) => alterar(ap.nome, parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div className="col-span-2 text-right">
                  <span className="font-mono text-xs text-ink-500">
                    {((aparelhos[ap.nome] || 0) * ap.potencia).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {potenciaTotal > 0 && (
            <div className="mt-6 pt-6 border-t border-ink-300/30 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                    Potência total
                  </p>
                  <p className="font-display text-2xl text-ink-700 tabular-nums">
                    {potenciaTotal.toLocaleString('pt-BR')} kcal/h
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                    Consumo de GLP
                  </p>
                  <p className="font-display text-2xl text-ink-700 tabular-nums">
                    {consumoKgH.toFixed(2)} kg/h
                  </p>
                </div>
              </div>

              <div className="bg-cream-200 p-4 rounded-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500 mb-1">
                  Tubulação principal recomendada
                </p>
                <p className="font-display text-3xl text-terra-500">{tubulacao}</p>
                <p className="text-xs text-ink-600 mt-1">Cobre rígido ou aço galvanizado</p>
              </div>

              <div className="bg-cream-200 p-4 rounded-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
                  Cilindros sugeridos (autonomia 30 dias)
                </p>
                <p className="font-display text-2xl text-ink-900">
                  {qtdCilindros}× {recomendCilindro}
                </p>
                <p className="text-xs text-ink-600 mt-1">
                  Consumo estimado/mês: {consumo30dias.toFixed(1)} kg
                </p>
              </div>

              {centralObrigatoria && (
                <div className="bg-terra-50 border border-terra-400/40 p-3 rounded-md">
                  <p className="text-xs text-terra-700">
                    <strong>Central de GLP obrigatória (NBR 13523):</strong> instalar em local
                    ventilado, externo, com cilindros reserva idênticos. Consulte distâncias
                    mínimas no artigo &quot;Central de GLP&quot;.
                  </p>
                </div>
              )}

              <p className="text-xs text-ink-500">
                <strong>Importante:</strong> projeto de gás exige ART/RRT e teste de
                estanqueidade obrigatório.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
