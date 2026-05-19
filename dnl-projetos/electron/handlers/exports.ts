import { ipcMain, dialog } from 'electron'
import ExcelJS from 'exceljs'
import { getDatabase } from '../database/db'
import { session } from './session'

const TIPO_PONTO_LABEL: Record<string, string> = {
  entrada: 'Entrada',
  almoco_inicio: 'Início almoço',
  almoco_fim: 'Volta almoço',
  saida: 'Saída',
  parada_inicio: 'Início parada',
  parada_fim: 'Fim parada'
}

function formatarHoras(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`
}

function aplicarEstilosCabecalho(
  ws: ExcelJS.Worksheet,
  rowIndex: number = 1
) {
  const row = ws.getRow(rowIndex)
  row.font = { bold: true, color: { argb: 'FFFAF9F4' } }
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1A1A1A' }
  }
  row.alignment = { vertical: 'middle', horizontal: 'left' }
  row.height = 22
}

export function registrarHandlersExports() {
  // ============================================================
  // EXPORTAR PONTOS PRA EXCEL
  // ============================================================
  ipcMain.handle(
    'exports:pontosExcel',
    async (
      _e,
      filtros: { inicio: string; fim: string; usuario_id?: number }
    ): Promise<{ success: boolean; arquivo?: string; error?: string }> => {
      try {
        const u = session.requireUser()
        const ehAdminOuRH = u.role === 'admin' || u.role === 'rh'

        // Funcionário comum só pode exportar os próprios pontos
        const usuarioAlvo = ehAdminOuRH ? filtros.usuario_id : u.id

        const db = getDatabase()

        const whereParts: string[] = ['date(p.timestamp) BETWEEN ? AND ?']
        const params: any[] = [filtros.inicio, filtros.fim]
        if (usuarioAlvo) {
          whereParts.push('p.usuario_id = ?')
          params.push(usuarioAlvo)
        }
        const whereClause = `WHERE ${whereParts.join(' AND ')}`

        const pontos = db
          .prepare(
            `SELECT p.*, u.nome as usuario_nome, u.email as usuario_email
             FROM pontos p
             JOIN usuarios u ON u.id = p.usuario_id
             ${whereClause}
             ORDER BY p.timestamp ASC`
          )
          .all(...params) as Array<{
          id: number
          usuario_id: number
          usuario_nome: string
          usuario_email: string
          tipo: string
          timestamp: string
          observacao: string | null
        }>

        const result = await dialog.showSaveDialog({
          title: 'Salvar pontos em Excel',
          defaultPath: `pontos-${filtros.inicio}-a-${filtros.fim}.xlsx`,
          filters: [{ name: 'Excel', extensions: ['xlsx'] }]
        })
        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Exportação cancelada' }
        }

        const wb = new ExcelJS.Workbook()
        wb.creator = 'DNL Projetos'
        wb.created = new Date()

        // Aba 1: Lista de pontos
        const ws = wb.addWorksheet('Pontos', {
          views: [{ state: 'frozen', ySplit: 1 }]
        })
        ws.columns = [
          { header: 'Data', key: 'data', width: 12 },
          { header: 'Hora', key: 'hora', width: 10 },
          { header: 'Funcionário', key: 'funcionario', width: 28 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Tipo', key: 'tipo', width: 16 },
          { header: 'Observação', key: 'obs', width: 40 }
        ]
        aplicarEstilosCabecalho(ws)

        for (const p of pontos) {
          const dt = new Date(p.timestamp.replace(' ', 'T'))
          ws.addRow({
            data: dt.toLocaleDateString('pt-BR'),
            hora: dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            funcionario: p.usuario_nome,
            email: p.usuario_email,
            tipo: TIPO_PONTO_LABEL[p.tipo] || p.tipo,
            obs: p.observacao || ''
          })
        }

        // Aba 2: Resumo por dia/funcionário (calcula horas trabalhadas)
        const ws2 = wb.addWorksheet('Resumo Diário', {
          views: [{ state: 'frozen', ySplit: 1 }]
        })
        ws2.columns = [
          { header: 'Data', key: 'data', width: 12 },
          { header: 'Funcionário', key: 'funcionario', width: 28 },
          { header: 'Entrada', key: 'entrada', width: 10 },
          { header: 'Saída', key: 'saida', width: 10 },
          { header: 'Almoço', key: 'almoco', width: 10 },
          { header: 'Paradas', key: 'paradas', width: 10 },
          { header: 'Horas Trabalhadas', key: 'horas', width: 18 }
        ]
        aplicarEstilosCabecalho(ws2)

        // Agrupa pontos por (data, usuario_id)
        const grupos = new Map<string, typeof pontos>()
        for (const p of pontos) {
          const data = p.timestamp.slice(0, 10)
          const key = `${data}|${p.usuario_id}`
          if (!grupos.has(key)) grupos.set(key, [])
          grupos.get(key)!.push(p)
        }

        // Calcula resumo
        for (const [key, lista] of [...grupos.entries()].sort()) {
          const [data, _] = key.split('|')
          const ord = [...lista].sort(
            (a, b) =>
              new Date(a.timestamp.replace(' ', 'T')).getTime() -
              new Date(b.timestamp.replace(' ', 'T')).getTime()
          )
          const entrada = ord.find((p) => p.tipo === 'entrada')
          const saida = [...ord].reverse().find((p) => p.tipo === 'saida')
          if (!entrada) continue

          const fim = saida
            ? new Date(saida.timestamp.replace(' ', 'T'))
            : new Date(entrada.timestamp.replace(' ', 'T'))
          let total = (fim.getTime() - new Date(entrada.timestamp.replace(' ', 'T')).getTime()) / 1000
          let almocoSeg = 0
          let paradasSeg = 0

          const aIni = ord.find((p) => p.tipo === 'almoco_inicio')
          const aFim = ord.find((p) => p.tipo === 'almoco_fim')
          if (aIni && aFim) {
            const dur =
              (new Date(aFim.timestamp.replace(' ', 'T')).getTime() -
                new Date(aIni.timestamp.replace(' ', 'T')).getTime()) /
              1000
            total -= dur
            almocoSeg = dur
          }

          const pIni = ord.filter((p) => p.tipo === 'parada_inicio')
          const pFim = ord.filter((p) => p.tipo === 'parada_fim')
          for (let i = 0; i < pIni.length; i++) {
            const f = pFim[i]
            if (f) {
              const dur =
                (new Date(f.timestamp.replace(' ', 'T')).getTime() -
                  new Date(pIni[i].timestamp.replace(' ', 'T')).getTime()) /
                1000
              total -= dur
              paradasSeg += dur
            }
          }
          total = Math.max(0, total)

          const dt = new Date(data + 'T12:00:00')
          ws2.addRow({
            data: dt.toLocaleDateString('pt-BR'),
            funcionario: lista[0].usuario_nome,
            entrada: new Date(entrada.timestamp.replace(' ', 'T')).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            saida: saida
              ? new Date(saida.timestamp.replace(' ', 'T')).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : '—',
            almoco: formatarHoras(almocoSeg),
            paradas: formatarHoras(paradasSeg),
            horas: formatarHoras(total)
          })
        }

        await wb.xlsx.writeFile(result.filePath)
        return { success: true, arquivo: result.filePath }
      } catch (err: any) {
        return { success: false, error: err.message || 'Erro ao exportar' }
      }
    }
  )

  // ============================================================
  // EXPORTAR HORAS POR PROJETO PRA EXCEL
  // ============================================================
  ipcMain.handle(
    'exports:horasProjetoExcel',
    async (
      _e,
      filtros: {
        inicio: string
        fim: string
        usuario_id?: number
        projeto_id?: number
      }
    ): Promise<{ success: boolean; arquivo?: string; error?: string }> => {
      try {
        const u = session.requireUser()
        const ehAdminOuRH = u.role === 'admin' || u.role === 'rh'

        // Funcionário comum só vê os próprios cronômetros
        const usuarioAlvo = ehAdminOuRH ? filtros.usuario_id : u.id

        const db = getDatabase()

        const whereParts: string[] = [
          'c.fim IS NOT NULL',
          'date(c.inicio) BETWEEN ? AND ?'
        ]
        const params: any[] = [filtros.inicio, filtros.fim]
        if (usuarioAlvo) {
          whereParts.push('c.usuario_id = ?')
          params.push(usuarioAlvo)
        }
        if (filtros.projeto_id) {
          whereParts.push('c.projeto_id = ?')
          params.push(filtros.projeto_id)
        }

        const linhas = db
          .prepare(
            `SELECT c.*,
                    u.nome as usuario_nome,
                    p.nome as projeto_nome,
                    cl.nome as cliente_nome
             FROM cronometros c
             JOIN usuarios u ON u.id = c.usuario_id
             JOIN projetos p ON p.id = c.projeto_id
             LEFT JOIN clientes cl ON cl.id = p.cliente_id
             WHERE ${whereParts.join(' AND ')}
             ORDER BY c.inicio ASC`
          )
          .all(...params) as Array<{
          id: number
          usuario_id: number
          usuario_nome: string
          projeto_id: number
          projeto_nome: string
          cliente_nome: string | null
          inicio: string
          fim: string
          observacao: string | null
        }>

        const result = await dialog.showSaveDialog({
          title: 'Salvar horas por projeto em Excel',
          defaultPath: `horas-projetos-${filtros.inicio}-a-${filtros.fim}.xlsx`,
          filters: [{ name: 'Excel', extensions: ['xlsx'] }]
        })
        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Exportação cancelada' }
        }

        const wb = new ExcelJS.Workbook()
        wb.creator = 'DNL Projetos'
        wb.created = new Date()

        // Aba 1: Detalhes (cada cronômetro)
        const ws = wb.addWorksheet('Cronômetros', {
          views: [{ state: 'frozen', ySplit: 1 }]
        })
        ws.columns = [
          { header: 'Data', key: 'data', width: 12 },
          { header: 'Funcionário', key: 'funcionario', width: 28 },
          { header: 'Cliente', key: 'cliente', width: 25 },
          { header: 'Projeto', key: 'projeto', width: 30 },
          { header: 'Início', key: 'inicio', width: 10 },
          { header: 'Fim', key: 'fim', width: 10 },
          { header: 'Duração', key: 'duracao', width: 12 },
          { header: 'Observação', key: 'obs', width: 40 }
        ]
        aplicarEstilosCabecalho(ws)

        for (const l of linhas) {
          const ini = new Date(l.inicio.replace(' ', 'T'))
          const fim = new Date(l.fim.replace(' ', 'T'))
          const segundos = Math.floor((fim.getTime() - ini.getTime()) / 1000)
          ws.addRow({
            data: ini.toLocaleDateString('pt-BR'),
            funcionario: l.usuario_nome,
            cliente: l.cliente_nome || '—',
            projeto: l.projeto_nome,
            inicio: ini.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            fim: fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            duracao: formatarHoras(segundos),
            obs: l.observacao || ''
          })
        }

        // Aba 2: Resumo por projeto
        const ws2 = wb.addWorksheet('Total por Projeto', {
          views: [{ state: 'frozen', ySplit: 1 }]
        })
        ws2.columns = [
          { header: 'Cliente', key: 'cliente', width: 25 },
          { header: 'Projeto', key: 'projeto', width: 30 },
          { header: 'Total de Horas', key: 'total', width: 16 },
          { header: 'Horas Decimais', key: 'decimal', width: 16 }
        ]
        aplicarEstilosCabecalho(ws2)

        const porProjeto = new Map<number, { cliente: string; projeto: string; segundos: number }>()
        for (const l of linhas) {
          const ini = new Date(l.inicio.replace(' ', 'T'))
          const fim = new Date(l.fim.replace(' ', 'T'))
          const segundos = Math.floor((fim.getTime() - ini.getTime()) / 1000)
          const atual = porProjeto.get(l.projeto_id) || {
            cliente: l.cliente_nome || '—',
            projeto: l.projeto_nome,
            segundos: 0
          }
          atual.segundos += segundos
          porProjeto.set(l.projeto_id, atual)
        }
        for (const v of porProjeto.values()) {
          ws2.addRow({
            cliente: v.cliente,
            projeto: v.projeto,
            total: formatarHoras(v.segundos),
            decimal: (v.segundos / 3600).toFixed(2)
          })
        }

        // Aba 3: Resumo por funcionário
        const ws3 = wb.addWorksheet('Total por Funcionário', {
          views: [{ state: 'frozen', ySplit: 1 }]
        })
        ws3.columns = [
          { header: 'Funcionário', key: 'funcionario', width: 28 },
          { header: 'Total de Horas', key: 'total', width: 16 },
          { header: 'Horas Decimais', key: 'decimal', width: 16 }
        ]
        aplicarEstilosCabecalho(ws3)

        const porUsuario = new Map<number, { nome: string; segundos: number }>()
        for (const l of linhas) {
          const ini = new Date(l.inicio.replace(' ', 'T'))
          const fim = new Date(l.fim.replace(' ', 'T'))
          const segundos = Math.floor((fim.getTime() - ini.getTime()) / 1000)
          const atual = porUsuario.get(l.usuario_id) || { nome: l.usuario_nome, segundos: 0 }
          atual.segundos += segundos
          porUsuario.set(l.usuario_id, atual)
        }
        for (const v of porUsuario.values()) {
          ws3.addRow({
            funcionario: v.nome,
            total: formatarHoras(v.segundos),
            decimal: (v.segundos / 3600).toFixed(2)
          })
        }

        await wb.xlsx.writeFile(result.filePath)
        return { success: true, arquivo: result.filePath }
      } catch (err: any) {
        return { success: false, error: err.message || 'Erro ao exportar' }
      }
    }
  )
}
