import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Timer, Square } from 'lucide-react'
import { api } from '../lib/api'
import type { Cronometro } from '@shared/types'

const POLL_MS = 15000

function formatarSegundos(seg: number): string {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function CronometroFlutuante() {
  const location = useLocation()
  const navigate = useNavigate()
  const [ativo, setAtivo] = useState<Cronometro | null>(null)
  const [tempo, setTempo] = useState(0)
  const [parando, setParando] = useState(false)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  async function verificar() {
    try {
      const c = await api.cronometro.ativo()
      if (montado.current) setAtivo(c)
    } catch {
      // silencioso — widget so aparece quando ha certeza de cronometro ativo
    }
  }

  useEffect(() => {
    verificar()
    const t = setInterval(verificar, POLL_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  useEffect(() => {
    if (!ativo) return
    const inicioMs = new Date(ativo.inicio.replace(' ', 'T')).getTime()
    const calc = () => setTempo(Math.floor((Date.now() - inicioMs) / 1000))
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [ativo])

  async function parar() {
    if (!ativo) return
    setParando(true)
    try {
      await api.cronometro.parar(ativo.id)
      setAtivo(null)
    } catch {
      // se falhar, mantem o widget e deixa o usuario tentar de novo na pagina do cronometro
    } finally {
      setParando(false)
    }
  }

  if (!ativo || location.pathname === '/cronometro') return null

  return (
    <div
      className="fixed bottom-6 right-6 z-40 flex items-center gap-3 bg-ink-900 text-cream-50
        rounded-full pl-4 pr-2 py-2 shadow-lift"
    >
      <button
        type="button"
        onClick={() => navigate('/cronometro')}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        title="Ver cronômetro"
      >
        <Timer size={15} className="text-terra-400 shrink-0" />
        <div className="text-left leading-tight">
          <p className="text-[10px] font-mono uppercase tracking-widest text-cream-50/50 max-w-[140px] truncate">
            {ativo.projeto_nome || 'Cronômetro'}
          </p>
          <p className="font-mono text-sm tabular-nums">{formatarSegundos(tempo)}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={parar}
        disabled={parando}
        className="ml-1 p-1.5 rounded-full text-cream-50/70 hover:text-cream-50 hover:bg-white/10 transition-colors disabled:opacity-40"
        title="Parar cronômetro"
      >
        <Square size={13} fill="currentColor" />
      </button>
    </div>
  )
}
