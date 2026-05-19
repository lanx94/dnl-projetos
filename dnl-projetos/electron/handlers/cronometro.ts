import { ipcMain } from 'electron'
import { getDatabase } from '../database/db'
import { session } from './session'
import type { Cronometro } from '../../shared/types'

function nowISO() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function calcDuracao(c: Cronometro): Cronometro {
  if (c.fim) {
    c.duracao_segundos = Math.floor(
      (new Date(c.fim).getTime() - new Date(c.inicio).getTime()) / 1000
    )
  }
  return c
}

export function registrarHandlersCronometro() {
  ipcMain.handle(
    'cronometro:iniciar',
    async (_e, projeto_id: number, observacao?: string): Promise<Cronometro> => {
      const u = session.requireUser()
      const db = getDatabase()

      if (typeof projeto_id !== 'number' || projeto_id <= 0) {
        throw new Error('Projeto inválido')
      }
      if (observacao && observacao.length > 500) {
        throw new Error('Observação muito longa (máx 500 caracteres)')
      }

      // Transação para evitar race condition: verifica + insere atomicamente
      const tx = db.transaction(() => {
        const ativo = db
          .prepare('SELECT id FROM cronometros WHERE usuario_id = ? AND fim IS NULL')
          .get(u.id)
        if (ativo)
          throw new Error('Você já tem um cronômetro ativo. Pare-o antes de iniciar outro.')

        if (u.role !== 'admin') {
          const acesso = db
            .prepare('SELECT 1 FROM projeto_funcionario WHERE projeto_id = ? AND usuario_id = ?')
            .get(projeto_id, u.id)
          if (!acesso) throw new Error('Você não tem acesso a este projeto')
        }

        const result = db
          .prepare(
            `INSERT INTO cronometros (usuario_id, projeto_id, inicio, observacao) VALUES (?, ?, ?, ?)`
          )
          .run(u.id, projeto_id, nowISO(), observacao || null)
        return result.lastInsertRowid as number
      })

      const id = tx()

      const row = db
        .prepare(
          `SELECT c.*, p.nome as projeto_nome
           FROM cronometros c JOIN projetos p ON p.id = c.projeto_id
           WHERE c.id = ?`
        )
        .get(id) as Cronometro
      return calcDuracao(row)
    }
  )

  ipcMain.handle('cronometro:parar', async (_e, id: number): Promise<Cronometro> => {
    const u = session.requireUser()
    const db = getDatabase()
    const c = db
      .prepare('SELECT * FROM cronometros WHERE id = ? AND usuario_id = ?')
      .get(id, u.id) as Cronometro | undefined
    if (!c) throw new Error('Cronômetro não encontrado')
    if (c.fim) throw new Error('Cronômetro já foi parado')

    db.prepare('UPDATE cronometros SET fim = ? WHERE id = ?').run(nowISO(), id)
    const row = db
      .prepare(
        `SELECT c.*, p.nome as projeto_nome
         FROM cronometros c JOIN projetos p ON p.id = c.projeto_id
         WHERE c.id = ?`
      )
      .get(id) as Cronometro
    return calcDuracao(row)
  })

  ipcMain.handle('cronometro:ativo', async (): Promise<Cronometro | null> => {
    const u = session.requireUser()
    const db = getDatabase()
    const row = db
      .prepare(
        `SELECT c.*, p.nome as projeto_nome
         FROM cronometros c JOIN projetos p ON p.id = c.projeto_id
         WHERE c.usuario_id = ? AND c.fim IS NULL`
      )
      .get(u.id) as Cronometro | undefined
    return row ? calcDuracao(row) : null
  })

  ipcMain.handle('cronometro:historico', async (_e, limit = 50): Promise<Cronometro[]> => {
    const u = session.requireUser()
    const db = getDatabase()
    const rows = db
      .prepare(
        `SELECT c.*, p.nome as projeto_nome
         FROM cronometros c JOIN projetos p ON p.id = c.projeto_id
         WHERE c.usuario_id = ? AND c.fim IS NOT NULL
         ORDER BY c.inicio DESC LIMIT ?`
      )
      .all(u.id, limit) as Cronometro[]
    return rows.map(calcDuracao)
  })
}
