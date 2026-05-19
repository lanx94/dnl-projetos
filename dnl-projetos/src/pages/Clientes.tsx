import { useEffect, useState, FormEvent } from 'react'
import { Plus, X, Edit2, Trash2, Mail, Phone, MapPin, FileText } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import type { Cliente, TipoPessoa } from '@shared/types'
import { maskCpfCnpj, maskRG, maskTelefone } from '../utils/masks'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const lista = await api.clientes.listar()
    setClientes(lista)
  }

  async function deletar(c: Cliente) {
    if (!confirm(`Deletar cliente "${c.nome}"?`)) return
    const r = await api.clientes.deletar(c.id)
    if (r.success) carregar()
    else alert(r.error || 'Erro ao deletar')
  }

  const filtrados = clientes.filter((c) =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.cnpj?.toLowerCase().includes(busca.toLowerCase()) ||
    c.cpf?.toLowerCase().includes(busca.toLowerCase()) ||
    c.email?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <>
      <PageHeader
        numero="A3"
        rotulo="Clientes"
        titulo="Clientes"
        descricao="Cadastro completo de clientes e contatos."
        acoes={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={14} /> Novo cliente
          </button>
        }
      />

      <div className="mb-5 fade-in">
        <input
          className="input-field"
          placeholder="Buscar por nome, CNPJ ou email…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {filtrados.length === 0 ? (
        <div className="card p-12 text-center fade-in">
          <p className="font-display text-2xl text-ink-700 mb-2">
            {clientes.length === 0 ? 'Nenhum cliente cadastrado' : 'Nada encontrado'}
          </p>
          <p className="text-ink-500 text-sm">
            {clientes.length === 0
              ? 'Cadastre o primeiro cliente para começar.'
              : 'Tente buscar por outro termo.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtrados.map((c) => (
            <div key={c.id} className="card p-6 fade-in">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-display text-2xl text-ink-900 leading-tight flex-1 pr-3">
                  {c.nome}
                </h3>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setEditando(c)}
                    className="p-1.5 text-ink-500 hover:text-ink-900 transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deletar(c)}
                    className="p-1.5 text-ink-500 hover:text-terra-500 transition-colors"
                    title="Deletar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded ${
                    c.tipo_pessoa === 'fisica'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {c.tipo_pessoa === 'fisica' ? 'PF' : 'PJ'}
                </span>
                {c.cnpj && (
                  <p className="font-mono text-xs text-ink-500">CNPJ: {c.cnpj}</p>
                )}
                {c.cpf && (
                  <p className="font-mono text-xs text-ink-500">CPF: {c.cpf}</p>
                )}
              </div>

              <div className="space-y-1.5 text-sm">
                {c.contato_responsavel && (
                  <p className="text-ink-700">
                    <span className="text-ink-500 text-xs">Contato: </span>
                    {c.contato_responsavel}
                  </p>
                )}
                {c.email && (
                  <p className="flex items-center gap-2 text-ink-700">
                    <Mail size={12} className="text-ink-400" />
                    <span className="font-mono text-xs">{c.email}</span>
                  </p>
                )}
                {c.telefone && (
                  <p className="flex items-center gap-2 text-ink-700">
                    <Phone size={12} className="text-ink-400" />
                    <span className="font-mono text-xs">{c.telefone}</span>
                  </p>
                )}
                {c.endereco && (
                  <p className="flex items-start gap-2 text-ink-700">
                    <MapPin size={12} className="text-ink-400 mt-1 shrink-0" />
                    <span className="text-xs">{c.endereco}</span>
                  </p>
                )}
                {c.observacoes && (
                  <p className="flex items-start gap-2 text-ink-600 mt-3 pt-3 border-t border-ink-300/30">
                    <FileText size={12} className="text-ink-400 mt-0.5 shrink-0" />
                    <span className="text-xs italic">{c.observacoes}</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ModalCliente
          onFechar={() => setShowForm(false)}
          onSalvo={() => {
            setShowForm(false)
            carregar()
          }}
        />
      )}

      {editando && (
        <ModalCliente
          cliente={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null)
            carregar()
          }}
        />
      )}
    </>
  )
}

function ModalCliente({
  cliente,
  onFechar,
  onSalvo
}: {
  cliente?: Cliente
  onFechar: () => void
  onSalvo: () => void
}) {
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>(
    cliente?.tipo_pessoa || 'juridica'
  )
  const [nome, setNome] = useState(cliente?.nome || '')
  const [cnpj, setCnpj] = useState(cliente?.cnpj || '')
  const [inscricaoEstadual, setInscricaoEstadual] = useState(cliente?.inscricao_estadual || '')
  const [cpfCliente, setCpfCliente] = useState(cliente?.cpf || '')
  const [rgCliente, setRgCliente] = useState(cliente?.rg || '')
  const [email, setEmail] = useState(cliente?.email || '')
  const [telefone, setTelefone] = useState(cliente?.telefone || '')
  const [endereco, setEndereco] = useState(cliente?.endereco || '')
  const [contato, setContato] = useState(cliente?.contato_responsavel || '')
  const [obs, setObs] = useState(cliente?.observacoes || '')
  // Representante (pra contratos PJ)
  const [repNome, setRepNome] = useState(cliente?.representante_nome || '')
  const [repNacion, setRepNacion] = useState(cliente?.representante_nacionalidade || 'brasileiro')
  const [repNatural, setRepNatural] = useState(cliente?.representante_naturalidade || '')
  const [repEstado, setRepEstado] = useState(cliente?.representante_estado_civil || '')
  const [repProfissao, setRepProfissao] = useState(cliente?.representante_profissao || '')
  const [repRg, setRepRg] = useState(cliente?.representante_rg || '')
  const [repCpf, setRepCpf] = useState(cliente?.representante_cpf || '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const ehEdicao = !!cliente

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const dados: Partial<Cliente> = {
        tipo_pessoa: tipoPessoa,
        nome,
        cnpj: tipoPessoa === 'juridica' ? cnpj || undefined : undefined,
        inscricao_estadual:
          tipoPessoa === 'juridica' ? inscricaoEstadual || undefined : undefined,
        cpf: tipoPessoa === 'fisica' ? cpfCliente || undefined : undefined,
        rg: tipoPessoa === 'fisica' ? rgCliente || undefined : undefined,
        email: email || undefined,
        telefone: telefone || undefined,
        endereco: endereco || undefined,
        contato_responsavel: contato || undefined,
        observacoes: obs || undefined,
        representante_nome: repNome || undefined,
        representante_nacionalidade: repNacion || undefined,
        representante_naturalidade: repNatural || undefined,
        representante_estado_civil: repEstado || undefined,
        representante_profissao: repProfissao || undefined,
        representante_rg: repRg || undefined,
        representante_cpf: repCpf || undefined
      }
      if (ehEdicao) {
        await api.clientes.atualizar(cliente.id, dados as any)
      } else {
        await api.clientes.criar(dados as any)
      }
      onSalvo()
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-cream-50 rounded-lg shadow-lift w-full max-w-2xl max-h-[90vh] overflow-auto fade-in">
        <div className="px-7 py-5 border-b border-ink-300/40 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              {ehEdicao ? 'Editar' : 'Novo'}
            </p>
            <h2 className="font-display text-3xl text-ink-900">
              {ehEdicao ? cliente.nome : 'Cadastrar cliente'}
            </h2>
          </div>
          <button onClick={onFechar} className="text-ink-500 hover:text-ink-900">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div>
            <label className="label">Nome / Razão social *</label>
            <input
              className="input-field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          {/* Seletor Tipo de Pessoa */}
          <div>
            <label className="label">Tipo *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTipoPessoa('juridica')}
                className={`flex-1 py-3 px-4 rounded-md border-2 transition-all text-left
                  ${
                    tipoPessoa === 'juridica'
                      ? 'border-terra-500 bg-terra-50'
                      : 'border-ink-300/40 bg-cream-50 hover:bg-cream-100'
                  }`}
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  PJ
                </p>
                <p className="font-display text-base text-ink-900">Pessoa Jurídica</p>
                <p className="text-xs text-ink-500">CNPJ + Inscrição Estadual</p>
              </button>
              <button
                type="button"
                onClick={() => setTipoPessoa('fisica')}
                className={`flex-1 py-3 px-4 rounded-md border-2 transition-all text-left
                  ${
                    tipoPessoa === 'fisica'
                      ? 'border-terra-500 bg-terra-50'
                      : 'border-ink-300/40 bg-cream-50 hover:bg-cream-100'
                  }`}
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  PF
                </p>
                <p className="font-display text-base text-ink-900">Pessoa Física</p>
                <p className="text-xs text-ink-500">CPF + RG</p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {tipoPessoa === 'juridica' ? (
              <>
                <div>
                  <label className="label">CNPJ</label>
                  <input
                    className="input-field font-mono"
                    placeholder="00.000.000/0000-00"
                    value={cnpj}
                    onChange={(e) => setCnpj(maskCpfCnpj(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label">Inscrição estadual</label>
                  <input
                    className="input-field font-mono"
                    placeholder="opcional"
                    value={inscricaoEstadual}
                    onChange={(e) => setInscricaoEstadual(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">CPF</label>
                  <input
                    className="input-field font-mono"
                    placeholder="000.000.000-00"
                    value={cpfCliente}
                    onChange={(e) => setCpfCliente(maskCpfCnpj(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label">RG</label>
                  <input
                    className="input-field font-mono"
                    placeholder="00.000.000-0"
                    value={rgCliente}
                    onChange={(e) => setRgCliente(maskRG(e.target.value))}
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Telefone</label>
              <input
                className="input-field"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(maskTelefone(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Contato responsável</label>
              <input
                className="input-field"
                placeholder="Nome do contato"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Endereço</label>
            <input
              className="input-field"
              placeholder="Rua, número, complemento, cidade"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea
              className="input-field min-h-[80px]"
              rows={3}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Notas internas sobre este cliente..."
            />
          </div>

          <div className="pt-5 border-t border-ink-300/40">
            <p className="font-mono text-[10px] uppercase tracking-widest text-terra-500 mb-1">
              Representante legal (para contratos)
            </p>
            <p className="text-xs text-ink-500 mb-4">
              Preencha quando este cliente for usado em contratos. Para PF, use os mesmos
              dados do próprio cliente.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nome do representante</label>
                  <input
                    className="input-field"
                    value={repNome}
                    onChange={(e) => setRepNome(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="label">Profissão</label>
                  <input
                    className="input-field"
                    value={repProfissao}
                    onChange={(e) => setRepProfissao(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Nacionalidade</label>
                  <input
                    className="input-field"
                    value={repNacion}
                    onChange={(e) => setRepNacion(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Naturalidade</label>
                  <input
                    className="input-field"
                    value={repNatural}
                    onChange={(e) => setRepNatural(e.target.value)}
                    placeholder="Cidade/UF"
                  />
                </div>
                <div>
                  <label className="label">Estado civil</label>
                  <input
                    className="input-field"
                    value={repEstado}
                    onChange={(e) => setRepEstado(e.target.value)}
                    placeholder="solteiro, casado..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">RG</label>
                  <input
                    className="input-field font-mono"
                    value={repRg}
                    onChange={(e) => setRepRg(maskRG(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label">CPF</label>
                  <input
                    className="input-field font-mono"
                    value={repCpf}
                    onChange={(e) => setRepCpf(maskCpfCnpj(e.target.value))}
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>
            </div>
          </div>

          {erro && (
            <div className="px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md">
              <p className="text-sm text-terra-700">{erro}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-ink-300/40">
            <button type="button" onClick={onFechar} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="btn-primary">
              {salvando ? 'Salvando…' : ehEdicao ? 'Salvar alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
