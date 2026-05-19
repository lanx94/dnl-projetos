import { Router } from 'express'
import { getDatabase } from '../database/db'
import { requireRole } from '../middleware/auth'
import type { Lancamento, LancamentoCreateInput, CategoriaFinanceira, ResumoFinanceiro, DREMensal, TipoLancamento, FluxoCaixaData, BalanceteData } from '../../shared/types'

const router = Router()

const LANCAMENTO_SELECT = `SELECT l.*, cf.nome as categoria_nome, p.nome as projeto_nome, c.nome as cliente_nome, u.nome as criado_por_nome FROM lancamentos l LEFT JOIN categorias_financeiras cf ON cf.id = l.categoria_id LEFT JOIN projetos p ON p.id = l.projeto_id LEFT JOIN clientes c ON c.id = l.cliente_id LEFT JOIN usuarios u ON u.id = l.criado_por_id`

// GET /api/financeiro/lancamentos?tipo=&inicio=&fim=&categoria_id=&projeto_id=
router.get('/lancamentos', requireRole('admin', 'rh'), (req, res) => {
  try {
    const db = getDatabase()
    const { tipo, inicio, fim, categoria_id, projeto_id } = req.query as any
    const where: string[] = []
    const params: any[] = []
    if (tipo) { where.push('l.tipo = ?'); params.push(tipo) }
    if (inicio) { where.push('l.data >= ?'); params.push(inicio) }
    if (fim) { where.push('l.data <= ?'); params.push(fim) }
    if (categoria_id) { where.push('l.categoria_id = ?'); params.push(Number(categoria_id)) }
    if (projeto_id) { where.push('l.projeto_id = ?'); params.push(Number(projeto_id)) }
    const sql = `${LANCAMENTO_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.data DESC, l.id DESC`
    res.json(db.prepare(sql).all(...params) as Lancamento[])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/financeiro/lancamentos
router.post('/lancamentos', requireRole('admin', 'rh'), (req, res) => {
  try {
    const u = req.currentUser
    const input: LancamentoCreateInput = req.body
    if (!input.descricao?.trim()) throw new Error('Descrição é obrigatória')
    if (input.valor <= 0) throw new Error('Valor deve ser maior que zero')
    if (!input.data) throw new Error('Data é obrigatória')
    const db = getDatabase()
    const result = db.prepare(`INSERT INTO lancamentos (tipo, descricao, valor, categoria_id, projeto_id, cliente_id, data, pago, observacoes, criado_por_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.tipo, input.descricao.trim(), input.valor, input.categoria_id || null, input.projeto_id || null, input.cliente_id || null, input.data, input.pago ? 1 : 0, input.observacoes || null, u.id)
    res.json(db.prepare(`${LANCAMENTO_SELECT} WHERE l.id = ?`).get(result.lastInsertRowid) as Lancamento)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// PUT /api/financeiro/lancamentos/:id
router.put('/lancamentos/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    const id = Number(req.params.id)
    const input: Partial<LancamentoCreateInput> = req.body
    const db = getDatabase()
    const mapper: Record<string, string> = { tipo: 'tipo', descricao: 'descricao', valor: 'valor', categoria_id: 'categoria_id', projeto_id: 'projeto_id', cliente_id: 'cliente_id', data: 'data', pago: 'pago', observacoes: 'observacoes' }
    const campos: string[] = []
    const valores: any[] = []
    for (const [key, value] of Object.entries(input)) {
      if (!mapper[key]) continue
      campos.push(`${mapper[key]} = ?`)
      valores.push(key === 'pago' ? (value ? 1 : 0) : (value === '' || value === undefined ? null : value))
    }
    if (campos.length > 0) { valores.push(id); db.prepare(`UPDATE lancamentos SET ${campos.join(', ')} WHERE id = ?`).run(...valores) }
    res.json(db.prepare(`${LANCAMENTO_SELECT} WHERE l.id = ?`).get(id) as Lancamento)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/financeiro/lancamentos/:id
router.delete('/lancamentos/:id', requireRole('admin', 'rh'), (req, res) => {
  try {
    getDatabase().prepare('DELETE FROM lancamentos WHERE id = ?').run(Number(req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/financeiro/resumo?inicio=&fim=
router.get('/resumo', requireRole('admin', 'rh'), (req, res) => {
  try {
    const { inicio, fim } = req.query as { inicio?: string; fim?: string }
    if (!inicio || !fim) throw new Error('inicio e fim são obrigatórios')
    const dados = getDatabase().prepare(`SELECT tipo, pago, SUM(valor) as total FROM lancamentos WHERE data BETWEEN ? AND ? GROUP BY tipo, pago`).all(inicio, fim) as any[]
    let total_receitas = 0, total_despesas = 0, receitas_pagas = 0, despesas_pagas = 0, receitas_pendentes = 0, despesas_pendentes = 0
    for (const d of dados) {
      const v = d.total || 0
      if (d.tipo === 'receita') { total_receitas += v; if (d.pago) receitas_pagas += v; else receitas_pendentes += v }
      else { total_despesas += v; if (d.pago) despesas_pagas += v; else despesas_pendentes += v }
    }
    res.json({ total_receitas, total_despesas, saldo: total_receitas - total_despesas, receitas_pagas, despesas_pagas, receitas_pendentes, despesas_pendentes } as ResumoFinanceiro)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/financeiro/categorias
router.get('/categorias', requireRole('admin', 'rh'), (req, res) => {
  try {
    res.json(getDatabase().prepare('SELECT * FROM categorias_financeiras ORDER BY tipo, nome').all() as CategoriaFinanceira[])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/financeiro/categorias
router.post('/categorias', requireRole('admin', 'rh'), (req, res) => {
  try {
    const { nome, tipo, cor } = req.body
    const db = getDatabase()
    const r = db.prepare('INSERT INTO categorias_financeiras (nome, tipo, cor) VALUES (?, ?, ?)').run(nome, tipo, cor || null)
    res.json(db.prepare('SELECT * FROM categorias_financeiras WHERE id = ?').get(r.lastInsertRowid) as CategoriaFinanceira)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/financeiro/dre?mes=YYYY-MM
router.get('/dre', requireRole('admin', 'rh'), (req, res) => {
  try {
    const mes = req.query.mes as string | undefined
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      res.status(400).json({ error: 'Parâmetro mes é obrigatório no formato YYYY-MM' })
      return
    }
    const db = getDatabase()
    const inicio = `${mes}-01`
    const [yy, mm] = mes.split('-').map(Number)
    const fim = `${mes}-${String(new Date(yy, mm, 0).getDate()).padStart(2, '0')}`

    const dados = db.prepare(`SELECT l.tipo, COALESCE(cf.nome, 'Sem categoria') as categoria_nome, SUM(l.valor) as total FROM lancamentos l LEFT JOIN categorias_financeiras cf ON cf.id = l.categoria_id WHERE l.data BETWEEN ? AND ? GROUP BY l.tipo, cf.nome ORDER BY total DESC`).all(inicio, fim) as any[]

    const rec = dados.filter((d) => d.tipo === 'receita').map((d) => ({ nome: d.categoria_nome, valor: d.total }))
    const des = dados.filter((d) => d.tipo === 'despesa').map((d) => ({ nome: d.categoria_nome, valor: d.total }))
    const receita_bruta = rec.reduce((a, r) => a + r.valor, 0)

    let deducoes = 0, custos_operacionais = 0, despesas_administrativas = 0, despesas_operacionais = 0
    for (const d of des) {
      if (/imposto|tribut/i.test(d.nome)) deducoes += d.valor
      else if (/folha/i.test(d.nome)) custos_operacionais += d.valor
      else if (/aluguel|software|licen|material|escrit/i.test(d.nome)) despesas_operacionais += d.valor
      else despesas_administrativas += d.valor
    }

    const receita_liquida = receita_bruta - deducoes
    const lucro_bruto = receita_liquida - custos_operacionais
    const resultado_operacional = lucro_bruto - despesas_administrativas - despesas_operacionais
    const margem_operacional = receita_liquida > 0 ? (resultado_operacional / receita_liquida) * 100 : 0

    res.json({ mes, receita_bruta, deducoes, receita_liquida, custos_operacionais, lucro_bruto, despesas_administrativas, despesas_operacionais, resultado_operacional, margem_operacional, detalhamento: { receitas_por_categoria: rec, despesas_por_categoria: des } } as DREMensal)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/financeiro/fluxo-caixa?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
router.get('/fluxo-caixa', requireRole('admin', 'rh'), (req, res) => {
  try {
    const { inicio, fim } = req.query as { inicio: string; fim: string }
    if (!inicio || !fim) throw new Error('inicio e fim são obrigatórios')
    const db = getDatabase()

    const rows = db.prepare(
      `SELECT data, tipo, SUM(CASE WHEN pago = 1 THEN valor ELSE 0 END) as pago, SUM(valor) as total FROM lancamentos WHERE data BETWEEN ? AND ? GROUP BY data, tipo ORDER BY data`
    ).all(inicio, fim) as any[]

    const porDia = new Map<string, { entradas: number; saidas: number }>()
    for (const r of rows) {
      if (!porDia.has(r.data)) porDia.set(r.data, { entradas: 0, saidas: 0 })
      const d = porDia.get(r.data)!
      if (r.tipo === 'receita') d.entradas += r.pago
      else d.saidas += r.pago
    }

    let saldo_acumulado = 0
    const periodo = Array.from(porDia.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([data, v]) => {
      const saldo_dia = v.entradas - v.saidas
      saldo_acumulado += saldo_dia
      return { data, entradas: v.entradas, saidas: v.saidas, saldo_dia, saldo_acumulado }
    })

    const total_entradas = periodo.reduce((s, p) => s + p.entradas, 0)
    const total_saidas = periodo.reduce((s, p) => s + p.saidas, 0)

    res.json({ periodo, total_entradas, total_saidas, saldo_final: total_entradas - total_saidas, saldo_inicial: 0 } as FluxoCaixaData)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/financeiro/balancete?inicio=YYYY-MM&fim=YYYY-MM
router.get('/balancete', requireRole('admin', 'rh'), (req, res) => {
  try {
    const { inicio, fim } = req.query as { inicio: string; fim: string }
    if (!inicio || !fim) throw new Error('inicio e fim são obrigatórios')
    const db = getDatabase()

    const [, mF] = fim.split('-').map(Number)
    const yF = Number(fim.split('-')[0])
    const dataInicio = `${inicio}-01`
    const dataFim = `${fim}-${String(new Date(yF, mF, 0).getDate()).padStart(2, '0')}`

    const porMes = db.prepare(
      `SELECT strftime('%Y-%m', data) as mes, tipo, SUM(valor) as total FROM lancamentos WHERE data BETWEEN ? AND ? GROUP BY mes, tipo ORDER BY mes`
    ).all(dataInicio, dataFim) as any[]

    const mesesSet = new Set<string>()
    for (const r of porMes) mesesSet.add(r.mes)
    const mesesOrdenados = Array.from(mesesSet).sort()

    const meses = mesesOrdenados.map(mes => {
      const rec = (porMes.find(r => r.mes === mes && r.tipo === 'receita')?.total) || 0
      const des = (porMes.find(r => r.mes === mes && r.tipo === 'despesa')?.total) || 0
      return { mes, receitas: rec, despesas: des, resultado: rec - des }
    })

    const catReceita = db.prepare(
      `SELECT COALESCE(cf.nome, 'Sem categoria') as nome, SUM(l.valor) as total FROM lancamentos l LEFT JOIN categorias_financeiras cf ON cf.id = l.categoria_id WHERE l.tipo = 'receita' AND l.data BETWEEN ? AND ? GROUP BY nome ORDER BY total DESC`
    ).all(dataInicio, dataFim) as any[]

    const catDespesa = db.prepare(
      `SELECT COALESCE(cf.nome, 'Sem categoria') as nome, SUM(l.valor) as total FROM lancamentos l LEFT JOIN categorias_financeiras cf ON cf.id = l.categoria_id WHERE l.tipo = 'despesa' AND l.data BETWEEN ? AND ? GROUP BY nome ORDER BY total DESC`
    ).all(dataInicio, dataFim) as any[]

    const totRec = catReceita.reduce((s: number, c: any) => s + c.total, 0)
    const totDes = catDespesa.reduce((s: number, c: any) => s + c.total, 0)

    const pagoRows = db.prepare(
      `SELECT tipo, pago, SUM(valor) as total FROM lancamentos WHERE data BETWEEN ? AND ? GROUP BY tipo, pago`
    ).all(dataInicio, dataFim) as any[]

    let receitas_pagas = 0, receitas_pendentes = 0, despesas_pagas = 0, despesas_pendentes = 0
    for (const r of pagoRows) {
      if (r.tipo === 'receita') { if (r.pago) receitas_pagas += r.total; else receitas_pendentes += r.total }
      else { if (r.pago) despesas_pagas += r.total; else despesas_pendentes += r.total }
    }

    res.json({
      meses,
      categorias_receita: catReceita.map((c: any) => ({ nome: c.nome, total: c.total, pct: totRec > 0 ? (c.total / totRec) * 100 : 0 })),
      categorias_despesa: catDespesa.map((c: any) => ({ nome: c.nome, total: c.total, pct: totDes > 0 ? (c.total / totDes) * 100 : 0 })),
      total_receitas: totRec,
      total_despesas: totDes,
      resultado_total: totRec - totDes,
      receitas_pagas, receitas_pendentes, despesas_pagas, despesas_pendentes
    } as BalanceteData)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
