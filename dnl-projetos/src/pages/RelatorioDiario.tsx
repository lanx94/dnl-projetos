import { useEffect, useState } from 'react'
import { Save, Check } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { RelatorioDiario, Projeto } from '@shared/types'

export default function RelatorioDiarioPage() {
  const [conteudo, setConteudo] = useState('')
  const [revisao, setRevisao] = useState('')
  const [projetoId, setProjetoId] = useState<number | ''>('')
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [salvo, setSalvo] = useState<RelatorioDiario | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const [d, ps] = await Promise.all([
      api.relatorios.obterDiarioHoje(),
      api.projetos.listarMeus()
    ])
    setProjetos(ps)
    if (d) {
      setSalvo(d)
      setConteudo(d.conteudo)
      setRevisao(d.revisao)
      setProjetoId(d.projeto_id || '')
    }
  }

  async function salvar() {
    setErro('')
    setSucesso(false)
    setSalvando(true)
    try {
      const r = await api.relatorios.salvarDiario(
        conteudo,
        revisao,
        projetoId ? Number(projetoId) : undefined
      )
      setSalvo(r)
      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const linhas = conteudo.split('\n').filter((l) => l.trim()).length
  const linhasExcedidas = linhas > 5

  return (
    <>
      <PageHeader
        numero="05"
        rotulo="Relatório diário"
        titulo="O que você fez hoje?"
        descricao="Resumo das atividades do dia em até 5 linhas + revisão atual do projeto."
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <div className="card p-7 fade-in">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
              Hoje · {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
            </p>
            <h3 className="font-display text-3xl text-ink-900 mb-6">
              {salvo ? 'Editar registro' : 'Novo registro'}
            </h3>

            <div className="space-y-5">
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className="label !mb-0">Atividades realizadas</label>
                  <span
                    className={`font-mono text-xs ${linhasExcedidas ? 'text-terra-500' : 'text-ink-500'}`}
                  >
                    {linhas}/5 linhas
                  </span>
                </div>
                <textarea
                  className="input-field min-h-[140px] font-mono text-sm leading-relaxed"
                  placeholder="Linha 1: Revisão do memorial descritivo&#10;Linha 2: Reunião com cliente&#10;Linha 3: ..."
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  rows={6}
                />
                <p className="text-xs text-ink-500 mt-1.5">
                  Máximo de 5 linhas. Quebre as linhas com Enter.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Revisão atual</label>
                  <input
                    className="input-field font-mono"
                    placeholder="Ex: R03"
                    value={revisao}
                    onChange={(e) => setRevisao(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Projeto (opcional)</label>
                  <select
                    className="input-field"
                    value={projetoId}
                    onChange={(e) => setProjetoId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">— Nenhum —</option>
                    {projetos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {erro && (
                <div className="px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md">
                  <p className="text-sm text-terra-700">{erro}</p>
                </div>
              )}

              {sucesso && (
                <div className="px-4 py-3 bg-moss-500/10 border border-moss-500/40 rounded-md flex items-center gap-2">
                  <Check size={16} className="text-moss-600" />
                  <p className="text-sm text-moss-600">Relatório salvo com sucesso</p>
                </div>
              )}

              <button
                onClick={salvar}
                disabled={salvando || linhasExcedidas || !conteudo.trim() || !revisao.trim()}
                className="btn-primary"
              >
                <Save size={14} /> {salvando ? 'Salvando…' : salvo ? 'Atualizar' : 'Salvar relatório'}
              </button>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <div className="card p-6 fade-in stagger-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">
              Como escrever
            </p>
            <h3 className="font-display text-xl text-ink-900 mb-4">Boas práticas</h3>
            <ul className="space-y-3 text-sm text-ink-700">
              <li className="flex gap-2">
                <span className="text-terra-500 font-mono">→</span>
                <span>Cada linha = uma atividade concluída ou em andamento.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-terra-500 font-mono">→</span>
                <span>Mencione o que ficou pendente para amanhã.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-terra-500 font-mono">→</span>
                <span>Atualize a revisão sempre que avançar no projeto.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-terra-500 font-mono">→</span>
                <span>Seja conciso — cinco linhas, no máximo.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}
