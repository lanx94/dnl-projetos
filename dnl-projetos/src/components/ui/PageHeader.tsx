import { ReactNode } from 'react'

interface PageHeaderProps {
  numero: string
  rotulo: string
  titulo: string
  descricao?: string
  acoes?: ReactNode
}

export default function PageHeader({
  numero,
  rotulo,
  titulo,
  descricao,
  acoes
}: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-8 mb-10 pb-6 border-b border-ink-300/40 fade-in">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-2">
          {numero} · {rotulo}
        </p>
        <h1 className="font-display text-5xl tracking-tightest text-ink-900 leading-none">
          {titulo}
        </h1>
        {descricao && <p className="text-ink-600 text-sm mt-3 max-w-xl">{descricao}</p>}
      </div>
      {acoes && <div className="flex gap-3 items-center shrink-0">{acoes}</div>}
    </div>
  )
}
