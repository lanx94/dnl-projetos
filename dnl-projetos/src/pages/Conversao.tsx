import { useState, useCallback } from 'react'
import { ArrowRightLeft } from 'lucide-react'

type Unidade = { label: string; simbolo: string; fator?: number }
type Categoria = {
  nome: string
  unidades: Unidade[]
  converter?: (valor: number, de: string, para: string) => number
}

const categorias: Categoria[] = [
  {
    nome: 'Comprimento',
    unidades: [
      { label: 'Milímetro',    simbolo: 'mm',  fator: 0.001 },
      { label: 'Centímetro',   simbolo: 'cm',  fator: 0.01 },
      { label: 'Metro',        simbolo: 'm',   fator: 1 },
      { label: 'Quilômetro',   simbolo: 'km',  fator: 1000 },
      { label: 'Polegada',     simbolo: 'in',  fator: 0.0254 },
      { label: 'Pé',           simbolo: 'ft',  fator: 0.3048 },
      { label: 'Jarda',        simbolo: 'yd',  fator: 0.9144 },
      { label: 'Milha',        simbolo: 'mi',  fator: 1609.344 },
    ],
  },
  {
    nome: 'Massa',
    unidades: [
      { label: 'Miligrama',   simbolo: 'mg',  fator: 0.000001 },
      { label: 'Grama',       simbolo: 'g',   fator: 0.001 },
      { label: 'Quilograma',  simbolo: 'kg',  fator: 1 },
      { label: 'Tonelada',    simbolo: 't',   fator: 1000 },
      { label: 'Onça',        simbolo: 'oz',  fator: 0.0283495 },
      { label: 'Libra',       simbolo: 'lb',  fator: 0.453592 },
    ],
  },
  {
    nome: 'Temperatura',
    unidades: [
      { label: 'Celsius',     simbolo: '°C' },
      { label: 'Fahrenheit',  simbolo: '°F' },
      { label: 'Kelvin',      simbolo: 'K' },
    ],
    converter: (valor, de, para) => {
      let celsius = valor
      if (de === '°F') celsius = (valor - 32) * 5 / 9
      if (de === 'K')  celsius = valor - 273.15
      if (para === '°C') return celsius
      if (para === '°F') return celsius * 9 / 5 + 32
      return celsius + 273.15
    },
  },
  {
    nome: 'Área',
    unidades: [
      { label: 'Milímetro²',   simbolo: 'mm²', fator: 0.000001 },
      { label: 'Centímetro²',  simbolo: 'cm²', fator: 0.0001 },
      { label: 'Metro²',       simbolo: 'm²',  fator: 1 },
      { label: 'Quilômetro²',  simbolo: 'km²', fator: 1_000_000 },
      { label: 'Hectare',      simbolo: 'ha',  fator: 10_000 },
      { label: 'Acre',         simbolo: 'ac',  fator: 4046.86 },
    ],
  },
  {
    nome: 'Volume',
    unidades: [
      { label: 'Mililitro',     simbolo: 'ml',    fator: 0.001 },
      { label: 'Litro',         simbolo: 'L',     fator: 1 },
      { label: 'Metro³',        simbolo: 'm³',    fator: 1000 },
      { label: 'Galão (US)',    simbolo: 'gal',   fator: 3.78541 },
      { label: 'Fl. oz (US)',   simbolo: 'fl oz', fator: 0.0295735 },
    ],
  },
  {
    nome: 'Velocidade',
    unidades: [
      { label: 'Metro/segundo',      simbolo: 'm/s',  fator: 1 },
      { label: 'Quilômetro/hora',    simbolo: 'km/h', fator: 1 / 3.6 },
      { label: 'Milha/hora',         simbolo: 'mph',  fator: 0.44704 },
      { label: 'Nó',                 simbolo: 'kt',   fator: 0.514444 },
    ],
  },
  {
    nome: 'Tempo',
    unidades: [
      { label: 'Segundo',    simbolo: 's',   fator: 1 },
      { label: 'Minuto',     simbolo: 'min', fator: 60 },
      { label: 'Hora',       simbolo: 'h',   fator: 3600 },
      { label: 'Dia',        simbolo: 'd',   fator: 86400 },
      { label: 'Semana',     simbolo: 'sem', fator: 604800 },
      { label: 'Mês (30d)',  simbolo: 'mês', fator: 2592000 },
      { label: 'Ano',        simbolo: 'ano', fator: 31536000 },
    ],
  },
  {
    nome: 'Dados',
    unidades: [
      { label: 'Bit',       simbolo: 'bit', fator: 1 },
      { label: 'Byte',      simbolo: 'B',   fator: 8 },
      { label: 'Kilobyte',  simbolo: 'KB',  fator: 8192 },
      { label: 'Megabyte',  simbolo: 'MB',  fator: 8_388_608 },
      { label: 'Gigabyte',  simbolo: 'GB',  fator: 8_589_934_592 },
      { label: 'Terabyte',  simbolo: 'TB',  fator: 8_796_093_022_208 },
    ],
  },
]

function formatar(n: number): string {
  if (isNaN(n) || !isFinite(n)) return '—'
  if (Math.abs(n) >= 1e12 || (Math.abs(n) < 0.000001 && n !== 0)) {
    return n.toExponential(6)
  }
  const s = parseFloat(n.toPrecision(10))
  return s.toLocaleString('pt-BR', { maximumFractionDigits: 10 })
}

export default function Conversao() {
  const [catIdx, setCatIdx] = useState(0)
  const [de, setDe] = useState(0)
  const [para, setPara] = useState(1)
  const [valor, setValor] = useState('')

  const cat = categorias[catIdx]

  const resultado = useCallback(() => {
    const v = parseFloat(valor.replace(',', '.'))
    if (isNaN(v)) return ''
    const simDe = cat.unidades[de].simbolo
    const simPara = cat.unidades[para].simbolo
    if (cat.converter) return formatar(cat.converter(v, simDe, simPara))
    const fDe = cat.unidades[de].fator!
    const fPara = cat.unidades[para].fator!
    return formatar(v * fDe / fPara)
  }, [valor, cat, de, para])

  const trocar = () => {
    setDe(para)
    setPara(de)
  }

  const mudarCategoria = (idx: number) => {
    setCatIdx(idx)
    setDe(0)
    setPara(1)
    setValor('')
  }

  const res = resultado()

  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-400 mb-1">Ferramentas</p>
        <h1 className="font-display text-3xl text-ink-900">Conversão de Unidades</h1>
        <p className="text-ink-500 mt-1 text-sm">Converta entre unidades de medida de diferentes categorias.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {categorias.map((c, i) => (
          <button
            key={c.nome}
            onClick={() => mudarCategoria(i)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
              ${catIdx === i
                ? 'bg-ink-900 text-cream-50'
                : 'bg-cream-200 text-ink-700 hover:bg-cream-300'}`}
          >
            {c.nome}
          </button>
        ))}
      </div>

      <div className="max-w-lg">
        <div className="bg-cream-50 border border-ink-200 rounded-xl p-6">
          <div className="mb-4">
            <label className="font-mono text-[10px] uppercase tracking-widest text-ink-400 mb-2 block">
              De
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0"
                className="flex-1 min-w-0 bg-white border border-ink-200 rounded-lg px-3 py-2.5 text-lg
                  font-display focus:outline-none focus:border-ink-500 transition-colors"
              />
              <select
                value={de}
                onChange={e => setDe(Number(e.target.value))}
                className="bg-white border border-ink-200 rounded-lg px-3 py-2.5 text-sm
                  focus:outline-none focus:border-ink-500 transition-colors"
              >
                {cat.unidades.map((u, i) => (
                  <option key={u.simbolo} value={i}>{u.label} ({u.simbolo})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-center my-4">
            <button
              onClick={trocar}
              title="Trocar unidades"
              className="p-2 rounded-full border border-ink-200 bg-cream-100 hover:bg-cream-200 transition-colors"
            >
              <ArrowRightLeft size={16} className="text-ink-600" />
            </button>
          </div>

          <div className="mb-6">
            <label className="font-mono text-[10px] uppercase tracking-widest text-ink-400 mb-2 block">
              Para
            </label>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0 bg-white border border-ink-200 rounded-lg px-3 py-2.5
                text-lg font-display text-ink-900 min-h-[46px] flex items-center">
                {res ? res : <span className="text-ink-300">—</span>}
              </div>
              <select
                value={para}
                onChange={e => setPara(Number(e.target.value))}
                className="bg-white border border-ink-200 rounded-lg px-3 py-2.5 text-sm
                  focus:outline-none focus:border-ink-500 transition-colors"
              >
                {cat.unidades.map((u, i) => (
                  <option key={u.simbolo} value={i}>{u.label} ({u.simbolo})</option>
                ))}
              </select>
            </div>
          </div>

          {valor && res && (
            <div className="text-center font-mono text-xs text-ink-400 bg-cream-100 rounded-lg py-2 px-4">
              {valor} {cat.unidades[de].simbolo} = {res} {cat.unidades[para].simbolo}
            </div>
          )}
        </div>

        {cat.nome === 'Temperatura' && (
          <div className="mt-4 p-4 border border-ink-200 rounded-lg bg-cream-50">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-400 mb-2">Referências rápidas</p>
            <div className="grid grid-cols-3 gap-2 text-xs text-ink-600">
              {[
                ['Congelamento', '0°C', '32°F', '273K'],
                ['Corpo humano', '36.5°C', '97.7°F', '309.65K'],
                ['Ebulição', '100°C', '212°F', '373K'],
              ].map(([label, c, f, k]) => (
                <div key={label} className="text-center">
                  <p className="text-ink-400 mb-1">{label}</p>
                  <p className="font-medium">{c}</p>
                  <p>{f}</p>
                  <p>{k}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
