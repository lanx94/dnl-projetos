import { ipcMain, dialog } from 'electron'
import fs from 'node:fs'
import { getDatabase } from '../database/db'
import { session } from './session'

const TABELAS_BACKUP = [
  'usuarios',
  'pontos',
  'clientes',
  'projetos',
  'projeto_funcionario',
  'cronometros',
  'relatorios_diarios',
  'eventos',
  'categorias_financeiras',
  'lancamentos',
  'artigos_conhecimento',
  'orcamentos',
  'itens_orcamento',
  'contratos'
]

export function registrarHandlersBackup() {
  ipcMain.handle('backup:exportar', async () => {
    try {
      const u = session.requireRole('admin')
      const db = getDatabase()

      const result = await dialog.showSaveDialog({
        title: 'Exportar backup',
        defaultPath: `dnl-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Exportação cancelada' }
      }

      const dados: Record<string, any[]> = {}
      for (const tabela of TABELAS_BACKUP) {
        try {
          dados[tabela] = db.prepare(`SELECT * FROM ${tabela}`).all()
        } catch (e) {
          console.warn(`[BACKUP] tabela ${tabela} não encontrada, pulando`)
          dados[tabela] = []
        }
      }

      const backup = {
        versao: '0.3.0',
        exportado_em: new Date().toISOString(),
        exportado_por: u.email,
        dados
      }

      fs.writeFileSync(result.filePath, JSON.stringify(backup, null, 2), 'utf8')

      return { success: true, arquivo: result.filePath }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao exportar' }
    }
  })

  ipcMain.handle('backup:importar', async () => {
    try {
      session.requireRole('admin')
      const db = getDatabase()

      const result = await dialog.showOpenDialog({
        title: 'Importar backup',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Importação cancelada' }
      }

      const conteudo = fs.readFileSync(result.filePaths[0], 'utf8')
      const backup = JSON.parse(conteudo)

      if (!backup.dados || typeof backup.dados !== 'object') {
        return { success: false, error: 'Arquivo inválido — não é um backup válido' }
      }

      const confirma = await dialog.showMessageBox({
        type: 'warning',
        title: 'Confirmar importação',
        message: 'Importar backup vai SUBSTITUIR todos os dados atuais.',
        detail: `Backup de: ${backup.exportado_por || 'desconhecido'}\nData: ${
          backup.exportado_em || 'desconhecida'
        }\n\nTem certeza? Esta operação não pode ser desfeita.`,
        buttons: ['Cancelar', 'Importar e substituir tudo'],
        defaultId: 0,
        cancelId: 0
      })

      if (confirma.response !== 1) {
        return { success: false, error: 'Importação cancelada' }
      }

      let totalImportado = 0

      const tx = db.transaction(() => {
        // Apaga tudo na ordem inversa (filhos antes, pais depois)
        const ordemDelete = [
          'itens_orcamento',
          'projeto_funcionario',
          'cronometros',
          'relatorios_diarios',
          'pontos',
          'lancamentos',
          'eventos',
          'contratos',
          'orcamentos',
          'artigos_conhecimento',
          'projetos',
          'clientes',
          'categorias_financeiras',
          'usuarios'
        ]
        for (const t of ordemDelete) {
          try {
            db.prepare(`DELETE FROM ${t}`).run()
            db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(t)
          } catch (e) {
            // ignora
          }
        }

        // Insere na ordem correta (pais antes, filhos depois)
        const ordemInsert = [
          'usuarios',
          'clientes',
          'categorias_financeiras',
          'projetos',
          'projeto_funcionario',
          'pontos',
          'cronometros',
          'relatorios_diarios',
          'eventos',
          'lancamentos',
          'artigos_conhecimento',
          'orcamentos',
          'itens_orcamento',
          'contratos'
        ]

        for (const tabela of ordemInsert) {
          const linhas = backup.dados[tabela]
          if (!Array.isArray(linhas) || linhas.length === 0) continue

          // Pega colunas que de fato existem na tabela atual (PRAGMA table_info)
          let colunasAtuais: string[] = []
          try {
            const info = db.prepare(`PRAGMA table_info(${tabela})`).all() as Array<{
              name: string
            }>
            colunasAtuais = info.map((i) => i.name)
          } catch (e) {
            console.warn(`[BACKUP] Tabela ${tabela} não existe no schema atual, pulando`)
            continue
          }

          for (const linha of linhas) {
            try {
              // Filtra apenas as colunas que existem na tabela atual E na linha
              const colunasUsar = Object.keys(linha).filter((c) =>
                colunasAtuais.includes(c)
              )
              if (colunasUsar.length === 0) continue

              const placeholders = colunasUsar.map(() => '?').join(', ')
              const stmt = db.prepare(
                `INSERT INTO ${tabela} (${colunasUsar.join(', ')}) VALUES (${placeholders})`
              )
              stmt.run(...colunasUsar.map((c) => linha[c]))
              totalImportado++
            } catch (e: any) {
              console.warn(`[BACKUP] Erro ao importar linha de ${tabela}:`, e.message)
            }
          }
        }
      })

      tx()

      // Após importar, a sessão antiga pode estar inválida (usuário pode não existir mais)
      // Força logout para que o usuário precise fazer login novamente.
      session.set(null)

      return { success: true, importado: totalImportado }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao importar' }
    }
  })
}
