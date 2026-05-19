import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'

bcrypt.setRandomFallback((len: number) => {
  const buf = crypto.randomBytes(len)
  return Array.from(buf)
})

const dbDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
const db = new Database(path.join(dbDir, 'dnl-projetos.db'))
db.pragma('foreign_keys = ON')

// ── 5 Clientes ──────────────────────────────────────────────────────────────

const ic = db.prepare(`
  INSERT INTO clientes
    (tipo_pessoa, nome, email, telefone, cpf, rg, cnpj, endereco,
     representante_nome, representante_rg, representante_cpf,
     representante_estado_civil, representante_profissao, representante_nacionalidade)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const c1 = ic.run(
  'fisica', 'Maria José Ferreira', 'maria.ferreira@gmail.com', '(11) 98765-4321',
  '234.567.890-12', '34.567.890-8', null,
  'Rua das Acácias, 45, Jardim Paulista, São Paulo – SP, CEP 01310-000',
  'Maria José Ferreira', '34.567.890-8', '234.567.890-12', 'casada', 'professora', 'brasileira'
)

const c2 = ic.run(
  'fisica', 'Roberto Carlos Almeida', 'roberto.almeida@gmail.com', '(11) 97654-3210',
  '345.678.901-23', '45.678.901-9', null,
  'Av. Brigadeiro Faria Lima, 789, Itaim Bibi, São Paulo – SP, CEP 01451-000',
  'Roberto Carlos Almeida', '45.678.901-9', '345.678.901-23', 'solteiro', 'engenheiro', 'brasileiro'
)

const c3 = ic.run(
  'juridica', 'Construtora Horizonte Ltda', 'contato@horizonte.com.br', '(11) 3456-7890',
  null, null, '12.345.678/0001-90',
  'Av. Paulista, 1234, Bela Vista, São Paulo – SP, CEP 01310-100',
  'Ana Paula Corrêa', '56.789.012-0', '456.789.012-34', 'casada', 'diretora', 'brasileira'
)

const c4 = ic.run(
  'fisica', 'João Paulo Santos', 'joao.santos@gmail.com', '(11) 96543-2109',
  '456.789.012-34', '56.789.012-0', null,
  'Rua Augusta, 567, Consolação, São Paulo – SP, CEP 01305-000',
  'João Paulo Santos', '56.789.012-0', '456.789.012-34', 'divorciado', 'comerciante', 'brasileiro'
)

const c5 = ic.run(
  'juridica', 'Incorporadora Bela Vista S/A', 'contato@belavista.com.br', '(11) 2345-6789',
  null, null, '98.765.432/0001-10',
  'Rua do Bosque, 321, Lapa, São Paulo – SP, CEP 05023-000',
  'Marcos Antônio Lima', '67.890.123-1', '567.890.123-45', 'casado', 'diretor', 'brasileiro'
)

console.log('✓ 5 clientes criados')

// ── 5 Projetos ──────────────────────────────────────────────────────────────

const ip = db.prepare(`
  INSERT INTO projetos (cliente_id, nome, descricao, status, data_inicio)
  VALUES (?, ?, ?, ?, date('now','localtime'))
`)

ip.run(c1.lastInsertRowid, 'Projeto Elétrico — Residência Ferreira',
  'Elaboração de projeto elétrico residencial para aprovação junto à concessionária.', 'em_andamento')

ip.run(c2.lastInsertRowid, 'Manual As-Built — Residência Almeida',
  'Levantamento As-Built in loco e elaboração do Manual do Proprietário.', 'planejamento')

ip.run(c3.lastInsertRowid, 'Laudo de Vizinhança — Construtora Horizonte',
  'Laudo técnico de vizinhança para emissão de alvará de demolição.', 'em_andamento')

ip.run(c4.lastInsertRowid, 'Regularização — Residência Santos',
  'Projeto de regularização de edificação junto à Prefeitura de São Paulo.', 'planejamento')

ip.run(c5.lastInsertRowid, 'Usucapião — Lote Bela Vista',
  'Instrução técnica de processo de usucapião: memorial descritivo e planta georreferenciada.', 'em_andamento')

console.log('✓ 5 projetos criados')

// ── 2 Funcionários ───────────────────────────────────────────────────────────

const senhaHash = bcrypt.hashSync('Func@2025', 10)

db.prepare(`INSERT OR IGNORE INTO usuarios (email, senha_hash, nome, cargo, role, data_admissao)
  VALUES (?, ?, ?, ?, ?, date('now','localtime'))`)
  .run('ana.mendes@dnlprojetos.com', senhaHash, 'Ana Paula Mendes', 'Engenheira Civil', 'funcionario')

db.prepare(`INSERT OR IGNORE INTO usuarios (email, senha_hash, nome, cargo, role, data_admissao)
  VALUES (?, ?, ?, ?, ?, date('now','localtime'))`)
  .run('carlos.santos@dnlprojetos.com', senhaHash, 'Carlos Eduardo Santos', 'Técnico em Edificações', 'funcionario')

console.log('✓ 2 funcionários criados (senha: Func@2025)')
console.log('\nPronto! Recarregue o sistema no browser.')

db.close()
