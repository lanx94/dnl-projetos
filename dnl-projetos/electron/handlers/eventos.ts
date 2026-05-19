import { ipcMain } from 'electron'
import { getDatabase } from '../database/db'
import { session } from './session'
import type { Evento, EventoCreateInput } from '../../shared/types'

export function registrarHandlersEventos() {
  // Lista todos os eventos relevantes pro usuário (globais + os próprios)
  ipcMain.handle('eventos:listar', async (_e, limit = 50): Promise<Evento[]> => {
    const u = session.requireUser()
    const db = getDatabase()
    return db
      .prepare(
        `SELECT e.*, u.nome as autor_nome
         FROM eventos e LEFT JOIN usuarios u ON u.id = e.autor_id
         WHERE e.global = 1 OR e.autor_id = ?
         ORDER BY e.criado_em DESC
         LIMIT ?`
      )
      .all(u.id, limit) as Evento[]
  })

  ipcMain.handle('eventos:listarMeus', async (_e, limit = 50): Promise<Evento[]> => {
    const u = session.requireUser()
    const db = getDatabase()
    return db
      .prepare(
        `SELECT e.*, u.nome as autor_nome
         FROM eventos e LEFT JOIN usuarios u ON u.id = e.autor_id
         WHERE e.autor_id = ?
         ORDER BY e.criado_em DESC
         LIMIT ?`
      )
      .all(u.id, limit) as Evento[]
  })

  ipcMain.handle('eventos:criar', async (_e, input: EventoCreateInput): Promise<Evento> => {
    const u = session.requireUser()
    const db = getDatabase()

    // Validação de tipo (defesa em profundidade)
    const tiposValidos = ['aviso', 'comunicado', 'pessoal', 'aniversario', 'reuniao']
    if (!tiposValidos.includes(input.tipo)) {
      throw new Error('Tipo de evento inválido')
    }

    // Apenas admin/RH podem criar eventos globais
    const ehGlobal = !!input.global
    if (ehGlobal && u.role !== 'admin' && u.role !== 'rh') {
      throw new Error('Apenas admin/RH podem criar eventos globais')
    }

    if (!input.titulo.trim()) throw new Error('Título é obrigatório')
    if (!input.conteudo.trim()) throw new Error('Conteúdo é obrigatório')
    if (input.titulo.length > 200) throw new Error('Título muito longo (máx 200 caracteres)')
    if (input.conteudo.length > 5000) throw new Error('Conteúdo muito longo (máx 5000 caracteres)')

    const result = db
      .prepare(
        `INSERT INTO eventos (autor_id, tipo, titulo, conteudo, global, data_evento)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        u.id,
        input.tipo,
        input.titulo.trim(),
        input.conteudo.trim(),
        ehGlobal ? 1 : 0,
        input.data_evento || null
      )

    return db
      .prepare(
        `SELECT e.*, u.nome as autor_nome
         FROM eventos e LEFT JOIN usuarios u ON u.id = e.autor_id
         WHERE e.id = ?`
      )
      .get(result.lastInsertRowid) as Evento
  })

  ipcMain.handle('eventos:deletar', async (_e, id: number) => {
    try {
      const u = session.requireUser()
      const db = getDatabase()

      const evento = db.prepare('SELECT * FROM eventos WHERE id = ?').get(id) as
        | Evento
        | undefined
      if (!evento) return { success: false, error: 'Evento não encontrado' }

      // Só o autor ou admin pode deletar
      if (evento.autor_id !== u.id && u.role !== 'admin') {
        return { success: false, error: 'Sem permissão para deletar este evento' }
      }

      db.prepare('DELETE FROM eventos WHERE id = ?').run(id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao deletar' }
    }
  })
}
