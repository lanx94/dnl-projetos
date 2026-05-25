// Tipos compartilhados entre Electron main process e React renderer

export type UserRole = 'admin' | 'rh' | 'funcionario'

export interface User {
  id: number
  email: string
  nome: string
  cargo: string
  role: UserRole
  cpf?: string
  telefone?: string
  data_admissao?: string
  ativo: boolean
  criado_em: string
}

export interface UserCreateInput {
  email: string
  senha: string
  nome: string
  cargo: string
  role: UserRole
  cpf?: string
  telefone?: string
  data_admissao?: string
}

export interface UserUpdateInput {
  id: number
  nome?: string
  cargo?: string
  role?: UserRole
  cpf?: string
  telefone?: string
  data_admissao?: string
  ativo?: boolean
}

export interface AuthResponse {
  success: boolean
  token?: string
  user?: User
  error?: string
}

export type TipoPonto =
  | 'entrada'
  | 'almoco_inicio'
  | 'almoco_fim'
  | 'saida'
  | 'parada_inicio'
  | 'parada_fim'

export interface Ponto {
  id: number
  usuario_id: number
  tipo: TipoPonto
  timestamp: string
  observacao?: string
}

export interface PontosDoDia {
  entrada?: Ponto
  almoco_inicio?: Ponto
  almoco_fim?: Ponto
  saida?: Ponto
  paradas_extras: Array<{ inicio: Ponto; fim?: Ponto }>
  total_horas?: string
}

export type TipoPessoa = 'fisica' | 'juridica'

export interface Cliente {
  id: number
  tipo_pessoa: TipoPessoa
  nome: string
  email?: string
  telefone?: string
  // PJ
  cnpj?: string
  inscricao_estadual?: string
  // PF
  cpf?: string
  rg?: string
  // comum
  endereco?: string
  contato_responsavel?: string
  observacoes?: string
  // Dados do representante legal (PJ) ou pessoa (PF) - usado em contratos
  representante_nome?: string
  representante_nacionalidade?: string
  representante_naturalidade?: string
  representante_estado_civil?: string
  representante_profissao?: string
  representante_rg?: string
  representante_cpf?: string
  criado_em: string
}

export type StatusProjeto =
  | 'planejamento'
  | 'em_andamento'
  | 'pausado'
  | 'concluido'
  | 'cancelado'

export interface Projeto {
  id: number
  cliente_id: number
  cliente_nome?: string
  nome: string
  descricao?: string
  status: StatusProjeto
  revisao_atual: string
  data_inicio?: string
  data_prevista_fim?: string
  cidade?: string
  criado_em: string
}

export interface ProjetoCreateInput {
  cliente_id: number
  nome: string
  descricao?: string
  status?: StatusProjeto
  revisao_atual?: string
  data_inicio?: string
  data_prevista_fim?: string
  cidade?: string
  funcionarios_ids?: number[]
}

export interface AnalyticsDashboard {
  projetos_status: Array<{ status: string; count: number }>
  projetos_atrasados: Projeto[]
  projetos_prazo_proximo: Projeto[]
  faturamento_mensal: Array<{ mes: string; total: number }>
  ticket_por_cliente: Array<{ cliente_nome: string; total_contratos: number; total_valor: number; media_valor: number }>
  projetos_por_cidade: Array<{ cidade: string; count: number }>
}

export interface Cronometro {
  id: number
  usuario_id: number
  projeto_id: number
  projeto_nome?: string
  inicio: string
  fim?: string
  duracao_segundos?: number
  observacao?: string
}

export interface RelatorioDiario {
  id: number
  usuario_id: number
  data: string
  conteudo: string
  revisao: string
  projeto_id?: number
  criado_em: string
}

export interface RelatorioHoras {
  data: string
  horas_trabalhadas: string
  horas_em_segundos: number
  total_paradas: string
  pontos: Ponto[]
}

export interface ResumoMensal {
  mes: string
  total_horas: string
  total_segundos: number
  dias_trabalhados: number
  media_diaria: string
}

// === FASE 2 ===

export type TipoEvento = 'aviso' | 'comunicado' | 'pessoal' | 'aniversario' | 'reuniao'

export interface Evento {
  id: number
  autor_id: number
  autor_nome?: string
  tipo: TipoEvento
  titulo: string
  conteudo: string
  global: boolean
  data_evento?: string
  criado_em: string
}

export interface EventoCreateInput {
  tipo: TipoEvento
  titulo: string
  conteudo: string
  global?: boolean
  data_evento?: string
}

export type TipoLancamento = 'receita' | 'despesa'

export interface CategoriaFinanceira {
  id: number
  nome: string
  tipo: TipoLancamento
  cor?: string
  criado_em: string
}

export interface Lancamento {
  id: number
  tipo: TipoLancamento
  descricao: string
  valor: number
  categoria_id?: number
  categoria_nome?: string
  projeto_id?: number
  projeto_nome?: string
  cliente_id?: number
  cliente_nome?: string
  data: string
  pago: boolean
  observacoes?: string
  criado_por_id: number
  criado_por_nome?: string
  criado_em: string
}

export interface LancamentoCreateInput {
  tipo: TipoLancamento
  descricao: string
  valor: number
  categoria_id?: number
  projeto_id?: number
  cliente_id?: number
  data: string
  pago?: boolean
  observacoes?: string
}

export interface ResumoFinanceiro {
  total_receitas: number
  total_despesas: number
  saldo: number
  receitas_pagas: number
  despesas_pagas: number
  receitas_pendentes: number
  despesas_pendentes: number
}

export interface DashboardAdmin {
  total_funcionarios: number
  funcionarios_trabalhando: number
  total_projetos_ativos: number
  total_horas_mes: string
  cronometros_ativos: Array<{
    usuario_nome: string
    projeto_nome: string
    inicio: string
  }>
  pontos_hoje: Array<{
    usuario_id: number
    usuario_nome: string
    entrada?: string
    saida?: string
    horas: string
    status: 'trabalhando' | 'almoco' | 'parada' | 'finalizado' | 'ausente'
  }>
}

export interface FluxoCaixaData {
  periodo: Array<{
    data: string
    entradas: number
    saidas: number
    saldo_dia: number
    saldo_acumulado: number
  }>
  total_entradas: number
  total_saidas: number
  saldo_final: number
  saldo_inicial: number
}

export interface BalanceteData {
  meses: Array<{ mes: string; receitas: number; despesas: number; resultado: number }>
  categorias_receita: Array<{ nome: string; total: number; pct: number }>
  categorias_despesa: Array<{ nome: string; total: number; pct: number }>
  total_receitas: number
  total_despesas: number
  resultado_total: number
  receitas_pagas: number
  receitas_pendentes: number
  despesas_pagas: number
  despesas_pendentes: number
}

// === FASE 3 ===

// --- Base de conhecimento ---

export type CategoriaConhecimento =
  | 'climatizacao'
  | 'hidraulica'
  | 'eletrica'
  | 'gas'
  | 'estrutural'
  | 'regularizacao'
  | 'laudos'
  | 'normas'
  | 'outro'

export interface ArtigoConhecimento {
  id: number
  categoria: CategoriaConhecimento
  titulo: string
  conteudo: string
  tags?: string
  autor_id: number
  autor_nome?: string
  criado_em: string
  atualizado_em: string
}

export interface ArtigoCreateInput {
  categoria: CategoriaConhecimento
  titulo: string
  conteudo: string
  tags?: string
}

// --- Orçamentos ---

export type StatusOrcamento = 'rascunho' | 'enviado' | 'aprovado' | 'rejeitado' | 'expirado'

export interface ItemOrcamento {
  id?: number
  orcamento_id?: number
  ordem: number
  descricao: string
  quantidade: number
  unidade: string
  valor_unitario: number
  valor_total: number
}

export interface Orcamento {
  id: number
  numero: string
  cliente_id: number
  cliente_nome?: string
  cliente_cnpj?: string
  cliente_endereco?: string
  projeto_id?: number
  projeto_nome?: string
  titulo: string
  descricao?: string
  status: StatusOrcamento
  data_emissao: string
  validade_dias: number
  desconto_percentual: number
  forma_pagamento?: string
  prazo_execucao?: string
  observacoes?: string
  projetos_necessarios?: string
  incluso?: string
  itens: ItemOrcamento[]
  subtotal: number
  desconto_valor: number
  total: number
  criado_por_id: number
  criado_por_nome?: string
  criado_em: string
  atualizado_em: string
}

export interface OrcamentoCreateInput {
  cliente_id: number
  projeto_id?: number
  titulo: string
  descricao?: string
  status?: StatusOrcamento
  data_emissao?: string
  validade_dias?: number
  desconto_percentual?: number
  forma_pagamento?: string
  prazo_execucao?: string
  observacoes?: string
  projetos_necessarios?: string
  incluso?: string
  itens: Omit<ItemOrcamento, 'id' | 'orcamento_id' | 'valor_total'>[]
}

// --- Contratos ---

export type TipoContrato =
  | 'laudo_vizinhanca'
  | 'eletrica'
  | 'hidraulica'
  | 'gas'
  | 'regularizacao'
  | 'manual_proprietario'
  | 'generico'
  | 'eletrica_hidraulica_gas'
  | 'laudo_entrega'
  | 'laudo_apontamento'
  | 'manual_asbuilt'
  | 'usucapiao'

export type StatusContrato =
  | 'rascunho'
  | 'aguardando_assinatura'
  | 'ativo'
  | 'concluido'
  | 'cancelado'

export interface ServicoContrato {
  ordem: number
  descricao: string
}

export interface ParcelaContrato {
  ordem: number
  rotulo?: string
  valor: number
  valor_extenso?: string
  na_assinatura: boolean
  data?: string
}

export interface ClausulaContrato {
  id: string
  secao: string
  rotulo: string
  texto: string
  texto_padrao: string
  essencial: boolean
  incluida: boolean
  ordem: number
}

export interface ClausulaPadrao {
  id: number
  tipo_contrato: TipoContrato
  clausula_id: string // identificador interno (ex: 'objeto', 'preco')
  secao: string
  rotulo: string
  texto: string
  essencial: boolean
  ordem: number
  ativa: boolean
}

export interface Contrato {
  id: number
  numero: string
  tipo_contrato: TipoContrato
  tipos_contrato?: TipoContrato[]
  cliente_id: number
  cliente_nome?: string
  cliente_tipo_pessoa?: string
  cliente_cnpj?: string
  cliente_endereco?: string
  cliente_representante?: string
  cliente_rg?: string
  cliente_cpf?: string
  cliente_estado_civil?: string
  cliente_profissao?: string
  cliente_nacionalidade?: string
  cliente_naturalidade?: string
  contratada_qualificacao?: string
  projeto_id?: number
  projeto_nome?: string
  orcamento_id?: number
  titulo: string
  objeto: string
  endereco_imovel?: string
  valor: number
  valor_extenso?: string
  servicos: ServicoContrato[]
  parcelas: ParcelaContrato[]
  multa_percentual?: string
  juros_diario?: string
  forma_pagamento?: string
  prazo_execucao?: string
  data_inicio?: string
  data_fim?: string
  cidade: string
  data_assinatura?: string
  clausulas: ClausulaContrato[]
  observacoes?: string
  status: StatusContrato
  criado_por_id: number
  criado_por_nome?: string
  criado_em: string
  atualizado_em: string
}

export interface ContratoCreateInput {
  tipo_contrato: TipoContrato
  tipos_contrato?: TipoContrato[]
  cliente_id: number
  projeto_id?: number
  orcamento_id?: number
  titulo: string
  objeto: string
  endereco_imovel?: string
  valor: number
  valor_extenso?: string
  servicos?: ServicoContrato[]
  parcelas?: ParcelaContrato[]
  multa_percentual?: string
  juros_diario?: string
  forma_pagamento?: string
  prazo_execucao?: string
  data_inicio?: string
  data_fim?: string
  cidade?: string
  data_assinatura?: string
  clausulas?: ClausulaContrato[]
  observacoes?: string
  status?: StatusContrato
  contratada_qualificacao?: string
}

// --- DRE ---

export interface DREMensal {
  mes: string // 'YYYY-MM'
  receita_bruta: number
  deducoes: number
  receita_liquida: number
  custos_operacionais: number
  lucro_bruto: number
  despesas_administrativas: number
  despesas_operacionais: number
  resultado_operacional: number
  margem_operacional: number
  detalhamento: {
    receitas_por_categoria: Array<{ nome: string; valor: number }>
    despesas_por_categoria: Array<{ nome: string; valor: number }>
  }
}

// --- Reunião dos sócios ---

export interface ReuniaoTopico {
  id: number
  reuniao_id: number
  texto: string
  cor: string // pastel: azul, amarelo, lilas, rosa, verde, vermelho, cinza
  ordem: number
  concluido: boolean
}

export interface ReuniaoSocios {
  id: number
  titulo: string
  data: string
  observacoes?: string
  topicos: ReuniaoTopico[]
  criado_por_id: number
  criado_por_nome?: string
  criado_em: string
  atualizado_em: string
}

export interface ReuniaoCreateInput {
  titulo: string
  data?: string
  observacoes?: string
  topicos?: Array<{ texto: string; cor: string; ordem: number; concluido: boolean }>
}

// --- CRM (Pipeline de Leads/Orçamentos) ---

export type StatusLead =
  | 'lead'
  | 'reuniao'
  | 'proposta'
  | 'aguardando'
  | 'orcamento'
  | 'fechado'
  | 'perdido'

export interface Lead {
  id: number
  nome: string
  status: StatusLead
  valor_estimado: number
  responsavel_id?: number
  responsavel_nome?: string
  cliente_id?: number
  cliente_nome?: string
  orcamento_id?: number
  orcamento_numero?: string
  contatado_em?: string
  data_alvo?: string
  observacoes?: string
  ordem: number
  criado_em: string
  atualizado_em: string
}

export interface LeadCreateInput {
  nome: string
  status?: StatusLead
  valor_estimado?: number
  responsavel_id?: number
  cliente_id?: number
  orcamento_id?: number
  contatado_em?: string
  data_alvo?: string
  observacoes?: string
}

// --- Calendário de Postagem ---

export type StatusPostagem = 'ideia' | 'roteiro' | 'gravando' | 'editando' | 'agendado' | 'publicado'

export interface CalendarioPostagem {
  id: number
  nome: string
  status: StatusPostagem
  rede_social?: string
  objetivo?: string
  servico?: string
  roteiro?: string
  legenda?: string
  formato?: string
  data_postagem?: string
  ordem: number
  criado_por_id: number
  criado_por_nome?: string
  criado_em: string
  atualizado_em: string
}

export interface CalendarioCreateInput {
  nome: string
  status?: StatusPostagem
  rede_social?: string
  objetivo?: string
  servico?: string
  roteiro?: string
  legenda?: string
  formato?: string
  data_postagem?: string
}

// --- Metas SMART ---

export type StatusMeta = 'ativa' | 'concluida' | 'cancelada'

export interface MetaSMART {
  id: number
  titulo: string
  especifico: string
  mensuravel: string
  atingivel: string
  relevante: string
  prazo: string
  progresso: number
  status: StatusMeta
  criado_por_id: number
  criado_por_nome?: string
  criado_em: string
  atualizado_em: string
}

export interface MetaCreateInput {
  titulo: string
  especifico: string
  mensuravel: string
  atingivel: string
  relevante: string
  prazo: string
  progresso?: number
  status?: StatusMeta
}

// --- Revisões de Projeto ---

export type StatusRevisao = 'pendente' | 'em_andamento' | 'concluida'

export interface RevisaoProjeto {
  id: number
  nome_projeto: string
  revisao: string
  descricao?: string
  data_revisao?: string
  responsavel_id?: number
  responsavel_nome?: string
  status: StatusRevisao
  criado_por_id: number
  criado_por_nome?: string
  criado_em: string
  atualizado_em: string
}

export interface RevisaoCreateInput {
  nome_projeto: string
  revisao: string
  descricao?: string
  data_revisao?: string
  responsavel_id?: number
  status?: StatusRevisao
}

// --- Backup ---

export interface BackupData {
  versao: string
  exportado_em: string
  exportado_por: string
  dados: Record<string, any[]>
}

// === API ===

export interface ElectronAPI {
  auth: {
    login: (email: string, senha: string) => Promise<AuthResponse>
    logout: () => Promise<void>
    getCurrentUser: () => Promise<User | null>
    register: (input: UserCreateInput) => Promise<AuthResponse>
    atualizarUsuario: (input: UserUpdateInput) => Promise<{ success: boolean; error?: string }>
    resetarSenha: (
      usuario_id: number,
      nova_senha: string
    ) => Promise<{ success: boolean; error?: string }>
    desativarUsuario: (
      usuario_id: number
    ) => Promise<{ success: boolean; error?: string }>
    reativarUsuario: (
      usuario_id: number
    ) => Promise<{ success: boolean; error?: string }>
    trocarMinhaSenha: (
      senha_atual: string,
      nova_senha: string
    ) => Promise<{ success: boolean; error?: string }>
  }
  pontos: {
    bater: (tipo: TipoPonto, observacao?: string) => Promise<Ponto>
    listarHoje: () => Promise<PontosDoDia>
    listarPorPeriodo: (inicio: string, fim: string) => Promise<Ponto[]>
  }
  projetos: {
    listar: (cliente_id?: number) => Promise<Projeto[]>
    listarMeus: () => Promise<Projeto[]>
    criar: (input: ProjetoCreateInput) => Promise<Projeto>
    obter: (id: number) => Promise<Projeto | null>
    atualizar: (id: number, input: Partial<ProjetoCreateInput>) => Promise<Projeto>
    deletar: (id: number) => Promise<{ success: boolean; error?: string }>
    funcionariosDoProjeto: (id: number) => Promise<Array<{ usuario_id: number }>>
  }
  clientes: {
    listar: () => Promise<Cliente[]>
    criar: (input: Omit<Cliente, 'id' | 'criado_em'>) => Promise<Cliente>
    atualizar: (id: number, input: Partial<Omit<Cliente, 'id' | 'criado_em'>>) => Promise<Cliente>
    deletar: (id: number) => Promise<{ success: boolean; error?: string }>
  }
  cronometro: {
    iniciar: (projeto_id: number, observacao?: string) => Promise<Cronometro>
    parar: (id: number) => Promise<Cronometro>
    ativo: () => Promise<Cronometro | null>
    historico: (limit?: number) => Promise<Cronometro[]>
  }
  relatorios: {
    salvarDiario: (
      conteudo: string,
      revisao: string,
      projeto_id?: number
    ) => Promise<RelatorioDiario>
    obterDiarioHoje: () => Promise<RelatorioDiario | null>
    horasPorPeriodo: (
      inicio: string,
      fim: string,
      usuario_id?: number
    ) => Promise<RelatorioHoras[]>
    resumoMensal: (mes: string, usuario_id?: number) => Promise<ResumoMensal>
  }
  usuarios: {
    listar: () => Promise<User[]>
    listarTodos: () => Promise<User[]>
  }
  eventos: {
    listar: (limit?: number) => Promise<Evento[]>
    listarMeus: (limit?: number) => Promise<Evento[]>
    criar: (input: EventoCreateInput) => Promise<Evento>
    deletar: (id: number) => Promise<{ success: boolean; error?: string }>
  }
  financeiro: {
    listarLancamentos: (filtros?: {
      tipo?: TipoLancamento
      inicio?: string
      fim?: string
      categoria_id?: number
      projeto_id?: number
    }) => Promise<Lancamento[]>
    criarLancamento: (input: LancamentoCreateInput) => Promise<Lancamento>
    atualizarLancamento: (
      id: number,
      input: Partial<LancamentoCreateInput>
    ) => Promise<Lancamento>
    deletarLancamento: (id: number) => Promise<{ success: boolean; error?: string }>
    resumoFinanceiro: (inicio: string, fim: string) => Promise<ResumoFinanceiro>
    listarCategorias: () => Promise<CategoriaFinanceira[]>
    criarCategoria: (
      nome: string,
      tipo: TipoLancamento,
      cor?: string
    ) => Promise<CategoriaFinanceira>
    dreMensal: (mes: string) => Promise<DREMensal>
  }
  admin: {
    dashboard: () => Promise<DashboardAdmin>
  }
  conhecimento: {
    listar: (categoria?: CategoriaConhecimento, busca?: string) => Promise<ArtigoConhecimento[]>
    obter: (id: number) => Promise<ArtigoConhecimento | null>
    criar: (input: ArtigoCreateInput) => Promise<ArtigoConhecimento>
    atualizar: (id: number, input: Partial<ArtigoCreateInput>) => Promise<ArtigoConhecimento>
    deletar: (id: number) => Promise<{ success: boolean; error?: string }>
  }
  orcamentos: {
    listar: (status?: StatusOrcamento, cliente_id?: number) => Promise<Orcamento[]>
    obter: (id: number) => Promise<Orcamento | null>
    criar: (input: OrcamentoCreateInput) => Promise<Orcamento>
    atualizar: (id: number, input: Partial<OrcamentoCreateInput>) => Promise<Orcamento>
    deletar: (id: number) => Promise<{ success: boolean; error?: string }>
    duplicar: (id: number) => Promise<Orcamento>
  }
  contratos: {
    listar: (status?: StatusContrato, cliente_id?: number) => Promise<Contrato[]>
    obter: (id: number) => Promise<Contrato | null>
    criar: (input: ContratoCreateInput) => Promise<Contrato>
    atualizar: (id: number, input: Partial<ContratoCreateInput>) => Promise<Contrato>
    deletar: (id: number) => Promise<{ success: boolean; error?: string }>
    gerarDeOrcamento: (orcamento_id: number) => Promise<Contrato>
    listarClausulasPadrao: (tipo: TipoContrato) => Promise<ClausulaPadrao[]>
  }
  reunioes: {
    listar: () => Promise<ReuniaoSocios[]>
    obter: (id: number) => Promise<ReuniaoSocios | null>
    criar: (input: ReuniaoCreateInput) => Promise<ReuniaoSocios>
    atualizar: (id: number, input: Partial<ReuniaoCreateInput>) => Promise<ReuniaoSocios>
    deletar: (id: number) => Promise<{ success: boolean; error?: string }>
  }
  leads: {
    listar: (status?: StatusLead) => Promise<Lead[]>
    criar: (input: LeadCreateInput) => Promise<Lead>
    atualizar: (id: number, input: Partial<LeadCreateInput>) => Promise<Lead>
    mover: (id: number, novo_status: StatusLead, nova_ordem: number) => Promise<Lead>
    deletar: (id: number) => Promise<{ success: boolean; error?: string }>
  }
  exports: {
    pontosExcel: (
      filtros: { inicio: string; fim: string; usuario_id?: number }
    ) => Promise<{ success: boolean; arquivo?: string; error?: string }>
    horasProjetoExcel: (
      filtros: { inicio: string; fim: string; usuario_id?: number; projeto_id?: number }
    ) => Promise<{ success: boolean; arquivo?: string; error?: string }>
  }
  backup: {
    exportar: () => Promise<{ success: boolean; arquivo?: string; error?: string }>
    importar: () => Promise<{ success: boolean; importado?: number; error?: string }>
  }
  export: {
    pontos: (
      inicio?: string,
      fim?: string,
      usuario_id?: number
    ) => Promise<{ success: boolean; cancelado?: boolean; caminho?: string; error?: string }>
    cronometros: (
      inicio?: string,
      fim?: string,
      usuario_id?: number,
      projeto_id?: number
    ) => Promise<{ success: boolean; cancelado?: boolean; caminho?: string; error?: string }>
    resumoProjetos: (
      inicio?: string,
      fim?: string
    ) => Promise<{ success: boolean; cancelado?: boolean; caminho?: string; error?: string }>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
