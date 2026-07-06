import { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Clock,
  FolderKanban,
  Timer,
  FileText,
  BarChart3,
  LogOut,
  Newspaper,
  Users,
  Building2,
  Wallet,
  ShieldCheck,
  BookOpen,
  ScrollText,
  FileSignature,
  TrendingUp,
  DatabaseBackup,
  UserCircle,
  Calendar,
  Kanban,
  GanttChartSquare,
  BarChart2,
  ArrowLeftRight,
  Scale,
  Target,
  ClipboardList,
  CalendarDays,
  CalendarCheck,
  Ruler,
  Settings2
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import CronometroFlutuante from '../CronometroFlutuante'
import logoDNL from '../../assets/logo-dnl-new.svg'

type MenuItem = { to: string; icon: any; label: string; numero: string }
type MenuGrupo = { grupo: string; itens: MenuItem[] }

const menuPrincipal: MenuGrupo[] = [
  {
    grupo: 'Início',
    itens: [
      { to: '/', icon: LayoutDashboard, label: 'Visão Geral', numero: '01' },
      { to: '/feed', icon: Newspaper, label: 'Feed', numero: '02' },
    ]
  },
  {
    grupo: 'Registro de tempo',
    itens: [
      { to: '/ponto',     icon: Clock,         label: 'Ponto',        numero: '03' },
      { to: '/cronometro',icon: Timer,          label: 'Cronômetro',   numero: '04' },
      { to: '/feriados',  icon: CalendarCheck,  label: 'Feriados SP',  numero: 'F1' },
    ]
  },
  {
    grupo: 'Relatórios',
    itens: [
      { to: '/relatorio-diario', icon: FileText, label: 'Diário', numero: '05' },
      { to: '/relatorio-horas', icon: BarChart3, label: 'Horas', numero: '06' },
    ]
  },
  {
    grupo: 'Desenvolvimento',
    itens: [
      { to: '/projetos',   icon: FolderKanban, label: 'Projetos',    numero: '07' },
      { to: '/metas',      icon: Target,        label: 'Metas SMART', numero: '08' },
      { to: '/conhecimento',icon: BookOpen,     label: 'Base técnica',numero: '09' },
      { to: '/conversao',  icon: Ruler,         label: 'Conversão',   numero: 'F2' },
    ]
  },
  {
    grupo: 'Conta',
    itens: [
      { to: '/minha-conta', icon: UserCircle, label: 'Minha conta', numero: '10' },
    ]
  },
]

const menuAdmin: MenuGrupo[] = [
  {
    grupo: 'Projetos',
    itens: [
      { to: '/gestao-projetos', icon: GanttChartSquare, label: 'Gestão / Gantt', numero: 'A0' },
      { to: '/revisoes-projeto', icon: ClipboardList, label: 'Revisões', numero: 'RV' },
    ]
  },
  {
    grupo: 'Clientes & CRM',
    itens: [
      { to: '/clientes', icon: Building2, label: 'Clientes', numero: 'A1' },
      { to: '/crm', icon: Kanban, label: 'CRM', numero: 'A2' },
    ]
  },
  {
    grupo: 'Financeiro',
    itens: [
      { to: '/financeiro', icon: Wallet, label: 'Financeiro', numero: 'A3' },
      { to: '/orcamentos', icon: ScrollText, label: 'Orçamentos', numero: 'A4' },
      { to: '/contratos', icon: FileSignature, label: 'Contratos', numero: 'A5' },
      { to: '/dre', icon: TrendingUp, label: 'DRE', numero: 'A6' },
      { to: '/fluxo-caixa', icon: ArrowLeftRight, label: 'Fluxo de Caixa', numero: 'A7' },
      { to: '/balancete', icon: Scale, label: 'Balancete', numero: 'A8' },
      { to: '/dashboards', icon: BarChart2, label: 'Dashboards', numero: 'B1' },
    ]
  },
  {
    grupo: 'Pessoas',
    itens: [
      { to: '/funcionarios', icon: Users, label: 'Funcionários', numero: 'A9' },
      { to: '/reunioes', icon: Calendar, label: 'Reuniões', numero: 'B0' },
    ]
  },
  {
    grupo: 'Conteúdo',
    itens: [
      { to: '/calendario-postagem', icon: CalendarDays, label: 'Cal. Postagem', numero: 'CN' },
    ]
  },
  {
    grupo: 'Sistema',
    itens: [
      { to: '/admin',          icon: ShieldCheck,    label: 'Painel Admin',   numero: 'B2' },
      { to: '/configuracoes',  icon: Settings2,      label: 'Dados Empresa',  numero: 'B4' },
      { to: '/backup',         icon: DatabaseBackup, label: 'Backup',         numero: 'B3' },
    ]
  },
]

function NavItem({ item, adminStyle }: { item: MenuItem; adminStyle?: boolean }) {
  const location = useLocation()
  const Icon = item.icon
  const active = location.pathname === item.to
  return (
    <NavLink
      to={item.to}
      className={`group flex items-center gap-3 px-3 py-2 rounded-md transition-colors mb-0.5
        ${active ? 'bg-ink-900 text-cream-50' : 'text-ink-700 hover:bg-cream-200'}`}
    >
      <span
        className={`font-mono text-[10px] tracking-wider
        ${active
          ? 'text-cream-50/60'
          : adminStyle
            ? 'text-terra-500/60 group-hover:text-terra-500'
            : 'text-ink-400 group-hover:text-ink-500'}`}
      >
        {item.numero}
      </span>
      <Icon size={14} strokeWidth={1.75} />
      <span className="text-sm">{item.label}</span>
    </NavLink>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const ehAdminOuRH = user?.role === 'admin' || user?.role === 'rh'

  return (
    <div className="min-h-screen flex bg-cream-100">
      <aside className="w-64 border-r border-ink-300/40 bg-cream-50 flex flex-col">
        <div className="px-6 pt-5 pb-5 border-b border-ink-300/30">
          <img src={logoDNL} alt="DNL Projetos" className="w-full h-auto mx-auto" />
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-400 mt-2 text-center">
            Sistema interno · v0.3
          </p>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {menuPrincipal.map((grupo, gi) => (
            <div key={grupo.grupo} className={gi > 0 ? 'mt-4' : ''}>
              <p className="px-3 mb-1 font-mono text-[9px] uppercase tracking-widest text-ink-400">
                {grupo.grupo}
              </p>
              {grupo.itens.map(item => (
                <NavItem key={item.to} item={item} />
              ))}
            </div>
          ))}

          {ehAdminOuRH && (
            <>
              <div className="my-4 border-t border-ink-300/30" />
              <p className="px-3 mb-1 font-mono text-[9px] uppercase tracking-widest text-terra-500">
                Administração
              </p>
              {menuAdmin.map((grupo, gi) => (
                <div key={grupo.grupo} className={gi > 0 ? 'mt-3' : 'mt-2'}>
                  <p className="px-3 mb-1 font-mono text-[9px] uppercase tracking-widest text-terra-400/70">
                    {grupo.grupo}
                  </p>
                  {grupo.itens.map(item => (
                    <NavItem key={item.to} item={item} adminStyle />
                  ))}
                </div>
              ))}
            </>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-ink-300/30">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-ink-900 truncate">{user?.nome}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-500 mt-0.5">
              {user?.role} · {user?.cargo}
            </p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-ink-600
              hover:bg-cream-200 hover:text-ink-900 transition-colors text-sm"
          >
            <LogOut size={14} strokeWidth={1.75} />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-10 py-10">{children}</div>
      </main>

      <CronometroFlutuante />
    </div>
  )
}
