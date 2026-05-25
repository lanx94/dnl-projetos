import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ArrowRight } from 'lucide-react'
import logoDNL from '../assets/logo-dnl-light.svg'

export default function Login() {
  const { user, login, apiAvailable } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      const res = await login(email, senha)
      if (!res.success) setErro(res.error || 'Erro no login')
      else navigate('/', { replace: true })
    } catch (e: any) {
      setErro(e.message || 'Erro inesperado')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-5 bg-cream-100">
      <div className="lg:col-span-3 relative bg-ink-900 text-cream-100 px-12 lg:px-20 py-16 flex flex-col justify-between overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px'
          }}
        />
        <div
          className="absolute -right-32 -top-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #C75D2C 0%, transparent 70%)' }}
        />

        <div className="relative">
          <img src={logoDNL} alt="DNL Projetos" className="w-96 h-auto" />
          <p className="font-mono text-[10px] uppercase tracking-widest text-cream-100/40 mt-2">
            Sistema interno
          </p>
        </div>

        <div className="relative max-w-lg">
          <p className="font-mono text-[10px] uppercase tracking-widest text-terra-400 mb-6">
            — Acesso restrito
          </p>
          <h2 className="font-display text-5xl lg:text-6xl leading-[1.05]">
            Cada hora,<br />
            cada <em className="text-terra-400">projeto</em>,<br />
            cada revisão.
          </h2>
          <p className="text-cream-100/60 text-sm mt-6 max-w-md leading-relaxed">
            Plataforma interna de gestão para a equipe DNL. Controle de ponto,
            cronometragem por projeto e relatórios consolidados.
          </p>
        </div>

        <div className="relative font-mono text-[10px] uppercase tracking-widest text-cream-100/40">
          {new Date().getFullYear()} · DNL Projetos
        </div>
      </div>

      <div className="lg:col-span-2 flex items-center justify-center px-8 lg:px-14 py-16">
        <div className="w-full max-w-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500 mb-3">
            01 · Autenticação
          </p>
          <h2 className="font-display text-4xl text-ink-900 mb-2">Entre na conta.</h2>
          <p className="text-ink-600 text-sm mb-10">
            Use seu email corporativo{' '}
            <span className="font-mono text-ink-900">@dnlprojetos.com</span>
          </p>

          {!apiAvailable && (
            <div className="mb-4 px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md">
              <p className="text-sm text-terra-700">Aguardando conexão com o sistema…</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="seu.nome@dnlprojetos.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div>
              <label className="label">Senha</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>

            {erro && (
              <div className="px-4 py-3 bg-terra-50 border border-terra-400/40 rounded-md">
                <p className="text-sm text-terra-700">{erro}</p>
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full mt-2"
              disabled={carregando || !apiAvailable}
            >
              {carregando ? (
                'Entrando…'
              ) : (
                <>
                  Entrar
                  <ArrowRight size={16} strokeWidth={2} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
