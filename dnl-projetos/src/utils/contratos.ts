// Utilitários compartilhados de contratos - integrados do gerador antigo
import type { ClausulaContrato, ServicoContrato, ParcelaContrato } from '@shared/types'

// =========================================================
// Formatadores
// =========================================================

export function fmtMoney(v: number): string {
  if (typeof v !== 'number' || isNaN(v)) return '0,00'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtMoneyBR(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function fmtDataBR(data?: string | null): string {
  if (!data) return ''
  try {
    return new Date(data + (data.length === 10 ? 'T12:00:00' : '')).toLocaleDateString(
      'pt-BR',
      { day: '2-digit', month: 'long', year: 'numeric' }
    )
  } catch {
    return data
  }
}

export function fmtDataCurta(data?: string | null): string {
  if (!data) return ''
  try {
    return new Date(data + (data.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR')
  } catch {
    return data
  }
}

// =========================================================
// Conversor de número para extenso (português)
// =========================================================

export function numberToWords(valor: number): string {
  if (!valor || valor <= 0) return ''

  const inteiro = Math.floor(valor)
  const centavos = Math.round((valor - inteiro) * 100)

  const unidades = [
    '',
    'um',
    'dois',
    'três',
    'quatro',
    'cinco',
    'seis',
    'sete',
    'oito',
    'nove'
  ]
  const dez_a_dezenove = [
    'dez',
    'onze',
    'doze',
    'treze',
    'quatorze',
    'quinze',
    'dezesseis',
    'dezessete',
    'dezoito',
    'dezenove'
  ]
  const dezenas = [
    '',
    '',
    'vinte',
    'trinta',
    'quarenta',
    'cinquenta',
    'sessenta',
    'setenta',
    'oitenta',
    'noventa'
  ]
  const centenas = [
    '',
    'cento',
    'duzentos',
    'trezentos',
    'quatrocentos',
    'quinhentos',
    'seiscentos',
    'setecentos',
    'oitocentos',
    'novecentos'
  ]

  const ate999 = (n: number): string => {
    if (n === 0) return ''
    if (n === 100) return 'cem'

    const c = Math.floor(n / 100)
    const r = n % 100
    const d = Math.floor(r / 10)
    const u = r % 10

    let s = ''
    if (c > 0) s += centenas[c]
    if (r > 0) {
      if (s) s += ' e '
      if (r >= 10 && r < 20) s += dez_a_dezenove[r - 10]
      else {
        if (d > 0) s += dezenas[d]
        if (d > 0 && u > 0) s += ' e '
        if (u > 0) s += unidades[u]
      }
    }
    return s
  }

  const toExtenso = (n: number): string => {
    if (n === 0) return 'zero'
    if (n < 1000) return ate999(n)

    const milhoes = Math.floor(n / 1000000)
    const resto = n % 1000000
    const milhar = Math.floor(resto / 1000)
    const restoFinal = resto % 1000

    const parts: string[] = []
    if (milhoes > 0) parts.push(milhoes === 1 ? 'um milhão' : ate999(milhoes) + ' milhões')
    if (milhar > 0) {
      if (milhar === 1) parts.push('mil')
      else parts.push(ate999(milhar) + ' mil')
    }
    if (restoFinal > 0) parts.push(ate999(restoFinal))

    if (parts.length > 1) {
      const last = parts.pop()!
      return parts.join(', ') + ' e ' + last
    }
    return parts[0]
  }

  const inteiroStr = inteiro === 1 ? 'um real' : toExtenso(inteiro) + ' reais'
  if (centavos === 0) return inteiroStr
  const centavosStr = centavos === 1 ? 'um centavo' : toExtenso(centavos) + ' centavos'
  return `${inteiroStr} e ${centavosStr}`
}

// =========================================================
// Numeração de cláusulas e substituição de placeholders
// =========================================================

export function calcularNumeros(clausulas: ClausulaContrato[]): Record<string, number> {
  const mapa: Record<string, number> = {}
  let n = 1
  // Ordena pela ordem antes de numerar
  const ordenadas = [...clausulas].sort((a, b) => a.ordem - b.ordem)
  ordenadas.forEach((c) => {
    if (c.incluida) {
      mapa[c.id] = n
      n += 1
    }
  })
  return mapa
}

export interface ContextoSubstituicao {
  numeros: Record<string, number>
  contratante: {
    razao_social?: string
    cnpj?: string
    endereco?: string
    representante?: string
    rg?: string
    cpf?: string
  }
  objeto: {
    descricao: string
    endereco_imovel?: string
    valor: number
    valor_extenso?: string
    servicos: ServicoContrato[]
  }
  pagamento: {
    parcelas: ParcelaContrato[]
    multa?: string
    juros?: string
    pix_info?: string
  }
  cabecalho: {
    cidade: string
  }
}

export function substituirVars(texto: string, ctx: ContextoSubstituicao): string {
  let out = texto

  // Referências a outras cláusulas: {{ref:id_clausula}}
  out = out.replace(/\{\{ref:([a-z_]+)\}\}/g, (_, id) => {
    const num = ctx.numeros[id]
    return num ? `Cláusula ${num}ª` : 'Cláusula (não incluída)'
  })

  const ordinaisParcela = [
    'Primeira',
    'Segunda',
    'Terceira',
    'Quarta',
    'Quinta',
    'Sexta',
    'Sétima',
    'Oitava',
    'Nona',
    'Décima',
    'Décima primeira',
    'Décima segunda'
  ]

  const parcelasTexto = (ctx.pagamento.parcelas || [])
    .map((p, i) => {
      const rotulo = p.rotulo || ordinaisParcela[i] || `${i + 1}ª`
      const valor = fmtMoney(p.valor)
      const ext = (p.valor_extenso || numberToWords(p.valor)).toUpperCase()
      const data = p.na_assinatura
        ? 'no ato da assinatura deste contrato'
        : `no dia ${fmtDataCurta(p.data)}`
      return `${rotulo} parcela: R$ ${valor} (${ext}), ${data}.`
    })
    .join('\n')

  const servicosTexto = (ctx.objeto.servicos || [])
    .map((s) => `• ${s.descricao.toUpperCase()}`)
    .join('\n')

  const vars: Record<string, string> = {
    '{{contratante_nome}}': (ctx.contratante.razao_social || '—').toUpperCase(),
    '{{objeto_descricao}}': ctx.objeto.descricao || '—',
    '{{objeto_endereco}}': (ctx.objeto.endereco_imovel || '').toUpperCase(),
    '{{valor_numero}}': fmtMoney(ctx.objeto.valor),
    '{{valor_extenso}}': (
      ctx.objeto.valor_extenso || numberToWords(ctx.objeto.valor)
    ).toUpperCase(),
    '{{cidade}}': ctx.cabecalho.cidade || '—',
    '{{multa}}': ctx.pagamento.multa || '1',
    '{{juros}}': ctx.pagamento.juros || '0,50',
    '{{servicos_lista}}': servicosTexto,
    '{{parcelas_lista}}': parcelasTexto,
    '{{pix_info}}':
      ctx.pagamento.pix_info ||
      'O pagamento poderá ser efetuado via PIX, transferência bancária ou outra forma acordada entre as partes.'
  }

  for (const [k, v] of Object.entries(vars)) {
    out = out.split(k).join(v)
  }

  return out
}

// =========================================================
// Negrito automático nos termos das partes
// =========================================================

export const REGEX_TERMOS_PARTES = /\b(CONTRATANTES?|CONTRATADAS?|CONTRATADOS?|DNL PROJETOS)\b/g

export function negritarTermosHtml(texto: string): string {
  return texto.replace(REGEX_TERMOS_PARTES, '<strong>$1</strong>')
}

// =========================================================
// Agrupar cláusulas por seção
// =========================================================

export function agruparPorSecao(
  clausulas: ClausulaContrato[]
): Array<{ secao: string; itens: ClausulaContrato[] }> {
  const ordenadas = [...clausulas].sort((a, b) => a.ordem - b.ordem)
  const grupos: Array<{ secao: string; itens: ClausulaContrato[] }> = []
  let atual: { secao: string; itens: ClausulaContrato[] } | null = null

  for (const c of ordenadas) {
    if (!atual || atual.secao !== c.secao) {
      atual = { secao: c.secao, itens: [] }
      grupos.push(atual)
    }
    atual.itens.push(c)
  }
  return grupos
}
