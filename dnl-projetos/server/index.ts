import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import { getDatabase, seedInitialData } from './database/db'
import { authMiddleware } from './middleware/auth'

import authRouter from './routes/auth'
import pontosRouter from './routes/pontos'
import projetosRouter from './routes/projetos'
import cronometroRouter from './routes/cronometro'
import relatoriosRouter from './routes/relatorios'
import eventosRouter from './routes/eventos'
import financeiroRouter from './routes/financeiro'
import adminRouter from './routes/admin'
import conhecimentoRouter from './routes/conhecimento'
import orcamentosRouter from './routes/orcamentos'
import contratosRouter from './routes/contratos'
import reunioesRouter from './routes/reunioes'
import leadsRouter from './routes/leads'
import metasRouter from './routes/metas'
import revisoesRouter from './routes/revisoes'
import calendarioRouter from './routes/calendario'
import backupRouter from './routes/backup'
import exportsRouter from './routes/exports'
import clientesRouter from './routes/clientes'
import usuariosRouter from './routes/usuarios'
import configuracoesRouter from './routes/configuracoes'

const app = express()
const PORT = Number(process.env.PORT) || 3001

// Confia no proxy reverso (Nginx/Cloudflare) para obter o IP real via X-Forwarded-For
app.set('trust proxy', 1)

// ── Security headers ──────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.removeHeader('X-Powered-By')
  next()
})

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim())
app.use(cors({ origin: allowedOrigins, credentials: true }))

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))

// ── Inicializa banco ──────────────────────────────────────────────────────────
getDatabase()

// ── Health check (público) ────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

// ── Todas as rotas /api/* requerem autenticação ───────────────────────────────
app.use('/api', authMiddleware)

app.use('/api/auth', authRouter)
app.use('/api/pontos', pontosRouter)
app.use('/api/projetos', projetosRouter)
app.use('/api/cronometro', cronometroRouter)
app.use('/api/relatorios', relatoriosRouter)
app.use('/api/eventos', eventosRouter)
app.use('/api/financeiro', financeiroRouter)
app.use('/api/admin', adminRouter)
app.use('/api/conhecimento', conhecimentoRouter)
app.use('/api/orcamentos', orcamentosRouter)
app.use('/api/contratos', contratosRouter)
app.use('/api/reunioes', reunioesRouter)
app.use('/api/leads', leadsRouter)
app.use('/api/metas', metasRouter)
app.use('/api/revisoes', revisoesRouter)
app.use('/api/calendario', calendarioRouter)
app.use('/api/backup', backupRouter)
app.use('/api/exports', exportsRouter)
app.use('/api/clientes', clientesRouter)
app.use('/api/usuarios', usuariosRouter)
app.use('/api/configuracoes', configuracoesRouter)

// ── Serve frontend em produção ────────────────────────────────────────────────
const distPath = path.join(process.cwd(), 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// ── Erro global ───────────────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof err.status === 'number' ? err.status : typeof err.statusCode === 'number' ? err.statusCode : 500
  if (status < 500) {
    res.status(status).json({ error: err.message || 'Requisição inválida' })
  } else {
    console.error('[SERVER ERROR]', err)
    res.status(500).json({ error: err.message || 'Erro interno do servidor' })
  }
})

app.listen(PORT, () => {
  console.log(`[SERVER] DNL Projetos API rodando em http://localhost:${PORT}`)
  console.log(`[SERVER] Keycloak: ${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`)
})
