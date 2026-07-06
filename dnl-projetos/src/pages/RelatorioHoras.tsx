import { useEffect, useState } from 'react'
import { Calendar, User as UserIcon, Pencil } from 'lucide-react'
import { api } from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import ModalPonto from '../components/ModalPonto'
import type { RelatorioHoras, Ponto, TipoPonto, User } from '@shared/types'

function inicioDoMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export default function RelatorioHorasPage() {
  const { user } = useAuth()
  const [inicio, setInicio] = useState(inicioDoMes())
  const [fim, setFim] = useState(hojeISO())
  const [dados, setDados] = useState<RelatorioHoras[]>([])
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [usuarioAlvo, setUsuarioAlvo] = useState<number | ''>('')
  const [carregando, setCarregando] = useState(false)
  const [modal, setModal] = useState<{ modo: 'criar' | 'editar'; ponto?: Ponto; tipo: TipoPonto; data: string } | null>(null)

  const ehAdmin = user?.role === 'admin'

  function abrirEdicao(ponto: Ponto | undefined, tipo: TipoPonto, data: string) {
    setModal(ponto ? { modo: 'editar', ponto, tipo, data } : { modo: 'criar', tipo, data })
  }

  useEffect(() => {
    if (ehAdmin) {
      api.usuarios.listar().then((us) => setUsuarios(us as User[]))
    }
  }, [ehAdmin])

  useEffect(() => {
    consultar()
  }, [usuarioAlvo, inicio, fim])

  async function consultar() {
    setCarregando(true)
    try {
      const alvo = usuarioAlvo ? Number(usuarioAlvo) : undefined
      const d = await api.relatorios.horasPorPeriodo(inicio, fim, alvo)
      setDados(d)
    } finally {
      setCarregando(false)
    }
  }

  const totalSegundos = dados.reduce((acc, d) => acc + d.horas_em_segundos, 0)
  const totalHoras = formatarHoras(totalSegundos)

  return (
    <>
      <PageHeader
        numero="06"
        rotulo="Relatório de horas"
        titulo="Horas trabalhadas"
        descricao={
          ehAdmin
            ? 'Visualize horas trabalhadas — sua equipe ou as suas próprias.'
            : 'Suas horas trabalhadas no período selecionado.'
        }
        acoes={
          <button
            type="button"
            onClick={async () => {
              const r = await api.exports.horasProjetoExcel({
                inicio,
                fim,
                usuario_id: usuarioAlvo ? Number(usuarioAlvo) : undefined
              })
              if (r.success) {
                alert(`Exportado para: ${r.arquivo}`)
              } else if (r.error && r.error !== 'Exportação cancelada') {
                alert(`Erro: ${r.error}`)
              }
            }}
            className="btn-secondary"
            title="Exportar para Excel"
          >
            📊 Excel
          </button>
        }
      />

      <div className="card p-5 mb-6 fade-in">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">De</label>
            <input
              type="date"
              className="input-field"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Até</label>
            <input
              type="date"
              className="input-field"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </div>
          {ehAdmin && (
            <div className="min-w-[200px]">
              <label className="label flex items-center gap-1">
                <UserIcon size={11} /> Funcionário
              </label>
              <select
                className="input-field"
                value={usuarioAlvo}
                onChange={(e) => setUsuarioAlvo(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— Eu mesmo —</option>
                {usuarios
                  .filter((u) => u.id !== user?.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <button onClick={consultar} className="btn-primary">
            <Calendar size={14} /> Consultar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 fade-in stagger-1">
        <CardResumo rotulo="Total no período" valor={totalHoras} destaque />
        <CardResumo rotulo="Dias trabalhados" valor={String(dados.length)} />
        <CardResumo
          rotulo="Média diária"
          valor={dados.length > 0 ? formatarHoras(totalSegundos / dados.length) : '00h00'}
        />
      </div>

      <div className="card overflow-hidden fade-in stagger-2">
        <div className="px-7 py-5 border-b border-ink-300/40">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-1">
            Detalhamento
          </p>
          <h3 className="font-display text-2xl text-ink-900">Por dia</h3>
        </div>

        {carregando ? (
          <p className="px-7 py-12 text-center text-ink-500 text-sm">Carregando…</p>
        ) : dados.length === 0 ? (
          <p className="px-7 py-12 text-center text-ink-500 text-sm">
            Nenhum ponto registrado neste período.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-300/40 text-left">
                <Th>Data</Th>
                <Th>Entrada</Th>
                <Th>Almoço</Th>
                <Th>Volta</Th>
                <Th>Saída</Th>
                <Th align="right">Paradas</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {dados.map((d) => {
                const entrada = d.pontos.find((p) => p.tipo === 'entrada')
                const almIni = d.pontos.find((p) => p.tipo === 'almoco_inicio')
                const almFim = d.pontos.find((p) => p.tipo === 'almoco_fim')
                const saida = d.pontos.find((p) => p.tipo === 'saida')
                return (
                  <tr key={d.data} className="border-b border-ink-300/20 hover:bg-cream-200/50">
                    <Td>
                      <span className="font-mono text-xs uppercase tracking-wider">
                        {new Date(d.data + 'T12:00').toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          weekday: 'short'
                        })}
                      </span>
                    </Td>
                    <Td>
                      <HoraEditavel ponto={entrada} tipo="entrada" data={d.data} onEditar={abrirEdicao} />
                    </Td>
                    <Td>
                      <HoraEditavel ponto={almIni} tipo="almoco_inicio" data={d.data} onEditar={abrirEdicao} />
                    </Td>
                    <Td>
                      <HoraEditavel ponto={almFim} tipo="almoco_fim" data={d.data} onEditar={abrirEdicao} />
                    </Td>
                    <Td>
                      <HoraEditavel ponto={saida} tipo="saida" data={d.data} onEditar={abrirEdicao} />
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-xs text-ink-500">{d.total_paradas}</span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-sm font-medium text-ink-900 tabular-nums">
                        {d.horas_trabalhadas}
                      </span>
                    </Td>
                  </tr>
                )
              })}
              <tr className="bg-cream-200/50">
                <Td colSpan={5}>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                    Total
                  </span>
                </Td>
                <Td />
                <Td align="right">
                  <span className="font-display text-xl text-ink-900 tabular-nums">
                    {totalHoras}
                  </span>
                </Td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <ModalPonto
          modo={modal.modo}
          ponto={modal.ponto}
          tipoPadrao={modal.tipo}
          dataPadrao={modal.data}
          usuarioId={usuarioAlvo ? Number(usuarioAlvo) : undefined}
          onFechar={() => setModal(null)}
          onSalvo={() => {
            setModal(null)
            consultar()
          }}
        />
      )}
    </>
  )
}

function CardResumo({
  rotulo,
  valor,
  destaque
}: {
  rotulo: string
  valor: string
  destaque?: boolean
}) {
  return (
    <div className="card p-6">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">
        {rotulo}
      </p>
      <p
        className={`font-display tabular-nums ${destaque ? 'text-5xl text-ink-900' : 'text-3xl text-ink-700'}`}
      >
        {valor}
      </p>
    </div>
  )
}

function Th({ children, align = 'left' }: any) {
  return (
    <th
      className={`px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-ink-500 font-normal text-${align}`}
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left', colSpan }: any) {
  return (
    <td className={`px-5 py-3 text-${align}`} colSpan={colSpan}>
      {children}
    </td>
  )
}

function HoraEditavel({
  ponto,
  tipo,
  data,
  onEditar
}: {
  ponto?: Ponto
  tipo: TipoPonto
  data: string
  onEditar: (ponto: Ponto | undefined, tipo: TipoPonto, data: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5 group">
      {ponto ? (
        <span className="font-mono text-sm text-ink-700 tabular-nums">
          {new Date(ponto.timestamp.replace(' ', 'T')).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      ) : (
        <span className="text-ink-300">—</span>
      )}
      <button
        type="button"
        onClick={() => onEditar(ponto, tipo, data)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-400 hover:text-ink-900"
        title={ponto ? 'Editar este ponto' : 'Registrar ponto esquecido'}
      >
        <Pencil size={12} />
      </button>
    </div>
  )
}

function formatarHoras(seg: number): string {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`
}
