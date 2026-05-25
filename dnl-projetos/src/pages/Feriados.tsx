import { useState, useMemo } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'

interface Feriado {
  data: Date
  nome: string
  tipo: 'nacional' | 'estadual' | 'municipal'
}

function calcularPascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, month - 1, day)
}

function addDias(data: Date, dias: number): Date {
  const d = new Date(data)
  d.setDate(d.getDate() + dias)
  return d
}

function getFeriados(ano: number): Feriado[] {
  const pascoa = calcularPascoa(ano)
  const feriados: Feriado[] = [
    { data: new Date(ano, 0, 1),  nome: 'Confraternização Universal',    tipo: 'nacional' },
    { data: new Date(ano, 0, 25), nome: 'Aniversário de São Paulo',       tipo: 'municipal' },
    { data: addDias(pascoa, -48), nome: 'Carnaval (Segunda-feira)',        tipo: 'nacional' },
    { data: addDias(pascoa, -47), nome: 'Carnaval (Terça-feira)',          tipo: 'nacional' },
    { data: addDias(pascoa, -2),  nome: 'Sexta-feira Santa',              tipo: 'nacional' },
    { data: pascoa,               nome: 'Páscoa',                          tipo: 'nacional' },
    { data: new Date(ano, 3, 21), nome: 'Tiradentes',                      tipo: 'nacional' },
    { data: new Date(ano, 4, 1),  nome: 'Dia do Trabalho',                tipo: 'nacional' },
    { data: addDias(pascoa, 60),  nome: 'Corpus Christi',                  tipo: 'nacional' },
    { data: new Date(ano, 6, 9),  nome: 'Revolução Constitucionalista',   tipo: 'estadual' },
    { data: new Date(ano, 8, 7),  nome: 'Independência do Brasil',        tipo: 'nacional' },
    { data: new Date(ano, 9, 12), nome: 'Nossa Senhora Aparecida',        tipo: 'nacional' },
    { data: new Date(ano, 10, 2), nome: 'Finados',                         tipo: 'nacional' },
    { data: new Date(ano, 10, 15),nome: 'Proclamação da República',       tipo: 'nacional' },
    { data: new Date(ano, 10, 20),nome: 'Consciência Negra',              tipo: 'nacional' },
    { data: new Date(ano, 11, 25),nome: 'Natal',                           tipo: 'nacional' },
  ]
  return feriados.sort((a, b) => a.data.getTime() - b.data.getTime())
}

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

const tipoCor: Record<string, string> = {
  nacional:   'bg-ink-100 text-ink-600 border-ink-300',
  estadual:   'bg-terra-50 text-terra-700 border-terra-200',
  municipal:  'bg-blue-50 text-blue-700 border-blue-200',
}

export default function Feriados() {
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(anoAtual)

  const feriados = useMemo(() => getFeriados(ano), [ano])

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const feriadosPorMes = useMemo(() => {
    const meses: Feriado[][] = Array.from({ length: 12 }, () => [])
    for (const f of feriados) meses[f.data.getMonth()].push(f)
    return meses
  }, [feriados])

  const proximoFeriado = feriados.find(f => {
    const d = new Date(f.data)
    d.setHours(0, 0, 0, 0)
    return d >= hoje
  })

  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-400 mb-1">Ferramentas</p>
        <h1 className="font-display text-3xl text-ink-900">Feriados — São Paulo Capital</h1>
        <p className="text-ink-500 mt-1 text-sm">Feriados nacionais, estaduais e municipais da cidade de São Paulo.</p>
      </div>

      {proximoFeriado && (
        <div className="mb-6 p-4 bg-ink-900 text-cream-50 rounded-lg flex items-center gap-4">
          <CalendarCheck size={20} className="text-terra-400 shrink-0" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-cream-50/50 mb-0.5">Próximo feriado</p>
            <p className="font-medium">{proximoFeriado.nome}</p>
            <p className="text-sm text-cream-50/70">
              {DIAS_SEMANA[proximoFeriado.data.getDay()]},{' '}
              {proximoFeriado.data.getDate()} de {MESES[proximoFeriado.data.getMonth()]} de {ano}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setAno(a => a - 1)}
          className="p-1.5 rounded hover:bg-cream-200 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="font-display text-xl text-ink-900 w-16 text-center">{ano}</span>
        <button
          onClick={() => setAno(a => a + 1)}
          className="p-1.5 rounded hover:bg-cream-200 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
        <div className="ml-4 flex items-center gap-4 text-xs text-ink-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-ink-400 inline-block" /> Nacional
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-terra-400 inline-block" /> Estadual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Municipal
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MESES.map((mes, mi) => {
          const itens = feriadosPorMes[mi]
          if (itens.length === 0) return (
            <div key={mes} className="border border-ink-200 rounded-lg p-4 opacity-35">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-400 mb-2">{mes}</p>
              <p className="text-sm text-ink-400 italic">Sem feriados</p>
            </div>
          )
          return (
            <div key={mes} className="border border-ink-200 rounded-lg p-4 bg-cream-50">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-400 mb-3">{mes}</p>
              <div className="space-y-3">
                {itens.map((f, i) => {
                  const dData = new Date(f.data)
                  dData.setHours(0, 0, 0, 0)
                  const passado = dData.getTime() < hoje.getTime()
                  return (
                    <div key={i} className={`flex items-start gap-3 ${passado ? 'opacity-35' : ''}`}>
                      <div className="text-center min-w-[2.5rem]">
                        <div className="font-display text-lg leading-none text-ink-900">{f.data.getDate()}</div>
                        <div className="font-mono text-[9px] uppercase text-ink-400">{DIAS_SEMANA[f.data.getDay()]}</div>
                      </div>
                      <div className="flex-1 pt-0.5">
                        <p className="text-sm text-ink-800 leading-snug">{f.nome}</p>
                        <span className={`inline-block font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border mt-1 ${tipoCor[f.tipo]}`}>
                          {f.tipo}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
