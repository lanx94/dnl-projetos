import { useEffect, useState, FormEvent } from 'react'
import { Plus, X, Edit2, Trash2, Eye, ArrowLeft, Printer, RotateCcw, Sparkles, FileText, GripVertical } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type {
  Contrato, ContratoCreateInput, StatusContrato, TipoContrato,
  Cliente, Projeto, ClausulaContrato, ServicoContrato, ParcelaContrato
} from '@shared/types'
import {
  fmtMoneyBR, fmtMoney, fmtDataBR, numberToWords,
  calcularNumeros, substituirVars, agruparPorSecao,
  REGEX_TERMOS_PARTES, negritarTermosHtml
} from '../utils/contratos'
import { maskCpfCnpj } from '../utils/masks'
import logoDNL from '../assets/logo-dnl.png'

const FONTE_CONTRATO = "'Arial', 'Helvetica', sans-serif"

// Divide o texto e envolve CONTRATANTE/CONTRATADA/CONTRATADO/DNL PROJETOS em <strong>
function negritarTermos(texto: string): React.ReactNode[] {
  return texto.split(REGEX_TERMOS_PARTES).map((parte, i) =>
    /^(CONTRATANTES?|CONTRATADAS?|CONTRATADOS?|DNL PROJETOS)$/.test(parte)
      ? <strong key={i}>{parte}</strong>
      : parte
  )
}

function up(s?: string | null): string {
  return (s || '').toUpperCase()
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CONTRATADA_PADRAO =
  'DNL PROJETOS, pessoa jurídica de direito privado, inscrita no CNPJ nº 51.212.533/0001-78, ' +
  'com sede na Rua Das Margaridas dos Campos, 45, bairro: Jardim Camargo novo, Itaim paulista, SP, ' +
  'CEP:08141-710, celular: (11) 93210-5096, neste ato representado por seu sócio Lucas Cardoso da Silva, ' +
  'engenheiro civil, brasileiro, solteiro e inscrito no CREA-SP nº5070747868.'

function buildContratadaDefault(): string {
  return CONTRATADA_PADRAO
}

const TEXTO_CELEBRACAO =
  'Celebram o presente contrato de prestação de serviços, sem qualquer vínculo trabalhista ou ' +
  'societário, que se regerá pelas cláusulas seguintes e, no que for omisso, pela Lei: 10.406/2002 ' +
  '(Código Civil Brasileiro).'

const STATUS_LABEL: Record<StatusContrato, string> = {
  rascunho: 'Rascunho',
  aguardando_assinatura: 'Ag. Assinatura',
  ativo: 'Ativo',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

const STATUS_COR: Record<StatusContrato, string> = {
  rascunho: 'bg-cream-300 text-ink-700',
  aguardando_assinatura: 'bg-amber-100 text-amber-700',
  ativo: 'bg-moss-500/15 text-moss-600',
  concluido: 'bg-ink-900 text-cream-50',
  cancelado: 'bg-terra-100 text-terra-700',
}

const TIPO_LABEL: Record<TipoContrato, string> = {
  laudo_vizinhanca: 'Laudo de Vizinhança',
  eletrica: 'Projeto Elétrico',
  hidraulica: 'Projeto Hidráulico',
  gas: 'Projeto de Gás',
  eletrica_hidraulica_gas: 'Elétrico + Hidráulico + Gás',
  regularizacao: 'Regularização',
  manual_proprietario: 'Manual do Proprietário',
  manual_asbuilt: 'Manual + As-Built',
  laudo_entrega: 'Laudo de Entrega',
  laudo_apontamento: 'Laudo de Apontamento',
  usucapiao: 'Usucapião',
  generico: 'Genérico',
}

const OBJETO_DEFAULT: Partial<Record<TipoContrato, string>> = {
  laudo_vizinhanca: 'elaboração de Laudo de Vizinhança do imóvel localizado na ',
  eletrica: 'elaboração do Projeto Elétrico do imóvel localizado na ',
  hidraulica: 'elaboração do Projeto Hidráulico do imóvel localizado na ',
  gas: 'elaboração do Projeto de Gás do imóvel localizado na ',
  eletrica_hidraulica_gas: 'elaboração dos Projetos de Instalações Elétricas, Hidrossanitárias e de Gás do imóvel localizado na ',
  regularizacao: 'elaboração do Projeto de Regularização do imóvel localizado na ',
  manual_proprietario: 'elaboração do Manual do Proprietário do imóvel localizado na ',
  manual_asbuilt: 'elaboração do Manual do Proprietário e Levantamento As-Built in loco do imóvel localizado na ',
  laudo_entrega: 'elaboração de Laudo Técnico de Vistoria de Entrega do imóvel localizado na ',
  laudo_apontamento: 'elaboração de Laudo de Apontamento das Patologias apresentadas no imóvel localizado na ',
  usucapiao: 'prestação de serviços de engenharia para instrução de processo de Usucapião do imóvel localizado na ',
  generico: '',
}

const SERVICOS_DEFAULT: Partial<Record<TipoContrato, ServicoContrato[]>> = {
  laudo_vizinhanca: [{ ordem: 0, descricao: 'LAUDO DE VIZINHANÇA' }, { ordem: 1, descricao: 'REGISTRO FOTOGRÁFICO' }, { ordem: 2, descricao: 'ART/RRT' }],
  eletrica: [{ ordem: 0, descricao: 'PROJETO ELÉTRICO' }, { ordem: 1, descricao: 'ART/RRT' }],
  hidraulica: [{ ordem: 0, descricao: 'PROJETO HIDRÁULICO' }, { ordem: 1, descricao: 'ART/RRT' }],
  gas: [{ ordem: 0, descricao: 'PROJETO DE GÁS' }, { ordem: 1, descricao: 'ART/RRT' }],
  eletrica_hidraulica_gas: [{ ordem: 0, descricao: 'PROJETO ELÉTRICO' }, { ordem: 1, descricao: 'PROJETO HIDRÁULICO' }, { ordem: 2, descricao: 'PROJETO DE GÁS' }, { ordem: 3, descricao: 'ART/RRT' }],
  regularizacao: [{ ordem: 0, descricao: 'PROJETO DE REGULARIZAÇÃO' }, { ordem: 1, descricao: 'ART/RRT' }],
  manual_proprietario: [{ ordem: 0, descricao: 'MANUAL DO PROPRIETÁRIO' }, { ordem: 1, descricao: 'ART/RRT' }],
  manual_asbuilt: [{ ordem: 0, descricao: 'LEVANTAMENTO AS-BUILT IN LOCO' }, { ordem: 1, descricao: 'MANUAL DO PROPRIETÁRIO' }, { ordem: 2, descricao: 'ART/RRT' }],
  laudo_entrega: [{ ordem: 0, descricao: 'VISTORIA TÉCNICA' }, { ordem: 1, descricao: 'LAUDO DE ENTREGA' }, { ordem: 2, descricao: 'REGISTRO FOTOGRÁFICO' }, { ordem: 3, descricao: 'ART/RRT' }],
  laudo_apontamento: [{ ordem: 0, descricao: 'LAUDO DE APONTAMENTO' }, { ordem: 1, descricao: 'REGISTRO FOTOGRÁFICO' }, { ordem: 2, descricao: 'ART/RRT' }],
  usucapiao: [{ ordem: 0, descricao: 'MEMORIAL DESCRITIVO' }, { ordem: 1, descricao: 'PLANTA DE SITUAÇÃO E LOCAÇÃO' }, { ordem: 2, descricao: 'ART' }],
  generico: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tiposLabel(tipos?: TipoContrato[]): string {
  if (!tipos || tipos.length === 0) return '—'
  return tipos.map(t => TIPO_LABEL[t] ?? t).join(' + ')
}

function gerarObjetoCombinado(tipos: TipoContrato[]): string {
  if (tipos.length === 0) return ''
  if (tipos.length === 1) return OBJETO_DEFAULT[tipos[0]] ?? ''
  const sufixo = /\s*(do|da)\s+imóvel\s+(localizado|situado)\s+na\s*$|\s+no\s+imóvel\s+localizado\s+na\s*$/i
  const partes = tipos
    .map(t => (OBJETO_DEFAULT[t] ?? '').replace(sufixo, ''))
    .filter(Boolean)
  if (partes.length === 0) return ''
  const ultima = partes.pop()!
  return (partes.length > 0 ? partes.join(', ') + ' e ' + ultima : ultima) + ' do imóvel localizado na '
}

function gerarServicosCombinados(tipos: TipoContrato[]): ServicoContrato[] {
  const seen = new Set<string>()
  const result: ServicoContrato[] = []
  for (const t of tipos) {
    for (const s of SERVICOS_DEFAULT[t] ?? []) {
      if (seen.has(s.descricao)) continue
      seen.add(s.descricao)
      result.push({ ...s, ordem: result.length })
    }
  }
  return result
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [filtroStatus, setFiltroStatus] = useState<'' | StatusContrato>('')
  const [carregando, setCarregando] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Contrato | null>(null)
  const [vendoContrato, setVendoContrato] = useState<Contrato | null>(null)

  useEffect(() => { carregar() }, [filtroStatus])

  async function carregar() {
    setCarregando(true)
    try {
      const lista = await api.contratos.listar((filtroStatus as StatusContrato) || undefined)
      setContratos(lista)
    } finally {
      setCarregando(false)
    }
  }

  async function deletar(c: Contrato) {
    if (!confirm(`Excluir o contrato ${c.numero}? Esta ação não pode ser desfeita.`)) return
    const r = await api.contratos.deletar(c.id)
    if (r.success) {
      setVendoContrato(null)
      carregar()
    } else {
      alert(r.error ?? 'Erro ao excluir')
    }
  }

  if (vendoContrato) {
    return (
      <ContratoView
        contrato={vendoContrato}
        onVoltar={() => setVendoContrato(null)}
        onEditar={() => { setEditando(vendoContrato); setVendoContrato(null) }}
        onDeletar={() => deletar(vendoContrato)}
      />
    )
  }

  return (
    <>
      <PageHeader
        numero="A7"
        rotulo="Contratos"
        titulo="Contratos"
        descricao="Geração automatizada com cláusulas por tipo de serviço. Selecione um ou mais tipos e as cláusulas são mescladas automaticamente."
        acoes={
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={14} /> Novo contrato
          </button>
        }
      />

      <div className="card p-4 mb-6 fade-in flex items-center gap-4">
        <div>
          <label className="label mb-1">Filtrar por status</label>
          <select
            className="input-field w-auto"
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value as any)}
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {carregando ? (
        <div className="card p-12 text-center fade-in">
          <p className="text-ink-500 text-sm">Carregando contratos...</p>
        </div>
      ) : contratos.length === 0 ? (
        <div className="card p-12 text-center fade-in">
          <p className="font-display text-2xl text-ink-700 mb-2">Nenhum contrato</p>
          <p className="text-ink-500 text-sm">Crie o primeiro contrato clicando em "Novo contrato".</p>
        </div>
      ) : (
        <div className="card overflow-hidden fade-in">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-300/40 text-left">
                <Th>Número</Th>
                <Th>Tipo</Th>
                <Th>Cliente</Th>
                <Th>Status</Th>
                <Th align="right">Valor</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {contratos.map(c => (
                <tr key={c.id} className="border-b border-ink-300/20 hover:bg-cream-200/50">
                  <Td>
                    <button
                      onClick={() => setVendoContrato(c)}
                      className="font-mono text-xs font-medium text-terra-500 hover:text-terra-600"
                    >
                      {c.numero}
                    </button>
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-600">{tiposLabel(c.tipos_contrato)}</span>
                  </Td>
                  <Td>
                    <span className="text-sm text-ink-700">{c.cliente_nome}</span>
                  </Td>
                  <Td>
                    <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded ${STATUS_COR[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-sm font-medium tabular-nums">{fmtMoneyBR(c.valor)}</span>
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setVendoContrato(c)} className="p-1.5 text-ink-400 hover:text-ink-900" title="Visualizar"><Eye size={13} /></button>
                      <button onClick={() => setEditando(c)} className="p-1.5 text-ink-400 hover:text-ink-900" title="Editar"><Edit2 size={13} /></button>
                      <button onClick={() => deletar(c)} className="p-1.5 text-ink-400 hover:text-terra-500" title="Excluir"><Trash2 size={13} /></button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ModalContrato
          onFechar={() => setShowModal(false)}
          onSalvo={() => { setShowModal(false); carregar() }}
        />
      )}
      {editando && (
        <ModalContrato
          contrato={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); carregar() }}
        />
      )}
    </>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: string }) {
  return (
    <th className={`px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-ink-500 font-normal text-${align}`}>
      {children}
    </th>
  )
}
function Td({ children, align = 'left' }: { children: React.ReactNode; align?: string }) {
  return <td className={`px-5 py-3 text-${align}`}>{children}</td>
}

// ─── Visualização do contrato ─────────────────────────────────────────────────

function ContratoView({
  contrato, onVoltar, onEditar, onDeletar,
}: {
  contrato: Contrato
  onVoltar: () => void
  onEditar: () => void
  onDeletar: () => void
}) {
  const [config, setConfig] = useState<Record<string, string>>({})
  useEffect(() => { api.configuracoes.obter().then(setConfig).catch(() => {}) }, [])

  const tipos = contrato.tipos_contrato?.length
    ? contrato.tipos_contrato
    : [contrato.tipo_contrato]

  const ctx = {
    numeros: calcularNumeros(contrato.clausulas),
    contratante: {
      razao_social: contrato.cliente_nome,
      cnpj: contrato.cliente_cnpj,
      endereco: contrato.cliente_endereco,
      representante: contrato.cliente_representante,
      rg: contrato.cliente_rg,
      cpf: contrato.cliente_cpf,
    },
    objeto: {
      descricao: contrato.objeto,
      endereco_imovel: contrato.endereco_imovel,
      valor: contrato.valor,
      valor_extenso: contrato.valor_extenso,
      servicos: contrato.servicos,
    },
    pagamento: {
      parcelas: contrato.parcelas,
      multa: contrato.multa_percentual,
      juros: contrato.juros_diario,
    },
    cabecalho: { cidade: contrato.cidade },
  }

  const grupos = agruparPorSecao(contrato.clausulas.filter(c => c.incluida))

  async function gerarWord() {
    const numeros = calcularNumeros(contrato.clausulas)

    const contratadaText = negritarTermosHtml(contrato.contratada_qualificacao || buildContratadaDefault())

    let contratanteText = ''
    if (contrato.cliente_tipo_pessoa === 'juridica') {
      contratanteText = up(contrato.cliente_nome) || '—'
      if (contrato.cliente_cnpj) contratanteText += `, pessoa jurídica inscrita no CNPJ sob o nº ${maskCpfCnpj(contrato.cliente_cnpj)}`
      if (contrato.cliente_endereco) contratanteText += `, com sede em ${up(contrato.cliente_endereco)}`
      if (contrato.cliente_representante) {
        contratanteText += `, neste ato representada por ${up(contrato.cliente_representante)}`
        if (contrato.cliente_estado_civil) contratanteText += `, ${up(contrato.cliente_estado_civil)}`
        if (contrato.cliente_profissao) contratanteText += `, ${up(contrato.cliente_profissao)}`
        if (contrato.cliente_nacionalidade) contratanteText += `, ${up(contrato.cliente_nacionalidade)}`
        if (contrato.cliente_rg) contratanteText += `, portador(a) do RG nº ${contrato.cliente_rg}`
        if (contrato.cliente_cpf) contratanteText += `, inscrito(a) no CPF sob o nº ${maskCpfCnpj(contrato.cliente_cpf)}`
      }
    } else {
      contratanteText = up(contrato.cliente_nome) || '—'
      if (contrato.cliente_nacionalidade) contratanteText += `, ${up(contrato.cliente_nacionalidade)}`
      if (contrato.cliente_estado_civil) contratanteText += `, ${up(contrato.cliente_estado_civil)}`
      if (contrato.cliente_profissao) contratanteText += `, ${up(contrato.cliente_profissao)}`
      if (contrato.cliente_rg) contratanteText += `, portador(a) do RG nº ${contrato.cliente_rg}`
      if (contrato.cliente_cpf) contratanteText += `, inscrito(a) no CPF sob o nº ${maskCpfCnpj(contrato.cliente_cpf)}`
      if (contrato.cliente_endereco) contratanteText += `, residente e domiciliado(a) à ${up(contrato.cliente_endereco)}`
    }

    let clausulasHtml = ''
    for (const g of grupos) {
      clausulasHtml += `<div style="margin-top:32px;margin-bottom:16px;text-align:center;"><span style="font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#888;">— ${g.secao} —</span></div>`
      for (const c of g.itens) {
        const n = numeros[c.id]
        const texto = negritarTermosHtml(substituirVars(c.texto, ctx))
        const paragrafos = texto.split('\n').filter(l => l.trim())
        clausulasHtml += `<p style="font-family:Arial,sans-serif;font-size:12pt;line-height:1.85;text-align:justify;margin-bottom:12px;color:#1a1a1a;"><strong>Cláusula ${n}ª.</strong> ${paragrafos[0] || ''}</p>`
        for (const p of paragrafos.slice(1)) {
          clausulasHtml += `<p style="font-family:Arial,sans-serif;font-size:12pt;line-height:1.85;text-align:justify;margin-bottom:8px;color:#1a1a1a;padding-left:24px;">${p}</p>`
        }
      }
    }

    // Logo em base64 para embutir no arquivo Word (formato MHTML)
    let logoBase64 = ''
    try {
      const resp = await fetch(logoDNL)
      const blobLogo = await resp.blob()
      logoBase64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result).split(',')[1] || '')
        fr.onerror = reject
        fr.readAsDataURL(blobLogo)
      })
    } catch {
      // sem logo, o cabeçalho fica só com texto
    }

    const rodapeInfo = [
      config.empresa_nome || 'DNL Projetos',
      config.empresa_cnpj ? `CNPJ ${config.empresa_cnpj}` : '',
      config.empresa_email,
      config.empresa_telefone,
    ].filter(Boolean).join(' · ')

    const html = `﻿<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${contrato.numero}</title>
<style>@page{margin:3cm 3.5cm;}body{font-family:Arial,Helvetica,sans-serif;font-size:12pt;color:#1a1a1a;}</style>
</head><body>
<table style="width:100%;border-collapse:collapse;border-bottom:2.5pt solid #1a1a1a;padding-bottom:16px;margin-bottom:24px;">
  <tr>
    ${logoBase64 ? `<td style="vertical-align:middle;padding-bottom:12px;width:130px;"><img src="logo-dnl.png" width="120" alt="DNL Projetos"></td>` : ''}
    <td style="vertical-align:middle;padding-bottom:12px;">
      <span style="font-family:Arial,sans-serif;font-size:14pt;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">${config.empresa_nome || 'DNL Projetos'}</span>
      ${config.empresa_slogan ? `<br><span style="font-family:Arial,sans-serif;font-size:9pt;color:#888;">${config.empresa_slogan}</span>` : ''}
      ${config.empresa_cnpj ? `<br><span style="font-family:Arial,sans-serif;font-size:9pt;color:#888;">CNPJ ${config.empresa_cnpj}</span>` : ''}
      ${(config.empresa_telefone || config.empresa_email) ? `<br><span style="font-family:Arial,sans-serif;font-size:9pt;color:#999;">${[config.empresa_telefone, config.empresa_email].filter(Boolean).join(' · ')}</span>` : ''}
    </td>
    <td style="text-align:right;vertical-align:top;padding-bottom:12px;">
      <span style="font-family:Arial,sans-serif;font-size:8pt;text-transform:uppercase;letter-spacing:2px;color:#888;">Contrato nº</span><br>
      <span style="font-family:monospace;font-size:20pt;font-weight:bold;">${contrato.numero.replace('CONT-', '')}</span>
      ${contrato.data_assinatura ? `<br><span style="font-family:Arial,sans-serif;font-size:10pt;color:#666;">${fmtDataBR(contrato.data_assinatura)}</span>` : ''}
    </td>
  </tr>
</table>
<div style="text-align:center;margin-bottom:28px;">
  <h1 style="font-family:Arial,sans-serif;font-size:13pt;font-weight:bold;letter-spacing:4px;text-transform:uppercase;color:#1a1a1a;margin:0;">Contrato de Prestação de Serviços</h1>
  <p style="font-family:Arial,sans-serif;font-size:11pt;color:#999;margin:6px 0 0;font-style:italic;">${tiposLabel(tipos)}</p>
</div>
<div style="margin-bottom:28px;font-size:12pt;line-height:1.8;text-align:justify;color:#1a1a1a;">
  <p style="margin-bottom:14px;">Pelo presente instrumento particular, as partes a seguir identificadas:</p>
  <p style="margin-bottom:14px;"><strong>CONTRATADA:</strong> ${contratadaText}, doravante denominada simplesmente <strong>CONTRATADA</strong>.</p>
  <p style="margin-bottom:14px;"><strong>CONTRATANTE:</strong> ${contratanteText}, doravante denominado(a) simplesmente <strong>CONTRATANTE</strong>.</p>
  <p style="font-style:italic;color:#555;">${TEXTO_CELEBRACAO}</p>
</div>
${clausulasHtml}
<p style="text-align:center;font-style:italic;color:#555;margin-top:40px;margin-bottom:28px;font-size:12pt;">${contrato.cidade}, ${contrato.data_assinatura ? fmtDataBR(contrato.data_assinatura) : '___ de ___________________ de ______'}.</p>
<table style="width:100%;border-collapse:collapse;margin-top:8px;">
  <tr>
    <td style="width:50%;text-align:center;padding:0 40px;">
      <div style="height:80px;"></div>
      <div style="border-top:2pt solid #1a1a1a;padding-top:10px;">
        <p style="font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0;">CONTRATANTE</p>
        <p style="font-family:Arial,sans-serif;font-size:9pt;color:#666;margin:4px 0 0;">${up(contrato.cliente_nome)}</p>
      </div>
    </td>
    <td style="width:50%;text-align:center;padding:0 40px;">
      <div style="height:80px;"></div>
      <div style="border-top:2pt solid #1a1a1a;padding-top:10px;">
        <p style="font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:0;">CONTRATADA</p>
        <p style="font-family:Arial,sans-serif;font-size:9pt;color:#666;margin:4px 0 0;">${config.empresa_responsavel || config.empresa_nome || 'DNL Projetos'}</p>
      </div>
    </td>
  </tr>
</table>
<table style="width:100%;border-collapse:collapse;margin-top:48px;">
  <tr>
    <td style="width:50%;text-align:center;padding:0 40px;">
      <div style="height:60px;"></div>
      <div style="border-top:1pt solid #888;padding-top:8px;">
        <p style="font-family:Arial,sans-serif;font-size:9pt;text-transform:uppercase;letter-spacing:2px;color:#666;margin:0;">Testemunha 1</p>
      </div>
    </td>
    <td style="width:50%;text-align:center;padding:0 40px;">
      <div style="height:60px;"></div>
      <div style="border-top:1pt solid #888;padding-top:8px;">
        <p style="font-family:Arial,sans-serif;font-size:9pt;text-transform:uppercase;letter-spacing:2px;color:#666;margin:0;">Testemunha 2</p>
      </div>
    </td>
  </tr>
</table>
${contrato.observacoes ? `<div style="margin-top:32px;padding-top:16px;border-top:1pt solid #ddd;"><p style="font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:6px;">Observações</p><p style="font-size:11pt;color:#555;white-space:pre-line;line-height:1.6;">${contrato.observacoes}</p></div>` : ''}
<div style="margin-top:28px;padding-top:8px;border-top:0.5pt solid #ddd;text-align:center;">
  <p style="font-family:Arial,sans-serif;font-size:7pt;text-transform:uppercase;letter-spacing:2px;color:#ccc;margin:0;">${rodapeInfo}</p>
</div>
</body></html>`

    // MHTML: HTML + logo em partes MIME — formato que o Word abre com a imagem embutida
    const b64utf8 = (s: string) => btoa(unescape(encodeURIComponent(s)))
    const quebrar76 = (s: string) => s.replace(/(.{76})/g, '$1\r\n')
    let conteudo: string
    if (logoBase64) {
      const boundary = '----=_NextPart_DNL_CONTRATO'
      conteudo = [
        'MIME-Version: 1.0',
        `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset="utf-8"',
        'Content-Transfer-Encoding: base64',
        'Content-Location: contrato.html',
        '',
        quebrar76(b64utf8(html)),
        `--${boundary}`,
        'Content-Type: image/png',
        'Content-Transfer-Encoding: base64',
        'Content-Location: logo-dnl.png',
        '',
        quebrar76(logoBase64),
        `--${boundary}--`,
        ''
      ].join('\r\n')
    } else {
      conteudo = html
    }

    const blob = new Blob([conteudo], { type: 'application/vnd.ms-word;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${contrato.numero}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fade-in">
      {/* Barra de ações — oculta na impressão */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button
          onClick={onVoltar}
          className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 text-sm"
        >
          <ArrowLeft size={14} /> Voltar à lista
        </button>
        <div className="flex gap-2">
          <button onClick={onDeletar} className="btn-secondary text-terra-600 hover:text-terra-700 border-terra-300 hover:border-terra-400">
            <Trash2 size={14} /> Excluir
          </button>
          <button onClick={onEditar} className="btn-secondary">
            <Edit2 size={14} /> Editar
          </button>
          <button onClick={gerarWord} className="btn-secondary">
            <FileText size={14} /> Gerar Word
          </button>
          <button onClick={() => window.print()} className="btn-primary">
            <Printer size={14} /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Papel do contrato */}
      <div
        className="bg-white p-14 rounded-lg shadow-soft print:shadow-none print:p-0 max-w-3xl mx-auto print-area"
        style={{ fontFamily: FONTE_CONTRATO }}
      >
        {/* CABEÇALHO */}
        <div className="flex items-start justify-between gap-6 pb-5 mb-7 border-b-2 border-ink-900">
          <div className="flex items-center gap-4">
            <img src={logoDNL} alt="DNL Projetos" style={{ width: 120, height: 'auto', flexShrink: 0 }} />
            <div>
              <p style={{ fontFamily: 'sans-serif' }} className="font-bold text-[13px] uppercase tracking-[0.15em] text-ink-900 leading-tight">
                {config.empresa_nome || 'DNL Projetos'}
              </p>
              {config.empresa_slogan && (
                <p style={{ fontFamily: 'sans-serif' }} className="text-[10px] text-ink-500 mt-0.5">{config.empresa_slogan}</p>
              )}
              {config.empresa_cnpj && (
                <p style={{ fontFamily: 'sans-serif' }} className="text-[10px] text-ink-500 mt-0.5">CNPJ {config.empresa_cnpj}</p>
              )}
              {(config.empresa_telefone || config.empresa_email) && (
                <p style={{ fontFamily: 'sans-serif' }} className="text-[10px] text-ink-400 mt-0.5">
                  {[config.empresa_telefone, config.empresa_email].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p style={{ fontFamily: 'sans-serif' }} className="text-[9px] uppercase tracking-widest text-ink-400">Contrato nº</p>
            <p style={{ fontFamily: 'monospace' }} className="text-xl font-bold text-ink-900 leading-tight mt-0.5">
              {contrato.numero.replace('CONT-', '')}
            </p>
            {contrato.data_assinatura && (
              <p style={{ fontFamily: 'sans-serif' }} className="text-[11px] text-ink-500 mt-1.5">{fmtDataBR(contrato.data_assinatura)}</p>
            )}
            <span className={`inline-block mt-2 text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded print:hidden ${STATUS_COR[contrato.status]}`}>
              {STATUS_LABEL[contrato.status]}
            </span>
          </div>
        </div>

        {/* TÍTULO */}
        <div className="text-center mb-8">
          <h1 style={{ fontFamily: 'sans-serif' }} className="text-[15px] font-bold uppercase tracking-[0.2em] text-ink-900">
            Contrato de Prestação de Serviços
          </h1>
          <p className="text-[12px] text-ink-400 mt-2 italic">
            {tiposLabel(tipos)}
          </p>
        </div>

        {/* QUALIFICAÇÃO DAS PARTES */}
        <div className="mb-8 text-[13px] text-ink-800 leading-[1.8] text-justify">
          <p className="mb-5">Pelo presente instrumento particular, as partes a seguir identificadas:</p>

          <p className="mb-5">
            <strong className="text-ink-900">CONTRATADA:</strong>{' '}
            {negritarTermos(contrato.contratada_qualificacao || buildContratadaDefault())},
            doravante denominada simplesmente <strong>CONTRATADA</strong>.
          </p>

          <p className="mb-5">
            <strong className="text-ink-900">CONTRATANTE:</strong>{' '}
            {contrato.cliente_tipo_pessoa === 'juridica' ? (
              <>
                <strong>{up(contrato.cliente_nome) || '—'}</strong>
                {contrato.cliente_cnpj && (
                  <>, pessoa jurídica inscrita no CNPJ sob o nº{' '}
                  <strong>{maskCpfCnpj(contrato.cliente_cnpj)}</strong></>
                )}
                {contrato.cliente_endereco && <>, com sede em {up(contrato.cliente_endereco)}</>}
                {contrato.cliente_representante && (
                  <>, neste ato representada por{' '}
                  <strong>{up(contrato.cliente_representante)}</strong>
                  {contrato.cliente_estado_civil && <>, {up(contrato.cliente_estado_civil)}</>}
                  {contrato.cliente_profissao && <>, {up(contrato.cliente_profissao)}</>}
                  {contrato.cliente_nacionalidade && <>, {up(contrato.cliente_nacionalidade)}</>}
                  {contrato.cliente_rg && <>, portador(a) do RG nº {contrato.cliente_rg}</>}
                  {contrato.cliente_cpf && <>, inscrito(a) no CPF sob o nº <strong>{maskCpfCnpj(contrato.cliente_cpf)}</strong></>}
                  </>
                )}
              </>
            ) : (
              <>
                <strong>{up(contrato.cliente_nome) || '—'}</strong>
                {contrato.cliente_nacionalidade && <>, {up(contrato.cliente_nacionalidade)}</>}
                {contrato.cliente_estado_civil && <>, {up(contrato.cliente_estado_civil)}</>}
                {contrato.cliente_profissao && <>, {up(contrato.cliente_profissao)}</>}
                {contrato.cliente_rg && <>, portador(a) do RG nº {contrato.cliente_rg}</>}
                {contrato.cliente_cpf && <>, inscrito(a) no CPF sob o nº <strong>{maskCpfCnpj(contrato.cliente_cpf)}</strong></>}
                {contrato.cliente_endereco && <>, residente e domiciliado(a) à {up(contrato.cliente_endereco)}</>}
              </>
            )}
            , doravante denominado(a) simplesmente <strong>CONTRATANTE</strong>.
          </p>

          <p className="italic text-ink-600">{TEXTO_CELEBRACAO}</p>
        </div>

        {/* CLÁUSULAS */}
        {grupos.map(g => (
          <div key={g.secao} className="mb-2">
            <div className="flex items-center gap-3 mt-9 mb-5">
              <div className="flex-1 border-t border-ink-700/20" />
              <h3
                style={{ fontFamily: 'sans-serif' }}
                className="text-[9px] font-bold uppercase tracking-[0.28em] text-ink-400 shrink-0 px-1"
              >
                {g.secao}
              </h3>
              <div className="flex-1 border-t border-ink-700/20" />
            </div>
            {g.itens.map(c => {
              const n = ctx.numeros[c.id]
              const texto = substituirVars(c.texto, ctx)
              const paragrafos = texto.split('\n').filter(l => l.trim())
              return (
                <div key={c.id} className="mb-4">
                  <p className="text-[13px] text-justify leading-[1.85] text-ink-800">
                    <strong className="text-ink-900 font-semibold">Cláusula {n}ª.</strong>{' '}
                    {negritarTermos(paragrafos[0])}
                  </p>
                  {paragrafos.slice(1).map((p, i) => (
                    <p key={i} className="text-[13px] text-justify leading-[1.85] text-ink-800 mt-1.5 pl-5 whitespace-pre-line">
                      {negritarTermos(p)}
                    </p>
                  ))}
                </div>
              )
            })}
          </div>
        ))}

        {/* LOCAL E DATA */}
        <div className="mt-12 mb-8">
          <p className="text-center text-[13px] italic text-ink-700">
            {contrato.cidade},{' '}
            {contrato.data_assinatura
              ? fmtDataBR(contrato.data_assinatura)
              : <span className="text-ink-400">___ de ___________________ de ______</span>}.
          </p>
        </div>

        {/* ASSINATURAS */}
        <div className="grid grid-cols-2 gap-16 mt-2">
          {[
            { rotulo: 'CONTRATANTE', nome: up(contrato.cliente_nome) },
            { rotulo: 'CONTRATADA', nome: config.empresa_responsavel || config.empresa_nome || 'DNL Projetos' },
          ].map(s => (
            <div key={s.rotulo} className="text-center">
              <div className="h-28" />
              <div className="border-t-2 border-ink-800 pt-3">
                <p style={{ fontFamily: 'sans-serif' }} className="text-[11px] font-bold uppercase tracking-wider text-ink-900">{s.rotulo}</p>
                <p style={{ fontFamily: 'sans-serif' }} className="text-[10px] text-ink-500 mt-0.5">{s.nome}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-16 mt-14">
          {['TESTEMUNHA 1', 'TESTEMUNHA 2'].map(s => (
            <div key={s} className="text-center">
              <div className="h-20" />
              <div className="border-t border-ink-400 pt-3">
                <p style={{ fontFamily: 'sans-serif' }} className="text-[10px] uppercase tracking-wider text-ink-500">{s}</p>
              </div>
            </div>
          ))}
        </div>

        {/* OBSERVAÇÕES */}
        {contrato.observacoes && (
          <div className="mt-8 pt-5 border-t border-ink-300/40">
            <p style={{ fontFamily: 'sans-serif' }} className="text-[10px] font-bold uppercase tracking-widest text-ink-500 mb-1.5">
              Observações
            </p>
            <p className="text-[12px] text-ink-600 whitespace-pre-line leading-relaxed">
              {contrato.observacoes}
            </p>
          </div>
        )}

        {/* RODAPÉ */}
        <div className="mt-8 pt-3 border-t border-ink-300/25 text-center">
          <p style={{ fontFamily: 'sans-serif' }} className="text-[8px] uppercase tracking-widest text-ink-300">
            {[config.empresa_nome || 'DNL Projetos', config.empresa_cnpj ? `CNPJ ${config.empresa_cnpj}` : '', config.empresa_email, config.empresa_telefone].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de criação / edição ────────────────────────────────────────────────

function ModalContrato({
  contrato, onFechar, onSalvo,
}: {
  contrato?: Contrato
  onFechar: () => void
  onSalvo: () => void
}) {
  const ehEdicao = !!contrato

  const tiposIniciais: TipoContrato[] = contrato?.tipos_contrato?.length
    ? contrato.tipos_contrato
    : contrato?.tipo_contrato
      ? [contrato.tipo_contrato]
      : ['laudo_vizinhanca']

  // ── Estado principal ──────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<TipoContrato[]>(tiposIniciais)
  const [titulo, setTitulo] = useState(contrato?.titulo ?? '')
  const [objeto, setObjeto] = useState(contrato?.objeto ?? gerarObjetoCombinado(tiposIniciais))
  const [endereco, setEndereco] = useState(contrato?.endereco_imovel ?? '')
  const [valor, setValor] = useState(contrato?.valor ? String(contrato.valor) : '')
  const [valorExtenso, setValorExtenso] = useState(contrato?.valor_extenso ?? '')
  const [clienteId, setClienteId] = useState<number | ''>(contrato?.cliente_id ?? '')
  const [projetoId, setProjetoId] = useState<number | ''>(contrato?.projeto_id ?? '')
  const [status, setStatus] = useState<StatusContrato>(contrato?.status ?? 'rascunho')
  const [cidade, setCidade] = useState(contrato?.cidade ?? 'São Paulo')
  const [dataAssinatura, setDataAssinatura] = useState(contrato?.data_assinatura ?? '')
  const [multa, setMulta] = useState(contrato?.multa_percentual ?? '1')
  const [juros, setJuros] = useState(contrato?.juros_diario ?? '0,50')
  const [obs, setObs] = useState(contrato?.observacoes ?? '')
  const [servicos, setServicos] = useState<ServicoContrato[]>(
    contrato?.servicos?.length ? contrato.servicos : gerarServicosCombinados(tiposIniciais)
  )
  const [parcelas, setParcelas] = useState<ParcelaContrato[]>(contrato?.parcelas ?? [])
  const [clausulas, setClausulas] = useState<ClausulaContrato[]>(contrato?.clausulas ?? [])
  const [contratadaQualificacao, setContratadaQualificacao] = useState(
    contrato?.contratada_qualificacao ?? ''
  )

  // ── Estado de UI ──────────────────────────────────────────────────────────
  const [config, setConfig] = useState<Record<string, string>>({})
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [aba, setAba] = useState<'dados' | 'contratada' | 'pagamento' | 'clausulas' | 'preview'>('dados')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)

  // ── Efeitos ───────────────────────────────────────────────────────────────

  // Carrega clientes, projetos e config na abertura
  useEffect(() => {
    Promise.all([api.clientes.listar(), api.projetos.listar(), api.configuracoes.obter()])
      .then(([cs, ps, cfg]) => {
        setClientes(cs)
        setProjetos(ps)
        setConfig(cfg)
        if (!ehEdicao && !contrato?.contratada_qualificacao) {
          setContratadaQualificacao(buildContratadaDefault())
        }
      })
  }, [])

  // Quando tipos mudam (apenas novo contrato): carrega e mescla cláusulas
  const tiposKey = tipos.join(',')
  useEffect(() => {
    if (ehEdicao) return
    if (tipos.length === 0) { setClausulas([]); return }
    let cancelado = false
    Promise.all(tipos.map(t => api.contratos.listarClausulasPadrao(t)))
      .then(resultados => {
        if (cancelado) return
        const seen = new Set<string>()
        const merged: ClausulaContrato[] = []
        for (const padroes of resultados) {
          for (const p of padroes) {
            if (seen.has(p.clausula_id)) continue
            seen.add(p.clausula_id)
            merged.push({
              id: p.clausula_id,
              secao: p.secao,
              rotulo: p.rotulo,
              texto: p.texto,
              texto_padrao: p.texto,
              essencial: !!p.essencial,
              incluida: true,
              ordem: p.ordem,
            })
          }
        }
        setClausulas(merged.sort((a, b) => a.ordem - b.ordem))
      })
    return () => { cancelado = true }
  }, [tiposKey, ehEdicao])

  // Quando tipos mudam (apenas novo contrato): preenche objeto e serviços
  useEffect(() => {
    if (ehEdicao || tipos.length === 0) return
    setObjeto(gerarObjetoCombinado(tipos))
    setServicos(gerarServicosCombinados(tipos))
  }, [tiposKey, ehEdicao])

  // Recalcula valor por extenso automaticamente
  useEffect(() => {
    const v = parseFloat(valor.replace(',', '.')) || 0
    setValorExtenso(v > 0 ? numberToWords(v).toUpperCase() : '')
  }, [valor])

  // ── Computed ──────────────────────────────────────────────────────────────
  const valorNum = parseFloat(valor.replace(',', '.')) || 0
  const clienteSel = clientes.find(c => c.id === Number(clienteId))
  const numClausulasAtivas = clausulas.filter(c => c.incluida).length
  const secoesExistentes = Array.from(new Set(clausulas.map(c => c.secao))).sort()

  const ctx = {
    numeros: calcularNumeros(clausulas),
    contratante: {
      razao_social: clienteSel?.nome,
      cnpj: clienteSel?.cnpj,
      endereco: clienteSel?.endereco,
      representante: clienteSel?.representante_nome,
      rg: clienteSel?.representante_rg,
      cpf: clienteSel?.representante_cpf,
    },
    objeto: { descricao: objeto, endereco_imovel: endereco, valor: valorNum, valor_extenso: valorExtenso, servicos },
    pagamento: { parcelas, multa, juros },
    cabecalho: { cidade },
  }

  // ── Handlers de tipos ─────────────────────────────────────────────────────
  function toggleTipo(t: TipoContrato) {
    setTipos(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  // ── Handlers de cláusulas ─────────────────────────────────────────────────
  function toggleClausula(id: string) {
    setClausulas(cls => cls.map(c => c.id === id ? { ...c, incluida: !c.incluida } : c))
  }
  function editarTextoClausula(id: string, texto: string) {
    setClausulas(cls => cls.map(c => c.id === id ? { ...c, texto } : c))
  }
  function restaurarClausula(id: string) {
    setClausulas(cls => cls.map(c => c.id === id ? { ...c, texto: c.texto_padrao } : c))
  }
  function adicionarClausulaEmBranco() {
    setClausulas(cls => {
      const foro = cls.find(c => c.id === 'foro' && c.incluida)
      const maxOrdem = cls.length > 0 ? Math.max(...cls.map(c => c.ordem)) : 0
      const qtdCustom = cls.filter(c => c.id.startsWith('custom_')).length
      // Insere antes do foro (quando existir) para a cláusula não cair depois de "DO FORO"
      const ordem = foro ? foro.ordem - 0.5 + qtdCustom * 0.01 : maxOrdem + 1 + qtdCustom
      const nova: ClausulaContrato = {
        id: `custom_${Date.now()}`,
        secao: 'DAS CONDIÇÕES GERAIS',
        rotulo: 'Nova cláusula',
        texto: '',
        texto_padrao: '',
        essencial: false,
        incluida: true,
        ordem,
      }
      return [...cls, nova]
    })
  }
  function removerClausula(id: string) {
    setClausulas(cls => cls.filter(c => c.id !== id))
  }
  function editarMetaClausula(id: string, campo: 'rotulo' | 'secao', valor: string) {
    setClausulas(cls => cls.map(c => c.id === id ? { ...c, [campo]: valor } : c))
  }
  // Move a clausula "origemId" para a posicao de "destinoId" (arrastar-e-soltar)
  // e renumera todo mundo em sequencia, na nova ordem visual.
  function reordenarClausula(origemId: string, destinoId: string) {
    if (origemId === destinoId) return
    setClausulas(cls => {
      const ordenadas = [...cls].sort((a, b) => a.ordem - b.ordem)
      const origemIdx = ordenadas.findIndex(c => c.id === origemId)
      const destinoIdx = ordenadas.findIndex(c => c.id === destinoId)
      if (origemIdx === -1 || destinoIdx === -1) return cls
      const [movida] = ordenadas.splice(origemIdx, 1)
      ordenadas.splice(destinoIdx, 0, movida)
      return ordenadas.map((c, i) => ({ ...c, ordem: i }))
    })
  }

  // ── Handlers de serviços ──────────────────────────────────────────────────
  function adicionarServico() {
    setServicos(s => [...s, { ordem: s.length, descricao: '' }])
  }
  function removerServico(idx: number) {
    setServicos(s => s.filter((_, i) => i !== idx).map((sv, i) => ({ ...sv, ordem: i })))
  }
  function editarServico(idx: number, descricao: string) {
    setServicos(s => s.map((sv, i) => i === idx ? { ...sv, descricao } : sv))
  }

  // ── Handlers de parcelas ──────────────────────────────────────────────────
  function adicionarParcela() {
    setParcelas(p => [...p, { ordem: p.length, valor: 0, valor_extenso: '', na_assinatura: p.length === 0, data: '' }])
  }
  function removerParcela(idx: number) {
    setParcelas(p => p.filter((_, i) => i !== idx).map((pc, i) => ({ ...pc, ordem: i })))
  }
  function editarParcela(idx: number, campo: keyof ParcelaContrato, val: any) {
    setParcelas(p => p.map((pc, i) => {
      if (i !== idx) return pc
      const novo = { ...pc, [campo]: val }
      if (campo === 'valor') novo.valor_extenso = numberToWords(parseFloat(String(val)) || 0).toUpperCase()
      return novo
    }))
  }
  function gerarParcelasAuto(qtd: number, diaVenc: number, primeiraNaAssin: boolean, mesInicial: number, anoInicial: number) {
    if (!valorNum || qtd <= 0) return
    const valorParc = Math.round(valorNum / qtd * 100) / 100
    const ultima = Math.round((valorNum - valorParc * (qtd - 1)) * 100) / 100
    const novas: ParcelaContrato[] = []
    for (let i = 0; i < qtd; i++) {
      const v = i === qtd - 1 ? ultima : valorParc
      let data = ''
      if (!(i === 0 && primeiraNaAssin)) {
        const offset = primeiraNaAssin ? i : i + 1
        const mesAlvo = mesInicial + offset - 1
        const ano = anoInicial + Math.floor(mesAlvo / 12)
        const mes = (mesAlvo % 12) + 1
        data = `${ano}-${String(mes).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`
      }
      novas.push({ ordem: i, valor: v, valor_extenso: numberToWords(v).toUpperCase(), na_assinatura: i === 0 && primeiraNaAssin, data })
    }
    setParcelas(novas)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!clienteId) return setErro('Selecione um cliente.')
    if (!titulo.trim()) return setErro('Informe um título.')
    if (tipos.length === 0) return setErro('Selecione pelo menos um tipo de serviço.')
    setErro('')
    setSalvando(true)
    try {
      const dados: ContratoCreateInput = {
        tipo_contrato: tipos[0],
        tipos_contrato: tipos,
        cliente_id: Number(clienteId),
        projeto_id: projetoId ? Number(projetoId) : undefined,
        titulo: titulo.trim(),
        objeto: objeto.trim(),
        endereco_imovel: endereco.trim() || undefined,
        valor: valorNum,
        valor_extenso: valorExtenso || undefined,
        cidade,
        data_assinatura: dataAssinatura || undefined,
        multa_percentual: multa,
        juros_diario: juros,
        servicos,
        parcelas,
        clausulas,
        observacoes: obs.trim() || undefined,
        status,
        contratada_qualificacao: contratadaQualificacao.trim() || undefined,
      }
      if (ehEdicao) {
        await api.contratos.atualizar(contrato.id, dados)
      } else {
        await api.contratos.criar(dados)
      }
      onSalvo()
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar contrato.')
    } finally {
      setSalvando(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col fade-in">

        {/* Header do modal */}
        <div className="px-7 py-4 border-b border-ink-300/40 flex items-center justify-between shrink-0">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              {ehEdicao ? `Editando ${contrato.numero}` : 'Novo contrato'}
            </p>
            <h2 className="font-display text-2xl text-ink-900">Contrato de Prestação de Serviços</h2>
          </div>
          <button onClick={onFechar} className="text-ink-400 hover:text-ink-900 p-1">
            <X size={20} />
          </button>
        </div>

        {/* Abas */}
        <div className="border-b border-ink-300/40 px-7 flex shrink-0">
          {([
            ['dados', 'Dados & Serviços'],
            ['contratada', 'Contratada'],
            ['pagamento', 'Pagamento'],
            ['clausulas', `Cláusulas (${numClausulasAtivas})`],
            ['preview', 'Pré-visualização'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setAba(key)}
              className={`px-4 py-3 text-sm transition-colors border-b-2 -mb-px ${
                aba === key
                  ? 'border-terra-500 text-ink-900 font-medium'
                  : 'border-transparent text-ink-500 hover:text-ink-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} id="form-contrato" className="flex-1 overflow-y-auto">

          {/* ── ABA: DADOS & SERVIÇOS ── */}
          {aba === 'dados' && (
            <div className="p-7 space-y-5">

              {/* Tipos de serviço */}
              <div>
                <label className="label">
                  Tipo(s) de serviço *
                  {tipos.length > 1 && (
                    <span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-terra-500 bg-terra-50 px-1.5 py-0.5 rounded">
                      {tipos.length} tipos — cláusulas mescladas
                    </span>
                  )}
                </label>
                {ehEdicao ? (
                  <div className="bg-cream-200/50 px-3 py-2.5 rounded-md text-sm text-ink-700">
                    {tiposLabel(tipos)}
                    <span className="block text-xs text-ink-400 mt-0.5">O tipo não pode ser alterado após a criação.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {(Object.entries(TIPO_LABEL) as [TipoContrato, string][]).map(([v, l]) => {
                      const on = tipos.includes(v)
                      return (
                        <label
                          key={v}
                          className={`flex items-start gap-2 p-2.5 rounded-md border cursor-pointer text-xs select-none transition-all ${
                            on
                              ? 'border-terra-400 bg-terra-50 text-ink-900 font-medium'
                              : 'border-ink-300/40 bg-cream-100/60 text-ink-600 hover:border-ink-400 hover:bg-cream-200/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 shrink-0 accent-terra-500"
                            checked={on}
                            onChange={() => toggleTipo(v)}
                          />
                          <span className="leading-tight">{l}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Cliente + Projeto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Cliente *</label>
                  <select
                    className="input-field"
                    value={clienteId}
                    onChange={e => setClienteId(e.target.value ? Number(e.target.value) : '')}
                    required
                  >
                    <option value="">Selecione o cliente...</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                  {clienteSel && !clienteSel.representante_nome && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠ Cliente sem representante — edite em Clientes para adicionar RG/CPF.
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Projeto vinculado</label>
                  <select
                    className="input-field"
                    value={projetoId}
                    onChange={e => setProjetoId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">— Nenhum —</option>
                    {projetos.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="label">Título do contrato *</label>
                <input
                  className="input-field"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Ex: Contrato de Prestação de Serviços de Engenharia"
                  required
                />
              </div>

              {/* Objeto */}
              <div>
                <label className="label">Objeto (prefixo — gerado automaticamente)</label>
                <textarea
                  className="input-field min-h-[70px] text-sm"
                  rows={3}
                  value={objeto}
                  onChange={e => setObjeto(e.target.value)}
                  placeholder="Descreva o objeto do contrato"
                />
              </div>

              {/* Endereço do imóvel */}
              <div>
                <label className="label">Endereço do imóvel (concatenado ao objeto)</label>
                <input
                  className="input-field"
                  value={endereco}
                  onChange={e => setEndereco(e.target.value)}
                  placeholder="Rua, número, bairro, CEP, cidade – UF"
                />
              </div>

              {/* Valor */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Valor total (R$) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input-field font-mono"
                    value={valor}
                    onChange={e => setValor(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Valor por extenso (calculado automaticamente)</label>
                  <input
                    className="input-field text-xs"
                    value={valorExtenso}
                    onChange={e => setValorExtenso(e.target.value)}
                    placeholder="Preenchido automaticamente"
                  />
                </div>
              </div>

              {/* Cidade + Data + Status */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Cidade do foro</label>
                  <input className="input-field" value={cidade} onChange={e => setCidade(e.target.value)} />
                </div>
                <div>
                  <label className="label">Data de assinatura</label>
                  <input type="date" className="input-field" value={dataAssinatura} onChange={e => setDataAssinatura(e.target.value)} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input-field" value={status} onChange={e => setStatus(e.target.value as StatusContrato)}>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Serviços */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Serviços contratados</label>
                  <button
                    type="button"
                    onClick={adicionarServico}
                    className="text-xs text-terra-500 hover:text-terra-700 flex items-center gap-1"
                  >
                    <Plus size={11} /> adicionar
                  </button>
                </div>
                {servicos.length === 0 ? (
                  <p className="text-sm text-ink-400 italic">Nenhum serviço — serão preenchidos automaticamente ao selecionar o tipo.</p>
                ) : (
                  <div className="space-y-2">
                    {servicos.map((s, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          className="input-field flex-1 text-sm"
                          value={s.descricao}
                          onChange={e => editarServico(idx, e.target.value)}
                          placeholder="Descrição do serviço"
                        />
                        <button
                          type="button"
                          onClick={() => removerServico(idx)}
                          className="p-2 text-ink-400 hover:text-terra-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Observações */}
              <div>
                <label className="label">Observações finais (opcional)</label>
                <textarea
                  className="input-field min-h-[60px]"
                  rows={2}
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  placeholder="Notas adicionais, condições especiais..."
                />
              </div>
            </div>
          )}

          {/* ── ABA: CONTRATADA ── */}
          {aba === 'contratada' && (
            <div className="p-7 space-y-4">
              <div className="bg-cream-200/50 p-3 rounded-md text-xs text-ink-700 leading-relaxed">
                Qualificação completa da CONTRATADA que aparecerá no contrato. Edite caso os dados da empresa mudem.
              </div>
              <div>
                <label className="label">Qualificação da CONTRATADA</label>
                <textarea
                  className="input-field min-h-[160px] text-sm font-mono leading-relaxed"
                  rows={8}
                  value={contratadaQualificacao}
                  onChange={e => setContratadaQualificacao(e.target.value)}
                  placeholder="Nome da empresa, CNPJ, sede, representante legal..."
                />
              </div>
              <button
                type="button"
                onClick={() => setContratadaQualificacao(buildContratadaDefault())}
                className="text-xs text-terra-500 hover:text-terra-700 flex items-center gap-1"
              >
                <RotateCcw size={11} /> Restaurar padrão
              </button>
            </div>
          )}

          {/* ── ABA: PAGAMENTO ── */}
          {aba === 'pagamento' && (
            <div className="p-7 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Multa por atraso (% ao mês)</label>
                  <input className="input-field font-mono" value={multa} onChange={e => setMulta(e.target.value)} />
                </div>
                <div>
                  <label className="label">Juros (% ao dia)</label>
                  <input className="input-field font-mono" value={juros} onChange={e => setJuros(e.target.value)} />
                </div>
              </div>

              <div className="bg-cream-200/50 rounded-md p-4 border border-ink-300/30">
                <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500 mb-3 flex items-center gap-1">
                  <Sparkles size={10} /> Gerador automático de parcelas
                </p>
                <GeradorParcelas valorTotal={valorNum} onGerar={gerarParcelasAuto} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Parcelas</label>
                  <button
                    type="button"
                    onClick={adicionarParcela}
                    className="text-xs text-terra-500 hover:text-terra-700 flex items-center gap-1"
                  >
                    <Plus size={11} /> manual
                  </button>
                </div>
                {parcelas.length === 0 ? (
                  <p className="text-sm text-ink-400 italic">Nenhuma parcela. Use o gerador acima ou adicione manualmente.</p>
                ) : (
                  <div className="space-y-2">
                    {parcelas.map((p, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-cream-200/40 rounded-md p-2">
                        <span className="col-span-1 font-mono text-xs text-ink-500 text-center">{idx + 1}ª</span>
                        <div className="col-span-3">
                          <input
                            type="number"
                            step="0.01"
                            className="input-field font-mono text-sm"
                            placeholder="Valor"
                            value={p.valor || ''}
                            onChange={e => editarParcela(idx, 'valor', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="col-span-3 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={p.na_assinatura}
                            onChange={e => editarParcela(idx, 'na_assinatura', e.target.checked)}
                            className="accent-ink-900"
                          />
                          <span className="text-xs text-ink-700">Na assinatura</span>
                        </div>
                        <div className="col-span-4">
                          {!p.na_assinatura && (
                            <input
                              type="date"
                              className="input-field text-xs"
                              value={p.data || ''}
                              onChange={e => editarParcela(idx, 'data', e.target.value)}
                            />
                          )}
                        </div>
                        <div className="col-span-1 text-right">
                          <button type="button" onClick={() => removerParcela(idx)} className="p-1 text-ink-400 hover:text-terra-500">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="text-right text-sm text-ink-600 pt-1">
                      Soma:{' '}
                      <span className="font-mono">{fmtMoneyBR(parcelas.reduce((s, p) => s + p.valor, 0))}</span>
                      {Math.abs(parcelas.reduce((s, p) => s + p.valor, 0) - valorNum) > 0.01 && (
                        <span className="text-terra-500 ml-2">(≠ total {fmtMoneyBR(valorNum)})</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ABA: CLÁUSULAS ── */}
          {aba === 'clausulas' && (
            <div className="p-7 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="bg-cream-200/50 p-3 rounded-md text-xs text-ink-700 leading-relaxed flex-1">
                  Ative ou desative cláusulas. Edite o texto livremente. Use{' '}
                  <code className="bg-cream-50 px-1 font-mono rounded text-[10px]">{'{{ref:id}}'}</code>{' '}
                  para referenciar outra cláusula pelo número (ex:{' '}
                  <code className="font-mono text-[10px]">{'{{ref:preco}}'}</code> → "Cláusula 8ª").
                </div>
                <button
                  type="button"
                  onClick={adicionarClausulaEmBranco}
                  className="btn-secondary shrink-0"
                >
                  <Plus size={13} /> Nova cláusula em branco
                </button>
              </div>
              {clausulas.length === 0 ? (
                <p className="text-sm text-ink-400 italic py-4 text-center">
                  Selecione pelo menos um tipo de serviço para carregar as cláusulas.
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-ink-400 flex items-center gap-1.5">
                    <GripVertical size={11} /> Arraste pelo ícone para reordenar — a numeração se ajusta sozinha.
                  </p>
                  {[...clausulas].sort((a, b) => a.ordem - b.ordem).map(c => (
                    <ClausulaEditor
                      key={c.id}
                      clausula={c}
                      numero={ctx.numeros[c.id]}
                      secoesExistentes={secoesExistentes}
                      arrastando={arrastandoId === c.id}
                      onToggle={() => toggleClausula(c.id)}
                      onEditar={txt => editarTextoClausula(c.id, txt)}
                      onRestaurar={() => restaurarClausula(c.id)}
                      onRemover={c.id.startsWith('custom_') ? () => removerClausula(c.id) : undefined}
                      onEditarMeta={c.id.startsWith('custom_') ? (campo, valor) => editarMetaClausula(c.id, campo, valor) : undefined}
                      onDragStart={() => setArrastandoId(c.id)}
                      onDragEnd={() => setArrastandoId(null)}
                      onDropSobre={() => { if (arrastandoId) reordenarClausula(arrastandoId, c.id) }}
                    />
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── ABA: PRÉ-VISUALIZAÇÃO ── */}
          {aba === 'preview' && (
            <div className="p-7">
              <div
                className="bg-white rounded-md shadow-soft p-10 max-w-2xl mx-auto"
                style={{ fontFamily: FONTE_CONTRATO }}
              >
                {/* Mini cabeçalho */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b-2 border-ink-900">
                  <div className="flex items-center gap-3">
                    <img src={logoDNL} alt="DNL" style={{ width: 52, height: 'auto' }} />
                    <div>
                      <p style={{ fontFamily: 'sans-serif' }} className="font-bold text-[12px] uppercase tracking-widest text-ink-900">{config.empresa_nome || 'DNL Projetos'}</p>
                      {config.empresa_cnpj && <p style={{ fontFamily: 'sans-serif' }} className="text-[9px] text-ink-500">CNPJ {config.empresa_cnpj}</p>}
                    </div>
                  </div>
                  <span style={{ fontFamily: 'sans-serif' }} className="text-[9px] uppercase tracking-widest text-ink-400 italic">Prévia</span>
                </div>

                <div className="text-center mb-5">
                  <h2 style={{ fontFamily: 'sans-serif' }} className="text-[13px] font-bold uppercase tracking-widest text-ink-900">
                    Contrato de Prestação de Serviços
                  </h2>
                  <p className="text-[11px] text-ink-400 mt-1 italic">{tiposLabel(tipos)}</p>
                </div>

                <p className="text-[12px] mb-3 text-justify leading-relaxed text-ink-800">
                  <strong>CONTRATADA:</strong> {negritarTermos(contratadaQualificacao || buildContratadaDefault())}.
                </p>
                <p className="text-[12px] mb-6 text-justify leading-relaxed text-ink-800">
                  <strong>CONTRATANTE:</strong>{' '}
                  <strong>{up(clienteSel?.nome) || '(cliente não selecionado)'}</strong>
                  {clienteSel?.representante_nome && <>, rep. por {up(clienteSel.representante_nome)}</>}.
                </p>

                {agruparPorSecao(clausulas.filter(c => c.incluida)).map(g => (
                  <div key={g.secao} className="mb-3">
                    <div className="flex items-center gap-2 my-4">
                      <div className="flex-1 border-t border-ink-200" />
                      <span style={{ fontFamily: 'sans-serif' }} className="text-[8px] uppercase tracking-widest text-ink-400 shrink-0">{g.secao}</span>
                      <div className="flex-1 border-t border-ink-200" />
                    </div>
                    {g.itens.map(c => {
                      const n = ctx.numeros[c.id]
                      return (
                        <p key={c.id} className="text-[12px] text-justify mb-2.5 leading-relaxed text-ink-800 whitespace-pre-line">
                          <strong>Cláusula {n}ª.</strong> {negritarTermos(substituirVars(c.texto, ctx))}
                        </p>
                      )
                    })}
                  </div>
                ))}

                {clausulas.filter(c => c.incluida).length === 0 && (
                  <p className="text-sm text-ink-400 italic text-center py-4">Nenhuma cláusula ativa.</p>
                )}
              </div>
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div className="mx-7 mb-4 px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md">
              <p className="text-sm text-terra-700">{erro}</p>
            </div>
          )}
        </form>

        {/* Rodapé do modal */}
        <div className="flex items-center justify-between p-5 border-t border-ink-300/40 shrink-0 bg-cream-100">
          <p className="text-xs text-ink-400">
            {clausulas.length > 0
              ? `${numClausulasAtivas} cláusula${numClausulasAtivas !== 1 ? 's' : ''} ativa${numClausulasAtivas !== 1 ? 's' : ''}`
              : 'Selecione um tipo para carregar as cláusulas'}
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onFechar} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" form="form-contrato" disabled={salvando} className="btn-primary">
              {salvando ? 'Salvando…' : ehEdicao ? 'Salvar alterações' : 'Criar contrato'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Editor de cláusula individual ───────────────────────────────────────────

function ClausulaEditor({
  clausula, numero, secoesExistentes, arrastando, onToggle, onEditar, onRestaurar, onRemover, onEditarMeta,
  onDragStart, onDragEnd, onDropSobre,
}: {
  clausula: ClausulaContrato
  numero?: number
  secoesExistentes: string[]
  arrastando?: boolean
  onToggle: () => void
  onEditar: (texto: string) => void
  onRestaurar: () => void
  onRemover?: () => void
  onEditarMeta?: (campo: 'rotulo' | 'secao', valor: string) => void
  onDragStart: () => void
  onDragEnd: () => void
  onDropSobre: () => void
}) {
  const ehCustom = !!onEditarMeta
  const [editando, setEditando] = useState(ehCustom && !clausula.texto)
  const [novaSecao, setNovaSecao] = useState(false)
  const foiAlterada = !ehCustom && clausula.texto !== clausula.texto_padrao

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); onDropSobre() }}
      className={`border rounded-md transition-colors ${
        clausula.incluida ? 'border-ink-300/40 bg-cream-50' : 'border-ink-300/25 bg-cream-200/40 opacity-55'
      } ${arrastando ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-3 p-3">
        <span
          className="pt-0.5 text-ink-300 hover:text-ink-500 cursor-grab active:cursor-grabbing shrink-0"
          title="Arrastar para reordenar"
        >
          <GripVertical size={14} />
        </span>
        <label className="flex items-center pt-0.5 cursor-pointer">
          <input
            type="checkbox"
            checked={clausula.incluida}
            onChange={onToggle}
            className="w-4 h-4 accent-ink-900 cursor-pointer"
          />
        </label>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] text-ink-500 bg-cream-200 px-1.5 py-0.5 rounded">
                {clausula.incluida && numero ? `Cláusula ${numero}ª` : 'oculta'}
              </span>
              {clausula.essencial && (
                <span className="font-mono text-[10px] text-terra-600 bg-terra-100 px-1.5 py-0.5 rounded">essencial</span>
              )}
              {ehCustom && (
                <span className="font-mono text-[10px] text-terra-600 bg-terra-50 px-1.5 py-0.5 rounded">personalizada</span>
              )}
              <span className="text-[10px] text-ink-400 italic">{clausula.secao}</span>
              {foiAlterada && (
                <span className="font-mono text-[10px] text-moss-600">editada</span>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              {foiAlterada && (
                <button
                  type="button"
                  onClick={onRestaurar}
                  className="text-[10px] text-ink-500 hover:text-ink-900 flex items-center gap-1"
                  title="Restaurar texto padrão"
                >
                  <RotateCcw size={10} /> restaurar
                </button>
              )}
              {onRemover && (
                <button
                  type="button"
                  onClick={onRemover}
                  className="text-[10px] text-terra-500 hover:text-terra-700 flex items-center gap-1"
                  title="Remover cláusula personalizada"
                >
                  <Trash2 size={10} /> remover
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditando(e => !e)}
                className="text-[10px] text-terra-500 hover:text-terra-700 flex items-center gap-1"
              >
                <Edit2 size={10} /> {editando ? 'fechar' : 'editar'}
              </button>
            </div>
          </div>
          {!(ehCustom && editando) && (
            <p className="text-sm font-medium text-ink-900 mt-1">{clausula.rotulo}</p>
          )}
          {ehCustom && editando && onEditarMeta && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="label">Rótulo (uso interno)</label>
                <input
                  className="input-field text-sm"
                  value={clausula.rotulo}
                  onChange={e => onEditarMeta('rotulo', e.target.value)}
                  placeholder="Ex: Garantia adicional"
                />
              </div>
              <div>
                <label className="label">Seção do contrato</label>
                {novaSecao || !secoesExistentes.includes(clausula.secao) ? (
                  <input
                    className="input-field text-sm"
                    value={clausula.secao}
                    onChange={e => onEditarMeta('secao', e.target.value)}
                    placeholder="Ex: DAS CONDIÇÕES GERAIS"
                    autoFocus={novaSecao}
                    onBlur={() => { if (!clausula.secao.trim()) setNovaSecao(false) }}
                  />
                ) : (
                  <select
                    className="input-field text-sm"
                    value={clausula.secao}
                    onChange={e => {
                      if (e.target.value === '__nova__') { setNovaSecao(true); onEditarMeta('secao', '') }
                      else onEditarMeta('secao', e.target.value)
                    }}
                  >
                    {secoesExistentes.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="__nova__">+ Nova seção...</option>
                  </select>
                )}
              </div>
            </div>
          )}
          {!editando && (
            <p className="text-xs text-ink-500 mt-1 line-clamp-2">
              {clausula.texto || <span className="italic text-ink-400">(sem texto — clique em editar)</span>}
            </p>
          )}
          {editando && (
            <textarea
              draggable={false}
              onMouseDown={e => e.stopPropagation()}
              className="input-field font-mono text-xs mt-2 min-h-[120px]"
              value={clausula.texto}
              onChange={e => onEditar(e.target.value)}
              placeholder="Escreva o texto da cláusula..."
              rows={6}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Gerador automático de parcelas ──────────────────────────────────────────

function GeradorParcelas({
  valorTotal, onGerar,
}: {
  valorTotal: number
  onGerar: (qtd: number, diaVenc: number, primeiraNaAssin: boolean, mesInicial: number, anoInicial: number) => void
}) {
  const hoje = new Date()
  const [qtd, setQtd] = useState(2)
  const [diaVenc, setDiaVenc] = useState(5)
  const [primeiraNaAssin, setPrimeiraNaAssin] = useState(true)
  const [mesInicial, setMesInicial] = useState(hoje.getMonth() + 1)
  const [anoInicial, setAnoInicial] = useState(hoje.getFullYear())

  const valorParcela = qtd > 0 && valorTotal > 0 ? valorTotal / qtd : 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="label">Qtd. parcelas</label>
          <input
            type="number" min={1} max={36}
            className="input-field font-mono text-sm"
            value={qtd}
            onChange={e => setQtd(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>
        <div>
          <label className="label">Vence dia</label>
          <input
            type="number" min={1} max={28}
            className="input-field font-mono text-sm"
            value={diaVenc}
            onChange={e => setDiaVenc(Math.min(28, Math.max(1, parseInt(e.target.value) || 5)))}
          />
        </div>
        <div>
          <label className="label">Mês inicial</label>
          <select
            className="input-field text-sm"
            value={mesInicial}
            onChange={e => setMesInicial(parseInt(e.target.value))}
          >
            {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ano</label>
          <input
            type="number" min={2024} max={2099}
            className="input-field font-mono text-sm"
            value={anoInicial}
            onChange={e => setAnoInicial(parseInt(e.target.value) || hoje.getFullYear())}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
          <input
            type="checkbox"
            checked={primeiraNaAssin}
            onChange={e => setPrimeiraNaAssin(e.target.checked)}
            className="accent-ink-900 w-4 h-4"
          />
          1ª parcela na assinatura do contrato
        </label>
        <button
          type="button"
          onClick={() => onGerar(qtd, diaVenc, primeiraNaAssin, mesInicial, anoInicial)}
          disabled={!valorTotal}
          className="btn-primary disabled:opacity-40 text-sm shrink-0"
        >
          <Sparkles size={12} />
          Gerar {qtd}× {valorParcela > 0 ? fmtMoneyBR(valorParcela) : ''}
        </button>
      </div>
    </div>
  )
}
