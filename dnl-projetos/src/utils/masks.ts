// Máscaras de formatação de campos

/**
 * Aplica máscara ao CPF: 000.000.000-00
 */
export function maskCPF(valor: string): string {
  const v = valor.replace(/\D/g, '').slice(0, 11)
  if (v.length <= 3) return v
  if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`
  if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`
  return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`
}

/**
 * Aplica máscara ao CNPJ: 00.000.000/0000-00
 */
export function maskCNPJ(valor: string): string {
  const v = valor.replace(/\D/g, '').slice(0, 14)
  if (v.length <= 2) return v
  if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`
  if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`
  if (v.length <= 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`
}

/**
 * Auto-detecta CPF ou CNPJ baseado na quantidade de dígitos
 */
export function maskCpfCnpj(valor: string): string {
  const v = valor.replace(/\D/g, '')
  if (v.length <= 11) return maskCPF(valor)
  return maskCNPJ(valor)
}

/**
 * Aplica máscara ao RG: 00.000.000-0 (formato São Paulo, padrão mais comum)
 */
export function maskRG(valor: string): string {
  // RG aceita letra X no final, então não usamos só \d
  const v = valor.replace(/[^0-9X]/gi, '').toUpperCase().slice(0, 9)
  if (v.length <= 2) return v
  if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`
  if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}-${v.slice(8)}`
}

/**
 * Aplica máscara ao telefone: (00) 0000-0000 ou (00) 00000-0000
 */
export function maskTelefone(valor: string): string {
  const v = valor.replace(/\D/g, '').slice(0, 11)
  if (v.length === 0) return ''
  if (v.length <= 2) return `(${v}`
  if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`
  if (v.length <= 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`
}

/**
 * Aplica máscara ao CEP: 00000-000
 */
export function maskCEP(valor: string): string {
  const v = valor.replace(/\D/g, '').slice(0, 8)
  if (v.length <= 5) return v
  return `${v.slice(0, 5)}-${v.slice(5)}`
}

/**
 * Remove máscara, retornando só dígitos
 */
export function unmask(valor: string): string {
  return valor.replace(/\D/g, '')
}
