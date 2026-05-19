import { Router } from 'express'
import ExcelJS from 'exceljs'
import { getDatabase } from '../database/db'
import { requireRole } from '../middleware/auth'

const router = Router()

const TIPO_PONTO_LABEL: Record<string, string> = {
  entrada: 'Entrada',
  almoco_inicio: 'Início almoço',
  almoco_fim: 'Volta almoço',
  saida: 'Saída',
  parada_inicio: 'Início parada',
  parada_fim: 'Fim parada'
}

function formatarHoras(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`
}

function aplicarCabecalho(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1)
  row.font = { bold: true, color: { argb: 'FFFAF9F4' } }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } }
  row.alignment = { vertical: 'middle', horizontal: 'left' }
  row.height = 22
}

// GET /api/exports/pontos-excel?inicio=&fim=&usuario_id=
router.get('/pontos-excel', requireRole('admin', 'rh'), async (req, res) => {
  try {
    const u = req.currentUser
    const { inicio, fim, usuario_id } = req.query as { inicio: string; fim: string; usuario_id?: string }
    const db = getDatabase()
    const ehAdminOuRH = u.role === 'admin' || u.role === 'rh'
    const targetId = ehAdminOuRH && usuario_id ? Number(usuario_id) : u.id

    const whereParts = ['date(p.timestamp) BETWEEN ? AND ?']
    const params: any[] = [inicio, fim]
    if (targetId) { whereParts.push('p.usuario_id = ?'); params.push(targetId) }

    const pontos = db.prepare(`SELECT p.*, u.nome as usuario_nome FROM pontos p JOIN usuarios u ON u.id = p.usuario_id WHERE ${whereParts.join(' AND ')} ORDER BY p.usuario_id, p.timestamp`).all(...params) as any[]

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Pontos')
    ws.columns = [
      { header: 'Funcionário', key: 'nome', width: 25 },
      { header: 'Data', key: 'data', width: 12 },
      { header: 'Horário', key: 'hora', width: 10 },
      { header: 'Tipo', key: 'tipo', width: 18 },
      { header: 'Observação', key: 'obs', width: 30 }
    ]
    aplicarCabecalho(ws)

    for (const p of pontos) {
      const [data, hora] = p.timestamp.split(' ')
      ws.addRow({ nome: p.usuario_nome, data, hora, tipo: TIPO_PONTO_LABEL[p.tipo] || p.tipo, obs: p.observacao || '' })
    }

    const nome = `pontos-${inicio}-a-${fim}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`)
    await wb.xlsx.write(res)
    res.end()
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/exports/horas-projeto-excel?inicio=&fim=&usuario_id=&projeto_id=
router.get('/horas-projeto-excel', requireRole('admin', 'rh'), async (req, res) => {
  try {
    const u = req.currentUser
    const { inicio, fim, usuario_id, projeto_id } = req.query as any
    const db = getDatabase()
    const ehAdminOuRH = u.role === 'admin' || u.role === 'rh'
    const targetId = ehAdminOuRH && usuario_id ? Number(usuario_id) : u.id

    const whereParts = ['date(cr.inicio) BETWEEN ? AND ?']
    const params: any[] = [inicio, fim]
    if (targetId) { whereParts.push('cr.usuario_id = ?'); params.push(targetId) }
    if (projeto_id) { whereParts.push('cr.projeto_id = ?'); params.push(Number(projeto_id)) }

    const cronometros = db.prepare(`SELECT cr.*, u.nome as usuario_nome, p.nome as projeto_nome FROM cronometros cr JOIN usuarios u ON u.id = cr.usuario_id JOIN projetos p ON p.id = cr.projeto_id WHERE ${whereParts.join(' AND ')} ORDER BY cr.inicio`).all(...params) as any[]

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Horas por Projeto')
    ws.columns = [
      { header: 'Funcionário', key: 'func', width: 25 },
      { header: 'Projeto', key: 'proj', width: 30 },
      { header: 'Data', key: 'data', width: 12 },
      { header: 'Início', key: 'inicio', width: 10 },
      { header: 'Fim', key: 'fim', width: 10 },
      { header: 'Duração', key: 'dur', width: 10 },
      { header: 'Observação', key: 'obs', width: 30 }
    ]
    aplicarCabecalho(ws)

    for (const cr of cronometros) {
      const [data, horaIni] = cr.inicio.split(' ')
      const horaFim = cr.fim ? cr.fim.split(' ')[1] : ''
      const dur = cr.fim ? formatarHoras(Math.round((new Date(cr.fim).getTime() - new Date(cr.inicio).getTime()) / 1000)) : ''
      ws.addRow({ func: cr.usuario_nome, proj: cr.projeto_nome, data, inicio: horaIni, fim: horaFim, dur, obs: cr.observacao || '' })
    }

    const nome = `horas-projeto-${inicio}-a-${fim}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`)
    await wb.xlsx.write(res)
    res.end()
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
