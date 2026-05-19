import { ipcMain } from 'electron'
import { getDatabase } from '../database/db'
import { session } from './session'
import type {
  ReuniaoSocios,
  ReuniaoCreateInput,
  ReuniaoTopico
} from '../../shared/types'

interface ReuniaoRow {
  id: number
  titulo: string
  data: string
  observacoes: string | null
  criado_por_id: number
  criado_por_nome: string | null
  criado_em: string
  atualizado_em: string
}

interface TopicoRow {
  id: number
  reuniao_id: number
  texto: string
  cor: string
  ordem: number
  concluido: number
}

function rowToReuniao(row: ReuniaoRow, topicos: TopicoRow[]): ReuniaoSocios {
  return {
    id: row.id,
    titulo: row.titulo,
    data: row.data,
    observacoes: row.observacoes || undefined,
    topicos: topicos.map((t) => ({
      id: t.id,
      reuniao_id: t.reuniao_id,
      texto: t.texto,
      cor: t.cor,
      ordem: t.ordem,
      concluido: !!t.concluido
    })),
    criado_por_id: row.criado_por_id,
    criado_por_nome: row.criado_por_nome || undefined,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em
  }
}

function buscarReuniao(db: any, id: number): ReuniaoSocios | null {
  const row = db
    .prepare(
      `SELECT r.*, u.nome as criado_por_nome FROM reunioes r
       LEFT JOIN usuarios u ON u.id = r.criado_por_id
       WHERE r.id = ?`
    )
    .get(id) as ReuniaoRow | undefined
  if (!row) return null
  const topicos = db
    .prepare('SELECT * FROM reuniao_topicos WHERE reuniao_id = ? ORDER BY ordem')
    .all(id) as TopicoRow[]
  return rowToReuniao(row, topicos)
}

export function registrarHandlersReunioes() {
  ipcMain.handle('reunioes:listar', async (): Promise<ReuniaoSocios[]> => {
    session.requireRole('admin', 'rh')
    const db = getDatabase()
    const rows = db
      .prepare(
        `SELECT r.*, u.nome as criado_por_nome FROM reunioes r
         LEFT JOIN usuarios u ON u.id = r.criado_por_id
         ORDER BY r.data DESC, r.id DESC`
      )
      .all() as ReuniaoRow[]
    const todosTopicos = db
      .prepare('SELECT * FROM reuniao_topicos ORDER BY reuniao_id, ordem')
      .all() as TopicoRow[]
    return rows.map((r) => {
      const topicos = todosTopicos.filter((t) => t.reuniao_id === r.id)
      return rowToReuniao(r, topicos)
    })
  })

  ipcMain.handle('reunioes:obter', async (_e, id: number): Promise<ReuniaoSocios | null> => {
    session.requireRole('admin', 'rh')
    return buscarReuniao(getDatabase(), id)
  })

  ipcMain.handle('reunioes:criar', async (_e, input: ReuniaoCreateInput): Promise<ReuniaoSocios> => {
    const u = session.requireRole('admin', 'rh')
    const db = getDatabase()
    if (!input.titulo?.trim()) throw new Error('Título obrigatório')
    if (input.titulo.length > 200) throw new Error('Título muito longo')

    const tx = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO reunioes (titulo, data, observacoes, criado_por_id)
           VALUES (?, ?, ?, ?)`
        )
        .run(
          input.titulo.trim(),
          input.data || new Date().toISOString().slice(0, 10),
          input.observacoes || null,
          u.id
        )
      const id = result.lastInsertRowid as number

      if (input.topicos && input.topicos.length > 0) {
        const stmt = db.prepare(
          `INSERT INTO reuniao_topicos (reuniao_id, texto, cor, ordem, concluido)
           VALUES (?, ?, ?, ?, ?)`
        )
        for (const t of input.topicos) {
          stmt.run(id, t.texto, t.cor || 'azul', t.ordem, t.concluido ? 1 : 0)
        }
      }
      return id
    })
    const id = tx()
    return buscarReuniao(db, id) as ReuniaoSocios
  })

  ipcMain.handle(
    'reunioes:atualizar',
    async (_e, id: number, input: Partial<ReuniaoCreateInput>): Promise<ReuniaoSocios> => {
      session.requireRole('admin', 'rh')
      const db = getDatabase()

      const tx = db.transaction(() => {
        const campos: string[] = []
        const valores: any[] = []
        if (input.titulo !== undefined) {
          campos.push('titulo = ?')
          valores.push(input.titulo)
        }
        if (input.data !== undefined) {
          campos.push('data = ?')
          valores.push(input.data)
        }
        if (input.observacoes !== undefined) {
          campos.push('observacoes = ?')
          valores.push(input.observacoes || null)
        }
        if (campos.length > 0) {
          campos.push("atualizado_em = datetime('now', 'localtime')")
          valores.push(id)
          db.prepare(`UPDATE reunioes SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
        }

        // Se topicos foi enviado, refaz tudo
        if (input.topicos !== undefined) {
          db.prepare('DELETE FROM reuniao_topicos WHERE reuniao_id = ?').run(id)
          const stmt = db.prepare(
            `INSERT INTO reuniao_topicos (reuniao_id, texto, cor, ordem, concluido)
             VALUES (?, ?, ?, ?, ?)`
          )
          for (const t of input.topicos) {
            stmt.run(id, t.texto, t.cor || 'azul', t.ordem, t.concluido ? 1 : 0)
          }
        }
      })
      tx()
      return buscarReuniao(db, id) as ReuniaoSocios
    }
  )

  ipcMain.handle('reunioes:deletar', async (_e, id: number) => {
    try {
      session.requireRole('admin', 'rh')
      getDatabase().prepare('DELETE FROM reunioes WHERE id = ?').run(id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao deletar' }
    }
  })
}
