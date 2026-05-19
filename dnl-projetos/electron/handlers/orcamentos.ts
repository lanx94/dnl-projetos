import { ipcMain } from 'electron'
import { getDatabase } from '../database/db'
import { session } from './session'
import type {
  Orcamento,
  OrcamentoCreateInput,
  ItemOrcamento,
  StatusOrcamento
} from '../../shared/types'

function gerarNumeroOrcamento(db: any): string {
  const ano = new Date().getFullYear()
  const ultimo = db
    .prepare(
      `SELECT numero FROM orcamentos WHERE numero LIKE ? ORDER BY id DESC LIMIT 1`
    )
    .get(`ORC-${ano}-%`) as { numero: string } | undefined

  let prox = 1
  if (ultimo) {
    const partes = ultimo.numero.split('-')
    prox = parseInt(partes[2], 10) + 1
  }
  return `ORC-${ano}-${String(prox).padStart(4, '0')}`
}

function calcularTotais(
  itens: { quantidade: number; valor_unitario: number }[],
  desconto_percentual: number
) {
  const subtotal = itens.reduce((acc, i) => acc + i.quantidade * i.valor_unitario, 0)
  const desconto_valor = subtotal * (desconto_percentual / 100)
  const total = subtotal - desconto_valor
  return { subtotal, desconto_valor, total }
}

function buscarOrcamento(db: any, id: number): Orcamento | null {
  const orc = db
    .prepare(
      `SELECT o.*,
              c.nome as cliente_nome, c.cnpj as cliente_cnpj, c.endereco as cliente_endereco,
              p.nome as projeto_nome,
              u.nome as criado_por_nome
       FROM orcamentos o
       LEFT JOIN clientes c ON c.id = o.cliente_id
       LEFT JOIN projetos p ON p.id = o.projeto_id
       LEFT JOIN usuarios u ON u.id = o.criado_por_id
       WHERE o.id = ?`
    )
    .get(id) as any
  if (!orc) return null

  const itens = db
    .prepare('SELECT * FROM itens_orcamento WHERE orcamento_id = ? ORDER BY ordem')
    .all(id) as ItemOrcamento[]

  const totais = calcularTotais(itens, orc.desconto_percentual)
  return { ...orc, itens, ...totais }
}

export function registrarHandlersOrcamentos() {
  ipcMain.handle(
    'orcamentos:listar',
    async (_e, status?: StatusOrcamento, cliente_id?: number): Promise<Orcamento[]> => {
      session.requireRole('admin', 'rh')
      const db = getDatabase()

      const where: string[] = []
      const params: any[] = []
      if (status) {
        where.push('o.status = ?')
        params.push(status)
      }
      if (cliente_id) {
        where.push('o.cliente_id = ?')
        params.push(cliente_id)
      }
      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

      const orcs = db
        .prepare(
          `SELECT o.*,
                  c.nome as cliente_nome, c.cnpj as cliente_cnpj,
                  p.nome as projeto_nome,
                  u.nome as criado_por_nome
           FROM orcamentos o
           LEFT JOIN clientes c ON c.id = o.cliente_id
           LEFT JOIN projetos p ON p.id = o.projeto_id
           LEFT JOIN usuarios u ON u.id = o.criado_por_id
           ${whereClause}
           ORDER BY o.criado_em DESC`
        )
        .all(...params) as any[]

      return orcs.map((o) => {
        const itens = db
          .prepare('SELECT * FROM itens_orcamento WHERE orcamento_id = ? ORDER BY ordem')
          .all(o.id) as ItemOrcamento[]
        const totais = calcularTotais(itens, o.desconto_percentual)
        return { ...o, itens, ...totais }
      })
    }
  )

  ipcMain.handle('orcamentos:obter', async (_e, id: number): Promise<Orcamento | null> => {
    session.requireRole('admin', 'rh')
    return buscarOrcamento(getDatabase(), id)
  })

  ipcMain.handle('orcamentos:criar', async (_e, input: OrcamentoCreateInput): Promise<Orcamento> => {
    const u = session.requireRole('admin', 'rh')
    const db = getDatabase()

    if (!input.titulo.trim()) throw new Error('Título obrigatório')
    if (!input.cliente_id) throw new Error('Cliente obrigatório')
    if (!input.itens || input.itens.length === 0) throw new Error('Adicione ao menos 1 item')

    const numero = gerarNumeroOrcamento(db)

    const tx = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO orcamentos
           (numero, cliente_id, projeto_id, titulo, descricao, status, data_emissao, validade_dias,
            desconto_percentual, forma_pagamento, prazo_execucao, observacoes, criado_por_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          numero,
          input.cliente_id,
          input.projeto_id || null,
          input.titulo.trim(),
          input.descricao || null,
          input.status || 'rascunho',
          input.data_emissao || new Date().toISOString().slice(0, 10),
          input.validade_dias || 30,
          input.desconto_percentual || 0,
          input.forma_pagamento || null,
          input.prazo_execucao || null,
          input.observacoes || null,
          u.id
        )
      const id = result.lastInsertRowid as number

      const stmtItem = db.prepare(
        `INSERT INTO itens_orcamento (orcamento_id, ordem, descricao, quantidade, unidade, valor_unitario, valor_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      input.itens.forEach((item, idx) => {
        const total = item.quantidade * item.valor_unitario
        stmtItem.run(
          id,
          item.ordem ?? idx,
          item.descricao,
          item.quantidade,
          item.unidade || 'un',
          item.valor_unitario,
          total
        )
      })
      return id
    })

    const id = tx()
    return buscarOrcamento(db, id) as Orcamento
  })

  ipcMain.handle(
    'orcamentos:atualizar',
    async (_e, id: number, input: Partial<OrcamentoCreateInput>): Promise<Orcamento> => {
      session.requireRole('admin', 'rh')
      const db = getDatabase()

      const tx = db.transaction(() => {
        const campos: string[] = []
        const valores: any[] = []

        const mapper: Record<string, string> = {
          cliente_id: 'cliente_id',
          projeto_id: 'projeto_id',
          titulo: 'titulo',
          descricao: 'descricao',
          status: 'status',
          data_emissao: 'data_emissao',
          validade_dias: 'validade_dias',
          desconto_percentual: 'desconto_percentual',
          forma_pagamento: 'forma_pagamento',
          prazo_execucao: 'prazo_execucao',
          observacoes: 'observacoes'
        }

        for (const [key, value] of Object.entries(input)) {
          if (key === 'itens') continue
          if (mapper[key]) {
            campos.push(`${mapper[key]} = ?`)
            valores.push(value === '' || value === undefined ? null : value)
          }
        }
        campos.push("atualizado_em = datetime('now', 'localtime')")
        if (campos.length > 0) {
          valores.push(id)
          db.prepare(`UPDATE orcamentos SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
        }

        if (input.itens) {
          db.prepare('DELETE FROM itens_orcamento WHERE orcamento_id = ?').run(id)
          const stmt = db.prepare(
            `INSERT INTO itens_orcamento (orcamento_id, ordem, descricao, quantidade, unidade, valor_unitario, valor_total)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          input.itens.forEach((item, idx) => {
            const total = item.quantidade * item.valor_unitario
            stmt.run(
              id,
              item.ordem ?? idx,
              item.descricao,
              item.quantidade,
              item.unidade || 'un',
              item.valor_unitario,
              total
            )
          })
        }
      })
      tx()
      return buscarOrcamento(db, id) as Orcamento
    }
  )

  ipcMain.handle('orcamentos:deletar', async (_e, id: number) => {
    try {
      session.requireRole('admin', 'rh')
      const db = getDatabase()

      const contratos = db
        .prepare('SELECT COUNT(*) as n FROM contratos WHERE orcamento_id = ?')
        .get(id) as { n: number }
      if (contratos.n > 0) {
        return {
          success: false,
          error: 'Não é possível deletar: orçamento gerou contrato. Cancele o contrato primeiro.'
        }
      }

      db.prepare('DELETE FROM orcamentos WHERE id = ?').run(id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao deletar' }
    }
  })

  ipcMain.handle('orcamentos:duplicar', async (_e, id: number): Promise<Orcamento> => {
    const u = session.requireRole('admin', 'rh')
    const db = getDatabase()

    const orig = buscarOrcamento(db, id)
    if (!orig) throw new Error('Orçamento não encontrado')

    const novoNumero = gerarNumeroOrcamento(db)

    const tx = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO orcamentos
           (numero, cliente_id, projeto_id, titulo, descricao, status, data_emissao, validade_dias,
            desconto_percentual, forma_pagamento, prazo_execucao, observacoes, criado_por_id)
           VALUES (?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          novoNumero,
          orig.cliente_id,
          orig.projeto_id || null,
          orig.titulo + ' (cópia)',
          orig.descricao || null,
          new Date().toISOString().slice(0, 10),
          orig.validade_dias,
          orig.desconto_percentual,
          orig.forma_pagamento || null,
          orig.prazo_execucao || null,
          orig.observacoes || null,
          u.id
        )
      const novoId = result.lastInsertRowid as number

      const stmt = db.prepare(
        `INSERT INTO itens_orcamento (orcamento_id, ordem, descricao, quantidade, unidade, valor_unitario, valor_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      orig.itens.forEach((item) => {
        stmt.run(
          novoId,
          item.ordem,
          item.descricao,
          item.quantidade,
          item.unidade,
          item.valor_unitario,
          item.valor_total
        )
      })
      return novoId
    })
    const novoId = tx()
    return buscarOrcamento(db, novoId) as Orcamento
  })
}
