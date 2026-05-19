import { Router, Request, Response } from 'express'
import { getDatabase } from '../database/db'
import { requireRole } from '../middleware/auth'

const router = Router()

const TABELAS = ['usuarios', 'clientes', 'projetos', 'projeto_funcionario', 'pontos', 'cronometros', 'relatorios_diarios', 'eventos', 'categorias_financeiras', 'lancamentos', 'artigos_conhecimento', 'orcamentos', 'itens_orcamento', 'contratos', 'clausulas_padrao', 'reunioes', 'reuniao_topicos', 'leads']

// GET /api/backup/exportar — faz download do arquivo JSON
router.get('/exportar', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const u = req.currentUser
    const db = getDatabase()
    const dados: Record<string, any[]> = {}
    for (const tabela of TABELAS) {
      try { dados[tabela] = db.prepare(`SELECT * FROM ${tabela}`).all() } catch { dados[tabela] = [] }
    }
    const backup = {
      versao: '0.7.0',
      exportado_em: new Date().toISOString(),
      exportado_por: u.nome,
      dados
    }
    const json = JSON.stringify(backup, null, 2)
    const filename = `dnl-backup-${new Date().toISOString().split('T')[0]}.json`
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(json)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/backup/importar — recebe JSON no body
router.post('/importar', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const backup = req.body
    if (!backup?.dados) {
      res.status(400).json({ success: false, error: 'Arquivo de backup inválido' })
      return
    }
    const db = getDatabase()
    let importado = 0

    const COL_SAFE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

    db.transaction(() => {
      for (const tabela of TABELAS) {
        const rows: any[] = backup.dados[tabela]
        if (!rows?.length) continue
        const keys = Object.keys(rows[0]).filter(k => COL_SAFE.test(k))
        if (!keys.length) continue
        const stmt = db.prepare(`INSERT OR REPLACE INTO ${tabela} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
        for (const row of rows) {
          stmt.run(...keys.map((k) => row[k]))
          importado++
        }
      }
    })()

    res.json({ success: true, importado })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
