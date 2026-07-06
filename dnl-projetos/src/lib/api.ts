import type {
  AuthResponse, User, UserCreateInput, UserUpdateInput,
  Ponto, PontosDoDia, TipoPonto,
  Projeto, ProjetoCreateInput,
  Cliente,
  Cronometro,
  RelatorioDiario, RelatorioHoras, ResumoMensal,
  Evento, EventoCreateInput,
  Lancamento, LancamentoCreateInput, CategoriaFinanceira, ResumoFinanceiro, DREMensal, TipoLancamento,
  FluxoCaixaData, BalanceteData,
  DashboardAdmin, AnalyticsDashboard,
  ArtigoConhecimento, ArtigoCreateInput, CategoriaConhecimento,
  Orcamento, OrcamentoCreateInput, StatusOrcamento,
  Contrato, ContratoCreateInput, StatusContrato, TipoContrato, ClausulaPadrao,
  ReuniaoSocios, ReuniaoCreateInput,
  Lead, LeadCreateInput, StatusLead,
  MetaSMART, MetaCreateInput, StatusMeta,
  RevisaoProjeto, RevisaoCreateInput,
  CalendarioPostagem, CalendarioCreateInput, StatusPostagem
} from '../../shared/types'

const TOKEN_KEY = 'dnl_token'

async function getToken(): Promise<string> {
  return localStorage.getItem(TOKEN_KEY) || ''
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `HTTP ${res.status}`)
  }

  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json() as Promise<T>
  return res as unknown as T
}

const get = <T>(path: string) => req<T>('GET', path)
const post = <T>(path: string, body?: unknown) => req<T>('POST', path, body)
const put = <T>(path: string, body?: unknown) => req<T>('PUT', path, body)
const del = <T>(path: string, body?: unknown) => req<T>('DELETE', path, body)

// ── Download helper ────────────────────────────────────────────────────────────

async function download(path: string): Promise<{ success: boolean; arquivo?: string; error?: string }> {
  try {
    const token = await getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api${path}`, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const cd = res.headers.get('content-disposition') || ''
    const match = cd.match(/filename="?([^"]+)"?/)
    const filename = match ? match[1] : 'download'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
    return { success: true, arquivo: filename }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ── API object (mesma forma que window.api) ────────────────────────────────────

export const api = {
  auth: {
    login: (email: string, senha: string): Promise<AuthResponse> =>
      req<AuthResponse>('POST', '/auth/login', { email, senha }),
    logout: async () => { localStorage.removeItem(TOKEN_KEY) },
    getCurrentUser: () => get<User>('/auth/current-user'),
    register: (input: UserCreateInput) => post<AuthResponse>('/auth/register', input),
    atualizarUsuario: (input: UserUpdateInput) => put<{ success: boolean; error?: string }>('/auth/usuario', input),
    resetarSenha: (usuario_id: number, nova_senha: string) => post<{ success: boolean; error?: string }>('/auth/resetar-senha', { usuario_id, nova_senha }),
    desativarUsuario: (usuario_id: number) => post<{ success: boolean; error?: string }>(`/auth/desativar/${usuario_id}`),
    reativarUsuario: (usuario_id: number) => post<{ success: boolean; error?: string }>(`/auth/reativar/${usuario_id}`),
    trocarMinhaSenha: (senha_atual: string, nova_senha: string) => post<{ success: boolean; error?: string }>('/auth/trocar-senha', { senha_atual, nova_senha })
  },

  pontos: {
    bater: (tipo: TipoPonto, observacao?: string) => post<Ponto>('/pontos/bater', { tipo, observacao }),
    listarHoje: (usuario_id?: number) => get<PontosDoDia>(`/pontos/hoje${usuario_id ? `?usuario_id=${usuario_id}` : ''}`),
    listarPorPeriodo: (inicio: string, fim: string, usuario_id?: number) => get<Ponto[]>(`/pontos/periodo?inicio=${inicio}&fim=${fim}${usuario_id ? `&usuario_id=${usuario_id}` : ''}`),
    criarManual: (input: { tipo: TipoPonto; timestamp: string; motivo: string; usuario_id?: number }) => post<Ponto>('/pontos/manual', input),
    corrigir: (id: number, timestamp: string, motivo: string) => put<Ponto>(`/pontos/${id}`, { timestamp, motivo }),
    excluir: (id: number, motivo: string) => del<{ success: boolean }>(`/pontos/${id}`, { motivo })
  },

  projetos: {
    listar: (cliente_id?: number) => get<Projeto[]>(cliente_id ? `/projetos?cliente_id=${cliente_id}` : '/projetos'),
    listarMeus: () => get<Projeto[]>('/projetos/meus'),
    criar: (input: ProjetoCreateInput) => post<Projeto>('/projetos', input),
    obter: (id: number) => get<Projeto | null>(`/projetos/${id}`),
    atualizar: (id: number, input: Partial<ProjetoCreateInput>) => put<Projeto>(`/projetos/${id}`, input),
    deletar: (id: number) => del<{ success: boolean; error?: string }>(`/projetos/${id}`),
    funcionariosDoProjeto: (id: number) => get<Array<{ usuario_id: number }>>(`/projetos/${id}/funcionarios`)
  },

  clientes: {
    listar: () => get<Cliente[]>('/clientes'),
    criar: (input: Omit<Cliente, 'id' | 'criado_em'>) => post<Cliente>('/clientes', input),
    atualizar: (id: number, input: Partial<Omit<Cliente, 'id' | 'criado_em'>>) => put<Cliente>(`/clientes/${id}`, input),
    deletar: (id: number) => del<{ success: boolean; error?: string }>(`/clientes/${id}`)
  },

  cronometro: {
    iniciar: (projeto_id: number, observacao?: string) => post<Cronometro>('/cronometro/iniciar', { projeto_id, observacao }),
    parar: (id: number) => post<Cronometro>(`/cronometro/parar/${id}`),
    ativo: (usuario_id?: number) => get<Cronometro | null>(`/cronometro/ativo${usuario_id ? `?usuario_id=${usuario_id}` : ''}`),
    historico: (limit?: number, usuario_id?: number) => {
      const params = new URLSearchParams()
      if (limit) params.set('limit', String(limit))
      if (usuario_id) params.set('usuario_id', String(usuario_id))
      const qs = params.toString()
      return get<Cronometro[]>(`/cronometro/historico${qs ? `?${qs}` : ''}`)
    },
    criarManual: (input: { projeto_id: number; inicio: string; fim: string; motivo: string; observacao?: string; usuario_id?: number }) =>
      post<Cronometro>('/cronometro/manual', input),
    corrigir: (id: number, input: { inicio?: string; fim?: string; motivo: string }) => put<Cronometro>(`/cronometro/${id}`, input),
    excluir: (id: number, motivo: string) => del<{ success: boolean }>(`/cronometro/${id}`, { motivo })
  },

  relatorios: {
    salvarDiario: (conteudo: string, revisao: string, projeto_id?: number) => post<RelatorioDiario>('/relatorios/diario', { conteudo, revisao, projeto_id }),
    obterDiarioHoje: () => get<RelatorioDiario | null>('/relatorios/diario/hoje'),
    horasPorPeriodo: (inicio: string, fim: string, usuario_id?: number) => get<RelatorioHoras[]>(`/relatorios/horas?inicio=${inicio}&fim=${fim}${usuario_id ? `&usuario_id=${usuario_id}` : ''}`),
    resumoMensal: (mes: string, usuario_id?: number) => get<ResumoMensal>(`/relatorios/mensal?mes=${mes}${usuario_id ? `&usuario_id=${usuario_id}` : ''}`)
  },

  usuarios: {
    listar: () => get<User[]>('/usuarios'),
    listarTodos: () => get<User[]>('/usuarios/todos')
  },

  eventos: {
    listar: (limit?: number) => get<Evento[]>(limit ? `/eventos?limit=${limit}` : '/eventos'),
    listarMeus: (limit?: number) => get<Evento[]>(limit ? `/eventos/meus?limit=${limit}` : '/eventos/meus'),
    criar: (input: EventoCreateInput) => post<Evento>('/eventos', input),
    deletar: (id: number) => del<{ success: boolean; error?: string }>(`/eventos/${id}`)
  },

  financeiro: {
    listarLancamentos: (filtros?: { tipo?: TipoLancamento; inicio?: string; fim?: string; categoria_id?: number; projeto_id?: number }) => {
      const qs = new URLSearchParams()
      if (filtros?.tipo) qs.set('tipo', filtros.tipo)
      if (filtros?.inicio) qs.set('inicio', filtros.inicio)
      if (filtros?.fim) qs.set('fim', filtros.fim)
      if (filtros?.categoria_id) qs.set('categoria_id', String(filtros.categoria_id))
      if (filtros?.projeto_id) qs.set('projeto_id', String(filtros.projeto_id))
      const q = qs.toString()
      return get<Lancamento[]>(`/financeiro/lancamentos${q ? '?' + q : ''}`)
    },
    criarLancamento: (input: LancamentoCreateInput) => post<Lancamento>('/financeiro/lancamentos', input),
    atualizarLancamento: (id: number, input: Partial<LancamentoCreateInput>) => put<Lancamento>(`/financeiro/lancamentos/${id}`, input),
    deletarLancamento: (id: number) => del<{ success: boolean; error?: string }>(`/financeiro/lancamentos/${id}`),
    resumoFinanceiro: (inicio: string, fim: string) => get<ResumoFinanceiro>(`/financeiro/resumo?inicio=${inicio}&fim=${fim}`),
    listarCategorias: () => get<CategoriaFinanceira[]>('/financeiro/categorias'),
    criarCategoria: (nome: string, tipo: TipoLancamento, cor?: string) => post<CategoriaFinanceira>('/financeiro/categorias', { nome, tipo, cor }),
    dreMensal: (mes: string) => get<DREMensal>(`/financeiro/dre?mes=${mes}`),
    fluxoCaixa: (inicio: string, fim: string) => get<FluxoCaixaData>(`/financeiro/fluxo-caixa?inicio=${inicio}&fim=${fim}`),
    balancete: (inicio: string, fim: string) => get<BalanceteData>(`/financeiro/balancete?inicio=${inicio}&fim=${fim}`)
  },

  admin: {
    dashboard: () => get<DashboardAdmin>('/admin/dashboard'),
    analytics: () => get<AnalyticsDashboard>('/admin/analytics')
  },

  conhecimento: {
    listar: (categoria?: CategoriaConhecimento, busca?: string) => {
      const qs = new URLSearchParams()
      if (categoria) qs.set('categoria', categoria)
      if (busca) qs.set('busca', busca)
      const q = qs.toString()
      return get<ArtigoConhecimento[]>(`/conhecimento${q ? '?' + q : ''}`)
    },
    obter: (id: number) => get<ArtigoConhecimento | null>(`/conhecimento/${id}`),
    criar: (input: ArtigoCreateInput) => post<ArtigoConhecimento>('/conhecimento', input),
    atualizar: (id: number, input: Partial<ArtigoCreateInput>) => put<ArtigoConhecimento>(`/conhecimento/${id}`, input),
    deletar: (id: number) => del<{ success: boolean; error?: string }>(`/conhecimento/${id}`)
  },

  orcamentos: {
    listar: (status?: StatusOrcamento, cliente_id?: number) => {
      const qs = new URLSearchParams()
      if (status) qs.set('status', status)
      if (cliente_id) qs.set('cliente_id', String(cliente_id))
      const q = qs.toString()
      return get<Orcamento[]>(`/orcamentos${q ? '?' + q : ''}`)
    },
    obter: (id: number) => get<Orcamento | null>(`/orcamentos/${id}`),
    criar: (input: OrcamentoCreateInput) => post<Orcamento>('/orcamentos', input),
    atualizar: (id: number, input: Partial<OrcamentoCreateInput>) => put<Orcamento>(`/orcamentos/${id}`, input),
    deletar: (id: number) => del<{ success: boolean; error?: string }>(`/orcamentos/${id}`),
    duplicar: (id: number) => post<Orcamento>(`/orcamentos/${id}/duplicar`)
  },

  contratos: {
    listar: (status?: StatusContrato, cliente_id?: number) => {
      const qs = new URLSearchParams()
      if (status) qs.set('status', status)
      if (cliente_id) qs.set('cliente_id', String(cliente_id))
      const q = qs.toString()
      return get<Contrato[]>(`/contratos${q ? '?' + q : ''}`)
    },
    obter: (id: number) => get<Contrato | null>(`/contratos/${id}`),
    criar: (input: ContratoCreateInput) => post<Contrato>('/contratos', input),
    atualizar: (id: number, input: Partial<ContratoCreateInput>) => put<Contrato>(`/contratos/${id}`, input),
    deletar: (id: number) => del<{ success: boolean; error?: string }>(`/contratos/${id}`),
    gerarDeOrcamento: (orcamento_id: number) => post<Contrato>(`/contratos/gerar-de-orcamento/${orcamento_id}`),
    listarClausulasPadrao: (tipo: TipoContrato) => get<ClausulaPadrao[]>(`/contratos/clausulas-padrao?tipo=${tipo}`)
  },

  reunioes: {
    listar: () => get<ReuniaoSocios[]>('/reunioes'),
    obter: (id: number) => get<ReuniaoSocios | null>(`/reunioes/${id}`),
    criar: (input: ReuniaoCreateInput) => post<ReuniaoSocios>('/reunioes', input),
    atualizar: (id: number, input: Partial<ReuniaoCreateInput>) => put<ReuniaoSocios>(`/reunioes/${id}`, input),
    deletar: (id: number) => del<{ success: boolean; error?: string }>(`/reunioes/${id}`)
  },

  calendario: {
    listar: () => get<CalendarioPostagem[]>('/calendario'),
    criar: (input: CalendarioCreateInput) => post<CalendarioPostagem>('/calendario', input),
    atualizar: (id: number, input: Partial<CalendarioCreateInput>) => put<CalendarioPostagem>(`/calendario/${id}`, input),
    mover: (id: number, novo_status: StatusPostagem) => post<CalendarioPostagem>(`/calendario/${id}/mover`, { novo_status }),
    deletar: (id: number) => del<{ success: boolean; error?: string }>(`/calendario/${id}`)
  },

  metas: {
    listar: (status?: StatusMeta) => get<MetaSMART[]>(status ? `/metas?status=${status}` : '/metas'),
    obter: (id: number) => get<MetaSMART | null>(`/metas/${id}`),
    criar: (input: MetaCreateInput) => post<MetaSMART>('/metas', input),
    atualizar: (id: number, input: Partial<MetaCreateInput>) => put<MetaSMART>(`/metas/${id}`, input),
    deletar: (id: number) => del<{ success: boolean; error?: string }>(`/metas/${id}`)
  },

  revisoes: {
    listar: (nome_projeto?: string) => get<RevisaoProjeto[]>(nome_projeto ? `/revisoes?nome_projeto=${encodeURIComponent(nome_projeto)}` : '/revisoes'),
    obter: (id: number) => get<RevisaoProjeto | null>(`/revisoes/${id}`),
    criar: (input: RevisaoCreateInput) => post<RevisaoProjeto>('/revisoes', input),
    atualizar: (id: number, input: Partial<RevisaoCreateInput>) => put<RevisaoProjeto>(`/revisoes/${id}`, input),
    deletar: (id: number) => del<{ success: boolean; error?: string }>(`/revisoes/${id}`)
  },

  leads: {
    listar: (status?: StatusLead) => get<Lead[]>(status ? `/leads?status=${status}` : '/leads'),
    criar: (input: LeadCreateInput) => post<Lead>('/leads', input),
    atualizar: (id: number, input: Partial<LeadCreateInput>) => put<Lead>(`/leads/${id}`, input),
    mover: (id: number, novo_status: StatusLead, nova_ordem: number) => post<Lead>(`/leads/${id}/mover`, { novo_status, nova_ordem }),
    deletar: (id: number) => del<{ success: boolean; error?: string }>(`/leads/${id}`)
  },

  orcamentosExtra: {
    enviarParaCRM: (orcamento_id: number, nome: string, valor: number, cliente_id?: number) =>
      post<Lead>('/leads', {
        nome,
        status: 'orcamento' as StatusLead,
        valor_estimado: valor,
        cliente_id,
        orcamento_id,
        observacoes: `Lead gerado automaticamente a partir de orçamento.`
      })
  },

  exports: {
    pontosExcel: async (filtros: { inicio: string; fim: string; usuario_id?: number }) => {
      const qs = new URLSearchParams({ inicio: filtros.inicio, fim: filtros.fim })
      if (filtros.usuario_id) qs.set('usuario_id', String(filtros.usuario_id))
      return download(`/exports/pontos-excel?${qs}`)
    },
    horasProjetoExcel: async (filtros: { inicio: string; fim: string; usuario_id?: number; projeto_id?: number }) => {
      const qs = new URLSearchParams({ inicio: filtros.inicio, fim: filtros.fim })
      if (filtros.usuario_id) qs.set('usuario_id', String(filtros.usuario_id))
      if (filtros.projeto_id) qs.set('projeto_id', String(filtros.projeto_id))
      return download(`/exports/horas-projeto-excel?${qs}`)
    }
  },

  backup: {
    exportar: () => download('/backup/exportar'),
    importar: async (): Promise<{ success: boolean; importado?: number; error?: string }> => {
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) { resolve({ success: false, error: 'Nenhum arquivo selecionado' }); return }
          try {
            const text = await file.text()
            const data = JSON.parse(text)
            const result = await post<{ success: boolean; importado?: number; error?: string }>('/backup/importar', data)
            resolve(result)
          } catch (e: any) {
            resolve({ success: false, error: e.message })
          }
        }
        input.click()
      })
    }
  },

  configuracoes: {
    obter: () => get<Record<string, string>>('/configuracoes'),
    salvar: (dados: Record<string, string>) => put<{ ok: boolean }>('/configuracoes', dados)
  },

  // Alias mantido para compatibilidade com pages que usam window.api.export.*
  export: {
    pontos: async (inicio?: string, fim?: string, usuario_id?: number) => {
      const qs = new URLSearchParams()
      if (inicio) qs.set('inicio', inicio)
      if (fim) qs.set('fim', fim)
      if (usuario_id) qs.set('usuario_id', String(usuario_id))
      const result = await download(`/exports/pontos-excel?${qs}`)
      return { ...result, caminho: result.arquivo, cancelado: false }
    },
    cronometros: async (inicio?: string, fim?: string, usuario_id?: number, projeto_id?: number) => {
      const qs = new URLSearchParams()
      if (inicio) qs.set('inicio', inicio)
      if (fim) qs.set('fim', fim)
      if (usuario_id) qs.set('usuario_id', String(usuario_id))
      if (projeto_id) qs.set('projeto_id', String(projeto_id))
      const result = await download(`/exports/horas-projeto-excel?${qs}`)
      return { ...result, caminho: result.arquivo, cancelado: false }
    },
    resumoProjetos: async (_inicio?: string, _fim?: string) => {
      return { success: false, cancelado: false, error: 'Funcionalidade não disponível na versão web' }
    }
  }
}
