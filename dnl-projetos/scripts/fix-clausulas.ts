/**
 * Adiciona cláusulas específicas aos tipos legados que só tinham 7 cláusulas genéricas.
 * Usa INSERT OR IGNORE (não sobrescreve o que já existe) + UPDATE nas texts genéricas.
 */
import Database from 'better-sqlite3'
import path from 'node:path'

const db = new Database(path.join(process.cwd(), 'data', 'dnl-projetos.db'))
db.pragma('foreign_keys = ON')

const ins = db.prepare(`INSERT OR IGNORE INTO clausulas_padrao
  (tipo_contrato, clausula_id, secao, rotulo, texto, essencial, ordem, ativa)
  VALUES (?, ?, ?, ?, ?, ?, ?, 1)`)

const upd = db.prepare(`UPDATE clausulas_padrao SET texto = ? WHERE tipo_contrato = ? AND clausula_id = ?`)

const PRECO = `O valor total do serviço contratado é de R$ {{valor_numero}} ({{valor_extenso}}), conforme a seguir:\n\n{{parcelas_lista}}\n\nO pagamento deverá ser realizado via PIX para a chave CNPJ 51.212.533/0001-78, em nome de "Desenvolvendo Novos Lares" – Banco Nubank.`
const FORO  = `Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes elegem o foro da comarca de {{cidade}}, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`

// ══════════════════════════════════════════════════════════════════════════════
// LAUDO DE VIZINHANÇA
// ══════════════════════════════════════════════════════════════════════════════
const LVZ = 'laudo_vizinhanca'

upd.run(
  `É objeto do presente contrato a elaboração de Laudo Técnico de Vizinhança do imóvel localizado na {{objeto_endereco}}, compreendendo o registro fotográfico e técnico do estado de conservação das edificações lindeiras antes do início das obras, conforme orçamento no valor de R$ {{valor_numero}} ({{valor_extenso}}), parte integrante deste contrato.`,
  LVZ, 'objeto'
)

ins.run(LVZ, 'incluso', 'DOS SERVIÇOS', 'Itens inclusos', `Está incluso no presente contrato:\n• Vistoria técnica presencial nas edificações vizinhas;\n• Registro fotográfico detalhado dos imóveis lindeiros;\n• Elaboração do laudo técnico de vizinhança;\n• Descrição do estado de conservação de fachadas, estruturas visíveis e área externa;\n• Anotação de Responsabilidade Técnica (ART) ou RRT.`, 0, 3)

upd.run(
  `Não está incluso no presente contrato:\n• Vistoria interna dos imóveis vizinhos (salvo autorização expressa dos proprietários);\n• Análise estrutural ou de fundações;\n• Mais de 1 (uma) visita técnica ao local;\n• Impressão do laudo;\n• Reconhecimento de firma;\n• Acompanhamento ou fiscalização de obra.`,
  LVZ, 'nao_incluso'
)

ins.run(LVZ, 'prazo', 'DO PRAZO', 'Prazo de entrega',
  `O laudo técnico será entregue em até 10 (dez) dias úteis após a realização da vistoria presencial nos imóveis vizinhos.`,
  1, 10)

ins.run(LVZ, 'desistencia', 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO', 'Desistência do CONTRATANTE',
  `Em caso de desistência por parte do CONTRATANTE após a realização da vistoria, o valor integral será cobrado, uma vez que o serviço principal terá sido executado.`,
  0, 13)

ins.run(LVZ, 'autorizacao_imagem', 'DAS CONDIÇÕES GERAIS', 'Autorização de uso de imagens',
  `O CONTRATANTE autoriza a CONTRATADA a utilizar as imagens externas obtidas durante a vistoria para fins de divulgação técnica e portfólio, desde que omitidos dados pessoais e a identificação dos imóveis.`,
  0, 15)

console.log('✓ laudo_vizinhanca — cláusulas atualizadas/inseridas')

// ══════════════════════════════════════════════════════════════════════════════
// PROJETO ELÉTRICO
// ══════════════════════════════════════════════════════════════════════════════
const ELE = 'eletrica'

upd.run(
  `É objeto do presente contrato a elaboração do Projeto de Instalações Elétricas do imóvel localizado na {{objeto_endereco}}, em conformidade com a norma ABNT NBR 5410 e demais normas técnicas aplicáveis, conforme orçamento no valor de R$ {{valor_numero}} ({{valor_extenso}}), parte integrante deste contrato.`,
  ELE, 'objeto'
)

ins.run(ELE, 'incluso', 'DOS SERVIÇOS', 'Itens inclusos',
  `Está incluso no presente contrato:\n• Elaboração do projeto elétrico conforme ABNT NBR 5410;\n• Dimensionamento de circuitos, quadro de distribuição e ponto de entrega;\n• Anotação de Responsabilidade Técnica (ART) ou Registro de Responsabilidade Técnica (RRT);\n• Arquivos digitais em formato PDF e DWG;\n• 1 (uma) revisão gratuita.`,
  0, 3)

upd.run(
  `Não está incluso no presente contrato:\n• Reconhecimento de firma;\n• Impressão das pranchas do projeto;\n• Taxas de aprovação junto à concessionária de energia;\n• Projeto de SPDA (para-raios);\n• Projeto de CFTV, automação ou alarme;\n• Acompanhamento de obra, execução e administração;\n• Revisões adicionais além da prevista.`,
  ELE, 'nao_incluso'
)

ins.run(ELE, 'prazo', 'DO PRAZO', 'Prazo de entrega',
  `O prazo de entrega do projeto será de até 20 (vinte) dias úteis, contados a partir do recebimento de todas as informações, plantas e documentos necessários e da confirmação do pagamento da entrada.\n\nParágrafo Único – O prazo poderá ser prorrogado em caso de solicitação de alterações pelo CONTRATANTE ou por motivos de força maior.`,
  1, 10)

ins.run(ELE, 'desistencia', 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO', 'Desistência do CONTRATANTE',
  `Em caso de desistência por parte do CONTRATANTE após o início dos serviços, será retido 50% (cinquenta por cento) do valor já recebido pela CONTRATADA, a título de ressarcimento dos trabalhos realizados e reserva de agenda.`,
  0, 13)

ins.run(ELE, 'responsabilidade', 'DAS CONDIÇÕES GERAIS', 'Responsabilidade técnica',
  `O projeto será elaborado sob responsabilidade técnica do Eng. Civil Lucas Cardoso da Silva, inscrito no CREA-SP nº 5070747868, com emissão de ART/RRT junto ao conselho profissional competente.`,
  0, 15)

console.log('✓ eletrica — cláusulas atualizadas/inseridas')

// ══════════════════════════════════════════════════════════════════════════════
// PROJETO HIDRÁULICO
// ══════════════════════════════════════════════════════════════════════════════
const HID = 'hidraulica'

upd.run(
  `É objeto do presente contrato a elaboração do Projeto de Instalações Hidrossanitárias do imóvel localizado na {{objeto_endereco}}, em conformidade com a norma ABNT NBR 5626, NBR 8160 e demais normas técnicas aplicáveis, conforme orçamento no valor de R$ {{valor_numero}} ({{valor_extenso}}), parte integrante deste contrato.`,
  HID, 'objeto'
)

ins.run(HID, 'incluso', 'DOS SERVIÇOS', 'Itens inclusos',
  `Está incluso no presente contrato:\n• Elaboração do projeto hidrossanitário conforme ABNT NBR 5626 e NBR 8160;\n• Dimensionamento de ramais de abastecimento de água fria e esgoto sanitário;\n• Anotação de Responsabilidade Técnica (ART) ou Registro de Responsabilidade Técnica (RRT);\n• Arquivos digitais em formato PDF e DWG;\n• 1 (uma) revisão gratuita.`,
  0, 3)

upd.run(
  `Não está incluso no presente contrato:\n• Reconhecimento de firma;\n• Impressão das pranchas do projeto;\n• Taxas de aprovação junto à concessionária de água e esgoto;\n• Projeto de água quente (solar ou a gás);\n• Projeto de reuso de água;\n• Acompanhamento de obra, execução e administração;\n• Revisões adicionais além da prevista.`,
  HID, 'nao_incluso'
)

ins.run(HID, 'prazo', 'DO PRAZO', 'Prazo de entrega',
  `O prazo de entrega do projeto será de até 20 (vinte) dias úteis, contados a partir do recebimento de todas as informações, plantas e documentos necessários e da confirmação do pagamento da entrada.\n\nParágrafo Único – O prazo poderá ser prorrogado em caso de solicitação de alterações pelo CONTRATANTE ou por motivos de força maior.`,
  1, 10)

ins.run(HID, 'desistencia', 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO', 'Desistência do CONTRATANTE',
  `Em caso de desistência por parte do CONTRATANTE após o início dos serviços, será retido 50% (cinquenta por cento) do valor já recebido pela CONTRATADA, a título de ressarcimento dos trabalhos realizados e reserva de agenda.`,
  0, 13)

ins.run(HID, 'responsabilidade', 'DAS CONDIÇÕES GERAIS', 'Responsabilidade técnica',
  `O projeto será elaborado sob responsabilidade técnica do Eng. Civil Lucas Cardoso da Silva, inscrito no CREA-SP nº 5070747868, com emissão de ART/RRT junto ao conselho profissional competente.`,
  0, 15)

console.log('✓ hidraulica — cláusulas atualizadas/inseridas')

// ══════════════════════════════════════════════════════════════════════════════
// PROJETO DE GÁS
// ══════════════════════════════════════════════════════════════════════════════
const GAS = 'gas'

upd.run(
  `É objeto do presente contrato a elaboração do Projeto de Instalações de Gás do imóvel localizado na {{objeto_endereco}}, em conformidade com a norma ABNT NBR 15526 e demais normas técnicas aplicáveis, conforme orçamento no valor de R$ {{valor_numero}} ({{valor_extenso}}), parte integrante deste contrato.`,
  GAS, 'objeto'
)

ins.run(GAS, 'incluso', 'DOS SERVIÇOS', 'Itens inclusos',
  `Está incluso no presente contrato:\n• Elaboração do projeto de instalações de gás conforme ABNT NBR 15526;\n• Dimensionamento de tubulações, pontos de consumo e válvulas de segurança;\n• Anotação de Responsabilidade Técnica (ART) ou Registro de Responsabilidade Técnica (RRT);\n• Arquivos digitais em formato PDF e DWG;\n• 1 (uma) revisão gratuita.`,
  0, 3)

upd.run(
  `Não está incluso no presente contrato:\n• Reconhecimento de firma;\n• Impressão das pranchas do projeto;\n• Taxas de aprovação junto à concessionária de gás;\n• Projeto de central de gás (granel ou botijão acima de 90 kg);\n• Acompanhamento de obra, execução e administração;\n• Revisões adicionais além da prevista.`,
  GAS, 'nao_incluso'
)

ins.run(GAS, 'prazo', 'DO PRAZO', 'Prazo de entrega',
  `O prazo de entrega do projeto será de até 20 (vinte) dias úteis, contados a partir do recebimento de todas as informações, plantas e documentos necessários e da confirmação do pagamento da entrada.`,
  1, 10)

ins.run(GAS, 'desistencia', 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO', 'Desistência do CONTRATANTE',
  `Em caso de desistência por parte do CONTRATANTE após o início dos serviços, será retido 50% (cinquenta por cento) do valor já recebido pela CONTRATADA, a título de ressarcimento dos trabalhos realizados e reserva de agenda.`,
  0, 13)

ins.run(GAS, 'responsabilidade', 'DAS CONDIÇÕES GERAIS', 'Responsabilidade técnica',
  `O projeto será elaborado sob responsabilidade técnica do Eng. Civil Lucas Cardoso da Silva, inscrito no CREA-SP nº 5070747868, com emissão de ART/RRT junto ao conselho profissional competente.`,
  0, 15)

console.log('✓ gas — cláusulas atualizadas/inseridas')

// ══════════════════════════════════════════════════════════════════════════════
// REGULARIZAÇÃO
// ══════════════════════════════════════════════════════════════════════════════
const REG = 'regularizacao'

upd.run(
  `É objeto do presente contrato a elaboração de Projeto de Regularização da edificação localizada na {{objeto_endereco}}, junto à Prefeitura Municipal competente, compreendendo o levantamento arquitetônico, memorial descritivo e peças gráficas necessárias à aprovação, conforme orçamento no valor de R$ {{valor_numero}} ({{valor_extenso}}), parte integrante deste contrato.`,
  REG, 'objeto'
)

ins.run(REG, 'incluso', 'DOS SERVIÇOS', 'Itens inclusos',
  `Está incluso no presente contrato:\n• Levantamento arquitetônico da edificação existente;\n• Elaboração de plantas, cortes e fachadas para regularização;\n• Memorial descritivo e de cálculo de áreas;\n• Anotação de Responsabilidade Técnica (ART) ou Registro de Responsabilidade Técnica (RRT);\n• Arquivos digitais em formato PDF e DWG;\n• Orientação e acompanhamento do protocolo junto à Prefeitura.`,
  0, 3)

upd.run(
  `Não está incluso no presente contrato:\n• Taxas de aprovação, ITBI, IPTU e custos cartorários;\n• Regularização junto ao cartório de registro de imóveis;\n• Projetos complementares (elétrico, hidráulico, estrutural);\n• Acompanhamento de obra ou execução;\n• Mais de 2 (duas) revisões do projeto;\n• Reconhecimento de firma.`,
  REG, 'nao_incluso'
)

ins.run(REG, 'prazo', 'DO PRAZO', 'Prazo de entrega',
  `O prazo de entrega do projeto será de até 30 (trinta) dias úteis, contados a partir do recebimento de toda a documentação necessária e da confirmação do pagamento da entrada.\n\nParágrafo Único – O prazo de aprovação pela Prefeitura é de responsabilidade exclusiva do órgão público, não compondo o prazo contratual da CONTRATADA.`,
  1, 10)

ins.run(REG, 'desistencia', 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO', 'Desistência do CONTRATANTE',
  `Em caso de desistência por parte do CONTRATANTE após o início dos serviços, será retido 50% (cinquenta por cento) do valor já recebido pela CONTRATADA, a título de ressarcimento dos trabalhos realizados e reserva de agenda.`,
  0, 13)

ins.run(REG, 'condicoes_gerais', 'DAS CONDIÇÕES GERAIS', 'Condições gerais',
  `Os documentos elaborados são de uso exclusivo do CONTRATANTE para a regularização do imóvel objeto deste contrato. O reaproveitamento para outros fins ou imóveis depende de nova contratação e emissão de nova ART.\n\nParágrafo Único – A CONTRATADA não se responsabiliza por eventuais exigências adicionais formuladas pela Prefeitura após a entrega do projeto.`,
  0, 15)

console.log('✓ regularizacao — cláusulas atualizadas/inseridas')

// ══════════════════════════════════════════════════════════════════════════════
// MANUAL DO PROPRIETÁRIO
// ══════════════════════════════════════════════════════════════════════════════
const MAN = 'manual_proprietario'

upd.run(
  `É objeto do presente contrato a elaboração do Manual do Proprietário do imóvel localizado na {{objeto_endereco}}, compreendendo orientações técnicas sobre o uso, operação e manutenção preventiva dos sistemas e instalações da edificação, conforme orçamento no valor de R$ {{valor_numero}} ({{valor_extenso}}), parte integrante deste contrato.`,
  MAN, 'objeto'
)

ins.run(MAN, 'incluso', 'DOS SERVIÇOS', 'Itens inclusos',
  `Está incluso no presente contrato:\n• Elaboração do Manual do Proprietário com informações técnicas dos sistemas da edificação;\n• Instruções de uso, operação e manutenção preventiva;\n• Vida útil estimada dos sistemas e componentes;\n• Periodicidade das manutenções recomendadas;\n• Orientações para situações de emergência;\n• Entrega em formato digital (.PDF).`,
  0, 3)

upd.run(
  `Não está incluso no presente contrato:\n• Levantamento técnico in loco (As-Built) — objeto de contrato separado;\n• Projetos de instalações (elétrico, hidráulico, gás);\n• Impressão do manual;\n• Reconhecimento de firma;\n• Visita técnica ao imóvel (o manual é elaborado com base em documentação fornecida pelo CONTRATANTE).`,
  MAN, 'nao_incluso'
)

ins.run(MAN, 'prazo', 'DO PRAZO', 'Prazo de entrega',
  `O prazo de entrega do Manual do Proprietário será de até 15 (quinze) dias úteis, contados a partir do recebimento de toda a documentação e informações necessárias sobre o imóvel e da confirmação do pagamento.`,
  1, 10)

ins.run(MAN, 'desistencia', 'DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO', 'Desistência do CONTRATANTE',
  `Em caso de desistência por parte do CONTRATANTE após o início dos serviços, será retido 50% (cinquenta por cento) do valor já recebido pela CONTRATADA, a título de ressarcimento dos trabalhos realizados e reserva de agenda.`,
  0, 13)

console.log('✓ manual_proprietario — cláusulas atualizadas/inseridas')

// ── Resumo ────────────────────────────────────────────────────────────────────
const contagens = db.prepare(`
  SELECT tipo_contrato, COUNT(*) as total
  FROM clausulas_padrao WHERE ativa = 1
  GROUP BY tipo_contrato ORDER BY tipo_contrato
`).all() as any[]

console.log('\nCláusulas por tipo após migração:')
for (const r of contagens) {
  console.log(`  ${r.tipo_contrato.padEnd(25)} → ${r.total} cláusulas`)
}

db.close()
console.log('\nPronto! Reinicie o servidor e recarregue o browser.')
