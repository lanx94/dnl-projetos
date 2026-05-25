import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Ponto from './pages/Ponto'
import Projetos from './pages/Projetos'
import Cronometro from './pages/Cronometro'
import RelatorioDiarioPage from './pages/RelatorioDiario'
import RelatorioHorasPage from './pages/RelatorioHoras'
import Feed from './pages/Feed'
import Funcionarios from './pages/Funcionarios'
import Clientes from './pages/Clientes'
import Financeiro from './pages/Financeiro'
import AdminDashboard from './pages/AdminDashboard'
import Conhecimento from './pages/Conhecimento'
import Orcamentos from './pages/Orcamentos'
import Contratos from './pages/Contratos'
import DRE from './pages/DRE'
import Backup from './pages/Backup'
import MinhaConta from './pages/MinhaConta'
import Reunioes from './pages/Reunioes'
import CRM from './pages/CRM'
import GestorProjetos from './pages/GestorProjetos'
import Dashboards from './pages/Dashboards'
import FluxoCaixa from './pages/FluxoCaixa'
import Balancete from './pages/Balancete'
import Metas from './pages/Metas'
import RevisoesProjeto from './pages/RevisoesProjeto'
import CalendarioPostagem from './pages/CalendarioPostagem'
import Feriados from './pages/Feriados'
import Configuracoes from './pages/Configuracoes'
import Conversao from './pages/Conversao'
import Layout from './components/layout/Layout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-100">
        <p className="font-display text-2xl text-ink-600">Carregando…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'admin' && user?.role !== 'rh') return <Navigate to="/" replace />
  return <>{children}</>
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/ponto" element={<Ponto />} />
                <Route path="/projetos" element={<Projetos />} />
                <Route path="/cronometro" element={<Cronometro />} />
                <Route path="/relatorio-diario" element={<RelatorioDiarioPage />} />
                <Route path="/relatorio-horas" element={<RelatorioHorasPage />} />
                <Route path="/conhecimento" element={<Conhecimento />} />
                <Route path="/metas" element={<Metas />} />
                <Route path="/minha-conta" element={<MinhaConta />} />
                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                <Route path="/funcionarios" element={<AdminRoute><Funcionarios /></AdminRoute>} />
                <Route path="/clientes" element={<AdminRoute><Clientes /></AdminRoute>} />
                <Route path="/financeiro" element={<AdminRoute><Financeiro /></AdminRoute>} />
                <Route path="/dre" element={<AdminRoute><DRE /></AdminRoute>} />
                <Route path="/orcamentos" element={<AdminRoute><Orcamentos /></AdminRoute>} />
                <Route path="/contratos" element={<AdminRoute><Contratos /></AdminRoute>} />
                <Route path="/reunioes" element={<AdminRoute><Reunioes /></AdminRoute>} />
                <Route path="/crm" element={<AdminRoute><CRM /></AdminRoute>} />
                <Route path="/gestao-projetos" element={<AdminRoute><GestorProjetos /></AdminRoute>} />
                <Route path="/dashboards" element={<AdminRoute><Dashboards /></AdminRoute>} />
                <Route path="/fluxo-caixa" element={<AdminRoute><FluxoCaixa /></AdminRoute>} />
                <Route path="/balancete" element={<AdminRoute><Balancete /></AdminRoute>} />
                <Route path="/revisoes-projeto" element={<AdminRoute><RevisoesProjeto /></AdminRoute>} />
                <Route path="/calendario-postagem" element={<AdminRoute><CalendarioPostagem /></AdminRoute>} />
                <Route path="/backup" element={<AdminOnlyRoute><Backup /></AdminOnlyRoute>} />
                <Route path="/configuracoes" element={<AdminOnlyRoute><Configuracoes /></AdminOnlyRoute>} />
                <Route path="/feriados" element={<Feriados />} />
                <Route path="/conversao" element={<Conversao />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
