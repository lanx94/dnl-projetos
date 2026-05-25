import { useEffect, useState, FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Plus, X, Edit2, Trash2, Copy, Eye, ArrowLeft, FileSignature,
  Printer, Kanban, UserPlus, Users, Zap, ChevronDown, ChevronUp,
  CreditCard, Smartphone, Barcode, Banknote,
  CloudLightning, Droplets, Flame, FileText, Building2, Shield
} from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import logoUrl from '../assets/logo-dnl-new.svg'
import type {
  Orcamento, OrcamentoCreateInput, ItemOrcamento,
  StatusOrcamento, Cliente, Projeto
} from '@shared/types'

// ─── Status ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<StatusOrcamento, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado',
  rejeitado: 'Rejeitado', expirado: 'Expirado'
}
const STATUS_COR: Record<StatusOrcamento, string> = {
  rascunho: 'bg-cream-300 text-ink-700',
  enviado: 'bg-cream-300 text-ink-700',
  aprovado: 'bg-moss-500/15 text-moss-600',
  rejeitado: 'bg-terra-100 text-terra-700',
  expirado: 'bg-cream-200 text-ink-400'
}

// ─── Tabela de preços (R$/m²) ─────────────────────────────────────────────────

const TABELA_M2 = {
  eletrico: { casa: 9.5,  predio: 12.0,  comercio: 16.2  },
  spda:     { casa: 2.5,  predio:  3.0,  comercio:  4.0  },
  hidro:    { casa: 8.7,  predio: 10.0,  comercio: 15.6  },
  gas:      { casa: 5.5,  predio:  5.0,  comercio:  9.11 },
} as const

type TipoEdificacao = 'casa' | 'predio' | 'comercio'
type TemplateProposta = 'livre' | 'complementares' | 'usucapiao' | 'manual' | 'laudo_viz' | 'laudo_apt'

const TEMPLATE_LABEL: Record<TemplateProposta, string> = {
  livre: 'Livre',
  complementares: 'Compl. (m²)',
  usucapiao: 'Usucapião',
  manual: 'Manual Prop.',
  laudo_viz: 'Laudo Vizinhança',
  laudo_apt: 'Laudo Apartamento',
}

// ─── Projetos necessários ─────────────────────────────────────────────────────

const PROJETOS_LISTA = [
  'Projeto Arquitetônico Executivo',
  'Projeto Estrutural / Fundação',
  'Projeto Elétrico, Lógico',
  'SPDA',
  'Projeto Hidrossanitário',
  'Projeto de Gás',
  'AVCB / CLCB',
  'Render / Visualização 3D',
  'Compatibilização BIM',
  'Laudo de Vizinhança',
  'Usucapião',
  'Manual do Proprietário',
]

// ─── Escopos pré-montados ─────────────────────────────────────────────────────

const ESCOPOS_PRONTOS = [
  'Elaborado conforme normas ABNT vigentes, com ART inclusa.',
  'Compatibilização BIM entre todas as disciplinas incluída.',
  'Todas as pranchas entregues em PDF e formato editável (.dwg).',
  'Levantamento in loco incluso no escopo de serviços.',
  'Memorial descritivo e quantitativo de materiais incluídos.',
  'Aprovação junto à concessionária inclusa no escopo.',
  'Isométrico e esquema vertical incluídos (hidrossanitário).',
  'Diagrama unifilar e tabela de cargas incluídos (elétrico).',
  'ART de projeto e execução inclusas.',
  'Projeto de fundação e estrutural com armações e quantitativos.',
]

// ─── O que está incluso por disciplina / serviço ─────────────────────────────

type SecaoIncluso = { titulo: string; itens: string[] }

const INCLUSOS_DISC: Record<string, SecaoIncluso> = {
  eletrico: {
    titulo: 'Projeto Elétrico, Lógico',
    itens: [
      'Diagrama unifilar completo',
      'Tabela de cargas detalhada',
      'Plantas de instalações elétricas por pavimento',
      'Projeto lógico — voz, dados e imagem',
      'Quadro de distribuição especificado',
      'Memorial descritivo',
      'ART inclusa',
      'Entrega em PDF e formato editável (.dwg)',
    ],
  },
  spda: {
    titulo: 'SPDA',
    itens: [
      'Projeto de para-raios conforme ABNT NBR 5419',
      'Malha de aterramento especificada',
      'Captores e descidas dimensionados',
      'ART inclusa',
    ],
  },
  hidro: {
    titulo: 'Projeto Hidrossanitário',
    itens: [
      'Planta de água fria e água quente',
      'Planta de esgoto e águas pluviais',
      'Isométrico hidráulico',
      'Esquema vertical',
      'Memorial descritivo e quantitativo de materiais',
      'ART inclusa',
      'Entrega em PDF e formato editável (.dwg)',
    ],
  },
  gas: {
    titulo: 'Projeto de Gás',
    itens: [
      'Projeto conforme NBR 15526 e normas da distribuidora local',
      'Planta de distribuição de gás por pavimento',
      'Isométrico de gás',
      'Aprovação junto à concessionária inclusa',
      'ART inclusa',
    ],
  },
}

const INCLUSOS_TEMPLATE: Record<string, SecaoIncluso[]> = {
  usucapiao: [{
    titulo: 'Elaboração de Ação de Usucapião',
    itens: [
      'Levantamento documental do imóvel',
      'Planta e memorial descritivo georreferenciado',
      'Análise de matrícula e certidões',
      'ART de responsabilidade técnica',
      'Entrega em PDF e formato editável',
    ],
  }],
  manual: [{
    titulo: 'Manual do Proprietário',
    itens: [
      'Fichas técnicas de todos os sistemas do imóvel',
      'Instruções de uso e manutenção preventiva',
      'Memorial descritivo de materiais utilizados',
      'Contatos de fornecedores e informações de garantias',
      'Entrega em PDF (formato imprimível)',
    ],
  }],
  laudo_viz: [{
    titulo: 'Laudo de Vizinhança',
    itens: [
      'Vistoria técnica pré-obra',
      'Registro fotográfico detalhado',
      'Memorial descritivo das condições encontradas',
      'ART de responsabilidade técnica',
      'Entrega em PDF',
    ],
  }],
  laudo_apt: [{
    titulo: 'Laudo de Vistoria de Entrega de Apartamento',
    itens: [
      'Inspeção técnica completa do imóvel',
      'Registro fotográfico de todos os ambientes',
      'Lista de não conformidades e pendências',
      'Relatório de vistoria de entrega de apartamento',
      'Entrega em PDF',
    ],
  }],
}

function iconForDisciplina(titulo: string) {
  const t = titulo.toLowerCase()
  if (t.includes('elétric') || t.includes('eletric') || t.includes('lógico') || t.includes('logico'))
    return <Zap size={16} className="text-yellow-300 shrink-0" />
  if (t.includes('spda') || t.includes('para-raios'))
    return <CloudLightning size={16} className="text-blue-300 shrink-0" />
  if (t.includes('hidro') || t.includes('sanit'))
    return <Droplets size={16} className="text-cyan-300 shrink-0" />
  if (t.includes('gás') || t.includes('gas'))
    return <Flame size={16} className="text-orange-300 shrink-0" />
  if (t.includes('laudo'))
    return <Eye size={16} className="text-purple-300 shrink-0" />
  if (t.includes('manual'))
    return <FileText size={16} className="text-green-300 shrink-0" />
  if (t.includes('usucap'))
    return <Building2 size={16} className="text-cream-300 shrink-0" />
  return <Shield size={16} className="text-cream-300 shrink-0" />
}

// ─── Formas de pagamento ──────────────────────────────────────────────────────

const METODOS_PAGAMENTO = [
  { id: 'pix', label: 'PIX', icon: Smartphone },
  { id: 'boleto', label: 'Boleto', icon: Barcode },
  { id: 'credito', label: 'Cartão de Crédito', icon: CreditCard },
  { id: 'debito', label: 'Cartão de Débito', icon: CreditCard },
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function itemVazio(): ItemOrcamento {
  return { ordem: 0, descricao: '', quantidade: 1, unidade: 'serv', valor_unitario: 0, valor_total: 0 }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrcamentosPage() {
  const [orcs, setOrcs] = useState<Orcamento[]>([])
  const [filtroStatus, setFiltroStatus] = useState<'' | StatusOrcamento>('')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Orcamento | null>(null)
  const [vendoOrc, setVendoOrc] = useState<Orcamento | null>(null)
  const location = useLocation()

  useEffect(() => { carregar() }, [filtroStatus])

  useEffect(() => {
    const abrirId = (location.state as any)?.abrirId
    if (abrirId && orcs.length > 0) {
      const orc = orcs.find(o => o.id === abrirId)
      if (orc) setVendoOrc(orc)
    }
  }, [orcs, location.state])

  async function carregar() {
    setOrcs(await api.orcamentos.listar(filtroStatus || undefined))
  }

  async function deletar(o: Orcamento) {
    if (!confirm(`Excluir o orçamento ${o.numero}?`)) return
    const r = await api.orcamentos.deletar(o.id)
    if (r.success) { setVendoOrc(null); carregar() }
    else alert(r.error || 'Erro ao excluir')
  }

  async function duplicar(o: Orcamento) {
    setEditando(await api.orcamentos.duplicar(o.id))
    carregar()
  }

  async function gerarContrato(o: Orcamento) {
    if (!confirm(`Gerar contrato a partir do orçamento ${o.numero}?`)) return
    try {
      const c = await api.contratos.gerarDeOrcamento(o.id)
      alert(`Contrato ${c.numero} criado!`)
    } catch (e: any) {
      alert(e.message || 'Erro ao gerar contrato')
    }
  }

  if (vendoOrc) {
    return (
      <OrcamentoView
        orcamento={vendoOrc}
        onVoltar={() => setVendoOrc(null)}
        onEditar={() => { setEditando(vendoOrc); setVendoOrc(null) }}
        onGerarContrato={() => gerarContrato(vendoOrc)}
      />
    )
  }

  return (
    <>
      <PageHeader
        numero="A6" rotulo="Orçamentos" titulo="Orçamentos"
        descricao="Crie, edite e gere contratos a partir de orçamentos."
        acoes={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={14} /> Novo orçamento
          </button>
        }
      />

      <div className="card p-5 mb-6 fade-in">
        <div>
          <label className="label">Status</label>
          <select className="input-field" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as any)}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
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
                <Th>Número</Th><Th>Cliente</Th><Th>Título</Th><Th>Data</Th>
                <Th>Status</Th><Th align="right">Total</Th><Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {orcs.map(o => (
                <tr key={o.id} className="border-b border-ink-300/20 hover:bg-cream-200/50">
                  <Td>
                    <button onClick={() => setVendoOrc(o)} className="font-mono text-xs font-medium text-terra-500 hover:text-terra-600">
                      {o.numero}
                    </button>
                  </Td>
                  <Td><span className="text-sm text-ink-700">{o.cliente_nome}</span></Td>
                  <Td><span className="text-sm text-ink-900">{o.titulo}</span></Td>
                  <Td>
                    <span className="font-mono text-xs uppercase tracking-wider">
                      {new Date(o.data_emissao + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                  </Td>
                  <Td>
                    <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded ${STATUS_COR[o.status]}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-sm font-medium text-ink-900 tabular-nums">{brl(o.total)}</span>
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setVendoOrc(o)} className="p-1 text-ink-500 hover:text-ink-900" title="Visualizar"><Eye size={12} /></button>
                      <button onClick={() => setEditando(o)} className="p-1 text-ink-500 hover:text-ink-900" title="Editar"><Edit2 size={12} /></button>
                      <button onClick={() => duplicar(o)} className="p-1 text-ink-500 hover:text-ink-900" title="Duplicar"><Copy size={12} /></button>
                      <button onClick={() => deletar(o)} className="p-1 text-ink-500 hover:text-terra-500" title="Excluir"><Trash2 size={12} /></button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <ModalOrcamento onFechar={() => setShowForm(false)} onSalvo={() => { setShowForm(false); carregar() }} />}
      {editando && <ModalOrcamento orcamento={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar() }} />}
    </>
  )
}

function Th({ children, align = 'left' }: any) {
  return <th className={`px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-ink-500 font-normal text-${align}`}>{children}</th>
}
function Td({ children, align = 'left' }: any) {
  return <td className={`px-5 py-3 text-${align}`}>{children}</td>
}

// ─── View (layout proposta PDF) ───────────────────────────────────────────────

function OrcamentoView({ orcamento, onVoltar, onEditar, onGerarContrato }: {
  orcamento: Orcamento
  onVoltar: () => void
  onEditar: () => void
  onGerarContrato: () => void
}) {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [enviandoCRM, setEnviandoCRM] = useState(false)
  useEffect(() => { api.configuracoes.obter().then(setConfig).catch(() => {}) }, [])

  async function enviarParaCRM() {
    if (!confirm(`Enviar "${orcamento.cliente_nome}" para o CRM?`)) return
    setEnviandoCRM(true)
    try {
      await api.orcamentosExtra.enviarParaCRM(orcamento.id, orcamento.cliente_nome || orcamento.titulo, orcamento.total, orcamento.cliente_id)
      alert('Lead criado no CRM com sucesso!')
    } catch (e: any) { alert(e.message || 'Erro') }
    finally { setEnviandoCRM(false) }
  }

  const dataValidade = new Date(orcamento.data_emissao + 'T12:00')
  dataValidade.setDate(dataValidade.getDate() + orcamento.validade_dias)

  const projetosNecessarios: string[] = (() => {
    try { return orcamento.projetos_necessarios ? JSON.parse(orcamento.projetos_necessarios) : [] }
    catch { return [] }
  })()

  function gerarWord() {
    const dataEmissao = new Date(orcamento.data_emissao + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const dataVal = new Date(orcamento.data_emissao + 'T12:00')
    dataVal.setDate(dataVal.getDate() + orcamento.validade_dias)
    const secoesIncluso: SecaoIncluso[] = (() => { try { return orcamento.incluso ? JSON.parse(orcamento.incluso) : [] } catch { return [] } })()
    const corWord = (titulo: string) => {
      const t = titulo.toLowerCase()
      if (t.includes('elétric') || t.includes('eletric')) return '#d4a000'
      if (t.includes('spda')) return '#3b82f6'
      if (t.includes('hidro')) return '#06b6d4'
      if (t.includes('gás') || t.includes('gas')) return '#f97316'
      return '#6b7280'
    }
    const itensHtml = orcamento.itens.map((it, i) => `
      <tr style="background:${i % 2 === 1 ? '#faf9f7' : '#fff'}">
        <td style="padding:8pt 10pt;border-bottom:0.5pt solid #e8e4de;font-size:10.5pt">${it.descricao}</td>
        <td style="padding:8pt;text-align:right;font-family:'Courier New';font-size:10pt;border-bottom:0.5pt solid #e8e4de;color:#666">${it.quantidade}</td>
        <td style="padding:8pt 6pt;font-family:'Courier New';font-size:9pt;border-bottom:0.5pt solid #e8e4de;color:#999">${it.unidade}</td>
        <td style="padding:8pt;text-align:right;font-family:'Courier New';font-size:10pt;border-bottom:0.5pt solid #e8e4de;color:#666">${brl(it.valor_unitario)}</td>
        <td style="padding:8pt 10pt;text-align:right;font-family:'Courier New';font-size:10.5pt;border-bottom:0.5pt solid #e8e4de;font-weight:600">${brl(it.valor_total)}</td>
      </tr>`).join('')
    const descontoHtml = orcamento.desconto_percentual > 0 ? `
      <tr><td colspan="4" style="padding:6pt 10pt;text-align:right;font-size:9pt;color:#888">Subtotal</td><td style="padding:6pt 10pt;text-align:right;font-family:'Courier New';font-size:10pt;color:#888">${brl(orcamento.subtotal)}</td></tr>
      <tr><td colspan="4" style="padding:4pt 10pt;text-align:right;font-size:9pt;color:#c0441a">Desconto (${orcamento.desconto_percentual}%)</td><td style="padding:4pt 10pt;text-align:right;font-family:'Courier New';font-size:10pt;color:#c0441a">− ${brl(orcamento.desconto_valor)}</td></tr>` : ''
    const inclHtml = secoesIncluso.length > 0 ? `
      <br style="page-break-before:always">
      <p style="font-family:'Courier New';font-size:7pt;letter-spacing:3pt;color:#888;text-transform:uppercase">${config.empresa_nome || 'DNL Projetos'} · ${orcamento.numero}</p>
      <p style="font-size:32pt;font-weight:900;margin:0;line-height:1">O QUE ESTÁ</p>
      <p style="font-size:22pt;font-weight:300;color:#c0441a;margin:0 0 14pt;letter-spacing:3pt">INCLUSO</p>
      <hr style="border:none;border-top:3pt solid #1a1a1a;margin-bottom:1pt"><hr style="border:none;border-top:0.5pt solid #ccc;margin-bottom:18pt">
      <table style="width:100%;border-collapse:separate;border-spacing:8pt 8pt">
        ${secoesIncluso.reduce((acc, s, i) => {
          if (i % 2 === 0) acc.push([s])
          else acc[acc.length - 1].push(s)
          return acc
        }, [] as SecaoIncluso[][]).map(par => `
        <tr>${par.map(s => `
          <td style="vertical-align:top;width:50%;border:0.5pt solid #ddd;border-top:3pt solid ${corWord(s.titulo)};padding:0">
            <div style="padding:8pt 14pt;background:#faf9f7;border-bottom:0.5pt solid #eee">
              <strong style="font-family:'Courier New';font-size:8pt;text-transform:uppercase;letter-spacing:1.5pt">${s.titulo}</strong>
            </div>
            <div style="padding:8pt 14pt">${s.itens.filter(Boolean).map(it => `<p style="margin:0 0 5pt;font-size:10pt">✓ ${it}</p>`).join('')}</div>
          </td>`).join('')}${par.length === 1 ? '<td style="width:50%"></td>' : ''}</tr>`).join('')}
      </table>` : ''
    const footerTxt = [config.empresa_nome || 'DNL Projetos', config.empresa_cnpj ? `CNPJ ${config.empresa_cnpj}` : '', config.empresa_email, config.empresa_telefone, config.empresa_site].filter(Boolean).join(' · ')
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><style>@page{margin:2cm} body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1a1a;line-height:1.4}</style></head>
<body>
<p style="font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:3pt;color:#888;margin-bottom:10pt">${config.empresa_nome || 'DNL Projetos'}</p>
<p style="font-size:40pt;font-weight:900;margin:0;line-height:1">PROPOSTA</p>
<p style="font-size:24pt;font-weight:300;color:#c0441a;margin:0 0 6pt;letter-spacing:3pt">COMERCIAL</p>
${config.empresa_responsavel ? `<p style="font-size:9pt;color:#888;margin-bottom:14pt">Eng. ${config.empresa_responsavel}</p>` : ''}
<hr style="border:none;border-top:3pt solid #1a1a1a;margin-bottom:1pt"><hr style="border:none;border-top:0.5pt solid #ccc;margin-bottom:14pt">
<table style="width:100%;border-collapse:collapse;margin-bottom:18pt"><tr>
  <td style="padding:0 14pt 0 0;vertical-align:top"><p style="font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#888;margin:0 0 3pt">Referência</p><strong style="font-family:'Courier New';font-size:11pt">${orcamento.numero}</strong></td>
  <td style="padding:0 14pt 0 0;vertical-align:top"><p style="font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#888;margin:0 0 3pt">Cliente</p><strong style="font-size:11pt">${orcamento.cliente_nome}</strong></td>
  <td style="padding:0 14pt 0 0;vertical-align:top"><p style="font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#888;margin:0 0 3pt">Emissão</p><strong style="font-size:11pt">${dataEmissao}</strong></td>
  <td style="padding:0;vertical-align:top"><p style="font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#888;margin:0 0 3pt">Validade</p><strong style="font-size:11pt">${orcamento.validade_dias} dias</strong><br><span style="font-family:'Courier New';font-size:8pt;color:#888">até ${dataVal.toLocaleDateString('pt-BR')}</span></td>
</tr></table>
<div style="border-left:3pt solid #c0441a;padding-left:12pt;margin-bottom:18pt">
  <p style="font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#c0441a;margin:0 0 4pt">Objeto</p>
  <p style="font-size:13pt;font-weight:700;margin:0 0 4pt">${orcamento.titulo}</p>
  ${orcamento.descricao ? `<p style="font-size:10pt;color:#555;margin:5pt 0 0;white-space:pre-wrap">${orcamento.descricao}</p>` : ''}
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:18pt">
  <thead><tr style="border-bottom:2pt solid #1a1a1a">
    <th style="padding:7pt 10pt 6pt;text-align:left;font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#666;font-weight:500">Descrição</th>
    <th style="padding:7pt 8pt 6pt;text-align:right;font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#666;font-weight:500;width:55pt">Qtd</th>
    <th style="padding:7pt 6pt 6pt;text-align:left;font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#666;font-weight:500;width:28pt">Un</th>
    <th style="padding:7pt 8pt 6pt;text-align:right;font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#666;font-weight:500;width:75pt">Unitário</th>
    <th style="padding:7pt 10pt 6pt;text-align:right;font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#666;font-weight:500;width:75pt">Total</th>
  </tr></thead>
  <tbody>${itensHtml}</tbody>
  <tfoot>${descontoHtml}<tr style="border-top:2pt solid #1a1a1a">
    <td colspan="4" style="padding:10pt 10pt;text-align:right;font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#666">Total</td>
    <td style="padding:10pt 10pt;text-align:right;font-family:'Courier New';font-size:18pt;font-weight:900">${brl(orcamento.total)}</td>
  </tr></tfoot>
</table>
${(orcamento.forma_pagamento || orcamento.prazo_execucao) ? `<table style="width:100%;border-collapse:collapse;margin-bottom:18pt"><tr>
  ${orcamento.forma_pagamento ? `<td style="vertical-align:top;width:${orcamento.prazo_execucao ? '50%' : '100%'};border-left:3pt solid #4a7c59;padding-left:12pt;padding-right:16pt"><p style="font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#4a7c59;margin:0 0 6pt">Condições de pagamento</p>${orcamento.forma_pagamento.split('\n').filter(Boolean).map(l => `<p style="font-size:10pt;color:#333;margin:0 0 4pt">• ${l}</p>`).join('')}</td>` : ''}
  ${orcamento.prazo_execucao ? `<td style="vertical-align:top;border-left:3pt solid #4a7c59;padding-left:12pt"><p style="font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#4a7c59;margin:0 0 6pt">Forma de entrega</p><p style="font-size:10pt;color:#333;white-space:pre-wrap">${orcamento.prazo_execucao}</p></td>` : ''}
</tr></table>` : ''}
${projetosNecessarios.length > 0 ? `<div style="border-left:3pt solid #ccc;padding-left:12pt;margin-bottom:18pt"><p style="font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#888;margin:0 0 8pt">Projetos necessários para execução</p>${projetosNecessarios.map(p => `<p style="font-size:10pt;color:#444;margin:0 0 4pt">• ${p}</p>`).join('')}</div>` : ''}
${orcamento.observacoes ? `<div style="border-left:3pt solid #ddd;padding:8pt 12pt;background:#faf9f7;margin-bottom:18pt"><p style="font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:2pt;color:#888;margin:0 0 6pt">Observações</p><p style="font-size:10pt;color:#555;white-space:pre-wrap">${orcamento.observacoes}</p></div>` : ''}
${inclHtml}
<hr style="border:none;border-top:0.5pt solid #ccc;margin-top:24pt;margin-bottom:8pt">
<p style="font-family:'Courier New';font-size:7pt;text-transform:uppercase;letter-spacing:1.5pt;color:#bbb;text-align:center">${footerTxt}</p>
</body></html>`
    const blob = new Blob(['﻿', html], { type: 'application/vnd.ms-word;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${orcamento.numero}.doc`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const corCard: Record<string, string> = {
    eletrico: 'border-t-yellow-400',
    spda: 'border-t-blue-400',
    hidro: 'border-t-cyan-400',
    gas: 'border-t-orange-400',
    laudo: 'border-t-purple-400',
    manual: 'border-t-green-400',
    usucap: 'border-t-terra-400',
    default: 'border-t-ink-400',
  }
  function corCardForTitulo(titulo: string): string {
    const t = titulo.toLowerCase()
    if (t.includes('elétric') || t.includes('eletric')) return corCard.eletrico
    if (t.includes('spda')) return corCard.spda
    if (t.includes('hidro')) return corCard.hidro
    if (t.includes('gás') || t.includes('gas')) return corCard.gas
    if (t.includes('laudo')) return corCard.laudo
    if (t.includes('manual')) return corCard.manual
    if (t.includes('usucap')) return corCard.usucap
    return corCard.default
  }

  return (
    <div className="fade-in">

      {/* ── Barra de ações (oculta no print) ── */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button onClick={onVoltar} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 text-sm">
          <ArrowLeft size={14} /> Voltar
        </button>
        <div className="flex gap-2">
          <button onClick={onEditar} className="btn-secondary"><Edit2 size={14} /> Editar</button>
          <button onClick={onGerarContrato} className="btn-secondary"><FileSignature size={14} /> Gerar contrato</button>
          <button onClick={enviarParaCRM} disabled={enviandoCRM} className="btn-secondary">
            <Kanban size={14} /> {enviandoCRM ? 'Enviando…' : 'Enviar para CRM'}
          </button>
          <button onClick={gerarWord} className="btn-secondary"><FileText size={14} /> Gerar Word</button>
          <button onClick={() => window.print()} className="btn-primary"><Printer size={14} /> Imprimir / PDF</button>
        </div>
      </div>

      {/* ══ DOCUMENTO ══ */}
      <div className="bg-white rounded-2xl shadow-lift print:shadow-none print:rounded-none max-w-4xl mx-auto print-area">

        {/* ── CABEÇALHO ── */}
        <div className="px-12 pt-12 pb-8 print:px-8 print:pt-8 print:pb-5">
          <div className="flex items-start justify-between">
            {/* Título */}
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-ink-400 mb-4">
                {config.empresa_nome || 'DNL Projetos'}
              </p>
              <h1 className="font-display text-[64px] font-black text-ink-900 leading-none tracking-tight">PROPOSTA</h1>
              <h2 className="font-display text-3xl font-extralight text-terra-500 leading-none tracking-[0.15em] mt-1">COMERCIAL</h2>
              {config.empresa_responsavel && (
                <p className="text-xs text-ink-400 mt-5 tracking-wide whitespace-nowrap">Eng. {config.empresa_responsavel}</p>
              )}
            </div>
            {/* Logo */}
            <div className="flex justify-end">
              <img src={logoUrl} alt="DNL" className="w-[16.5rem] object-contain" />
            </div>
          </div>

          {/* Linha decorativa dupla */}
          <div className="mt-8 border-t-4 border-ink-900" />
          <div className="border-t border-ink-200 mt-0.5 mb-6" />

          {/* Info: referência / cliente / data / validade */}
          <div className="grid grid-cols-4 gap-6">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-ink-400 mb-1.5">Referência</p>
              <p className="font-mono text-sm font-bold text-ink-900 tracking-wider">{orcamento.numero}</p>
              <span className={`print:hidden inline-block mt-1.5 font-mono text-[8px] uppercase tracking-[0.2em] px-2 py-1 rounded border ${STATUS_COR[orcamento.status]}`}>
                {STATUS_LABEL[orcamento.status]}
              </span>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-ink-400 mb-1.5">Cliente</p>
              <p className="text-sm font-semibold text-ink-900">{orcamento.cliente_nome}</p>
              {orcamento.cliente_cnpj && <p className="font-mono text-[10px] text-ink-400 mt-0.5">{orcamento.cliente_cnpj}</p>}
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-ink-400 mb-1.5">Emissão</p>
              <p className="text-sm font-semibold text-ink-900">
                {new Date(orcamento.data_emissao + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-ink-400 mb-1.5">Validade</p>
              <p className="text-sm font-semibold text-ink-900">{orcamento.validade_dias} dias</p>
              <p className="font-mono text-[10px] text-ink-400 mt-0.5">até {dataValidade.toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>

        {/* ── CORPO ── */}
        <div className="px-12 pb-12 print:px-8 print:pb-6 space-y-7 print:space-y-5">

          {/* OBJETO */}
          <div className="break-inside-avoid pl-5 border-l-[3px] border-terra-500">
            <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-terra-500 mb-2">Objeto</p>
            <p className="text-base font-bold text-ink-900 leading-snug">{orcamento.titulo}</p>
            {orcamento.descricao && (
              <p className="text-sm text-ink-600 mt-2.5 leading-relaxed whitespace-pre-line">{orcamento.descricao}</p>
            )}
            {orcamento.projeto_nome && (
              <p className="font-mono text-[10px] text-ink-400 mt-2">Projeto: {orcamento.projeto_nome}</p>
            )}
          </div>

          {/* TABELA */}
          <div className="break-inside-avoid border border-ink-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-ink-900 bg-ink-50">
                  <th className="py-3 px-5 text-left font-mono text-[9px] uppercase tracking-[0.3em] text-ink-500 font-medium">Descrição</th>
                  <th className="py-3 px-4 text-right font-mono text-[9px] uppercase tracking-[0.3em] text-ink-500 font-medium w-20">Qtd</th>
                  <th className="py-3 px-3 text-left font-mono text-[9px] uppercase tracking-[0.3em] text-ink-500 font-medium w-12">Un</th>
                  <th className="py-3 px-4 text-right font-mono text-[9px] uppercase tracking-[0.3em] text-ink-500 font-medium w-28">Unitário</th>
                  <th className="py-3 px-5 text-right font-mono text-[9px] uppercase tracking-[0.3em] text-ink-500 font-medium w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {orcamento.itens.map((it, i) => (
                  <tr key={i} className={`break-inside-avoid border-b border-ink-100 ${i % 2 === 1 ? 'bg-cream-50/50' : ''}`}>
                    <td className="py-3 px-5 text-sm text-ink-800">{it.descricao}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-ink-500 tabular-nums">{it.quantidade}</td>
                    <td className="py-3 px-3 font-mono text-xs text-ink-400">{it.unidade}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-ink-600 tabular-nums">{brl(it.valor_unitario)}</td>
                    <td className="py-3 px-5 text-right font-mono text-sm font-semibold text-ink-900 tabular-nums">{brl(it.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="break-inside-avoid">
                {orcamento.desconto_percentual > 0 && (
                  <>
                    <tr>
                      <td colSpan={4} className="py-2 px-5 text-right text-xs text-ink-400">Subtotal</td>
                      <td className="py-2 px-5 text-right font-mono text-sm text-ink-500 tabular-nums">{brl(orcamento.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="py-1.5 px-5 text-right text-xs text-terra-500">Desconto ({orcamento.desconto_percentual}%)</td>
                      <td className="py-1.5 px-5 text-right font-mono text-sm text-terra-500 tabular-nums">− {brl(orcamento.desconto_valor)}</td>
                    </tr>
                  </>
                )}
                <tr className="border-t-2 border-ink-900">
                  <td colSpan={4} className="py-4 px-5 text-right font-mono text-[9px] uppercase tracking-[0.35em] text-ink-500 font-medium">Total</td>
                  <td className="py-4 px-5 text-right font-mono text-2xl font-black text-ink-900 tabular-nums">{brl(orcamento.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* PAGAMENTO + ENTREGA */}
          {(orcamento.forma_pagamento || orcamento.prazo_execucao) && (
            <div className={`break-inside-avoid grid gap-6 ${orcamento.forma_pagamento && orcamento.prazo_execucao ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {orcamento.forma_pagamento && (
                <div className="pl-5 border-l-[3px] border-moss-500">
                  <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-moss-600 mb-2">Condições de pagamento</p>
                  <ul className="space-y-1.5">
                    {orcamento.forma_pagamento.split('\n').filter(Boolean).map((l, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-ink-700">
                        <span className="mt-2 w-1 h-1 rounded-full bg-moss-500 shrink-0" />
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {orcamento.prazo_execucao && (
                <div className="pl-5 border-l-[3px] border-moss-500">
                  <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-moss-600 mb-2">Forma de entrega</p>
                  <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">{orcamento.prazo_execucao}</p>
                </div>
              )}
            </div>
          )}

          {/* PROJETOS NECESSÁRIOS */}
          {projetosNecessarios.length > 0 && (
            <div className="break-inside-avoid pl-5 border-l-[3px] border-ink-300">
              <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-ink-400 mb-3">Projetos necessários para execução</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                {projetosNecessarios.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-ink-700">
                    <span className="w-1 h-1 rounded-full bg-ink-300 shrink-0" />
                    {p}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OBSERVAÇÕES */}
          {orcamento.observacoes && (
            <div className="break-inside-avoid pl-5 border-l-[3px] border-ink-200 py-3 pr-4 bg-cream-50/40 rounded-r">
              <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-ink-400 mb-2">Observações</p>
              <p className="text-sm text-ink-600 leading-relaxed whitespace-pre-line">{orcamento.observacoes}</p>
            </div>
          )}

          {/* RODAPÉ pág. 1 — oculto na impressão (pág. 3 já tem o rodapé) */}
          <div className="pt-5 border-t border-ink-200 flex items-center justify-between print:hidden">
            <p className="font-mono text-[9px] text-ink-300 uppercase tracking-[0.2em]">
              {[config.empresa_nome || 'DNL Projetos', config.empresa_cnpj ? `CNPJ ${config.empresa_cnpj}` : ''].filter(Boolean).join(' — ')}
            </p>
            <p className="font-mono text-[9px] text-ink-300">
              {[config.empresa_email, config.empresa_telefone, config.empresa_site].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {/* ══ O QUE ESTÁ INCLUSO — página 2 ══ */}
        {orcamento.incluso && (() => {
          try {
            const secoes = JSON.parse(orcamento.incluso) as SecaoIncluso[]
            if (!secoes.length) return null
            return (
              <div className="print:break-before-page border-t border-ink-100 print:border-t-0">
                {/* Cabeçalho pág. 2 */}
                <div className="px-12 pt-10 pb-6">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-ink-400 mb-3">
                        {config.empresa_nome || 'DNL Projetos'} · {orcamento.numero}
                      </p>
                      <h2 className="font-display text-4xl font-black text-ink-900 leading-none">O QUE ESTÁ</h2>
                      <h3 className="font-display text-3xl font-extralight text-terra-500 leading-none tracking-[0.1em] mt-1">INCLUSO</h3>
                    </div>
                    <img src={logoUrl} alt="DNL" className="w-[13.5rem] object-contain object-right opacity-80" />
                  </div>
                  <div className="mt-6 border-t-4 border-ink-900" />
                  <div className="border-t border-ink-200 mt-0.5" />
                </div>

                {/* Cards */}
                <div className="px-12 pb-12">
                  <div className="grid grid-cols-2 gap-5">
                    {secoes.map((s, i) => (
                      <div key={i} className={`break-inside-avoid rounded-xl overflow-hidden border-t-4 border border-ink-200/80 shadow-sm ${corCardForTitulo(s.titulo)}`}>
                        <div className="px-5 py-4 border-b border-ink-100 flex items-center gap-3 bg-cream-50/50">
                          {iconForDisciplina(s.titulo)}
                          <span className="font-mono text-[10px] font-bold text-ink-900 uppercase tracking-[0.18em]">{s.titulo}</span>
                        </div>
                        <ul className="bg-white px-5 py-4 space-y-2.5">
                          {s.itens.filter(Boolean).map((it, j) => (
                            <li key={j} className="flex items-start gap-3 text-sm text-ink-700">
                              <span className="mt-0.5 text-moss-500 font-bold shrink-0 text-base leading-none">✓</span>
                              {it}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {/* Rodapé pág. 2 */}
                  <div className="mt-8 pt-5 border-t border-ink-200 flex items-center justify-between">
                    <p className="font-mono text-[9px] text-ink-300 uppercase tracking-[0.2em]">
                      {[config.empresa_nome || 'DNL Projetos', config.empresa_cnpj ? `CNPJ ${config.empresa_cnpj}` : ''].filter(Boolean).join(' — ')}
                    </p>
                    <p className="font-mono text-[9px] text-ink-300">
                      {[config.empresa_email, config.empresa_telefone].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              </div>
            )
          } catch { return null }
        })()}
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function ModalOrcamento({ orcamento, onFechar, onSalvo }: {
  orcamento?: Orcamento
  onFechar: () => void
  onSalvo: () => void
}) {
  // Campos principais
  const [titulo, setTitulo] = useState(orcamento?.titulo || '')
  const [descricao, setDescricao] = useState(orcamento?.descricao || '')
  const [clienteId, setClienteId] = useState<number | ''>(orcamento?.cliente_id || '')
  const [projetoId, setProjetoId] = useState<number | ''>(orcamento?.projeto_id || '')
  const [status, setStatus] = useState<StatusOrcamento>(orcamento?.status || 'rascunho')
  const [dataEmissao, setDataEmissao] = useState(orcamento?.data_emissao || new Date().toISOString().slice(0, 10))
  const [validade, setValidade] = useState(orcamento?.validade_dias?.toString() || '15')
  const [desconto, setDesconto] = useState(orcamento?.desconto_percentual?.toString() || '0')
  const [formaPagto, setFormaPagto] = useState(orcamento?.forma_pagamento || '')
  const [prazoExec, setPrazoExec] = useState(orcamento?.prazo_execucao || '')
  const [obs, setObs] = useState(orcamento?.observacoes || '')
  const [itens, setItens] = useState<ItemOrcamento[]>(orcamento?.itens || [itemVazio()])

  // Carregados
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])

  // Form state
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Cliente
  const [modoCliente, setModoCliente] = useState<'existente' | 'rapido'>('existente')
  const [rapidoNome, setRapidoNome] = useState('')
  const [rapidoEmail, setRapidoEmail] = useState('')
  const [rapidoTelefone, setRapidoTelefone] = useState('')
  const [rapidoCpfCnpj, setRapidoCpfCnpj] = useState('')

  // Projeto
  const [modoProjeto, setModoProjeto] = useState<'nenhum' | 'existente' | 'rapido'>('nenhum')
  const [rapidoProjetoNome, setRapidoProjetoNome] = useState('')

  // Template
  const [template, setTemplate] = useState<TemplateProposta>('livre')
  const [tipoEdif, setTipoEdif] = useState<TipoEdificacao>('casa')
  const [areaMq, setAreaMq] = useState('')
  const [discEletrico, setDiscEletrico] = useState(true)
  const [discSpda, setDiscSpda] = useState(true)
  const [discHidro, setDiscHidro] = useState(true)
  const [discGas, setDiscGas] = useState(true)

  // Projetos necessários
  const [projetosNecessarios, setProjetosNecessarios] = useState<string[]>(() => {
    try { return orcamento?.projetos_necessarios ? JSON.parse(orcamento.projetos_necessarios) : [] }
    catch { return [] }
  })

  // Pagamento — calculadora de parcelas
  const [numParcelas, setNumParcelas] = useState(1)
  const [entradaPct, setEntradaPct] = useState(0)
  const [metodosPagamento, setMetodosPagamento] = useState<string[]>([])
  const [mostrarCalcPagto, setMostrarCalcPagto] = useState(false)

  // Escopos prontos
  const [mostrarEscopos, setMostrarEscopos] = useState(false)

  // O que está incluso — por disciplina
  const [inclusosSecoes, setInclusosSecoes] = useState<SecaoIncluso[]>(() => {
    try { return orcamento?.incluso ? JSON.parse(orcamento.incluso) : [] }
    catch { return [] }
  })

  const ehEdicao = !!orcamento

  useEffect(() => {
    Promise.all([api.clientes.listar(), api.projetos.listar()]).then(([cs, ps]) => {
      setClientes(cs); setProjetos(ps)
    })
  }, [])

  // ── Calculadora de totais ─────────────────────────────────────────────────

  const subtotal = itens.reduce((acc, i) => acc + i.quantidade * i.valor_unitario, 0)
  const descontoValor = subtotal * ((parseFloat(desconto) || 0) / 100)
  const total = subtotal - descontoValor

  // ── Preview de pagamento ──────────────────────────────────────────────────

  function gerarTextoPagamento(): string {
    if (total <= 0) return ''
    const linhas: string[] = []
    const entrada = total * entradaPct / 100
    const restante = total - entrada

    if (entradaPct > 0 && numParcelas > 1) {
      linhas.push(`Entrada: ${brl(entrada)} (${entradaPct}%) + ${numParcelas}× de ${brl(restante / numParcelas)}`)
    } else if (entradaPct > 0 && numParcelas <= 1) {
      linhas.push(`Entrada: ${brl(entrada)} (${entradaPct}%) + ${brl(restante)} na entrega`)
    } else if (numParcelas > 1) {
      linhas.push(`${numParcelas}× de ${brl(total / numParcelas)}`)
    } else {
      linhas.push('Pagamento à vista')
    }

    if (metodosPagamento.length > 0) {
      const nomes = metodosPagamento.map(id => METODOS_PAGAMENTO.find(m => m.id === id)?.label || id)
      linhas.push(`Formas aceitas: ${nomes.join(', ')}`)
    }
    return linhas.join('\n')
  }

  function aplicarPagamento() {
    setFormaPagto(gerarTextoPagamento())
    setMostrarCalcPagto(false)
  }

  function toggleMetodo(id: string) {
    setMetodosPagamento(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // ── Template ──────────────────────────────────────────────────────────────

  function aplicarTemplate() {
    if (template === 'livre') return

    if (template === 'complementares') {
      const area = parseFloat(areaMq.replace(',', '.')) || 0
      if (!area) { setErro('Informe a área em m²'); return }
      const tp = tipoEdif
      const tipoLabel = tp === 'casa' ? 'Casa' : tp === 'predio' ? 'Prédio' : 'Comércio'
      const areaFmt = area.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
      const novos: ItemOrcamento[] = []
      let ordem = 0
      if (discEletrico) {
        const vu = TABELA_M2.eletrico[tp]
        novos.push({ ordem: ordem++, descricao: `Projeto Elétrico, Lógico — ${areaFmt} m² (${tipoLabel})`, quantidade: area, unidade: 'm²', valor_unitario: vu, valor_total: area * vu })
      }
      if (discSpda) {
        const vu = TABELA_M2.spda[tp]
        novos.push({ ordem: ordem++, descricao: `SPDA — ${areaFmt} m² (${tipoLabel})`, quantidade: area, unidade: 'm²', valor_unitario: vu, valor_total: area * vu })
      }
      if (discHidro) {
        const vu = TABELA_M2.hidro[tp]
        novos.push({ ordem: ordem++, descricao: `Projeto Hidrossanitário — ${areaFmt} m² (${tipoLabel})`, quantidade: area, unidade: 'm²', valor_unitario: vu, valor_total: area * vu })
      }
      if (discGas) {
        const vu = TABELA_M2.gas[tp]
        novos.push({ ordem: ordem++, descricao: `Projeto de Gás — ${areaFmt} m² (${tipoLabel})`, quantidade: area, unidade: 'm²', valor_unitario: vu, valor_total: area * vu })
      }
      if (novos.length === 0) { setErro('Selecione ao menos uma disciplina'); return }
      setItens(novos)
      if (!titulo) setTitulo(`Projetos complementares — Aprox. ${areaFmt} m² (${tipoLabel})`)
      if (!prazoExec) setPrazoExec('Todas as pranchas executivas serão entregues em PDF e formato editável (.dwg)')
      if (inclusosSecoes.length === 0) {
        const secoes: SecaoIncluso[] = []
        if (discEletrico) secoes.push(INCLUSOS_DISC.eletrico)
        if (discSpda) secoes.push(INCLUSOS_DISC.spda)
        if (discHidro) secoes.push(INCLUSOS_DISC.hidro)
        if (discGas) secoes.push(INCLUSOS_DISC.gas)
        setInclusosSecoes(secoes)
      }
    } else {
      const MAP: Record<string, { desc: string; vu: number; pagto: string; entrega: string; tituloDefault: string }> = {
        usucapiao: {
          tituloDefault: 'Elaboração de Ação de Usucapião',
          desc: 'Elaboração de ação de Usucapião — levantamento documental, planta e memorial descritivo, ART',
          vu: 3000, pagto: '50% no início + 50% na entrega',
          entrega: 'Documentação entregue em PDF e formato editável'
        },
        manual: {
          tituloDefault: 'Manual do Proprietário',
          desc: 'Elaboração de Manual do Proprietário — documentação técnica, memoriais descritivos, instruções de uso e manutenção',
          vu: 3500, pagto: '50% no início + 50% na entrega',
          entrega: 'Manual entregue em PDF'
        },
        laudo_viz: {
          tituloDefault: 'Laudo de Vizinhança',
          desc: 'Laudo de Vizinhança — vistoria técnica, registro fotográfico, memorial descritivo e ART',
          vu: 2500, pagto: '100% no ato da contratação',
          entrega: 'Laudo entregue em PDF com ART'
        },
        laudo_apt: {
          tituloDefault: 'Laudo de Vistoria de Entrega de Apartamento',
          desc: 'Laudo de vistoria de entrega de apartamento — inspeção técnica, registro fotográfico e relatório',
          vu: 1100, pagto: '100% no ato da contratação',
          entrega: 'Relatório entregue em PDF'
        },
      }
      const t = MAP[template]
      if (t) {
        setItens([{ ordem: 0, descricao: t.desc, quantidade: 1, unidade: 'serv', valor_unitario: t.vu, valor_total: t.vu }])
        if (!titulo) setTitulo(t.tituloDefault)
        if (!formaPagto) setFormaPagto(t.pagto)
        if (!prazoExec) setPrazoExec(t.entrega)
        if (inclusosSecoes.length === 0 && INCLUSOS_TEMPLATE[template])
          setInclusosSecoes(INCLUSOS_TEMPLATE[template])
      }
    }
    setErro('')
  }

  // ── Itens ─────────────────────────────────────────────────────────────────

  function adicionarItem() {
    setItens([...itens, { ordem: itens.length, descricao: '', quantidade: 1, unidade: 'serv', valor_unitario: 0, valor_total: 0 }])
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

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (modoCliente === 'rapido' && !rapidoNome.trim()) return setErro('Nome do cliente é obrigatório')
    if (modoCliente === 'existente' && !clienteId) return setErro('Selecione um cliente')
    if (itens.length === 0 || itens.every(i => !i.descricao.trim())) return setErro('Adicione ao menos 1 item')

    setErro('')
    setSalvando(true)
    try {
      let cId: number = Number(clienteId)
      if (modoCliente === 'rapido') {
        const rawDoc = rapidoCpfCnpj.replace(/\D/g, '')
        const nc = await api.clientes.criar({
          nome: rapidoNome.trim(), tipo_pessoa: rawDoc.length > 11 ? 'juridica' : 'fisica',
          email: rapidoEmail || undefined, telefone: rapidoTelefone || undefined,
          cpf: rawDoc.length <= 11 && rawDoc ? rawDoc : undefined,
          cnpj: rawDoc.length > 11 ? rawDoc : undefined
        })
        cId = nc.id
      }

      let pId: number | undefined = projetoId ? Number(projetoId) : undefined
      if (modoProjeto === 'rapido' && rapidoProjetoNome.trim()) {
        const np = await api.projetos.criar({ cliente_id: cId, nome: rapidoProjetoNome.trim() })
        pId = np.id
      }

      const dados: OrcamentoCreateInput = {
        cliente_id: cId, projeto_id: pId,
        titulo, descricao: descricao || undefined, status,
        data_emissao: dataEmissao,
        validade_dias: parseInt(validade) || 15,
        desconto_percentual: parseFloat(desconto) || 0,
        forma_pagamento: formaPagto || undefined,
        prazo_execucao: prazoExec || undefined,
        observacoes: obs || undefined,
        projetos_necessarios: projetosNecessarios.length > 0 ? JSON.stringify(projetosNecessarios) : undefined,
        incluso: inclusosSecoes.length > 0 ? JSON.stringify(inclusosSecoes) : undefined,
        itens: itens.filter(i => i.descricao.trim()).map((i, idx) => ({
          ordem: idx, descricao: i.descricao, quantidade: i.quantidade,
          unidade: i.unidade, valor_unitario: i.valor_unitario
        }))
      }

      if (ehEdicao) await api.orcamentos.atualizar(orcamento.id, dados)
      else await api.orcamentos.criar(dados)
      onSalvo()
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-4xl max-h-[90vh] overflow-auto fade-in">

        {/* Header modal */}
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              {ehEdicao ? `Editar ${orcamento.numero}` : 'Novo'}
            </p>
            <h2 className="font-display text-3xl text-ink-900">Orçamento</h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-6">

          {/* ── TEMPLATE ── */}
          {!ehEdicao && (
            <div className="bg-cream-100 border border-ink-300/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={13} className="text-terra-500" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-600">Modelo de proposta</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(Object.keys(TEMPLATE_LABEL) as TemplateProposta[]).map(t => (
                  <button key={t} type="button" onClick={() => setTemplate(t)}
                    className={`text-[10px] font-mono px-2.5 py-1.5 rounded border uppercase tracking-wide transition ${template === t ? 'bg-ink-900 text-cream-50 border-ink-900' : 'bg-cream-50 text-ink-600 border-ink-300 hover:border-ink-600'}`}>
                    {TEMPLATE_LABEL[t]}
                  </button>
                ))}
              </div>

              {template === 'complementares' && (
                <div className="space-y-3 pt-3 border-t border-ink-300/30">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-[10px]">Tipo de edificação</label>
                      <div className="flex gap-1">
                        {(['casa', 'predio', 'comercio'] as TipoEdificacao[]).map(t => (
                          <button key={t} type="button" onClick={() => setTipoEdif(t)}
                            className={`flex-1 text-[10px] font-mono py-1.5 rounded border uppercase tracking-wide transition ${tipoEdif === t ? 'bg-ink-800 text-cream-50 border-ink-800' : 'bg-cream-50 text-ink-500 border-ink-300 hover:border-ink-500'}`}>
                            {t === 'predio' ? 'Prédio' : t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="label text-[10px]">Área total (m²)</label>
                      <input className="input-field font-mono" placeholder="Ex: 200" value={areaMq}
                        onChange={e => setAreaMq(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="label text-[10px]">Disciplinas</label>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { key: 'eletrico' as const, label: 'Elétrico, Lógico', val: discEletrico, set: setDiscEletrico },
                        { key: 'spda' as const, label: 'SPDA', val: discSpda, set: setDiscSpda },
                        { key: 'hidro' as const, label: 'Hidrossanitário', val: discHidro, set: setDiscHidro },
                        { key: 'gas' as const, label: 'Gás', val: discGas, set: setDiscGas },
                      ].map(d => {
                        const area = parseFloat(areaMq.replace(',', '.')) || 0
                        const valor = area > 0 ? TABELA_M2[d.key][tipoEdif] * area : null
                        return (
                          <label key={d.key} className="flex items-center gap-1.5 text-xs text-ink-700 cursor-pointer">
                            <input type="checkbox" checked={d.val} onChange={e => d.set(e.target.checked)} className="accent-ink-900" />
                            {d.label}
                            {valor !== null && (
                              <span className="font-mono text-moss-600 font-medium">{brl(valor)}</span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <button type="button" onClick={aplicarTemplate} className="btn-primary text-xs py-1.5">
                    <Zap size={11} /> Preencher itens automaticamente
                  </button>
                </div>
              )}

              {template !== 'livre' && template !== 'complementares' && (
                <div className="pt-3 border-t border-ink-300/30 flex items-center justify-between">
                  <p className="text-xs text-ink-500">
                    {template === 'usucapiao' && 'Valor padrão: R$ 3.000'}
                    {template === 'manual' && 'Valor padrão: R$ 3.500'}
                    {template === 'laudo_viz' && 'Valor padrão: R$ 2.500'}
                    {template === 'laudo_apt' && 'Valor padrão: R$ 1.100'}
                    {' '}— editável nos itens
                  </p>
                  <button type="button" onClick={aplicarTemplate} className="btn-secondary text-xs py-1.5">
                    <Zap size={11} /> Aplicar modelo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── CLIENTE ── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0">Cliente *</label>
              {!ehEdicao && (
                <div className="flex gap-1">
                  <button type="button" onClick={() => setModoCliente('existente')}
                    className={`text-[10px] font-mono px-2.5 py-1 rounded border uppercase tracking-wide flex items-center gap-1 transition ${modoCliente === 'existente' ? 'bg-ink-800 text-cream-50 border-ink-800' : 'bg-cream-100 text-ink-500 border-ink-300 hover:border-ink-500'}`}>
                    <Users size={10} /> Existente
                  </button>
                  <button type="button" onClick={() => setModoCliente('rapido')}
                    className={`text-[10px] font-mono px-2.5 py-1 rounded border uppercase tracking-wide flex items-center gap-1 transition ${modoCliente === 'rapido' ? 'bg-ink-800 text-cream-50 border-ink-800' : 'bg-cream-100 text-ink-500 border-ink-300 hover:border-ink-500'}`}>
                    <UserPlus size={10} /> Cadastro rápido
                  </button>
                </div>
              )}
            </div>
            {modoCliente === 'existente' || ehEdicao ? (
              <select className="input-field" value={clienteId} onChange={e => setClienteId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Selecione...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><input className="input-field" placeholder="Nome completo *" value={rapidoNome} onChange={e => setRapidoNome(e.target.value)} /></div>
                <div><input className="input-field font-mono" placeholder="CPF / CNPJ" value={rapidoCpfCnpj} onChange={e => setRapidoCpfCnpj(e.target.value)} /></div>
                <div><input className="input-field" placeholder="Telefone" value={rapidoTelefone} onChange={e => setRapidoTelefone(e.target.value)} /></div>
                <div className="col-span-2"><input type="email" className="input-field" placeholder="E-mail" value={rapidoEmail} onChange={e => setRapidoEmail(e.target.value)} /></div>
              </div>
            )}
          </div>

          {/* ── PROJETO ── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0">Projeto vinculado</label>
              {!ehEdicao && (
                <div className="flex gap-1">
                  {(['nenhum', 'existente', 'rapido'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setModoProjeto(m)}
                      className={`text-[10px] font-mono px-2.5 py-1 rounded border uppercase tracking-wide flex items-center gap-1 transition ${modoProjeto === m ? 'bg-ink-800 text-cream-50 border-ink-800' : 'bg-cream-100 text-ink-500 border-ink-300 hover:border-ink-500'}`}>
                      {m === 'nenhum' ? 'Nenhum' : m === 'existente' ? 'Existente' : <><Plus size={10} /> Novo</>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {modoProjeto === 'existente' || ehEdicao ? (
              <select className="input-field" value={projetoId} onChange={e => setProjetoId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">— Nenhum —</option>
                {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            ) : modoProjeto === 'rapido' ? (
              <input className="input-field" placeholder="Nome do projeto *" value={rapidoProjetoNome} onChange={e => setRapidoProjetoNome(e.target.value)} />
            ) : null}
          </div>

          {/* ── TÍTULO ── */}
          <div>
            <label className="label">Título / escopo *</label>
            <input className="input-field" value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Projetos complementares — residência aprox. 200m²" required />
          </div>

          {/* ── DESCRIÇÃO + escopos prontos ── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0">Descrição adicional</label>
              <button type="button" onClick={() => setMostrarEscopos(v => !v)}
                className="text-[10px] font-mono px-2 py-1 rounded border text-ink-500 border-ink-300 hover:border-ink-600 flex items-center gap-1">
                Escopos prontos {mostrarEscopos ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            </div>
            {mostrarEscopos && (
              <div className="mb-2 p-3 bg-cream-100 rounded border border-ink-300/30 grid grid-cols-1 gap-1">
                {ESCOPOS_PRONTOS.map(e => (
                  <button key={e} type="button" onClick={() => {
                    setDescricao(prev => prev ? prev + '\n' + e : e)
                    setMostrarEscopos(false)
                  }} className="text-left text-xs text-ink-700 hover:text-ink-900 hover:bg-cream-200 px-2 py-1 rounded transition">
                    + {e}
                  </button>
                ))}
              </div>
            )}
            <textarea className="input-field min-h-[80px]" rows={3} value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Clique em + Escopos prontos para adicionar ou escreva livremente" />
          </div>

          {/* ── STATUS / DATA / VALIDADE / DESCONTO ── */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="input-field" value={status} onChange={e => setStatus(e.target.value as StatusOrcamento)}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Data emissão</label>
              <input type="date" className="input-field" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} />
            </div>
            <div>
              <label className="label">Validade (dias)</label>
              <input type="number" className="input-field font-mono" value={validade} onChange={e => setValidade(e.target.value)} min="1" />
            </div>
            <div>
              <label className="label">Desconto (%)</label>
              <input type="number" step="0.01" className="input-field font-mono" value={desconto} onChange={e => setDesconto(e.target.value)} min="0" max="100" />
            </div>
          </div>

          {/* ── ITENS ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label !mb-0">Itens *</label>
              <button type="button" onClick={adicionarItem} className="text-xs text-terra-500 hover:text-terra-600 flex items-center gap-1">
                <Plus size={11} /> adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <input className="input-field" placeholder="Descrição" value={it.descricao} onChange={e => atualizarItem(idx, 'descricao', e.target.value)} />
                  </div>
                  <div className="col-span-1">
                    <input type="number" step="0.01" className="input-field font-mono" placeholder="Qtd" value={it.quantidade} onChange={e => atualizarItem(idx, 'quantidade', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-1">
                    <input className="input-field font-mono" placeholder="un" value={it.unidade} onChange={e => atualizarItem(idx, 'unidade', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" step="0.01" className="input-field font-mono" placeholder="Valor un." value={it.valor_unitario} onChange={e => atualizarItem(idx, 'valor_unitario', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-2">
                    <input readOnly className="input-field font-mono bg-cream-200" value={brl(it.quantidade * it.valor_unitario)} />
                  </div>
                  <div className="col-span-1">
                    <button type="button" onClick={() => removerItem(idx)} className="text-ink-500 hover:text-terra-500 p-2"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-ink-300/30 space-y-1 text-right">
              <p className="text-sm text-ink-600">Subtotal: <span className="font-mono ml-2">{brl(subtotal)}</span></p>
              {descontoValor > 0 && <p className="text-sm text-terra-500">Desconto: <span className="font-mono ml-2">− {brl(descontoValor)}</span></p>}
              <p className="font-display text-2xl text-ink-900">Total: <span className="font-mono tabular-nums ml-2">{brl(total)}</span></p>
            </div>
          </div>

          {/* ── PAGAMENTO ── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0">Condições de pagamento</label>
              <button type="button" onClick={() => setMostrarCalcPagto(v => !v)}
                className="text-[10px] font-mono px-2 py-1 rounded border text-ink-500 border-ink-300 hover:border-ink-600 flex items-center gap-1">
                Calculadora {mostrarCalcPagto ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            </div>

            {mostrarCalcPagto && (
              <div className="mb-3 p-4 bg-cream-100 border border-ink-300/40 rounded-lg space-y-3">
                {/* Formas de pagamento */}
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-ink-500 mb-1.5">Formas aceitas</p>
                  <div className="flex flex-wrap gap-2">
                    {METODOS_PAGAMENTO.map(m => {
                      const ativo = metodosPagamento.includes(m.id)
                      return (
                        <button key={m.id} type="button" onClick={() => toggleMetodo(m.id)}
                          className={`text-xs px-3 py-1.5 rounded border flex items-center gap-1.5 transition ${ativo ? 'bg-ink-900 text-cream-50 border-ink-900' : 'bg-cream-50 text-ink-600 border-ink-300 hover:border-ink-600'}`}>
                          <m.icon size={11} /> {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Parcelas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-ink-500 mb-1.5">Entrada (%)</p>
                    <div className="flex gap-1 flex-wrap">
                      {[0, 30, 50, 70, 100].map(p => (
                        <button key={p} type="button" onClick={() => setEntradaPct(p)}
                          className={`text-[10px] font-mono px-2 py-1 rounded border transition ${entradaPct === p ? 'bg-ink-800 text-cream-50 border-ink-800' : 'bg-cream-50 text-ink-500 border-ink-300 hover:border-ink-500'}`}>
                          {p === 0 ? 'Sem' : `${p}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-ink-500 mb-1.5">Parcelas (restante)</p>
                    <div className="flex gap-1 flex-wrap">
                      {[1, 2, 3, 4, 6, 10, 12].map(n => (
                        <button key={n} type="button" onClick={() => setNumParcelas(n)}
                          className={`text-[10px] font-mono px-2 py-1 rounded border transition ${numParcelas === n ? 'bg-ink-800 text-cream-50 border-ink-800' : 'bg-cream-50 text-ink-500 border-ink-300 hover:border-ink-500'}`}>
                          {n === 1 ? 'À vista' : `${n}×`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview */}
                {total > 0 && (
                  <div className="p-3 bg-white rounded border border-ink-300/40">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-ink-400 mb-1">Preview</p>
                    <pre className="text-sm text-ink-900 font-sans whitespace-pre-wrap">{gerarTextoPagamento()}</pre>
                    {entradaPct > 0 && numParcelas > 1 && (
                      <p className="text-xs text-ink-400 mt-1">
                        Entrada: {brl(total * entradaPct / 100)} · Restante: {brl(total * (1 - entradaPct / 100))} ÷ {numParcelas} = {brl(total * (1 - entradaPct / 100) / numParcelas)}/parcela
                      </p>
                    )}
                  </div>
                )}

                <button type="button" onClick={aplicarPagamento} className="btn-primary text-xs py-1.5">
                  Usar esta condição
                </button>
              </div>
            )}

            <textarea className="input-field min-h-[60px]" rows={2} value={formaPagto} onChange={e => setFormaPagto(e.target.value)}
              placeholder="Ex: Entrada 50% + 50% na entrega" />
          </div>

          {/* ── ENTREGA ── */}
          <div>
            <label className="label">Forma de entrega</label>
            <textarea className="input-field min-h-[60px]" rows={2} value={prazoExec} onChange={e => setPrazoExec(e.target.value)}
              placeholder="Ex: Todas as pranchas em PDF e .dwg editável" />
          </div>

          {/* ── PROJETOS NECESSÁRIOS ── */}
          <div>
            <label className="label">Projetos necessários (para execução da obra)</label>
            <div className="grid grid-cols-2 gap-1.5 p-3 bg-cream-100 rounded-md border border-ink-300/30">
              {PROJETOS_LISTA.map(p => (
                <label key={p} className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
                  <input type="checkbox" checked={projetosNecessarios.includes(p)}
                    onChange={e => {
                      if (e.target.checked) setProjetosNecessarios(prev => [...prev, p])
                      else setProjetosNecessarios(prev => prev.filter(x => x !== p))
                    }} className="accent-ink-900" />
                  {p}
                </label>
              ))}
            </div>
          </div>

          {/* ── O QUE ESTÁ INCLUSO ── */}
          <div>
            <label className="label">O que está incluso — por disciplina</label>
            {inclusosSecoes.length === 0 ? (
              <p className="text-xs text-ink-400 italic py-1">Preenchido automaticamente ao aplicar o modelo</p>
            ) : (
              <div className="space-y-2">
                {inclusosSecoes.map((secao, i) => (
                  <div key={i} className="border border-ink-300/40 rounded-lg overflow-hidden">
                    <div className="bg-ink-800 px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {iconForDisciplina(secao.titulo)}
                        <span className="text-xs font-semibold text-cream-50">{secao.titulo}</span>
                      </div>
                      <button type="button"
                        onClick={() => setInclusosSecoes(prev => prev.filter((_, j) => j !== i))}
                        className="text-cream-400 hover:text-red-300 transition">
                        <X size={12} />
                      </button>
                    </div>
                    <textarea
                      className="w-full px-3 py-2 text-xs font-mono bg-cream-50 border-0 outline-none resize-none min-h-[72px] text-ink-700"
                      value={secao.itens.join('\n')}
                      onChange={e => {
                        const novas = [...inclusosSecoes]
                        novas[i] = { ...novas[i], itens: e.target.value.split('\n') }
                        setInclusosSecoes(novas)
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-ink-400 mt-1">Aparece na proposta como cards por disciplina com ✓</p>
          </div>

          {/* ── OBSERVAÇÕES ── */}
          <div>
            <label className="label">Observações</label>
            <textarea className="input-field min-h-[60px]" rows={2} value={obs} onChange={e => setObs(e.target.value)} />
          </div>

          {/* ── ERRO ── */}
          {erro && (
            <div className="px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md">
              <p className="text-sm text-terra-700">{erro}</p>
            </div>
          )}

          {/* ── ACTIONS ── */}
          <div className="flex justify-end gap-3 pt-4 border-t border-ink-300/40">
            <button type="button" onClick={onFechar} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-primary">
              {salvando ? 'Salvando…' : ehEdicao ? 'Salvar alterações' : 'Criar orçamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
