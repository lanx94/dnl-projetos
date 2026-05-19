import { ipcMain } from 'electron'
import { getDatabase } from '../database/db'
import { session } from './session'
import type { Ponto, PontosDoDia, TipoPonto } from '../../shared/types'

function todayBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  return { start: fmt(start), end: fmt(end) }
}

function formatarHoras(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`
}

function calcularTotalDia(pontos: Ponto[]): { trabalhadas: string; segundos: number } {
  if (pontos.length === 0) return { trabalhadas: '00h00', segundos: 0 }

  const ordenados = [...pontos].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const entrada = ordenados.find((p) => p.tipo === 'entrada')
  const saida = [...ordenados].reverse().find((p) => p.tipo === 'saida')
  if (!entrada) return { trabalhadas: '00h00', segundos: 0 }

  const fim = saida ? new Date(saida.timestamp) : new Date()
  let total = (fim.getTime() - new Date(entrada.timestamp).getTime()) / 1000

  const almIni = ordenados.find((p) => p.tipo === 'almoco_inicio')
  const almFim = ordenados.find((p) => p.tipo === 'almoco_fim')
  if (almIni && almFim) {
    total -=
      (new Date(almFim.timestamp).getTime() - new Date(almIni.timestamp).getTime()) / 1000
  }

  const paradasIni = ordenados.filter((p) => p.tipo === 'parada_inicio')
  const paradasFim = ordenados.filter((p) => p.tipo === 'parada_fim')
  for (let i = 0; i < paradasIni.length; i++) {
    const ini = paradasIni[i]
    const fimP = paradasFim[i]
    if (fimP) {
      total -=
        (new Date(fimP.timestamp).getTime() - new Date(ini.timestamp).getTime()) / 1000
    }
  }

  total = Math.max(0, total)
  return { trabalhadas: formatarHoras(total), segundos: total }
}

export function registrarHandlersPontos() {
  ipcMain.handle(
    'pontos:bater',
    async (_e, tipo: TipoPonto, observacao?: string): Promise<Ponto> => {
      const u = session.requireUser()
      const db = getDatabase()

      // Validação de tipo (defesa em profundidade — não confiar só no TS)
      const tiposValidos: TipoPonto[] = [
        'entrada',
        'almoco_inicio',
        'almoco_fim',
        'saida',
        'parada_inicio',
        'parada_fim'
      ]
      if (!tiposValidos.includes(tipo)) {
        throw new Error('Tipo de ponto inválido')
      }
      if (observacao && observacao.length > 500) {
        throw new Error('Observação muito longa (máx 500 caracteres)')
      }

      const { start, end } = todayBounds()
      const hoje = db
        .prepare(
          'SELECT * FROM pontos WHERE usuario_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp'
        )
        .all(u.id, start, end) as Ponto[]

      const tipos = hoje.map((p) => p.tipo)

      if (tipo === 'entrada' && tipos.includes('entrada'))
        throw new Error('Você já bateu entrada hoje')
      if (tipo === 'saida' && tipos.includes('saida')) throw new Error('Você já bateu saída hoje')
      if (tipo === 'almoco_inicio' && !tipos.includes('entrada'))
        throw new Error('Você precisa bater entrada antes do almoço')
      if (tipo === 'almoco_fim' && !tipos.includes('almoco_inicio'))
        throw new Error('Você precisa iniciar o almoço primeiro')
      if (tipo === 'almoco_fim' && tipos.includes('almoco_fim'))
        throw new Error('Você já voltou do almoço')

      // Validações de paradas extras
      if (tipo === 'parada_inicio') {
        if (!tipos.includes('entrada'))
          throw new Error('Você precisa bater entrada antes de iniciar uma parada')
        if (tipos.includes('saida')) throw new Error('Dia já encerrado')
        const totalIni = tipos.filter((t) => t === 'parada_inicio').length
        const totalFim = tipos.filter((t) => t === 'parada_fim').length
        if (totalIni > totalFim) throw new Error('Você já tem uma parada em andamento')
      }
      if (tipo === 'parada_fim') {
        const totalIni = tipos.filter((t) => t === 'parada_inicio').length
        const totalFim = tipos.filter((t) => t === 'parada_fim').length
        if (totalIni <= totalFim)
          throw new Error('Você não tem parada em andamento')
      }

      // Não pode bater saída com parada em andamento ou almoço em andamento
      if (tipo === 'saida') {
        const almIni = tipos.filter((t) => t === 'almoco_inicio').length
        const almFim = tipos.filter((t) => t === 'almoco_fim').length
        if (almIni > almFim) throw new Error('Você precisa voltar do almoço antes de bater saída')
        const parIni = tipos.filter((t) => t === 'parada_inicio').length
        const parFim = tipos.filter((t) => t === 'parada_fim').length
        if (parIni > parFim) throw new Error('Você precisa retomar o trabalho da parada antes de sair')
      }

      const result = db
        .prepare(`INSERT INTO pontos (usuario_id, tipo, observacao) VALUES (?, ?, ?)`)
        .run(u.id, tipo, observacao || null)

      return db.prepare('SELECT * FROM pontos WHERE id = ?').get(result.lastInsertRowid) as Ponto
    }
  )

  ipcMain.handle('pontos:hoje', async (): Promise<PontosDoDia> => {
    const u = session.requireUser()
    const db = getDatabase()
    const { start, end } = todayBounds()
    const lista = db
      .prepare(
        'SELECT * FROM pontos WHERE usuario_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp'
      )
      .all(u.id, start, end) as Ponto[]

    const result: PontosDoDia = { paradas_extras: [] }
    for (const p of lista) {
      switch (p.tipo) {
        case 'entrada':
          result.entrada = p
          break
        case 'almoco_inicio':
          result.almoco_inicio = p
          break
        case 'almoco_fim':
          result.almoco_fim = p
          break
        case 'saida':
          result.saida = p
          break
        case 'parada_inicio':
          result.paradas_extras.push({ inicio: p })
          break
        case 'parada_fim':
          const last = result.paradas_extras[result.paradas_extras.length - 1]
          if (last && !last.fim) last.fim = p
          break
      }
    }

    const calc = calcularTotalDia(lista)
    result.total_horas = calc.trabalhadas
    return result
  })

  ipcMain.handle(
    'pontos:periodo',
    async (_e, inicio: string, fim: string): Promise<Ponto[]> => {
      const u = session.requireUser()
      const db = getDatabase()
      return db
        .prepare(
          'SELECT * FROM pontos WHERE usuario_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp'
        )
        .all(u.id, inicio, fim) as Ponto[]
    }
  )
}
