import { useState } from 'react'
import { X } from 'lucide-react'
import { api } from '../lib/api'
import type { PontosDoDia, TipoPonto, Ponto } from '@shared/types'

export const ROTULOS_TIPO: Record<TipoPonto, string> = {
  entrada: 'Entrada',
  almoco_inicio: 'Almoço',
  almoco_fim: 'Volta do almoço',
  saida: 'Saída',
  parada_inicio: 'Parada extra',
  parada_fim: 'Retomada'
}

const TIPOS_UNICOS: TipoPonto[] = ['entrada', 'almoco_inicio', 'almoco_fim', 'saida']

export function parseSQLiteDate(s: string): Date {
  return new Date(s.replace(' ', 'T'))
}

export function paraInputs(ts?: string, dataPadrao?: string): { data: string; hora: string } {
  if (!ts && dataPadrao) return { data: dataPadrao, hora: '08:00' }
  const d = ts ? parseSQLiteDate(ts) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    data: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
}

function primeiroTipoFaltante(estado?: PontosDoDia | null): TipoPonto {
  if (!estado) return 'entrada'
  for (const t of TIPOS_UNICOS) {
    if (!estado[t as keyof PontosDoDia]) return t
  }
  return 'entrada'
}

export default function ModalPonto({
  modo,
  ponto,
  estado,
  tipoPadrao,
  dataPadrao,
  usuarioId,
  onFechar,
  onSalvo
}: {
  modo: 'criar' | 'editar'
  ponto?: Ponto
  estado?: PontosDoDia | null
  tipoPadrao?: TipoPonto
  dataPadrao?: string
  usuarioId?: number
  onFechar: () => void
  onSalvo: () => void
}) {
  const iniciais = paraInputs(ponto?.timestamp, dataPadrao)
  const [tipo, setTipo] = useState<TipoPonto>(ponto?.tipo || tipoPadrao || primeiroTipoFaltante(estado))
  const [data, setData] = useState(iniciais.data)
  const [hora, setHora] = useState(iniciais.hora)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setErro('')
    if (!motivo.trim()) {
      setErro('Informe o motivo da correção')
      return
    }
    setSalvando(true)
    try {
      const timestamp = `${data} ${hora}`
      if (modo === 'editar' && ponto) {
        await api.pontos.corrigir(ponto.id, timestamp, motivo.trim())
      } else {
        await api.pontos.criarManual({ tipo, timestamp, motivo: motivo.trim(), usuario_id: usuarioId })
      }
      onSalvo()
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!ponto) return
    setErro('')
    if (!motivo.trim()) {
      setErro('Informe o motivo da exclusão')
      return
    }
    setSalvando(true)
    try {
      await api.pontos.excluir(ponto.id, motivo.trim())
      onSalvo()
    } catch (e: any) {
      setErro(e.message || 'Erro ao excluir')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-7">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-2xl text-ink-900">
            {modo === 'editar' ? 'Corrigir ponto' : 'Registrar ponto esquecido'}
          </h3>
          <button onClick={onFechar} className="text-ink-400 hover:text-ink-900">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Tipo</label>
            <select
              className="input-field"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoPonto)}
              disabled={modo === 'editar'}
            >
              {Object.entries(ROTULOS_TIPO).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Data</label>
              <input
                type="date"
                className="input-field"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="label">Hora</label>
              <input
                type="time"
                className="input-field"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Motivo da correção</label>
            <input
              type="text"
              className="input-field"
              placeholder="Ex: esqueci de bater a saída"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
            />
          </div>

          {erro && <p className="text-sm text-terra-700">{erro}</p>}

          <div className="flex items-center justify-between pt-2">
            {modo === 'editar' ? (
              <button onClick={excluir} disabled={salvando} className="btn-secondary text-terra-600">
                Excluir
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button onClick={onFechar} disabled={salvando} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando} className="btn-primary">
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
