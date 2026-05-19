import { ipcMain } from 'electron'
import { getDatabase } from '../database/db'
import { session } from './session'
import type { Projeto, ProjetoCreateInput, Cliente } from '../../shared/types'

export function registrarHandlersProjetos() {
  ipcMain.handle('projetos:listar', async (_e, cliente_id?: number): Promise<Projeto[]> => {
    session.requireUser()
    const db = getDatabase()
    let where = ''
    const params: any[] = []
    if (cliente_id) {
      where = 'WHERE p.cliente_id = ?'
      params.push(cliente_id)
    }
    return db
      .prepare(
        `SELECT p.*, c.nome as cliente_nome
         FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id
         ${where}
         ORDER BY p.criado_em DESC`
      )
      .all(...params) as Projeto[]
  })

  ipcMain.handle('projetos:meus', async (): Promise<Projeto[]> => {
    const u = session.requireUser()
    const db = getDatabase()
    if (u.role === 'admin') {
      return db
        .prepare(
          `SELECT p.*, c.nome as cliente_nome
           FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id
           WHERE p.status NOT IN ('concluido','cancelado')
           ORDER BY p.criado_em DESC`
        )
        .all() as Projeto[]
    }
    return db
      .prepare(
        `SELECT p.*, c.nome as cliente_nome
         FROM projetos p
         LEFT JOIN clientes c ON c.id = p.cliente_id
         INNER JOIN projeto_funcionario pf ON pf.projeto_id = p.id
         WHERE pf.usuario_id = ? AND p.status NOT IN ('concluido','cancelado')
         ORDER BY p.criado_em DESC`
      )
      .all(u.id) as Projeto[]
  })

  ipcMain.handle('projetos:criar', async (_e, input: ProjetoCreateInput): Promise<Projeto> => {
    session.requireRole('admin', 'rh')
    const db = getDatabase()

    const tx = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO projetos (cliente_id, nome, descricao, status, revisao_atual, data_inicio, data_prevista_fim)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.cliente_id,
          input.nome,
          input.descricao || null,
          input.status || 'em_andamento',
          input.revisao_atual || 'R00',
          input.data_inicio || null,
          input.data_prevista_fim || null
        )

      const id = result.lastInsertRowid as number
      if (input.funcionarios_ids?.length) {
        const stmt = db.prepare(
          'INSERT INTO projeto_funcionario (projeto_id, usuario_id) VALUES (?, ?)'
        )
        for (const uid of input.funcionarios_ids) stmt.run(id, uid)
      }
      return id
    })

    const id = tx()
    return db
      .prepare(
        `SELECT p.*, c.nome as cliente_nome
         FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id
         WHERE p.id = ?`
      )
      .get(id) as Projeto
  })

  ipcMain.handle('projetos:obter', async (_e, id: number): Promise<Projeto | null> => {
    session.requireUser()
    const db = getDatabase()
    return (
      (db
        .prepare(
          `SELECT p.*, c.nome as cliente_nome
           FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id
           WHERE p.id = ?`
        )
        .get(id) as Projeto) || null
    )
  })

  ipcMain.handle(
    'projetos:atualizar',
    async (_e, id: number, input: Partial<ProjetoCreateInput>): Promise<Projeto> => {
      session.requireRole('admin', 'rh')
      const db = getDatabase()

      // Whitelist de campos permitidos
      const camposPermitidos: Record<string, string> = {
        nome: 'nome',
        descricao: 'descricao',
        cliente_id: 'cliente_id',
        status: 'status',
        data_inicio: 'data_inicio',
        data_prevista_fim: 'data_prevista_fim'
      }

      const campos: string[] = []
      const valores: any[] = []

      for (const [key, value] of Object.entries(input)) {
        if (key === 'funcionarios_ids') continue // tratado separadamente
        if (!camposPermitidos[key]) continue
        campos.push(`${camposPermitidos[key]} = ?`)
        valores.push(value === '' || value === undefined ? null : value)
      }

      if (campos.length > 0) {
        valores.push(id)
        db.prepare(`UPDATE projetos SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
      }

      // Se enviou novos funcionários, substitui a lista
      if (input.funcionarios_ids !== undefined) {
        const tx = db.transaction(() => {
          db.prepare('DELETE FROM projeto_funcionario WHERE projeto_id = ?').run(id)
          if (input.funcionarios_ids && input.funcionarios_ids.length > 0) {
            const stmt = db.prepare(
              'INSERT INTO projeto_funcionario (projeto_id, usuario_id) VALUES (?, ?)'
            )
            for (const uid of input.funcionarios_ids) stmt.run(id, uid)
          }
        })
        tx()
      }

      return db
        .prepare(
          `SELECT p.*, c.nome as cliente_nome
           FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id
           WHERE p.id = ?`
        )
        .get(id) as Projeto
    }
  )

  ipcMain.handle('projetos:deletar', async (_e, id: number) => {
    try {
      session.requireRole('admin', 'rh')
      const db = getDatabase()
      const usado = db
        .prepare(
          'SELECT COUNT(*) as n FROM cronometros WHERE projeto_id = ?'
        )
        .get(id) as { n: number }
      if (usado.n > 0) {
        return {
          success: false,
          error: `Projeto não pode ser excluído — ${usado.n} cronômetro(s) já registrado(s). Considere arquivar definindo status como 'cancelado'.`
        }
      }
      db.prepare('DELETE FROM projeto_funcionario WHERE projeto_id = ?').run(id)
      db.prepare('DELETE FROM projetos WHERE id = ?').run(id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao excluir' }
    }
  })

  ipcMain.handle('projetos:funcionariosDoProjeto', async (_e, id: number) => {
    session.requireUser()
    const db = getDatabase()
    return db
      .prepare('SELECT usuario_id FROM projeto_funcionario WHERE projeto_id = ?')
      .all(id) as Array<{ usuario_id: number }>
  })

  ipcMain.handle('clientes:listar', async (): Promise<Cliente[]> => {
    session.requireUser()
    const db = getDatabase()
    return db.prepare('SELECT * FROM clientes ORDER BY nome').all() as Cliente[]
  })

  ipcMain.handle(
    'clientes:criar',
    async (_e, input: Omit<Cliente, 'id' | 'criado_em'>): Promise<Cliente> => {
      session.requireRole('admin', 'rh')
      const db = getDatabase()
      const tipoPessoa = input.tipo_pessoa || 'juridica'
      if (tipoPessoa !== 'fisica' && tipoPessoa !== 'juridica') {
        throw new Error('Tipo de pessoa inválido')
      }
      const result = db
        .prepare(
          `INSERT INTO clientes (
             tipo_pessoa, nome, email, telefone, cnpj, inscricao_estadual, cpf, rg,
             endereco, contato_responsavel, observacoes,
             representante_nome, representante_nacionalidade, representante_naturalidade,
             representante_estado_civil, representante_profissao,
             representante_rg, representante_cpf
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          tipoPessoa,
          input.nome,
          input.email || null,
          input.telefone || null,
          input.cnpj || null,
          input.inscricao_estadual || null,
          input.cpf || null,
          input.rg || null,
          input.endereco || null,
          input.contato_responsavel || null,
          input.observacoes || null,
          input.representante_nome || null,
          input.representante_nacionalidade || null,
          input.representante_naturalidade || null,
          input.representante_estado_civil || null,
          input.representante_profissao || null,
          input.representante_rg || null,
          input.representante_cpf || null
        )
      return db.prepare('SELECT * FROM clientes WHERE id = ?').get(result.lastInsertRowid) as Cliente
    }
  )

  ipcMain.handle(
    'clientes:atualizar',
    async (_e, id: number, input: Partial<Omit<Cliente, 'id' | 'criado_em'>>): Promise<Cliente> => {
      session.requireRole('admin', 'rh')
      const db = getDatabase()

      // Whitelist de campos permitidos (segurança: nunca usar keys do input direto na query)
      const camposPermitidos: Record<string, true> = {
        tipo_pessoa: true,
        nome: true,
        email: true,
        telefone: true,
        cnpj: true,
        inscricao_estadual: true,
        cpf: true,
        rg: true,
        endereco: true,
        contato_responsavel: true,
        observacoes: true,
        representante_nome: true,
        representante_nacionalidade: true,
        representante_naturalidade: true,
        representante_estado_civil: true,
        representante_profissao: true,
        representante_rg: true,
        representante_cpf: true
      }

      const campos: string[] = []
      const valores: any[] = []
      for (const [key, value] of Object.entries(input)) {
        if (!camposPermitidos[key]) continue
        campos.push(`${key} = ?`)
        // String vazia vira null; mas mantém o valor se for outro tipo
        valores.push(value === '' || value === undefined ? null : value)
      }
      if (campos.length === 0) {
        return db.prepare('SELECT * FROM clientes WHERE id = ?').get(id) as Cliente
      }
      valores.push(id)
      db.prepare(`UPDATE clientes SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
      return db.prepare('SELECT * FROM clientes WHERE id = ?').get(id) as Cliente
    }
  )

  ipcMain.handle('clientes:deletar', async (_e, id: number) => {
    try {
      session.requireRole('admin', 'rh')
      const db = getDatabase()

      const projetos = db
        .prepare('SELECT COUNT(*) as n FROM projetos WHERE cliente_id = ?')
        .get(id) as { n: number }
      if (projetos.n > 0) {
        return {
          success: false,
          error: `Não é possível deletar: cliente possui ${projetos.n} projeto(s) vinculado(s)`
        }
      }

      db.prepare('DELETE FROM clientes WHERE id = ?').run(id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao deletar' }
    }
  })

  // Listagem para vincular em projetos (só admin/RH)
  ipcMain.handle('usuarios:listar', async () => {
    session.requireRole('admin', 'rh')
    const db = getDatabase()
    return db
      .prepare(
        `SELECT id, email, nome, cargo, role, cpf, telefone, data_admissao, ativo, criado_em
         FROM usuarios WHERE ativo = 1 ORDER BY nome`
      )
      .all()
  })

  // Listagem completa (inclui inativos) - só admin/RH
  ipcMain.handle('usuarios:listarTodos', async () => {
    session.requireRole('admin', 'rh')
    const db = getDatabase()
    return db
      .prepare(
        `SELECT id, email, nome, cargo, role, cpf, telefone, data_admissao, ativo, criado_em
         FROM usuarios ORDER BY ativo DESC, nome`
      )
      .all()
  })
}
