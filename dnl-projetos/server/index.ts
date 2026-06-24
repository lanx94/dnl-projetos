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
const isProd = process.env.NODE_ENV === 'production'
const kcOrigin = process.env.KEYCLOAK_URL ? (() => { try { return new URL(process.env.KEYCLOAK_URL!).origin } catch { return '' } })() : ''
const csp = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",        // libs de UI (Recharts etc.) usam estilos inline
  "script-src 'self'",
  "font-src 'self' data:",
  `connect-src 'self' ${kcOrigin}`.trim(),    // API própria + Keycloak (se configurado)
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Content-Security-Policy', csp)
  if (isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.removeHeader('X-Powered-By')
  next()
})

// ── Sanitiza erros 5xx em produção (não vaza stack/SQL/caminhos ao cliente) ─────
app.use((_req, res, next) => {
  const orig = res.json.bind(res)
  res.json = ((body?: any) => {
    if (isProd && res.statusCode >= 500 && body && typeof body === 'object' && 'error' in body) {
      return orig({ ...body, error: 'Erro interno do servidor' })
    }
    return orig(body)
  }) as typeof res.json
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
