import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { getDatabase } from './database/db'
import { registrarHandlersAuth } from './handlers/auth'
import { registrarHandlersPontos } from './handlers/pontos'
import { registrarHandlersProjetos } from './handlers/projetos'
import { registrarHandlersCronometro } from './handlers/cronometro'
import { registrarHandlersRelatorios } from './handlers/relatorios'
import { registrarHandlersEventos } from './handlers/eventos'
import { registrarHandlersFinanceiro } from './handlers/financeiro'
import { registrarHandlersAdmin } from './handlers/admin'
import { registrarHandlersConhecimento } from './handlers/conhecimento'
import { registrarHandlersOrcamentos } from './handlers/orcamentos'
import { registrarHandlersContratos } from './handlers/contratos'
import { registrarHandlersReunioes } from './handlers/reunioes'
import { registrarHandlersLeads } from './handlers/leads'
import { registrarHandlersBackup } from './handlers/backup'
import { registrarHandlersExports } from './handlers/exports'

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

let mainWindow: BrowserWindow | null = null

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js')
  console.log('[MAIN] Preload path:', preloadPath)

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#FAF9F4',
    title: 'DNL Projetos',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (VITE_DEV_SERVER_URL) {
    console.log('[MAIN] Carregando dev server:', VITE_DEV_SERVER_URL)
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html')
    console.log('[MAIN] Carregando arquivo:', indexPath)
    mainWindow.loadFile(indexPath)
  }
}

app.whenReady().then(() => {
  console.log('[MAIN] App ready, inicializando...')
  getDatabase()
  registrarHandlersAuth()
  registrarHandlersPontos()
  registrarHandlersProjetos()
  registrarHandlersCronometro()
  registrarHandlersRelatorios()
  registrarHandlersEventos()
  registrarHandlersFinanceiro()
  registrarHandlersAdmin()
  registrarHandlersConhecimento()
  registrarHandlersOrcamentos()
  registrarHandlersContratos()
  registrarHandlersReunioes()
  registrarHandlersLeads()
  registrarHandlersBackup()
  registrarHandlersExports()
  console.log('[MAIN] Handlers registrados, criando janela...')

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
