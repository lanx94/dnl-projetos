import { Router } from 'express'
import { getDatabase } from '../database/db'
import type { Ponto, PontosDoDia, TipoPonto } from '../../shared/types'

const router = Router()

function todayBounds() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = now.getFullYear()
  const m = pad(now.getMonth() + 1)
  const d = pad(now.getDate())
  return {
    start: `${y}-${m}-${d} 00:00:00`,
    end: `${y}-${m}-${d} 23:59:59`
  }
}

function formatarHoras(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const mn = Math.floor((segundos % 3600) / 60)
  return `${String(h).padStart(2, '0')}h${String(mn).padStart(2, '0')}`
}

function calcularTotalDia(pontos: Ponto[]): string {
  if (pontos.length === 0) return '00h00'
  const ord = [...pontos].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const entrada = ord.find((p) => p.tipo === 'entrada')
  const saida = [...ord].reverse().find((p) => p.tipo === 'saida')
  if (!entrada) return '00h00'
  const fim = saida ? new Date(saida.timestamp) : new Date()
  let total = (fim.getTime() - new Date(entrada.timestamp).getTime()) / 1000
  const almIni = ord.find((p) => p.tipo === 'almoco_inicio')
  const almFim = ord.find((p) => p.tipo === 'almoco_fim')
  if (almIni && almFim) total -= (new Date(almFim.timestamp).getTime() - new Date(almIni.timestamp).getTime()) / 1000
  const parIni = ord.filter((p) => p.tipo === 'parada_inicio')
  const parFim = ord.filter((p) => p.tipo === 'parada_fim')
  for (let i = 0; i < parIni.length; i++) {
    if (parFim[i]) total -= (new Date(parFim[i].timestamp).getTime() - new Date(parIni[i].timestamp).getTime()) / 1000
  }
  return formatarHoras(Math.max(0, total))
}

// POST /api/pontos/bater
router.post('/bater', (req, res) => {
  try {
    const u = req.currentUser
    const { tipo, observacao }: { tipo: TipoPonto; observacao?: string } = req.body

    const tiposValidos: TipoPonto[] = ['entrada', 'almoco_inicio', 'almoco_fim', 'saida', 'parada_inicio', 'parada_fim']
    if (!tiposValidos.includes(tipo)) throw new Error('Tipo de ponto inválido')
    if (observacao && observacao.length > 500) throw new Error('Observação muito longa (máx 500 caracteres)')

    const db = getDatabase()
    const { start, end } = todayBounds()
    const hoje = db.prepare('SELECT * FROM pontos WHERE usuario_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp').all(u.id, start, end) as Ponto[]
    const tipos = hoje.map((p) => p.tipo)

    if (tipo === 'entrada' && tipos.includes('entrada')) throw new Error('Você já bateu entrada hoje')
    if (tipo === 'saida' && tipos.includes('saida')) throw new Error('Você já bateu saída hoje')
    if (tipo === 'almoco_inicio' && !tipos.includes('entrada')) throw new Error('Você precisa bater entrada antes do almoço')
    if (tipo === 'almoco_fim' && !tipos.includes('almoco_inicio')) throw new Error('Você precisa iniciar o almoço primeiro')
    if (tipo === 'almoco_fim' && tipos.includes('almoco_fim')) throw new Error('Você já voltou do almoço')

    if (tipo === 'parada_inicio') {
      if (!tipos.includes('entrada')) throw new Error('Você precisa bater entrada antes de iniciar uma parada')
      if (tipos.includes('saida')) throw new Error('Dia já encerrado')
      const ini = tipos.filter((t) => t === 'parada_inicio').length
      const fim = tipos.filter((t) => t === 'parada_fim').length
      if (ini > fim) throw new Error('Você já tem uma parada em andamento')
    }
    if (tipo === 'parada_fim') {
      const ini = tipos.filter((t) => t === 'parada_inicio').length
      const fim = tipos.filter((t) => t === 'parada_fim').length
      if (ini <= fim) throw new Error('Você não tem parada em andamento')
    }
    if (tipo === 'saida') {
      const almIni = tipos.filter((t) => t === 'almoco_inicio').length
      const almFim = tipos.filter((t) => t === 'almoco_fim').length
      if (almIni > almFim) throw new Error('Você precisa voltar do almoço antes de bater saída')
      const parIni = tipos.filter((t) => t === 'parada_inicio').length
      const parFim = tipos.filter((t) => t === 'parada_fim').length
      if (parIni > parFim) throw new Error('Você precisa retomar o trabalho da parada antes de sair')
    }

    const result = db.prepare('INSERT INTO pontos (usuario_id, tipo, observacao) VALUES (?, ?, ?)').run(u.id, tipo, observacao || null)
    const ponto = db.prepare('SELECT * FROM pontos WHERE id = ?').get(result.lastInsertRowid) as Ponto
    res.json(ponto)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/pontos/hoje
router.get('/hoje', (req, res) => {
  try {
    const u = req.currentUser
    const db = getDatabase()
    const { start, end } = todayBounds()
    const lista = db.prepare('SELECT * FROM pontos WHERE usuario_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp').all(u.id, start, end) as Ponto[]

    const result: PontosDoDia = { paradas_extras: [] }
    for (const p of lista) {
      switch (p.tipo) {
        case 'entrada': result.entrada = p; break
        case 'almoco_inicio': result.almoco_inicio = p; break
        case 'almoco_fim': result.almoco_fim = p; break
        case 'saida': result.saida = p; break
        case 'parada_inicio': result.paradas_extras.push({ inicio: p }); break
        case 'parada_fim': {
          const last = result.paradas_extras[result.paradas_extras.length - 1]
          if (last && !last.fim) last.fim = p
          break
        }
      }
    }
    result.total_horas = calcularTotalDia(lista)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/pontos/periodo?inicio=&fim=
router.get('/periodo', (req, res) => {
  try {
    const u = req.currentUser
    const { inicio, fim } = req.query as { inicio: string; fim: string }
    const db = getDatabase()
    const pontos = db.prepare('SELECT * FROM pontos WHERE usuario_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp').all(u.id, inicio, fim) as Ponto[]
    res.json(pontos)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
