import { Router } from 'express'
import { getDatabase } from '../database/db'
import type { Cronometro } from '../../shared/types'

const router = Router()

function calcDuracao(inicio: string, fim: string | null | undefined): number | undefined {
  if (!fim) return undefined
  return Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 1000)
}

function validarDataHora(valor: string, campo: string): string {
  if (!valor || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(valor)) {
    throw new Error(`${campo} inválido (use AAAA-MM-DD HH:MM)`)
  }
  return valor.length === 16 ? `${valor}:00` : valor
}

function validarMotivo(motivo: string): string {
  if (!motivo || !motivo.trim()) throw new Error('Informe o motivo da correção')
  if (motivo.length > 500) throw new Error('Motivo muito longo (máx 500 caracteres)')
  return motivo.trim()
}

// Admin/RH podem operar em nome de outro usuário; demais só em si mesmos.
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
    cronometroId: number | null
    usuarioId: number
    editadoPor: number
    acao: 'criacao_manual' | 'edicao' | 'exclusao'
    valorAnterior?: string | null
    valorNovo?: string | null
    motivo: string
  }
) {
  db.prepare(
    `INSERT INTO cronometros_auditoria (cronometro_id, usuario_id, editado_por, acao, valor_anterior, valor_novo, motivo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(args.cronometroId, args.usuarioId, args.editadoPor, args.acao, args.valorAnterior || null, args.valorNovo || null, args.motivo)
}

// POST /api/cronometro/iniciar
router.post('/iniciar', (req, res) => {
  try {
    const u = req.currentUser
    const { projeto_id, observacao } = req.body
    if (!projeto_id) throw new Error('projeto_id é obrigatório')
    const db = getDatabase()

    const projetoExiste = db.prepare('SELECT id FROM projetos WHERE id = ?').get(Number(projeto_id))
    if (!projetoExiste) throw new Error('Projeto não encontrado')

    const ativo = db.prepare('SELECT * FROM cronometros WHERE usuario_id = ? AND fim IS NULL').get(u.id) as Cronometro | undefined
    if (ativo) throw new Error('Você já tem um cronômetro ativo. Pare-o antes de iniciar outro.')

    const result = db.prepare('INSERT INTO cronometros (usuario_id, projeto_id, inicio, observacao) VALUES (?, ?, datetime(\'now\',\'localtime\'), ?)').run(u.id, projeto_id, observacao || null)
    const c = db.prepare(`SELECT cr.*, p.nome as projeto_nome FROM cronometros cr LEFT JOIN projetos p ON p.id = cr.projeto_id WHERE cr.id = ?`).get(result.lastInsertRowid) as any
    c.duracao_segundos = undefined
    res.json(c)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/cronometro/parar/:id
router.post('/parar/:id', (req, res) => {
  try {
    const u = req.currentUser
    const id = Number(req.params.id)
    const db = getDatabase()
    const c = db.prepare('SELECT * FROM cronometros WHERE id = ? AND usuario_id = ?').get(id, u.id) as Cronometro | undefined
    if (!c) throw new Error('Cronômetro não encontrado')
    if (c.fim) throw new Error('Cronômetro já foi parado')
    db.prepare("UPDATE cronometros SET fim = datetime('now','localtime') WHERE id = ?").run(id)
    const updated = db.prepare(`SELECT cr.*, p.nome as projeto_nome FROM cronometros cr LEFT JOIN projetos p ON p.id = cr.projeto_id WHERE cr.id = ?`).get(id) as any
    updated.duracao_segundos = calcDuracao(updated.inicio, updated.fim)
    res.json(updated)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/cronometro/ativo?usuario_id=
router.get('/ativo', (req, res) => {
  try {
    const usuarioId = resolverUsuarioAlvo(req, req.query.usuario_id)
    const c = getDatabase().prepare(`SELECT cr.*, p.nome as projeto_nome FROM cronometros cr LEFT JOIN projetos p ON p.id = cr.projeto_id WHERE cr.usuario_id = ? AND cr.fim IS NULL`).get(usuarioId) as any
    res.json(c || null)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/cronometro/historico?limit=&usuario_id=
router.get('/historico', (req, res) => {
  try {
    const usuarioId = resolverUsuarioAlvo(req, req.query.usuario_id)
    const limit = Number(req.query.limit) || 20
    const lista = getDatabase().prepare(`SELECT cr.*, p.nome as projeto_nome FROM cronometros cr LEFT JOIN projetos p ON p.id = cr.projeto_id WHERE cr.usuario_id = ? ORDER BY cr.inicio DESC LIMIT ?`).all(usuarioId, limit) as any[]
    const result = lista.map((c) => ({ ...c, duracao_segundos: calcDuracao(c.inicio, c.fim) }))
    res.json(result)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/cronometro/manual — registra uma sessão retroativa (esqueceu de usar o cronômetro)
router.post('/manual', (req, res) => {
  try {
    const u = req.currentUser
    const { projeto_id, observacao } = req.body
    const motivo = validarMotivo(req.body.motivo)
    const inicio = validarDataHora(req.body.inicio, 'Início')
    const fim = validarDataHora(req.body.fim, 'Fim')
    const usuarioId = resolverUsuarioAlvo(req, req.body.usuario_id)

    if (!projeto_id) throw new Error('projeto_id é obrigatório')
    if (new Date(fim).getTime() <= new Date(inicio).getTime()) throw new Error('O fim deve ser depois do início')

    const db = getDatabase()
    const projetoExiste = db.prepare('SELECT id FROM projetos WHERE id = ?').get(Number(projeto_id))
    if (!projetoExiste) throw new Error('Projeto não encontrado')

    const result = db.prepare(
      `INSERT INTO cronometros (usuario_id, projeto_id, inicio, fim, observacao, editado_por, editado_em, motivo_edicao, origem)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'), ?, 'manual')`
    ).run(usuarioId, projeto_id, inicio, fim, observacao || null, u.id, motivo)

    registrarAuditoria(db, {
      cronometroId: Number(result.lastInsertRowid),
      usuarioId,
      editadoPor: u.id,
      acao: 'criacao_manual',
      valorNovo: JSON.stringify({ inicio, fim }),
      motivo
    })

    const c = db.prepare(`SELECT cr.*, p.nome as projeto_nome FROM cronometros cr LEFT JOIN projetos p ON p.id = cr.projeto_id WHERE cr.id = ?`).get(result.lastInsertRowid) as any
    c.duracao_segundos = calcDuracao(c.inicio, c.fim)
    res.json(c)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// PUT /api/cronometro/:id — corrige início/fim de uma sessão
router.put('/:id', (req, res) => {
  try {
    const u = req.currentUser
    const id = Number(req.params.id)
    const motivo = validarMotivo(req.body.motivo)

    const db = getDatabase()
    const c = db.prepare('SELECT * FROM cronometros WHERE id = ?').get(id) as Cronometro | undefined
    if (!c) throw new Error('Cronômetro não encontrado')
    if (c.usuario_id !== u.id && u.role !== 'admin' && u.role !== 'rh') throw new Error('Sem permissão para editar este cronômetro')

    const novoInicio = req.body.inicio ? validarDataHora(req.body.inicio, 'Início') : c.inicio
    const novoFim = req.body.fim ? validarDataHora(req.body.fim, 'Fim') : c.fim
    if (novoFim && new Date(novoFim).getTime() <= new Date(novoInicio).getTime()) throw new Error('O fim deve ser depois do início')

    db.prepare(
      `UPDATE cronometros SET inicio = ?, fim = ?, editado_por = ?, editado_em = datetime('now','localtime'), motivo_edicao = ? WHERE id = ?`
    ).run(novoInicio, novoFim || null, u.id, motivo, id)

    registrarAuditoria(db, {
      cronometroId: id,
      usuarioId: c.usuario_id,
      editadoPor: u.id,
      acao: 'edicao',
      valorAnterior: JSON.stringify({ inicio: c.inicio, fim: c.fim }),
      valorNovo: JSON.stringify({ inicio: novoInicio, fim: novoFim }),
      motivo
    })

    const atualizado = db.prepare(`SELECT cr.*, p.nome as projeto_nome FROM cronometros cr LEFT JOIN projetos p ON p.id = cr.projeto_id WHERE cr.id = ?`).get(id) as any
    atualizado.duracao_segundos = calcDuracao(atualizado.inicio, atualizado.fim)
    res.json(atualizado)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// DELETE /api/cronometro/:id
router.delete('/:id', (req, res) => {
  try {
    const u = req.currentUser
    const id = Number(req.params.id)
    const motivo = validarMotivo(req.body.motivo)

    const db = getDatabase()
    const c = db.prepare('SELECT * FROM cronometros WHERE id = ?').get(id) as Cronometro | undefined
    if (!c) throw new Error('Cronômetro não encontrado')
    if (c.usuario_id !== u.id && u.role !== 'admin' && u.role !== 'rh') throw new Error('Sem permissão para excluir este cronômetro')

    registrarAuditoria(db, {
      cronometroId: null,
      usuarioId: c.usuario_id,
      editadoPor: u.id,
      acao: 'exclusao',
      valorAnterior: JSON.stringify({ inicio: c.inicio, fim: c.fim }),
      motivo
    })

    db.prepare('DELETE FROM cronometros WHERE id = ?').run(id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
