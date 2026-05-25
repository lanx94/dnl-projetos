import { Router } from 'express'
import { getDatabase } from '../database/db'
import { requireRole } from '../middleware/auth'

const router = Router()

const CHAVES = [
  'empresa_nome',
  'empresa_cnpj',
  'empresa_telefone',
  'empresa_email',
  'empresa_endereco',
  'empresa_site',
  'empresa_slogan',
  'empresa_inscricao_estadual',
  'empresa_responsavel',
]

router.get('/', (req, res) => {
  try {
    const db = getDatabase()
    const rows = db.prepare('SELECT chave, valor FROM configuracoes').all() as { chave: string; valor: string }[]
    const config: Record<string, string> = {}
    for (const chave of CHAVES) config[chave] = ''
    for (const row of rows) config[row.chave] = row.valor
    res.json(config)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/', requireRole('admin'), (req, res) => {
  try {
    const db = getDatabase()
    const dados = req.body as Record<string, string>
    const upsert = db.prepare(
      'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor'
    )
    const transacao = db.transaction(() => {
      for (const chave of CHAVES) {
        if (chave in dados) upsert.run(chave, dados[chave] ?? '')
      }
    })
    transacao()
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router
