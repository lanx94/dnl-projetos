import { Router } from 'express'
import { getDatabase } from '../database/db'
import type { Ponto, PontosDoDia, TipoPonto } from '../../shared/types'

const router = Router()

const TIPOS_VALIDOS: TipoPonto[] = ['entrada', 'almoco_inicio', 'almoco_fim', 'saida', 'parada_inicio', 'parada_fim']
const TIPOS_UNICOS: TipoPonto[] = ['entrada', 'almoco_inicio', 'almoco_fim', 'saida']
const ROTULOS_TIPO: Record<TipoPonto, string> = {
  entrada: 'Entrada',
  almoco_inicio: 'Almoço',
  almoco_fim: 'Volta do almoço',
  saida: 'Saída',
  parada_inicio: 'Parada extra',
  parada_fim: 'Retomada'
}

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

function dayBoundsFromTimestamp(timestamp: string) {
  const data = timestamp.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data/hora inválida')
  return { data, start: `${data} 00:00:00`, end: `${data} 23:59:59` }
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

// Admin/RH podem operar em nome de outro usuário (usuario_id vindo de query/body); demais só em si mesmos.
function resolverUsuarioAlvo(req: any, usuarioIdBruto: unknown): number {
  const u = req.currentUser
  const podeOperarOutro = u.role === 'admin' || u.role === 'rh'
  if (usuarioIdBruto === undefined || usuarioIdBruto === null || usuarioIdBruto === '') return u.id
  if (!podeOperarOutro) throw new Error('Sem permissão para operar em nome de outro usuário')
  const id = Number(usuarioIdBruto)
  if (!Number.isInteger(id) || id <= 0) throw new Error('usuario_id inválido')
  return id
}

function registrarAuditoria(
  db: ReturnType<typeof getDatabase>,
  args: {
    pontoId: number | null
    usuarioId: number
    editadoPor: number
    acao: 'criacao_manual' | 'edicao' | 'exclusao'
    tipo?: string
    valorAnterior?: string | null
    valorNovo?: string | null
    motivo: string
  }
) {
  db.prepare(
    `INSERT INTO pontos_auditoria (ponto_id, usuario_id, editado_por, acao, tipo, valor_anterior, valor_novo, motivo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(args.pontoId, args.usuarioId, args.editadoPor, args.acao, args.tipo || null, args.valorAnterior || null, args.valorNovo || null, args.motivo)
}

// POST /api/pontos/bater
router.post('/bater', (req, res) => {
  try {
    const u = req.currentUser
    const { tipo, observacao }: { tipo: TipoPonto; observacao?: string } = req.body

    if (!TIPOS_VALIDOS.includes(tipo)) throw new Error('Tipo de ponto inválido')
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

// GET /api/pontos/hoje?usuario_id= (admin/rh podem consultar outro usuário)
router.get('/hoje', (req, res) => {
  try {
    const usuarioId = resolverUsuarioAlvo(req, req.query.usuario_id)
    const db = getDatabase()
    const { start, end } = todayBounds()
    const lista = db.prepare('SELECT * FROM pontos WHERE usuario_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp').all(usuarioId, start, end) as Ponto[]

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
    res.status(400).json({ error: err.message })
  }
})

// GET /api/pontos/periodo?inicio=&fim=&usuario_id=
router.get('/periodo', (req, res) => {
  try {
    const { inicio, fim } = req.query as { inicio: string; fim: string }
    const usuarioId = resolverUsuarioAlvo(req, req.query.usuario_id)
    const db = getDatabase()
    const pontos = db.prepare('SELECT * FROM pontos WHERE usuario_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp').all(usuarioId, inicio, fim) as Ponto[]
    res.json(pontos)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/pontos/manual — cria um ponto retroativo (esqueceu de bater)
router.post('/manual', (req, res) => {
  try {
    const u = req.currentUser
    const { tipo, timestamp, motivo }: { tipo: TipoPonto; timestamp: string; motivo: string } = req.body
    const usuarioId = resolverUsuarioAlvo(req, req.body.usuario_id)

    if (!TIPOS_VALIDOS.includes(tipo)) throw new Error('Tipo de ponto inválido')
    if (!timestamp || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(timestamp)) throw new Error('Data/hora inválida (use AAAA-MM-DD HH:MM)')
    if (!motivo || !motivo.trim()) throw new Error('Informe o motivo da correção')
    if (motivo.length > 500) throw new Error('Motivo muito longo (máx 500 caracteres)')
    const timestampCompleto = timestamp.length === 16 ? `${timestamp}:00` : timestamp

    const db = getDatabase()
    const { data, start, end } = dayBoundsFromTimestamp(timestampCompleto)
    const doDia = db.prepare('SELECT * FROM pontos WHERE usuario_id = ? AND timestamp BETWEEN ? AND ?').all(usuarioId, start, end) as Ponto[]
    const existente = doDia.find((p) => p.tipo === tipo)
    if (TIPOS_UNICOS.includes(tipo) && existente) {
      throw new Error(`Já existe um registro de "${ROTULOS_TIPO[tipo]}" em ${data}. Edite-o na linha do tempo (ícone de lápis) em vez de criar um novo.`)
    }

    const result = db.prepare(
      `INSERT INTO pontos (usuario_id, tipo, timestamp, observacao, editado_por, editado_em, motivo_edicao, origem)
       VALUES (?, ?, ?, NULL, ?, datetime('now','localtime'), ?, 'manual')`
    ).run(usuarioId, tipo, timestampCompleto, u.id, motivo.trim())

    registrarAuditoria(db, {
      pontoId: Number(result.lastInsertRowid),
      usuarioId,
      editadoPor: u.id,
      acao: 'criacao_manual',
      tipo,
      valorNovo: timestampCompleto,
      motivo: motivo.trim()
    })

    const ponto = db.prepare('SELECT * FROM pontos WHERE id = ?').get(result.lastInsertRowid) as Ponto
    res.json(ponto)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// PUT /api/pontos/:id — corrige o horário de um ponto já batido
router.put('/:id', (req, res) => {
  try {
    const u = req.currentUser
    const id = Number(req.params.id)
    const { timestamp, motivo }: { timestamp: string; motivo: string } = req.body

    if (!timestamp || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(timestamp)) throw new Error('Data/hora inválida (use AAAA-MM-DD HH:MM)')
    if (!motivo || !motivo.trim()) throw new Error('Informe o motivo da correção')
    if (motivo.length > 500) throw new Error('Motivo muito longo (máx 500 caracteres)')
    const timestampCompleto = timestamp.length === 16 ? `${timestamp}:00` : timestamp

    const db = getDatabase()
    const ponto = db.prepare('SELECT * FROM pontos WHERE id = ?').get(id) as Ponto | undefined
    if (!ponto) throw new Error('Ponto não encontrado')
    if (ponto.usuario_id !== u.id && u.role !== 'admin' && u.role !== 'rh') throw new Error('Sem permissão para editar este ponto')

    db.prepare(
      `UPDATE pontos SET timestamp = ?, editado_por = ?, editado_em = datetime('now','localtime'), motivo_edicao = ? WHERE id = ?`
    ).run(timestampCompleto, u.id, motivo.trim(), id)

    registrarAuditoria(db, {
      pontoId: id,
      usuarioId: ponto.usuario_id,
      editadoPor: u.id,
      acao: 'edicao',
      tipo: ponto.tipo,
      valorAnterior: ponto.timestamp,
      valorNovo: timestampCompleto,
      motivo: motivo.trim()
    })

    const atualizado = db.prepare('SELECT * FROM pontos WHERE id = ?').get(id) as Ponto
    res.json(atualizado)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// DELETE /api/pontos/:id — remove um ponto batido por engano
router.delete('/:id', (req, res) => {
  try {
    const u = req.currentUser
    const id = Number(req.params.id)
    const { motivo }: { motivo: string } = req.body

    if (!motivo || !motivo.trim()) throw new Error('Informe o motivo da exclusão')
    if (motivo.length > 500) throw new Error('Motivo muito longo (máx 500 caracteres)')

    const db = getDatabase()
    const ponto = db.prepare('SELECT * FROM pontos WHERE id = ?').get(id) as Ponto | undefined
    if (!ponto) throw new Error('Ponto não encontrado')
    if (ponto.usuario_id !== u.id && u.role !== 'admin' && u.role !== 'rh') throw new Error('Sem permissão para excluir este ponto')

    registrarAuditoria(db, {
      pontoId: null,
      usuarioId: ponto.usuario_id,
      editadoPor: u.id,
      acao: 'exclusao',
      tipo: ponto.tipo,
      valorAnterior: ponto.timestamp,
      motivo: motivo.trim()
    })

    db.prepare('DELETE FROM pontos WHERE id = ?').run(id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
