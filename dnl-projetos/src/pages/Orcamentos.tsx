import { useEffect, useState, FormEvent } from 'react'
import {
  Plus,
  X,
  Edit2,
  Trash2,
  Copy,
  Eye,
  ArrowLeft,
  FileSignature,
  Printer
} from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type {
  Orcamento,
  OrcamentoCreateInput,
  ItemOrcamento,
  StatusOrcamento,
  Cliente,
  Projeto
} from '@shared/types'

const STATUS_LABEL: Record<StatusOrcamento, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  expirado: 'Expirado'
}

const STATUS_COR: Record<StatusOrcamento, string> = {
  rascunho: 'bg-cream-300 text-ink-700',
  enviado: 'bg-cream-300 text-ink-700',
  aprovado: 'bg-moss-500/15 text-moss-600',
  rejeitado: 'bg-terra-100 text-terra-700',
  expirado: 'bg-cream-200 text-ink-400'
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function OrcamentosPage() {
  const [orcs, setOrcs] = useState<Orcamento[]>([])
  const [filtroStatus, setFiltroStatus] = useState<'' | StatusOrcamento>('')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Orcamento | null>(null)
  const [vendoOrc, setVendoOrc] = useState<Orcamento | null>(null)

  useEffect(() => {
    carregar()
  }, [filtroStatus])

  async function carregar() {
    const lista = await api.orcamentos.listar(filtroStatus || undefined)
    setOrcs(lista)
  }

  async function deletar(o: Orcamento) {
    if (!confirm(`Excluir o orçamento ${o.numero}?`)) return
    const r = await api.orcamentos.deletar(o.id)
    if (r.success) {
      setVendoOrc(null)
      carregar()
    } else alert(r.error || 'Erro ao excluir')
  }

  async function duplicar(o: Orcamento) {
    const novo = await api.orcamentos.duplicar(o.id)
    setEditando(novo)
    carregar()
  }

  async function gerarContrato(o: Orcamento) {
    if (!confirm(`Gerar contrato a partir do orçamento ${o.numero}?`)) return
    try {
      const c = await api.contratos.gerarDeOrcamento(o.id)
      alert(`Contrato ${c.numero} criado! Acesse a página de Contratos para edição.`)
    } catch (e: any) {
      alert(e.message || 'Erro ao gerar contrato')
    }
  }

  if (vendoOrc) {
    return (
      <OrcamentoView
        orcamento={vendoOrc}
        onVoltar={() => setVendoOrc(null)}
        onEditar={() => {
          setEditando(vendoOrc)
          setVendoOrc(null)
        }}
        onGerarContrato={() => gerarContrato(vendoOrc)}
      />
    )
  }

  return (
    <>
      <PageHeader
        numero="A6"
        rotulo="Orçamentos"
        titulo="Orçamentos"
        descricao="Crie, edite e gere contratos a partir de orçamentos."
        acoes={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={14} /> Novo orçamento
          </button>
        }
      />

      <div className="card p-5 mb-6 fade-in">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">Status</label>
            <select
              className="input-field"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as any)}
            >
              <option value="">Todos</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {orcs.length === 0 ? (
        <div className="card p-12 text-center fade-in">
          <p className="font-display text-2xl text-ink-700 mb-2">Nenhum orçamento</p>
          <p className="text-ink-500 text-sm">Crie o primeiro orçamento para começar.</p>
        </div>
      ) : (
        <div className="card overflow-hidden fade-in">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-300/40 text-left">
                <Th>Número</Th>
                <Th>Cliente</Th>
                <Th>Título</Th>
                <Th>Data</Th>
                <Th>Status</Th>
                <Th align="right">Total</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {orcs.map((o) => (
                <tr key={o.id} className="border-b border-ink-300/20 hover:bg-cream-200/50">
                  <Td>
                    <button
                      onClick={() => setVendoOrc(o)}
                      className="font-mono text-xs font-medium text-terra-500 hover:text-terra-600"
                    >
                      {o.numero}
                    </button>
                  </Td>
                  <Td>
                    <span className="text-sm text-ink-700">{o.cliente_nome}</span>
                  </Td>
                  <Td>
                    <span className="text-sm text-ink-900">{o.titulo}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs uppercase tracking-wider">
                      {new Date(o.data_emissao + 'T12:00').toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short'
                      })}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded ${STATUS_COR[o.status]}`}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-sm font-medium text-ink-900 tabular-nums">
                      {brl(o.total)}
                    </span>
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setVendoOrc(o)}
                        className="p-1 text-ink-500 hover:text-ink-900"
                        title="Visualizar"
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        onClick={() => setEditando(o)}
                        className="p-1 text-ink-500 hover:text-ink-900"
                        title="Editar"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => duplicar(o)}
                        className="p-1 text-ink-500 hover:text-ink-900"
                        title="Duplicar"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={() => deletar(o)}
                        className="p-1 text-ink-500 hover:text-terra-500"
                        title="Excluir"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ModalOrcamento
          onFechar={() => setShowForm(false)}
          onSalvo={() => {
            setShowForm(false)
            carregar()
          }}
        />
      )}

      {editando && (
        <ModalOrcamento
          orcamento={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null)
            carregar()
          }}
        />
      )}
    </>
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

function OrcamentoView({
  orcamento,
  onVoltar,
  onEditar,
  onGerarContrato
}: {
  orcamento: Orcamento
  onVoltar: () => void
  onEditar: () => void
  onGerarContrato: () => void
}) {
  function imprimir() {
    window.print()
  }

  const validade = orcamento.validade_dias
    ? new Date(
        new Date(orcamento.data_emissao).getTime() + orcamento.validade_dias * 86400000
      ).toLocaleDateString('pt-BR')
    : '—'

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button
          onClick={onVoltar}
          className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 text-sm"
        >
          <ArrowLeft size={14} /> Voltar
        </button>
        <div className="flex gap-2">
          <button onClick={onEditar} className="btn-secondary">
            <Edit2 size={14} /> Editar
          </button>
          <button onClick={onGerarContrato} className="btn-secondary">
            <FileSignature size={14} /> Gerar contrato
          </button>
          <button onClick={imprimir} className="btn-primary">
            <Printer size={14} /> Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="bg-cream-50 p-10 rounded-lg shadow-soft print:shadow-none print:p-0 print-area">
        <div className="flex items-start justify-between mb-10 pb-6 border-b border-ink-300/40">
          <div>
            <h1 className="font-display text-4xl text-ink-900">DNL Projetos</h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mt-1">
              Engenharia & Projetos
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              Orçamento
            </p>
            <p className="font-mono text-2xl text-terra-500">{orcamento.numero}</p>
            <span
              className={`inline-block mt-2 text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded ${STATUS_COR[orcamento.status]}`}
            >
              {STATUS_LABEL[orcamento.status]}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">
              Cliente
            </p>
            <p className="text-lg text-ink-900 font-medium">{orcamento.cliente_nome}</p>
            {orcamento.cliente_cnpj && (
              <p className="font-mono text-xs text-ink-600">CNPJ: {orcamento.cliente_cnpj}</p>
            )}
            {orcamento.cliente_endereco && (
              <p className="text-sm text-ink-600 mt-1">{orcamento.cliente_endereco}</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">
              Datas
            </p>
            <p className="text-sm text-ink-700">
              <strong>Emissão:</strong>{' '}
              <span className="font-mono">
                {new Date(orcamento.data_emissao + 'T12:00').toLocaleDateString('pt-BR')}
              </span>
            </p>
            <p className="text-sm text-ink-700">
              <strong>Válido até:</strong> <span className="font-mono">{validade}</span>
            </p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="font-display text-2xl text-ink-900 mb-2">{orcamento.titulo}</h2>
          {orcamento.descricao && (
            <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">
              {orcamento.descricao}
            </p>
          )}
        </div>

        <div className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-3">
            Itens
          </p>
          <table className="w-full border-t border-ink-300/40">
            <thead>
              <tr className="border-b border-ink-300/40">
                <th className="py-2 text-left text-xs font-medium text-ink-500">Descrição</th>
                <th className="py-2 text-right text-xs font-medium text-ink-500 w-16">Qtd</th>
                <th className="py-2 text-left text-xs font-medium text-ink-500 w-16 pl-2">
                  Un
                </th>
                <th className="py-2 text-right text-xs font-medium text-ink-500 w-32">
                  Vl. unit.
                </th>
                <th className="py-2 text-right text-xs font-medium text-ink-500 w-32">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {orcamento.itens.map((it, i) => (
                <tr key={i} className="border-b border-ink-300/20">
                  <td className="py-3 text-sm text-ink-700">{it.descricao}</td>
                  <td className="py-3 text-right font-mono text-sm text-ink-700 tabular-nums">
                    {it.quantidade}
                  </td>
                  <td className="py-3 pl-2 font-mono text-xs text-ink-600">{it.unidade}</td>
                  <td className="py-3 text-right font-mono text-sm text-ink-700 tabular-nums">
                    {brl(it.valor_unitario)}
                  </td>
                  <td className="py-3 text-right font-mono text-sm text-ink-900 tabular-nums">
                    {brl(it.valor_total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="py-2 text-right text-sm text-ink-600">
                  Subtotal
                </td>
                <td className="py-2 text-right font-mono text-sm text-ink-700 tabular-nums">
                  {brl(orcamento.subtotal)}
                </td>
              </tr>
              {orcamento.desconto_percentual > 0 && (
                <tr>
                  <td colSpan={4} className="py-2 text-right text-sm text-ink-600">
                    Desconto ({orcamento.desconto_percentual}%)
                  </td>
                  <td className="py-2 text-right font-mono text-sm text-terra-500 tabular-nums">
                    − {brl(orcamento.desconto_valor)}
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-ink-700">
                <td colSpan={4} className="py-3 text-right font-display text-xl text-ink-900">
                  Total
                </td>
                <td className="py-3 text-right font-display text-2xl text-ink-900 tabular-nums">
                  {brl(orcamento.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {(orcamento.forma_pagamento || orcamento.prazo_execucao) && (
          <div className="grid grid-cols-2 gap-8 mb-6 pt-6 border-t border-ink-300/30">
            {orcamento.forma_pagamento && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
                  Forma de pagamento
                </p>
                <p className="text-sm text-ink-700 whitespace-pre-line">
                  {orcamento.forma_pagamento}
                </p>
              </div>
            )}
            {orcamento.prazo_execucao && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
                  Prazo de execução
                </p>
                <p className="text-sm text-ink-700 whitespace-pre-line">
                  {orcamento.prazo_execucao}
                </p>
              </div>
            )}
          </div>
        )}

        {orcamento.observacoes && (
          <div className="mb-6 pt-6 border-t border-ink-300/30">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
              Observações
            </p>
            <p className="text-sm text-ink-700 whitespace-pre-line">{orcamento.observacoes}</p>
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-ink-300/30 text-xs text-ink-500 text-center">
          DNL Projetos · contato@dnlprojetos.com
        </div>
      </div>
    </div>
  )
}

function ModalOrcamento({
  orcamento,
  onFechar,
  onSalvo
}: {
  orcamento?: Orcamento
  onFechar: () => void
  onSalvo: () => void
}) {
  const [titulo, setTitulo] = useState(orcamento?.titulo || '')
  const [descricao, setDescricao] = useState(orcamento?.descricao || '')
  const [clienteId, setClienteId] = useState<number | ''>(orcamento?.cliente_id || '')
  const [projetoId, setProjetoId] = useState<number | ''>(orcamento?.projeto_id || '')
  const [status, setStatus] = useState<StatusOrcamento>(orcamento?.status || 'rascunho')
  const [dataEmissao, setDataEmissao] = useState(
    orcamento?.data_emissao || new Date().toISOString().slice(0, 10)
  )
  const [validade, setValidade] = useState(orcamento?.validade_dias.toString() || '30')
  const [desconto, setDesconto] = useState(
    orcamento?.desconto_percentual.toString() || '0'
  )
  const [formaPagto, setFormaPagto] = useState(orcamento?.forma_pagamento || '')
  const [prazoExec, setPrazoExec] = useState(orcamento?.prazo_execucao || '')
  const [obs, setObs] = useState(orcamento?.observacoes || '')
  const [itens, setItens] = useState<ItemOrcamento[]>(
    orcamento?.itens || [
      { ordem: 0, descricao: '', quantidade: 1, unidade: 'un', valor_unitario: 0, valor_total: 0 }
    ]
  )
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const ehEdicao = !!orcamento

  useEffect(() => {
    Promise.all([api.clientes.listar(), api.projetos.listar()]).then(
      ([cs, ps]) => {
        setClientes(cs)
        setProjetos(ps)
      }
    )
  }, [])

  function adicionarItem() {
    setItens([
      ...itens,
      {
        ordem: itens.length,
        descricao: '',
        quantidade: 1,
        unidade: 'un',
        valor_unitario: 0,
        valor_total: 0
      }
    ])
  }

  function removerItem(idx: number) {
    setItens(itens.filter((_, i) => i !== idx))
  }

  function atualizarItem(idx: number, campo: keyof ItemOrcamento, valor: any) {
    const novos = [...itens]
    ;(novos[idx] as any)[campo] = valor
    if (campo === 'quantidade' || campo === 'valor_unitario') {
      novos[idx].valor_total = novos[idx].quantidade * novos[idx].valor_unitario
    }
    setItens(novos)
  }

  const subtotal = itens.reduce((acc, i) => acc + i.quantidade * i.valor_unitario, 0)
  const descontoValor = subtotal * ((parseFloat(desconto) || 0) / 100)
  const total = subtotal - descontoValor

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!clienteId) return setErro('Selecione um cliente')
    if (itens.length === 0 || itens.every((i) => !i.descricao.trim()))
      return setErro('Adicione ao menos 1 item')

    setErro('')
    setSalvando(true)
    try {
      const dados: OrcamentoCreateInput = {
        cliente_id: Number(clienteId),
        projeto_id: projetoId ? Number(projetoId) : undefined,
        titulo,
        descricao: descricao || undefined,
        status,
        data_emissao: dataEmissao,
        validade_dias: parseInt(validade) || 30,
        desconto_percentual: parseFloat(desconto) || 0,
        forma_pagamento: formaPagto || undefined,
        prazo_execucao: prazoExec || undefined,
        observacoes: obs || undefined,
        itens: itens
          .filter((i) => i.descricao.trim())
          .map((i, idx) => ({
            ordem: idx,
            descricao: i.descricao,
            quantidade: i.quantidade,
            unidade: i.unidade,
            valor_unitario: i.valor_unitario
          }))
      }
      if (ehEdicao) {
        await api.orcamentos.atualizar(orcamento.id, dados)
      } else {
        await api.orcamentos.criar(dados)
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
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-4xl max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              {ehEdicao ? `Editar ${orcamento.numero}` : 'Novo'}
            </p>
            <h2 className="font-display text-3xl text-ink-900">Orçamento</h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cliente *</label>
              <select
                className="input-field"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">Selecione...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Projeto vinculado</label>
              <select
                className="input-field"
                value={projetoId}
                onChange={(e) => setProjetoId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— Nenhum —</option>
                {projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Título *</label>
            <input
              className="input-field"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Projeto hidrossanitário residência X"
              required
            />
          </div>

          <div>
            <label className="label">Descrição / escopo</label>
            <textarea
              className="input-field min-h-[80px]"
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="label">Status</label>
              <select
                className="input-field"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusOrcamento)}
              >
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Data emissão</label>
              <input
                type="date"
                className="input-field"
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Validade (dias)</label>
              <input
                type="number"
                className="input-field font-mono"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                min="1"
              />
            </div>
            <div>
              <label className="label">Desconto (%)</label>
              <input
                type="number"
                step="0.01"
                className="input-field font-mono"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                min="0"
                max="100"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label !mb-0">Itens *</label>
              <button
                type="button"
                onClick={adicionarItem}
                className="text-xs text-terra-500 hover:text-terra-600 flex items-center gap-1"
              >
                <Plus size={11} /> adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <input
                      className="input-field"
                      placeholder="Descrição"
                      value={it.descricao}
                      onChange={(e) => atualizarItem(idx, 'descricao', e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      step="0.01"
                      className="input-field font-mono"
                      placeholder="Qtd"
                      value={it.quantidade}
                      onChange={(e) =>
                        atualizarItem(idx, 'quantidade', parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      className="input-field font-mono"
                      placeholder="un"
                      value={it.unidade}
                      onChange={(e) => atualizarItem(idx, 'unidade', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      className="input-field font-mono"
                      placeholder="Valor un."
                      value={it.valor_unitario}
                      onChange={(e) =>
                        atualizarItem(idx, 'valor_unitario', parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      readOnly
                      className="input-field font-mono bg-cream-200"
                      value={brl(it.quantidade * it.valor_unitario)}
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      type="button"
                      onClick={() => removerItem(idx)}
                      className="text-ink-500 hover:text-terra-500 p-2"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-ink-300/30 space-y-1 text-right">
              <p className="text-sm text-ink-600">
                Subtotal: <span className="font-mono ml-2">{brl(subtotal)}</span>
              </p>
              {descontoValor > 0 && (
                <p className="text-sm text-terra-500">
                  Desconto: <span className="font-mono ml-2">− {brl(descontoValor)}</span>
                </p>
              )}
              <p className="font-display text-2xl text-ink-900">
                Total: <span className="font-mono tabular-nums ml-2">{brl(total)}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Forma de pagamento</label>
              <textarea
                className="input-field min-h-[60px]"
                rows={2}
                value={formaPagto}
                onChange={(e) => setFormaPagto(e.target.value)}
                placeholder="Ex: 50% no início, 50% na entrega"
              />
            </div>
            <div>
              <label className="label">Prazo de execução</label>
              <textarea
                className="input-field min-h-[60px]"
                rows={2}
                value={prazoExec}
                onChange={(e) => setPrazoExec(e.target.value)}
                placeholder="Ex: 45 dias úteis a partir da assinatura"
              />
            </div>
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea
              className="input-field min-h-[60px]"
              rows={2}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
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
              {salvando ? 'Salvando…' : ehEdicao ? 'Salvar alterações' : 'Criar orçamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
