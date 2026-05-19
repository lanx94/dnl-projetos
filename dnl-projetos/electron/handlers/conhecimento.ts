import { ipcMain } from 'electron'
import { getDatabase } from '../database/db'
import { session } from './session'
import type {
  ArtigoConhecimento,
  ArtigoCreateInput,
  CategoriaConhecimento
} from '../../shared/types'

export function registrarHandlersConhecimento() {
  ipcMain.handle(
    'conhecimento:listar',
    async (_e, categoria?: CategoriaConhecimento, busca?: string): Promise<ArtigoConhecimento[]> => {
      session.requireUser()
      const db = getDatabase()

      const where: string[] = []
      const params: any[] = []

      if (categoria) {
        where.push('a.categoria = ?')
        params.push(categoria)
      }
      if (busca && busca.trim()) {
        where.push('(a.titulo LIKE ? OR a.conteudo LIKE ? OR a.tags LIKE ?)')
        const t = `%${busca.trim()}%`
        params.push(t, t, t)
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

      return db
        .prepare(
          `SELECT a.*, u.nome as autor_nome
           FROM artigos_conhecimento a
           LEFT JOIN usuarios u ON u.id = a.autor_id
           ${whereClause}
           ORDER BY a.atualizado_em DESC`
        )
        .all(...params) as ArtigoConhecimento[]
    }
  )

  ipcMain.handle('conhecimento:obter', async (_e, id: number): Promise<ArtigoConhecimento | null> => {
    session.requireUser()
    const db = getDatabase()
    return (
      (db
        .prepare(
          `SELECT a.*, u.nome as autor_nome
           FROM artigos_conhecimento a
           LEFT JOIN usuarios u ON u.id = a.autor_id
           WHERE a.id = ?`
        )
        .get(id) as ArtigoConhecimento) || null
    )
  })

  ipcMain.handle(
    'conhecimento:criar',
    async (_e, input: ArtigoCreateInput): Promise<ArtigoConhecimento> => {
      const u = session.requireUser()
      const db = getDatabase()

      if (!input.titulo.trim()) throw new Error('Título obrigatório')
      if (!input.conteudo.trim()) throw new Error('Conteúdo obrigatório')

      const result = db
        .prepare(
          `INSERT INTO artigos_conhecimento (categoria, titulo, conteudo, tags, autor_id)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          input.categoria,
          input.titulo.trim(),
          input.conteudo.trim(),
          input.tags || null,
          u.id
        )

      return db
        .prepare(
          `SELECT a.*, u.nome as autor_nome
           FROM artigos_conhecimento a
           LEFT JOIN usuarios u ON u.id = a.autor_id
           WHERE a.id = ?`
        )
        .get(result.lastInsertRowid) as ArtigoConhecimento
    }
  )

  ipcMain.handle(
    'conhecimento:atualizar',
    async (_e, id: number, input: Partial<ArtigoCreateInput>): Promise<ArtigoConhecimento> => {
      const u = session.requireUser()
      const db = getDatabase()

      const artigo = db.prepare('SELECT * FROM artigos_conhecimento WHERE id = ?').get(id) as
        | ArtigoConhecimento
        | undefined
      if (!artigo) throw new Error('Artigo não encontrado')

      // Só admin/RH ou autor pode editar
      if (u.role !== 'admin' && u.role !== 'rh' && artigo.autor_id !== u.id) {
        throw new Error('Sem permissão para editar este artigo')
      }

      const campos: string[] = []
      const valores: any[] = []
      if (input.categoria !== undefined) {
        campos.push('categoria = ?')
        valores.push(input.categoria)
      }
      if (input.titulo !== undefined) {
        campos.push('titulo = ?')
        valores.push(input.titulo.trim())
      }
      if (input.conteudo !== undefined) {
        campos.push('conteudo = ?')
        valores.push(input.conteudo.trim())
      }
      if (input.tags !== undefined) {
        campos.push('tags = ?')
        valores.push(input.tags || null)
      }
      campos.push("atualizado_em = datetime('now', 'localtime')")

      valores.push(id)
      db.prepare(`UPDATE artigos_conhecimento SET ${campos.join(', ')} WHERE id = ?`).run(
        ...valores
      )

      return db
        .prepare(
          `SELECT a.*, u.nome as autor_nome
           FROM artigos_conhecimento a
           LEFT JOIN usuarios u ON u.id = a.autor_id
           WHERE a.id = ?`
        )
        .get(id) as ArtigoConhecimento
    }
  )

  ipcMain.handle('conhecimento:deletar', async (_e, id: number) => {
    try {
      const u = session.requireUser()
      const db = getDatabase()

      const artigo = db.prepare('SELECT * FROM artigos_conhecimento WHERE id = ?').get(id) as
        | ArtigoConhecimento
        | undefined
      if (!artigo) return { success: false, error: 'Artigo não encontrado' }

      if (u.role !== 'admin' && u.role !== 'rh' && artigo.autor_id !== u.id) {
        return { success: false, error: 'Sem permissão para deletar este artigo' }
      }

      db.prepare('DELETE FROM artigos_conhecimento WHERE id = ?').run(id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao deletar' }
    }
  })
}
