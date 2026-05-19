import { contextBridge, ipcRenderer } from 'electron'

const api = {
  auth: {
    login: (email: string, senha: string) => ipcRenderer.invoke('auth:login', email, senha),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getCurrentUser: () => ipcRenderer.invoke('auth:current'),
    register: (input: any) => ipcRenderer.invoke('auth:register', input),
    atualizarUsuario: (input: any) => ipcRenderer.invoke('auth:atualizarUsuario', input),
    resetarSenha: (usuario_id: number, nova_senha: string) =>
      ipcRenderer.invoke('auth:resetarSenha', usuario_id, nova_senha),
    desativarUsuario: (usuario_id: number) =>
      ipcRenderer.invoke('auth:desativarUsuario', usuario_id),
    reativarUsuario: (usuario_id: number) =>
      ipcRenderer.invoke('auth:reativarUsuario', usuario_id),
    trocarMinhaSenha: (senha_atual: string, nova_senha: string) =>
      ipcRenderer.invoke('auth:trocarMinhaSenha', senha_atual, nova_senha)
  },
  pontos: {
    bater: (tipo: string, observacao?: string) =>
      ipcRenderer.invoke('pontos:bater', tipo, observacao),
    listarHoje: () => ipcRenderer.invoke('pontos:hoje'),
    listarPorPeriodo: (inicio: string, fim: string) =>
      ipcRenderer.invoke('pontos:periodo', inicio, fim)
  },
  projetos: {
    listar: () => ipcRenderer.invoke('projetos:listar'),
    listarMeus: () => ipcRenderer.invoke('projetos:meus'),
    criar: (input: any) => ipcRenderer.invoke('projetos:criar', input),
    obter: (id: number) => ipcRenderer.invoke('projetos:obter', id),
    atualizar: (id: number, input: any) =>
      ipcRenderer.invoke('projetos:atualizar', id, input),
    deletar: (id: number) => ipcRenderer.invoke('projetos:deletar', id),
    funcionariosDoProjeto: (id: number) =>
      ipcRenderer.invoke('projetos:funcionariosDoProjeto', id)
  },
  clientes: {
    listar: () => ipcRenderer.invoke('clientes:listar'),
    criar: (input: any) => ipcRenderer.invoke('clientes:criar', input),
    atualizar: (id: number, input: any) => ipcRenderer.invoke('clientes:atualizar', id, input),
    deletar: (id: number) => ipcRenderer.invoke('clientes:deletar', id)
  },
  cronometro: {
    iniciar: (projeto_id: number, observacao?: string) =>
      ipcRenderer.invoke('cronometro:iniciar', projeto_id, observacao),
    parar: (id: number) => ipcRenderer.invoke('cronometro:parar', id),
    ativo: () => ipcRenderer.invoke('cronometro:ativo'),
    historico: (limit?: number) => ipcRenderer.invoke('cronometro:historico', limit)
  },
  relatorios: {
    salvarDiario: (conteudo: string, revisao: string, projeto_id?: number) =>
      ipcRenderer.invoke('relatorios:salvarDiario', conteudo, revisao, projeto_id),
    obterDiarioHoje: () => ipcRenderer.invoke('relatorios:diarioHoje'),
    horasPorPeriodo: (inicio: string, fim: string, usuario_id?: number) =>
      ipcRenderer.invoke('relatorios:horasPorPeriodo', inicio, fim, usuario_id),
    resumoMensal: (mes: string, usuario_id?: number) =>
      ipcRenderer.invoke('relatorios:resumoMensal', mes, usuario_id)
  },
  usuarios: {
    listar: () => ipcRenderer.invoke('usuarios:listar'),
    listarTodos: () => ipcRenderer.invoke('usuarios:listarTodos')
  },
  eventos: {
    listar: (limit?: number) => ipcRenderer.invoke('eventos:listar', limit),
    listarMeus: (limit?: number) => ipcRenderer.invoke('eventos:listarMeus', limit),
    criar: (input: any) => ipcRenderer.invoke('eventos:criar', input),
    deletar: (id: number) => ipcRenderer.invoke('eventos:deletar', id)
  },
  financeiro: {
    listarLancamentos: (filtros?: any) =>
      ipcRenderer.invoke('financeiro:listarLancamentos', filtros),
    criarLancamento: (input: any) => ipcRenderer.invoke('financeiro:criarLancamento', input),
    atualizarLancamento: (id: number, input: any) =>
      ipcRenderer.invoke('financeiro:atualizarLancamento', id, input),
    deletarLancamento: (id: number) =>
      ipcRenderer.invoke('financeiro:deletarLancamento', id),
    resumoFinanceiro: (inicio: string, fim: string) =>
      ipcRenderer.invoke('financeiro:resumoFinanceiro', inicio, fim),
    listarCategorias: () => ipcRenderer.invoke('financeiro:listarCategorias'),
    criarCategoria: (nome: string, tipo: string, cor?: string) =>
      ipcRenderer.invoke('financeiro:criarCategoria', nome, tipo, cor),
    dreMensal: (mes: string) => ipcRenderer.invoke('financeiro:dreMensal', mes)
  },
  admin: {
    dashboard: () => ipcRenderer.invoke('admin:dashboard')
  },
  conhecimento: {
    listar: (categoria?: string, busca?: string) =>
      ipcRenderer.invoke('conhecimento:listar', categoria, busca),
    obter: (id: number) => ipcRenderer.invoke('conhecimento:obter', id),
    criar: (input: any) => ipcRenderer.invoke('conhecimento:criar', input),
    atualizar: (id: number, input: any) =>
      ipcRenderer.invoke('conhecimento:atualizar', id, input),
    deletar: (id: number) => ipcRenderer.invoke('conhecimento:deletar', id)
  },
  orcamentos: {
    listar: (status?: string, cliente_id?: number) =>
      ipcRenderer.invoke('orcamentos:listar', status, cliente_id),
    obter: (id: number) => ipcRenderer.invoke('orcamentos:obter', id),
    criar: (input: any) => ipcRenderer.invoke('orcamentos:criar', input),
    atualizar: (id: number, input: any) =>
      ipcRenderer.invoke('orcamentos:atualizar', id, input),
    deletar: (id: number) => ipcRenderer.invoke('orcamentos:deletar', id),
    duplicar: (id: number) => ipcRenderer.invoke('orcamentos:duplicar', id)
  },
  contratos: {
    listar: (status?: string, cliente_id?: number) =>
      ipcRenderer.invoke('contratos:listar', status, cliente_id),
    obter: (id: number) => ipcRenderer.invoke('contratos:obter', id),
    criar: (input: any) => ipcRenderer.invoke('contratos:criar', input),
    atualizar: (id: number, input: any) =>
      ipcRenderer.invoke('contratos:atualizar', id, input),
    deletar: (id: number) => ipcRenderer.invoke('contratos:deletar', id),
    gerarDeOrcamento: (orcamento_id: number) =>
      ipcRenderer.invoke('contratos:gerarDeOrcamento', orcamento_id),
    listarClausulasPadrao: (tipo: string) =>
      ipcRenderer.invoke('contratos:listarClausulasPadrao', tipo)
  },
  reunioes: {
    listar: () => ipcRenderer.invoke('reunioes:listar'),
    obter: (id: number) => ipcRenderer.invoke('reunioes:obter', id),
    criar: (input: any) => ipcRenderer.invoke('reunioes:criar', input),
    atualizar: (id: number, input: any) => ipcRenderer.invoke('reunioes:atualizar', id, input),
    deletar: (id: number) => ipcRenderer.invoke('reunioes:deletar', id)
  },
  leads: {
    listar: (status?: string) => ipcRenderer.invoke('leads:listar', status),
    criar: (input: any) => ipcRenderer.invoke('leads:criar', input),
    atualizar: (id: number, input: any) => ipcRenderer.invoke('leads:atualizar', id, input),
    mover: (id: number, novo_status: string, nova_ordem: number) =>
      ipcRenderer.invoke('leads:mover', id, novo_status, nova_ordem),
    deletar: (id: number) => ipcRenderer.invoke('leads:deletar', id)
  },
  exports: {
    pontosExcel: (filtros: any) => ipcRenderer.invoke('exports:pontosExcel', filtros),
    horasProjetoExcel: (filtros: any) =>
      ipcRenderer.invoke('exports:horasProjetoExcel', filtros)
  },
  backup: {
    exportar: () => ipcRenderer.invoke('backup:exportar'),
    importar: () => ipcRenderer.invoke('backup:importar')
  }
}

contextBridge.exposeInMainWorld('api', api)

console.log('[PRELOAD] window.api exposto com sucesso')
