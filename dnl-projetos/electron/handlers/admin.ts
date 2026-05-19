import { ipcMain } from 'electron'
import { getDatabase } from '../database/db'
import { session } from './session'
import type { DashboardAdmin, Ponto, Cronometro, User } from '../../shared/types'

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

function formatarHoras(seg: number): string {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`
}

function calcularDoDia(pontos: Ponto[]): number {
  if (pontos.length === 0) return 0
  const ord = [...pontos].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  const entrada = ord.find((p) => p.tipo === 'entrada')
  const saida = [...ord].reverse().find((p) => p.tipo === 'saida')
  if (!entrada) return 0
  const fim = saida ? new Date(saida.timestamp) : new Date()
  let total = (fim.getTime() - new Date(entrada.timestamp).getTime()) / 1000

  const aIni = ord.find((p) => p.tipo === 'almoco_inicio')
  const aFim = ord.find((p) => p.tipo === 'almoco_fim')
  if (aIni && aFim) {
    total -=
      (new Date(aFim.timestamp).getTime() - new Date(aIni.timestamp).getTime()) / 1000
  }

  const pIni = ord.filter((p) => p.tipo === 'parada_inicio')
  const pFim = ord.filter((p) => p.tipo === 'parada_fim')
  for (let i = 0; i < pIni.length; i++) {
    const f = pFim[i]
    if (f) {
      total -= (new Date(f.timestamp).getTime() - new Date(pIni[i].timestamp).getTime()) / 1000
    }
  }
  return Math.max(0, total)
}

function determinarStatus(
  pontos: Ponto[]
): 'trabalhando' | 'almoco' | 'parada' | 'finalizado' | 'ausente' {
  if (pontos.length === 0) return 'ausente'
  const ord = [...pontos].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  if (ord.find((p) => p.tipo === 'saida')) return 'finalizado'

  const tipos = ord.map((p) => p.tipo)
  const ultimoAlmoco = tipos.lastIndexOf('almoco_inicio')
  const ultimoVolta = tipos.lastIndexOf('almoco_fim')
  if (ultimoAlmoco > ultimoVolta) return 'almoco'

  const ultimaParada = tipos.lastIndexOf('parada_inicio')
  const ultimaRetomada = tipos.lastIndexOf('parada_fim')
  if (ultimaParada > ultimaRetomada) return 'parada'

  if (tipos.includes('entrada')) return 'trabalhando'
  return 'ausente'
}

export function registrarHandlersAdmin() {
  ipcMain.handle('admin:dashboard', async (): Promise<DashboardAdmin> => {
    session.requireRole('admin', 'rh')
    const db = getDatabase()
    const { start, end } = todayBounds()

    // Total de funcionários ativos
    const totalFuncs = (
      db.prepare("SELECT COUNT(*) as n FROM usuarios WHERE ativo = 1").get() as { n: number }
    ).n

    // Funcionários trabalhando (com entrada batida sem saída)
    const trabalhandoIds = db
      .prepare(
        `SELECT DISTINCT p.usuario_id
         FROM pontos p
         WHERE p.timestamp BETWEEN ? AND ? AND p.tipo = 'entrada'
         AND p.usuario_id NOT IN (
           SELECT usuario_id FROM pontos
           WHERE timestamp BETWEEN ? AND ? AND tipo = 'saida'
         )`
      )
      .all(start, end, start, end) as Array<{ usuario_id: number }>

    // Total de projetos ativos
    const totalProjetos = (
      db
        .prepare(
          "SELECT COUNT(*) as n FROM projetos WHERE status NOT IN ('concluido','cancelado')"
        )
        .get() as { n: number }
    ).n

    // Total de horas do mês (todos os funcionários)
    const mesAtual = new Date()
    const inicioMes = `${mesAtual.getFullYear()}-${String(mesAtual.getMonth() + 1).padStart(2, '0')}-01`
    const ultimoDia = new Date(
      mesAtual.getFullYear(),
      mesAtual.getMonth() + 1,
      0
    ).getDate()
    const fimMes = `${mesAtual.getFullYear()}-${String(mesAtual.getMonth() + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

    const pontosMes = db
      .prepare(
        `SELECT * FROM pontos
         WHERE date(timestamp) BETWEEN date(?) AND date(?)
         ORDER BY usuario_id, timestamp`
      )
      .all(inicioMes, fimMes) as Ponto[]

    // Agrupa por usuário+dia
    const porUsuarioDia = new Map<string, Ponto[]>()
    for (const p of pontosMes) {
      const dia = p.timestamp.slice(0, 10)
      const key = `${p.usuario_id}_${dia}`
      if (!porUsuarioDia.has(key)) porUsuarioDia.set(key, [])
      porUsuarioDia.get(key)!.push(p)
    }
    let totalSegundos = 0
    for (const ps of porUsuarioDia.values()) {
      totalSegundos += calcularDoDia(ps)
    }

    // Cronômetros ativos
    const cronometrosAtivos = db
      .prepare(
        `SELECT c.inicio, p.nome as projeto_nome, u.nome as usuario_nome
         FROM cronometros c
         JOIN projetos p ON p.id = c.projeto_id
         JOIN usuarios u ON u.id = c.usuario_id
         WHERE c.fim IS NULL`
      )
      .all() as Array<{ usuario_nome: string; projeto_nome: string; inicio: string }>

    // Pontos do dia para cada funcionário
    const usuarios = db
      .prepare(
        "SELECT id, nome FROM usuarios WHERE ativo = 1 AND role IN ('funcionario', 'rh', 'admin') ORDER BY nome"
      )
      .all() as Array<{ id: number; nome: string }>

    const pontosHoje = db
      .prepare(
        'SELECT * FROM pontos WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp'
      )
      .all(start, end) as Ponto[]

    const pontosPorUsuario = new Map<number, Ponto[]>()
    for (const p of pontosHoje) {
      if (!pontosPorUsuario.has(p.usuario_id)) pontosPorUsuario.set(p.usuario_id, [])
      pontosPorUsuario.get(p.usuario_id)!.push(p)
    }

    const pontosHojeAgg = usuarios.map((u) => {
      const ps = pontosPorUsuario.get(u.id) || []
      const entrada = ps.find((p) => p.tipo === 'entrada')
      const saida = ps.find((p) => p.tipo === 'saida')
      const horas = formatarHoras(calcularDoDia(ps))
      const status = determinarStatus(ps)
      return {
        usuario_id: u.id,
        usuario_nome: u.nome,
        entrada: entrada?.timestamp,
        saida: saida?.timestamp,
        horas,
        status
      }
    })

    return {
      total_funcionarios: totalFuncs,
      funcionarios_trabalhando: trabalhandoIds.length,
      total_projetos_ativos: totalProjetos,
      total_horas_mes: formatarHoras(totalSegundos),
      cronometros_ativos: cronometrosAtivos,
      pontos_hoje: pontosHojeAgg
    }
  })
}
