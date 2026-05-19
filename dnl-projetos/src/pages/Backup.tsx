import { useState } from 'react'
import { Download, Upload, AlertTriangle, Database } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'

export default function BackupPage() {
  const [exportando, setExportando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  async function exportar() {
    setExportando(true)
    setMensagem(null)
    try {
      const r = await api.backup.exportar()
      if (r.success && r.arquivo) {
        setMensagem({
          tipo: 'sucesso',
          texto: `Backup exportado em: ${r.arquivo}`
        })
      } else if (r.error) {
        setMensagem({ tipo: 'erro', texto: r.error })
      }
    } finally {
      setExportando(false)
    }
  }

  async function importar() {
    setImportando(true)
    setMensagem(null)
    try {
      const r = await api.backup.importar()
      if (r.success && r.importado !== undefined) {
        setMensagem({
          tipo: 'sucesso',
          texto: `Backup importado com sucesso. ${r.importado} registros restaurados. Você será redirecionado ao login em 3 segundos…`
        })
        // Força logout e redirect porque a sessão atual pode estar inválida
        setTimeout(async () => {
          if (api) await api.auth.logout()
          window.location.hash = '#/login'
          window.location.reload()
        }, 3000)
      } else if (r.error) {
        setMensagem({ tipo: 'erro', texto: r.error })
      }
    } finally {
      setImportando(false)
    }
  }

  return (
    <>
      <PageHeader
        numero="A8"
        rotulo="Backup"
        titulo="Backup & restauração"
        descricao="Exporte ou importe todos os dados do sistema em arquivo JSON."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 fade-in">
        <div className="card p-7">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-md bg-moss-500/15 flex items-center justify-center text-moss-600">
              <Download size={18} />
            </div>
            <h3 className="font-display text-2xl text-ink-900">Exportar dados</h3>
          </div>
          <p className="text-sm text-ink-600 mb-6 leading-relaxed">
            Gera um arquivo <span className="font-mono">.json</span> com todos os dados do sistema:
            usuários, projetos, pontos, lançamentos financeiros, orçamentos, contratos, base de
            conhecimento e mais.
          </p>
          <button onClick={exportar} disabled={exportando} className="btn-primary">
            <Download size={14} />
            {exportando ? 'Exportando…' : 'Exportar backup agora'}
          </button>
          <p className="text-xs text-ink-500 mt-4">
            Recomendamos fazer backup periódico — semanal ou mensal — em armazenamento externo
            (HD, nuvem pessoal etc.).
          </p>
        </div>

        <div className="card p-7">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-md bg-terra-100 flex items-center justify-center text-terra-500">
              <Upload size={18} />
            </div>
            <h3 className="font-display text-2xl text-ink-900">Importar backup</h3>
          </div>
          <p className="text-sm text-ink-600 mb-6 leading-relaxed">
            Restaura todos os dados a partir de um arquivo de backup. <strong>Atenção:</strong> isso
            substitui todos os dados atuais.
          </p>
          <button onClick={importar} disabled={importando} className="btn-secondary">
            <Upload size={14} />
            {importando ? 'Importando…' : 'Selecionar arquivo de backup'}
          </button>
        </div>
      </div>

      {mensagem && (
        <div
          className={`px-4 py-3 rounded-md fade-in mb-6
            ${
              mensagem.tipo === 'sucesso'
                ? 'bg-moss-500/10 border border-moss-500/40 text-moss-600'
                : 'bg-terra-50 border border-terra-400/40 text-terra-700'
            }`}
        >
          <p className="text-sm">{mensagem.texto}</p>
        </div>
      )}

      <div className="card p-6 bg-cream-200/50 fade-in stagger-1">
        <div className="flex gap-4">
          <AlertTriangle size={18} className="text-terra-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-display text-lg text-ink-900 mb-2">Sincronização em nuvem</h4>
            <p className="text-sm text-ink-700 leading-relaxed mb-2">
              Atualmente o sistema funciona inteiramente <strong>offline</strong>. Os dados ficam
              salvos localmente em <span className="font-mono text-xs">%APPDATA%\dnl-projetos\</span>
              .
            </p>
            <p className="text-sm text-ink-700 leading-relaxed">
              Para ter sincronização em tempo real entre múltiplas máquinas, é necessário um servidor
              backend. Por ora, o backup manual é a forma de mover dados entre computadores.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-6 fade-in stagger-2 mt-4">
        <div className="flex gap-4">
          <Database size={18} className="text-ink-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-display text-lg text-ink-900 mb-2">Localização do banco de dados</h4>
            <p className="text-sm text-ink-700 leading-relaxed mb-2">
              O banco SQLite fica em:
            </p>
            <code className="text-xs bg-cream-200 px-3 py-1.5 rounded block font-mono">
              %APPDATA%\dnl-projetos\dnl-projetos.db
            </code>
            <p className="text-xs text-ink-500 mt-2">
              Cole esse caminho na barra do Explorador de Arquivos para localizar.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
