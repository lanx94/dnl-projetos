import { ipcMain } from 'electron'
import { getDatabase } from '../database/db'
import { session } from './session'
import type { Lead, LeadCreateInput, StatusLead } from '../../shared/types'

const STATUS_VALIDOS: StatusLead[] = [
  'lead',
  'reuniao',
  'proposta',
  'aguardando',
  'orcamento',
  'fechado',
  'perdido'
]

interface LeadRow {
  id: number
  nome: string
  status: StatusLead
  valor_estimado: number
  responsavel_id: number | null
  responsavel_nome: string | null
  cliente_id: number | null
  cliente_nome: string | null
  contatado_em: string | null
  data_alvo: string | null
  observacoes: string | null
  ordem: number
  criado_em: string
  atualizado_em: string
}

function rowToLead(row: LeadRow): Lead {
  return {
    id: row.id,
    nome: row.nome,
    status: row.status,
    valor_estimado: row.valor_estimado,
    responsavel_id: row.responsavel_id || undefined,
    responsavel_nome: row.responsavel_nome || undefined,
    cliente_id: row.cliente_id || undefined,
    cliente_nome: row.cliente_nome || undefined,
    contatado_em: row.contatado_em || undefined,
    data_alvo: row.data_alvo || undefined,
    observacoes: row.observacoes || undefined,
    ordem: row.ordem,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em
  }
}

function buscarLead(db: any, id: number): Lead | null {
  const row = db
    .prepare(
      `SELECT l.*, u.nome as responsavel_nome, c.nome as cliente_nome
       FROM leads l
       LEFT JOIN usuarios u ON u.id = l.responsavel_id
       LEFT JOIN clientes c ON c.id = l.cliente_id
       WHERE l.id = ?`
    )
    .get(id) as LeadRow | undefined
  return row ? rowToLead(row) : null
}

export function registrarHandlersLeads() {
  ipcMain.handle('leads:listar', async (_e, status?: StatusLead): Promise<Lead[]> => {
    session.requireRole('admin', 'rh')
    const db = getDatabase()
    let where = ''
    const params: any[] = []
    if (status) {
      where = 'WHERE l.status = ?'
      params.push(status)
    }
    const rows = db
      .prepare(
        `SELECT l.*, u.nome as responsavel_nome, c.nome as cliente_nome
         FROM leads l
         LEFT JOIN usuarios u ON u.id = l.responsavel_id
         LEFT JOIN clientes c ON c.id = l.cliente_id
         ${where}
         ORDER BY l.status, l.ordem ASC, l.id ASC`
      )
      .all(...params) as LeadRow[]
    return rows.map(rowToLead)
  })

  ipcMain.handle('leads:criar', async (_e, input: LeadCreateInput): Promise<Lead> => {
    session.requireRole('admin', 'rh')
    const db = getDatabase()
    if (!input.nome?.trim()) throw new Error('Nome obrigatório')
    if (input.nome.length > 200) throw new Error('Nome muito longo')
    const status = input.status || 'lead'
    if (!STATUS_VALIDOS.includes(status)) throw new Error('Status inválido')

    // Pega próxima ordem dentro daquele status
    const max = db
      .prepare('SELECT COALESCE(MAX(ordem), -1) as m FROM leads WHERE status = ?')
      .get(status) as { m: number }
    const proxOrdem = max.m + 1

    const result = db
      .prepare(
        `INSERT INTO leads (
           nome, status, valor_estimado, responsavel_id, cliente_id,
           contatado_em, data_alvo, observacoes, ordem
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.nome.trim(),
        status,
        input.valor_estimado || 0,
        input.responsavel_id || null,
        input.cliente_id || null,
        input.contatado_em || null,
        input.data_alvo || null,
        input.observacoes || null,
        proxOrdem
      )
    return buscarLead(db, result.lastInsertRowid as number) as Lead
  })

  ipcMain.handle(
    'leads:atualizar',
    async (_e, id: number, input: Partial<LeadCreateInput>): Promise<Lead> => {
      session.requireRole('admin', 'rh')
      const db = getDatabase()

      const camposPermitidos: Record<string, true> = {
        nome: true,
        status: true,
        valor_estimado: true,
        responsavel_id: true,
        cliente_id: true,
        contatado_em: true,
        data_alvo: true,
        observacoes: true
      }

      if (input.status !== undefined && !STATUS_VALIDOS.includes(input.status)) {
        throw new Error('Status inválido')
      }

      const campos: string[] = []
      const valores: any[] = []
      for (const [key, value] of Object.entries(input)) {
        if (!camposPermitidos[key]) continue
        campos.push(`${key} = ?`)
        valores.push(value === '' || value === undefined ? null : value)
      }
      if (campos.length === 0) {
        return buscarLead(db, id) as Lead
      }
      campos.push("atualizado_em = datetime('now', 'localtime')")
      valores.push(id)
      db.prepare(`UPDATE leads SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
      return buscarLead(db, id) as Lead
    }
  )

  ipcMain.handle(
    'leads:mover',
    async (_e, id: number, novo_status: StatusLead, nova_ordem: number): Promise<Lead> => {
      session.requireRole('admin', 'rh')
      const db = getDatabase()
      if (!STATUS_VALIDOS.includes(novo_status)) throw new Error('Status inválido')

      const tx = db.transaction(() => {
        // Empurra os itens do destino que estavam na nova_ordem ou abaixo
        db.prepare(
          'UPDATE leads SET ordem = ordem + 1 WHERE status = ? AND ordem >= ? AND id != ?'
        ).run(novo_status, nova_ordem, id)

        db.prepare(
          `UPDATE leads SET status = ?, ordem = ?, atualizado_em = datetime('now','localtime') WHERE id = ?`
        ).run(novo_status, nova_ordem, id)
      })
      tx()
      return buscarLead(db, id) as Lead
    }
  )

  ipcMain.handle('leads:deletar', async (_e, id: number) => {
    try {
      session.requireRole('admin', 'rh')
      getDatabase().prepare('DELETE FROM leads WHERE id = ?').run(id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao deletar' }
    }
  })
}
