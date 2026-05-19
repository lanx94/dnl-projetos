import { ipcMain } from 'electron'
import { getDatabase } from '../database/db'
import { session } from './session'
import type {
  Lancamento,
  LancamentoCreateInput,
  TipoLancamento,
  ResumoFinanceiro,
  CategoriaFinanceira,
  DREMensal
} from '../../shared/types'

export function registrarHandlersFinanceiro() {
  ipcMain.handle(
    'financeiro:listarLancamentos',
    async (
      _e,
      filtros?: {
        tipo?: TipoLancamento
        inicio?: string
        fim?: string
        categoria_id?: number
        projeto_id?: number
      }
    ): Promise<Lancamento[]> => {
      session.requireRole('admin', 'rh')
      const db = getDatabase()

      const where: string[] = []
      const params: any[] = []

      if (filtros?.tipo) {
        where.push('l.tipo = ?')
        params.push(filtros.tipo)
      }
      if (filtros?.inicio) {
        where.push('l.data >= ?')
        params.push(filtros.inicio)
      }
      if (filtros?.fim) {
        where.push('l.data <= ?')
        params.push(filtros.fim)
      }
      if (filtros?.categoria_id) {
        where.push('l.categoria_id = ?')
        params.push(filtros.categoria_id)
      }
      if (filtros?.projeto_id) {
        where.push('l.projeto_id = ?')
        params.push(filtros.projeto_id)
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

      return db
        .prepare(
          `SELECT l.*,
                  cf.nome as categoria_nome,
                  p.nome as projeto_nome,
                  c.nome as cliente_nome,
                  u.nome as criado_por_nome
           FROM lancamentos l
           LEFT JOIN categorias_financeiras cf ON cf.id = l.categoria_id
           LEFT JOIN projetos p ON p.id = l.projeto_id
           LEFT JOIN clientes c ON c.id = l.cliente_id
           LEFT JOIN usuarios u ON u.id = l.criado_por_id
           ${whereClause}
           ORDER BY l.data DESC, l.id DESC`
        )
        .all(...params) as Lancamento[]
    }
  )

  ipcMain.handle(
    'financeiro:criarLancamento',
    async (_e, input: LancamentoCreateInput): Promise<Lancamento> => {
      const u = session.requireRole('admin', 'rh')
      const db = getDatabase()

      if (!input.descricao.trim()) throw new Error('Descrição é obrigatória')
      if (input.valor <= 0) throw new Error('Valor deve ser maior que zero')
      if (!input.data) throw new Error('Data é obrigatória')

      const result = db
        .prepare(
          `INSERT INTO lancamentos
           (tipo, descricao, valor, categoria_id, projeto_id, cliente_id, data, pago, observacoes, criado_por_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.tipo,
          input.descricao.trim(),
          input.valor,
          input.categoria_id || null,
          input.projeto_id || null,
          input.cliente_id || null,
          input.data,
          input.pago ? 1 : 0,
          input.observacoes || null,
          u.id
        )

      return db
        .prepare(
          `SELECT l.*,
                  cf.nome as categoria_nome,
                  p.nome as projeto_nome,
                  c.nome as cliente_nome,
                  u.nome as criado_por_nome
           FROM lancamentos l
           LEFT JOIN categorias_financeiras cf ON cf.id = l.categoria_id
           LEFT JOIN projetos p ON p.id = l.projeto_id
           LEFT JOIN clientes c ON c.id = l.cliente_id
           LEFT JOIN usuarios u ON u.id = l.criado_por_id
           WHERE l.id = ?`
        )
        .get(result.lastInsertRowid) as Lancamento
    }
  )

  ipcMain.handle(
    'financeiro:atualizarLancamento',
    async (_e, id: number, input: Partial<LancamentoCreateInput>): Promise<Lancamento> => {
      session.requireRole('admin', 'rh')
      const db = getDatabase()

      const campos: string[] = []
      const valores: any[] = []
      const mapper: Record<string, string> = {
        tipo: 'tipo',
        descricao: 'descricao',
        valor: 'valor',
        categoria_id: 'categoria_id',
        projeto_id: 'projeto_id',
        cliente_id: 'cliente_id',
        data: 'data',
        pago: 'pago',
        observacoes: 'observacoes'
      }

      for (const [key, value] of Object.entries(input)) {
        if (mapper[key]) {
          campos.push(`${mapper[key]} = ?`)
          if (key === 'pago') {
            valores.push(value ? 1 : 0)
          } else if (value === '' || value === undefined) {
            // String vazia ou undefined viram NULL (campos opcionais)
            valores.push(null)
          } else {
            // Mantém o valor (incluindo 0, false, etc.)
            valores.push(value)
          }
        }
      }

      if (campos.length === 0) {
        return db.prepare('SELECT * FROM lancamentos WHERE id = ?').get(id) as Lancamento
      }

      valores.push(id)
      db.prepare(`UPDATE lancamentos SET ${campos.join(', ')} WHERE id = ?`).run(...valores)

      return db
        .prepare(
          `SELECT l.*,
                  cf.nome as categoria_nome,
                  p.nome as projeto_nome,
                  c.nome as cliente_nome,
                  u.nome as criado_por_nome
           FROM lancamentos l
           LEFT JOIN categorias_financeiras cf ON cf.id = l.categoria_id
           LEFT JOIN projetos p ON p.id = l.projeto_id
           LEFT JOIN clientes c ON c.id = l.cliente_id
           LEFT JOIN usuarios u ON u.id = l.criado_por_id
           WHERE l.id = ?`
        )
        .get(id) as Lancamento
    }
  )

  ipcMain.handle('financeiro:deletarLancamento', async (_e, id: number) => {
    try {
      session.requireRole('admin', 'rh')
      const db = getDatabase()
      db.prepare('DELETE FROM lancamentos WHERE id = ?').run(id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao deletar' }
    }
  })

  ipcMain.handle(
    'financeiro:resumoFinanceiro',
    async (_e, inicio: string, fim: string): Promise<ResumoFinanceiro> => {
      session.requireRole('admin', 'rh')
      const db = getDatabase()

      const dados = db
        .prepare(
          `SELECT tipo, pago, SUM(valor) as total
           FROM lancamentos
           WHERE data BETWEEN ? AND ?
           GROUP BY tipo, pago`
        )
        .all(inicio, fim) as Array<{ tipo: TipoLancamento; pago: number; total: number }>

      let total_receitas = 0
      let total_despesas = 0
      let receitas_pagas = 0
      let despesas_pagas = 0
      let receitas_pendentes = 0
      let despesas_pendentes = 0

      for (const d of dados) {
        const valor = d.total || 0
        if (d.tipo === 'receita') {
          total_receitas += valor
          if (d.pago) receitas_pagas += valor
          else receitas_pendentes += valor
        } else {
          total_despesas += valor
          if (d.pago) despesas_pagas += valor
          else despesas_pendentes += valor
        }
      }

      return {
        total_receitas,
        total_despesas,
        saldo: total_receitas - total_despesas,
        receitas_pagas,
        despesas_pagas,
        receitas_pendentes,
        despesas_pendentes
      }
    }
  )

  ipcMain.handle('financeiro:listarCategorias', async (): Promise<CategoriaFinanceira[]> => {
    session.requireRole('admin', 'rh')
    const db = getDatabase()
    return db
      .prepare('SELECT * FROM categorias_financeiras ORDER BY tipo, nome')
      .all() as CategoriaFinanceira[]
  })

  ipcMain.handle(
    'financeiro:criarCategoria',
    async (_e, nome: string, tipo: TipoLancamento, cor?: string): Promise<CategoriaFinanceira> => {
      session.requireRole('admin', 'rh')
      const db = getDatabase()
      const result = db
        .prepare('INSERT INTO categorias_financeiras (nome, tipo, cor) VALUES (?, ?, ?)')
        .run(nome, tipo, cor || null)
      return db
        .prepare('SELECT * FROM categorias_financeiras WHERE id = ?')
        .get(result.lastInsertRowid) as CategoriaFinanceira
    }
  )

  ipcMain.handle('financeiro:dreMensal', async (_e, mes: string): Promise<DREMensal> => {
    session.requireRole('admin', 'rh')
    const db = getDatabase()

    const inicio = `${mes}-01`
    const [yy, mm] = mes.split('-').map(Number)
    const ultimoDia = new Date(yy, mm, 0).getDate()
    const fim = `${mes}-${String(ultimoDia).padStart(2, '0')}`

    // Receitas e despesas por categoria
    const dados = db
      .prepare(
        `SELECT l.tipo, COALESCE(cf.nome, 'Sem categoria') as categoria_nome, SUM(l.valor) as total
         FROM lancamentos l
         LEFT JOIN categorias_financeiras cf ON cf.id = l.categoria_id
         WHERE l.data BETWEEN ? AND ?
         GROUP BY l.tipo, cf.nome
         ORDER BY total DESC`
      )
      .all(inicio, fim) as Array<{
      tipo: TipoLancamento
      categoria_nome: string
      total: number
    }>

    const receitas_por_categoria = dados
      .filter((d) => d.tipo === 'receita')
      .map((d) => ({ nome: d.categoria_nome, valor: d.total }))
    const despesas_por_categoria = dados
      .filter((d) => d.tipo === 'despesa')
      .map((d) => ({ nome: d.categoria_nome, valor: d.total }))

    const receita_bruta = receitas_por_categoria.reduce((acc, r) => acc + r.valor, 0)

    // Tratamos "Impostos" como dedução, e classificamos as demais despesas
    // entre operacionais (folha, aluguel, software, material) e administrativas (outras)
    const ehImposto = (n: string) => /imposto|tribut/i.test(n)
    const ehOperacional = (n: string) =>
      /folha|aluguel|software|licen|material|escrit/i.test(n)

    let deducoes = 0
    let custos_operacionais = 0
    let despesas_administrativas = 0
    let despesas_operacionais = 0

    for (const d of despesas_por_categoria) {
      if (ehImposto(d.nome)) deducoes += d.valor
      else if (ehOperacional(d.nome)) {
        // Folha de pagamento conta como custo operacional; aluguel/software/material como despesa operacional
        if (/folha/i.test(d.nome)) custos_operacionais += d.valor
        else despesas_operacionais += d.valor
      } else {
        despesas_administrativas += d.valor
      }
    }

    const receita_liquida = receita_bruta - deducoes
    const lucro_bruto = receita_liquida - custos_operacionais
    const resultado_operacional =
      lucro_bruto - despesas_administrativas - despesas_operacionais
    const margem_operacional =
      receita_liquida > 0 ? (resultado_operacional / receita_liquida) * 100 : 0

    return {
      mes,
      receita_bruta,
      deducoes,
      receita_liquida,
      custos_operacionais,
      lucro_bruto,
      despesas_administrativas,
      despesas_operacionais,
      resultado_operacional,
      margem_operacional,
      detalhamento: {
        receitas_por_categoria,
        despesas_por_categoria
      }
    }
  })
}
