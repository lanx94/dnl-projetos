import { ipcMain } from 'electron'
import { getDatabase } from '../database/db'
import { session } from './session'
import type {
  RelatorioDiario,
  RelatorioHoras,
  ResumoMensal,
  Ponto
} from '../../shared/types'

function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function formatarHoras(seg: number): string {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`
}

function calcularDoDia(
  pontos: Ponto[]
): { trabalhadas: string; segundos: number; paradas: string } {
  if (pontos.length === 0) return { trabalhadas: '00h00', segundos: 0, paradas: '00h00' }
  const ord = [...pontos].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  const entrada = ord.find((p) => p.tipo === 'entrada')
  const saida = [...ord].reverse().find((p) => p.tipo === 'saida')
  if (!entrada) return { trabalhadas: '00h00', segundos: 0, paradas: '00h00' }

  const fim = saida ? new Date(saida.timestamp) : new Date()
  let total = (fim.getTime() - new Date(entrada.timestamp).getTime()) / 1000
  let paradasSeg = 0

  const aIni = ord.find((p) => p.tipo === 'almoco_inicio')
  const aFim = ord.find((p) => p.tipo === 'almoco_fim')
  if (aIni && aFim) {
    const dur =
      (new Date(aFim.timestamp).getTime() - new Date(aIni.timestamp).getTime()) / 1000
    total -= dur
    paradasSeg += dur
  }

  const pIni = ord.filter((p) => p.tipo === 'parada_inicio')
  const pFim = ord.filter((p) => p.tipo === 'parada_fim')
  for (let i = 0; i < pIni.length; i++) {
    const f = pFim[i]
    if (f) {
      const dur = (new Date(f.timestamp).getTime() - new Date(pIni[i].timestamp).getTime()) / 1000
      total -= dur
      paradasSeg += dur
    }
  }

  total = Math.max(0, total)
  return {
    trabalhadas: formatarHoras(total),
    segundos: total,
    paradas: formatarHoras(paradasSeg)
  }
}

export function registrarHandlersRelatorios() {
  ipcMain.handle(
    'relatorios:salvarDiario',
    async (
      _e,
      conteudo: string,
      revisao: string,
      projeto_id?: number
    ): Promise<RelatorioDiario> => {
      const u = session.requireUser()
      const db = getDatabase()

      const linhas = conteudo.split('\n').filter((l) => l.trim()).length
      if (linhas > 5) throw new Error('Relatório diário deve ter no máximo 5 linhas')
      if (!conteudo.trim()) throw new Error('Relatório não pode estar vazio')
      if (!revisao.trim()) throw new Error('Informe a revisão atual do projeto')

      const data = hojeISO()
      db.prepare(
        `INSERT INTO relatorios_diarios (usuario_id, data, conteudo, revisao, projeto_id)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(usuario_id, data) DO UPDATE SET
           conteudo = excluded.conteudo,
           revisao = excluded.revisao,
           projeto_id = excluded.projeto_id`
      ).run(u.id, data, conteudo, revisao, projeto_id || null)

      return db
        .prepare('SELECT * FROM relatorios_diarios WHERE usuario_id = ? AND data = ?')
        .get(u.id, data) as RelatorioDiario
    }
  )

  ipcMain.handle('relatorios:diarioHoje', async (): Promise<RelatorioDiario | null> => {
    const u = session.requireUser()
    const db = getDatabase()
    return (
      (db
        .prepare('SELECT * FROM relatorios_diarios WHERE usuario_id = ? AND data = ?')
        .get(u.id, hojeISO()) as RelatorioDiario) || null
    )
  })

  ipcMain.handle(
    'relatorios:horasPorPeriodo',
    async (_e, inicio: string, fim: string, usuario_id?: number): Promise<RelatorioHoras[]> => {
      const u = session.requireUser()
      const db = getDatabase()

      let alvoId = u.id
      if (usuario_id && usuario_id !== u.id) {
        if (u.role !== 'admin') throw new Error('Apenas admin pode ver dados de outros usuários')
        alvoId = usuario_id
      }

      const pontos = db
        .prepare(
          `SELECT * FROM pontos
           WHERE usuario_id = ? AND date(timestamp) BETWEEN date(?) AND date(?)
           ORDER BY timestamp`
        )
        .all(alvoId, inicio, fim) as Ponto[]

      const porDia = new Map<string, Ponto[]>()
      for (const p of pontos) {
        const dia = p.timestamp.slice(0, 10)
        if (!porDia.has(dia)) porDia.set(dia, [])
        porDia.get(dia)!.push(p)
      }

      const result: RelatorioHoras[] = []
      for (const [data, ps] of [...porDia.entries()].sort()) {
        const calc = calcularDoDia(ps)
        result.push({
          data,
          horas_trabalhadas: calc.trabalhadas,
          horas_em_segundos: calc.segundos,
          total_paradas: calc.paradas,
          pontos: ps
        })
      }
      return result
    }
  )

  ipcMain.handle(
    'relatorios:resumoMensal',
    async (_e, mes: string, usuario_id?: number): Promise<ResumoMensal> => {
      const u = session.requireUser()
      let alvoId = u.id
      if (usuario_id && usuario_id !== u.id) {
        if (u.role !== 'admin') throw new Error('Apenas admin pode ver dados de outros usuários')
        alvoId = usuario_id
      }
      const inicio = `${mes}-01`
      const [yy, mm] = mes.split('-').map(Number)
      const ultimoDia = new Date(yy, mm, 0).getDate()
      const fim = `${mes}-${String(ultimoDia).padStart(2, '0')}`

      const db = getDatabase()
      const pontos = db
        .prepare(
          `SELECT * FROM pontos
           WHERE usuario_id = ? AND date(timestamp) BETWEEN date(?) AND date(?)
           ORDER BY timestamp`
        )
        .all(alvoId, inicio, fim) as Ponto[]

      const porDia = new Map<string, Ponto[]>()
      for (const p of pontos) {
        const dia = p.timestamp.slice(0, 10)
        if (!porDia.has(dia)) porDia.set(dia, [])
        porDia.get(dia)!.push(p)
      }

      let totalSeg = 0
      for (const ps of porDia.values()) totalSeg += calcularDoDia(ps).segundos

      const dias = porDia.size
      const media = dias > 0 ? totalSeg / dias : 0

      return {
        mes,
        total_horas: formatarHoras(totalSeg),
        total_segundos: totalSeg,
        dias_trabalhados: dias,
        media_diaria: formatarHoras(media)
      }
    }
  )
}
