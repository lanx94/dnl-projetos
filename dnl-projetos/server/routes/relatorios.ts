import { Router } from 'express'
import { getDatabase } from '../database/db'
import type { RelatorioDiario, RelatorioHoras, ResumoMensal } from '../../shared/types'

const router = Router()

function todayStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatarHoras(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`
}

// POST /api/relatorios/diario
router.post('/diario', (req, res) => {
  try {
    const u = req.currentUser
    const { conteudo, revisao, projeto_id } = req.body
    const data = todayStr()
    const db = getDatabase()
    db.prepare(`INSERT INTO relatorios_diarios (usuario_id, data, conteudo, revisao, projeto_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(usuario_id, data) DO UPDATE SET conteudo = excluded.conteudo, revisao = excluded.revisao, projeto_id = excluded.projeto_id`).run(u.id, data, conteudo, revisao, projeto_id || null)
    const row = db.prepare('SELECT * FROM relatorios_diarios WHERE usuario_id = ? AND data = ?').get(u.id, data) as RelatorioDiario
    res.json(row)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/relatorios/diario/hoje
router.get('/diario/hoje', (req, res) => {
  try {
    const u = req.currentUser
    const row = getDatabase().prepare('SELECT * FROM relatorios_diarios WHERE usuario_id = ? AND data = ?').get(u.id, todayStr()) as RelatorioDiario | undefined
    res.json(row || null)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/relatorios/horas?inicio=&fim=&usuario_id=
router.get('/horas', (req, res) => {
  try {
    const u = req.currentUser
    const { inicio, fim, usuario_id } = req.query as { inicio: string; fim: string; usuario_id?: string }
    const db = getDatabase()
    const targetId = (u.role === 'admin' || u.role === 'rh') && usuario_id ? Number(usuario_id) : u.id

    const pontos = db.prepare(`SELECT * FROM pontos WHERE usuario_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp`).all(targetId, inicio + ' 00:00:00', fim + ' 23:59:59') as any[]

    const byDate = new Map<string, any[]>()
    for (const p of pontos) {
      const date = p.timestamp.split(' ')[0]
      if (!byDate.has(date)) byDate.set(date, [])
      byDate.get(date)!.push(p)
    }

    const result: RelatorioHoras[] = []
    for (const [data, ps] of byDate) {
      const ord = [...ps].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const entrada = ord.find((p: any) => p.tipo === 'entrada')
      const saida = [...ord].reverse().find((p: any) => p.tipo === 'saida')
      if (!entrada) { result.push({ data, horas_trabalhadas: '00h00', horas_em_segundos: 0, total_paradas: '00h00', pontos: ps }); continue }
      let total = ((saida ? new Date(saida.timestamp) : new Date()).getTime() - new Date(entrada.timestamp).getTime()) / 1000
      const almIni = ord.find((p: any) => p.tipo === 'almoco_inicio')
      const almFim = ord.find((p: any) => p.tipo === 'almoco_fim')
      if (almIni && almFim) total -= (new Date(almFim.timestamp).getTime() - new Date(almIni.timestamp).getTime()) / 1000
      let paradas = 0
      const parIni = ord.filter((p: any) => p.tipo === 'parada_inicio')
      const parFim = ord.filter((p: any) => p.tipo === 'parada_fim')
      for (let i = 0; i < parIni.length; i++) {
        if (parFim[i]) { const d = (new Date(parFim[i].timestamp).getTime() - new Date(parIni[i].timestamp).getTime()) / 1000; total -= d; paradas += d }
      }
      total = Math.max(0, total)
      result.push({ data, horas_trabalhadas: formatarHoras(total), horas_em_segundos: total, total_paradas: formatarHoras(paradas), pontos: ps })
    }

    res.json(result.sort((a, b) => a.data.localeCompare(b.data)))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/relatorios/mensal?mes=YYYY-MM&usuario_id=
router.get('/mensal', (req, res) => {
  try {
    const u = req.currentUser
    const { mes, usuario_id } = req.query as { mes: string; usuario_id?: string }
    const db = getDatabase()
    const targetId = (u.role === 'admin' || u.role === 'rh') && usuario_id ? Number(usuario_id) : u.id

    const [yMes, mMes] = mes.split('-').map(Number)
    const ultimoDia = new Date(yMes, mMes, 0).getDate()
    const inicio = `${mes}-01 00:00:00`
    const fim = `${mes}-${String(ultimoDia).padStart(2, '0')} 23:59:59`
    const pontos = db.prepare(`SELECT * FROM pontos WHERE usuario_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp`).all(targetId, inicio, fim) as any[]

    const byDate = new Map<string, any[]>()
    for (const p of pontos) {
      const date = p.timestamp.split(' ')[0]
      if (!byDate.has(date)) byDate.set(date, [])
      byDate.get(date)!.push(p)
    }

    let totalSeg = 0
    let diasTrab = 0
    for (const [, ps] of byDate) {
      const ord = [...ps].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const entrada = ord.find((p: any) => p.tipo === 'entrada')
      const saida = [...ord].reverse().find((p: any) => p.tipo === 'saida')
      if (!entrada || !saida) continue
      let total = (new Date(saida.timestamp).getTime() - new Date(entrada.timestamp).getTime()) / 1000
      const almIni = ord.find((p: any) => p.tipo === 'almoco_inicio')
      const almFim = ord.find((p: any) => p.tipo === 'almoco_fim')
      if (almIni && almFim) total -= (new Date(almFim.timestamp).getTime() - new Date(almIni.timestamp).getTime()) / 1000
      const parIni = ord.filter((p: any) => p.tipo === 'parada_inicio')
      const parFim = ord.filter((p: any) => p.tipo === 'parada_fim')
      for (let i = 0; i < parIni.length; i++) {
        if (parFim[i]) total -= (new Date(parFim[i].timestamp).getTime() - new Date(parIni[i].timestamp).getTime()) / 1000
      }
      if (total > 0) { totalSeg += total; diasTrab++ }
    }

    const resultado: ResumoMensal = {
      mes,
      total_horas: formatarHoras(totalSeg),
      total_segundos: totalSeg,
      dias_trabalhados: diasTrab,
      media_diaria: diasTrab > 0 ? formatarHoras(totalSeg / diasTrab) : '00h00'
    }
    res.json(resultado)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
