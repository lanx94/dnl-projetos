import { useState, useEffect } from 'react'
import { Save, Building2, Check } from 'lucide-react'
import { api } from '../lib/api'

const CAMPOS = [
  { chave: 'empresa_nome',              label: 'Nome da empresa',         placeholder: 'DNL Projetos', tipo: 'text' },
  { chave: 'empresa_cnpj',              label: 'CNPJ',                    placeholder: '00.000.000/0001-00', tipo: 'text' },
  { chave: 'empresa_inscricao_estadual',label: 'Inscrição estadual',       placeholder: 'Isento ou número', tipo: 'text' },
  { chave: 'empresa_responsavel',       label: 'Responsável / Sócio',     placeholder: 'Nome completo', tipo: 'text' },
  { chave: 'empresa_telefone',          label: 'Telefone',                placeholder: '(11) 99999-9999', tipo: 'text' },
  { chave: 'empresa_email',             label: 'E-mail',                  placeholder: 'contato@dnlprojetos.com', tipo: 'email' },
  { chave: 'empresa_site',              label: 'Site',                    placeholder: 'https://dnlprojetos.com', tipo: 'url' },
  { chave: 'empresa_endereco',          label: 'Endereço completo',       placeholder: 'Rua, número, bairro, cidade — SP', tipo: 'text' },
  { chave: 'empresa_slogan',            label: 'Slogan / descrição curta',placeholder: 'Soluções criativas em comunicação', tipo: 'text' },
]

export default function Configuracoes() {
  const [dados, setDados] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    api.configuracoes.obter().then(setDados).catch(() => {})
  }, [])

  function handleChange(chave: string, valor: string) {
    setDados(d => ({ ...d, [chave]: valor }))
    setSalvo(false)
  }

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      await api.configuracoes.salvar(dados)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 3000)
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-terra-500 mb-1">Administração</p>
        <h1 className="font-display text-3xl text-ink-900">Dados da Empresa</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Informações utilizadas em orçamentos, contratos e relatórios.
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-cream-50 border border-ink-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-md bg-ink-900 flex items-center justify-center">
              <Building2 size={16} className="text-cream-50" />
            </div>
            <div>
              <p className="font-medium text-ink-900 text-sm">Informações cadastrais</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
                Dados exibidos em documentos gerados pelo sistema
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {CAMPOS.map(({ chave, label, placeholder, tipo }) => (
              <div key={chave}>
                <label className="font-mono text-[10px] uppercase tracking-widest text-ink-400 mb-1.5 block">
                  {label}
                </label>
                <input
                  type={tipo}
                  value={dados[chave] ?? ''}
                  onChange={e => handleChange(chave, e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-white border border-ink-200 rounded-lg px-3 py-2.5 text-sm
                    text-ink-900 placeholder-ink-300 focus:outline-none focus:border-ink-500 transition-colors"
                />
              </div>
            ))}
          </div>
        </div>

        {erro && (
          <p className="text-red-600 text-sm mb-4">{erro}</p>
        )}

        <button
          onClick={salvar}
          disabled={salvando}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors
            ${salvo
              ? 'bg-green-600 text-white'
              : 'bg-ink-900 text-cream-50 hover:bg-ink-700'
            } disabled:opacity-50`}
        >
          {salvo ? <Check size={15} /> : <Save size={15} />}
          {salvo ? 'Salvo!' : salvando ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  )
}
