import { Router } from 'express'
import { getDatabase } from '../database/db'
import { requireRole } from '../middleware/auth'
import type { DashboardAdmin, AnalyticsDashboard } from '../../shared/types'

const router = Router()

function formatarHoras(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`
}

// GET /api/admin/dashboard
router.get('/dashboard', requireRole('admin', 'rh'), (req, res) => {
  try {
    const db = getDatabase()
    const now = new Date()
    const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const total_funcionarios = (db.prepare('SELECT COUNT(*) as n FROM usuarios WHERE ativo = 1').get() as any).n
    const total_projetos_ativos = (db.prepare("SELECT COUNT(*) as n FROM projetos WHERE status = 'em_andamento'").get() as any).n

    // Cronômetros ativos
    const cronometros_ativos = (db.prepare(`SELECT u.nome as usuario_nome, p.nome as projeto_nome, cr.inicio FROM cronometros cr JOIN usuarios u ON u.id = cr.usuario_id JOIN projetos p ON p.id = cr.projeto_id WHERE cr.fim IS NULL`).all() as any[])
      .map((c) => ({ ...c, duracao_segundos: Math.max(0, Math.floor((Date.now() - new Date(c.inicio.replace(' ', 'T')).getTime()) / 1000)) }))
    const funcionarios_trabalhando = cronometros_ativos.length

    // Total horas do mês
    const inicio = `${mesAtual}-01 00:00:00`
    const fim = `${mesAtual}-31 23:59:59`
    const pontos = db.prepare(`SELECT * FROM pontos WHERE timestamp BETWEEN ? AND ?`).all(inicio, fim) as any[]
    let totalSeg = 0
    const byUser = new Map<number, any[]>()
    for (const p of pontos) {
      if (!byUser.has(p.usuario_id)) byUser.set(p.usuario_id, [])
      byUser.get(p.usuario_id)!.push(p)
    }
    for (const [, ps] of byUser) {
      const byDate = new Map<string, any[]>()
      for (const p of ps) {
        const d = p.timestamp.split(' ')[0]
        if (!byDate.has(d)) byDate.set(d, [])
        byDate.get(d)!.push(p)
      }
      for (const [, dps] of byDate) {
        const ord = [...dps].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        const ent = ord.find((p) => p.tipo === 'entrada')
        const sai = [...ord].reverse().find((p) => p.tipo === 'saida')
        if (!ent || !sai) continue
        let t = (new Date(sai.timestamp).getTime() - new Date(ent.timestamp).getTime()) / 1000
        const almIni = ord.find((p) => p.tipo === 'almoco_inicio')
        const almFim = ord.find((p) => p.tipo === 'almoco_fim')
        if (almIni && almFim) t -= (new Date(almFim.timestamp).getTime() - new Date(almIni.timestamp).getTime()) / 1000
        if (t > 0) totalSeg += t
      }
    }

    // Pontos hoje
    const todayStart = now.toISOString().split('T')[0] + ' 00:00:00'
    const todayEnd = now.toISOString().split('T')[0] + ' 23:59:59'
    const pontosHoje = db.prepare(`SELECT p.*, u.nome as usuario_nome, u.id as usuario_id FROM pontos p JOIN usuarios u ON u.id = p.usuario_id WHERE p.timestamp BETWEEN ? AND ? ORDER BY p.timestamp`).all(todayStart, todayEnd) as any[]

    const byUserHoje = new Map<number, { usuario_nome: string; pontos: any[] }>()
    for (const p of pontosHoje) {
      if (!byUserHoje.has(p.usuario_id)) byUserHoje.set(p.usuario_id, { usuario_nome: p.usuario_nome, pontos: [] })
      byUserHoje.get(p.usuario_id)!.pontos.push(p)
    }

    const pontos_hoje = Array.from(byUserHoje.values()).map(({ usuario_nome, pontos }) => {
      const ord = [...pontos].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const ent = ord.find((p) => p.tipo === 'entrada')
      const sai = ord.find((p) => p.tipo === 'saida')
      const almIni = ord.find((p) => p.tipo === 'almoco_inicio')
      const almFim = ord.find((p) => p.tipo === 'almoco_fim')
      const parIni = ord.filter((p) => p.tipo === 'parada_inicio').length
      const parFim = ord.filter((p) => p.tipo === 'parada_fim').length

      let status: string = 'ausente'
      if (sai) status = 'finalizado'
      else if (almIni && !almFim) status = 'almoco'
      else if (parIni > parFim) status = 'parada'
      else if (ent) status = 'trabalhando'

      let horas = '00h00'
      if (ent) {
        const fim2 = sai ? new Date(sai.timestamp) : new Date()
        let t = (fim2.getTime() - new Date(ent.timestamp).getTime()) / 1000
        if (almIni && almFim) t -= (new Date(almFim.timestamp).getTime() - new Date(almIni.timestamp).getTime()) / 1000
        horas = formatarHoras(Math.max(0, t))
      }

      return { usuario_id: pontos[0].usuario_id, usuario_nome, entrada: ent?.timestamp, saida: sai?.timestamp, horas, status }
    })

    res.json({ total_funcionarios, funcionarios_trabalhando, total_projetos_ativos, total_horas_mes: formatarHoras(totalSeg), cronometros_ativos, pontos_hoje } as DashboardAdmin)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/analytics
router.get('/analytics', requireRole('admin', 'rh'), (req, res) => {
  try {
    const db = getDatabase()
    const hoje = new Date().toISOString().split('T')[0]
    const em30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const ha6meses = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const projetos_status = db.prepare(`SELECT status, COUNT(*) as count FROM projetos GROUP BY status ORDER BY count DESC`).all() as any[]

    const projetos_atrasados = db.prepare(
      `SELECT p.*, c.nome as cliente_nome FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id WHERE p.status = 'em_andamento' AND p.data_prevista_fim IS NOT NULL AND p.data_prevista_fim < ? ORDER BY p.data_prevista_fim ASC`
    ).all(hoje) as any[]

    const projetos_prazo_proximo = db.prepare(
      `SELECT p.*, c.nome as cliente_nome FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id WHERE p.status = 'em_andamento' AND p.data_prevista_fim IS NOT NULL AND p.data_prevista_fim >= ? AND p.data_prevista_fim <= ? ORDER BY p.data_prevista_fim ASC`
    ).all(hoje, em30dias) as any[]

    const faturamento_mensal = db.prepare(
      `SELECT strftime('%Y-%m', data) as mes, SUM(valor) as total FROM lancamentos WHERE tipo = 'receita' AND data >= ? GROUP BY mes ORDER BY mes`
    ).all(ha6meses) as any[]

    const ticket_por_cliente = db.prepare(
      `SELECT c.nome as cliente_nome, COUNT(ct.id) as total_contratos, SUM(ct.valor) as total_valor, AVG(ct.valor) as media_valor FROM contratos ct LEFT JOIN clientes c ON c.id = ct.cliente_id WHERE ct.status != 'cancelado' GROUP BY ct.cliente_id ORDER BY total_valor DESC LIMIT 10`
    ).all() as any[]

    const projetos_por_cidade = db.prepare(
      `SELECT COALESCE(NULLIF(cidade, ''), 'Não informada') as cidade, COUNT(*) as count FROM (
        SELECT p.id, COALESCE(NULLIF(p.cidade, ''), (SELECT ct2.cidade FROM contratos ct2 WHERE ct2.projeto_id = p.id ORDER BY ct2.id DESC LIMIT 1)) as cidade
        FROM projetos p
      ) GROUP BY cidade ORDER BY count DESC`
    ).all() as any[]

    res.json({ projetos_status, projetos_atrasados, projetos_prazo_proximo, faturamento_mensal, ticket_por_cliente, projetos_por_cidade } as AnalyticsDashboard)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
