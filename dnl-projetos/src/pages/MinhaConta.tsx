import { KeyRound } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'

export default function MinhaContaPage() {
  const { user } = useAuth()

  return (
    <>
      <PageHeader
        numero="09"
        rotulo="Minha conta"
        titulo="Minha conta"
        descricao="Visualize seus dados e gerencie seu acesso."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-7 fade-in">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
            Dados pessoais
          </p>
          <h3 className="font-display text-2xl text-ink-900 mb-5">{user?.nome}</h3>

          <div className="space-y-3 text-sm">
            <Linha rotulo="Email" valor={user?.email || '—'} mono />
            <Linha rotulo="Cargo" valor={user?.cargo || '—'} />
            <Linha rotulo="Tipo de acesso" valor={user?.role.toUpperCase() || '—'} />
            {user?.cpf && <Linha rotulo="CPF" valor={user.cpf} mono />}
            {user?.telefone && <Linha rotulo="Telefone" valor={user.telefone} />}
            {user?.data_admissao && (
              <Linha
                rotulo="Admissão"
                valor={new Date(user.data_admissao + 'T12:00').toLocaleDateString('pt-BR')}
              />
            )}
          </div>

          <p className="text-xs text-ink-500 mt-5 pt-5 border-t border-ink-300/30">
            Para alterar dados pessoais, peça ao admin/RH.
          </p>
        </div>

        <div className="card p-7 fade-in stagger-1">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={14} className="text-terra-500" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              Segurança
            </p>
          </div>
          <h3 className="font-display text-2xl text-ink-900 mb-4">Alterar senha</h3>

          <p className="text-sm text-ink-600 mb-6">
            Para alterar sua senha, peça ao administrador do sistema ou use a opção "Trocar Minha Senha" abaixo.
          </p>
        </div>
      </div>
    </>
  )
}

function Linha({
  rotulo,
  valor,
  mono
}: {
  rotulo: string
  valor: string
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-ink-300/30 last:border-0">
      <span className="text-ink-500">{rotulo}</span>
      <span className={`text-ink-900 ${mono ? 'font-mono text-xs' : ''}`}>{valor}</span>
    </div>
  )
}
