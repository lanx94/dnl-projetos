# Auditoria de Segurança — DNL Projetos (v0.7.0)

> **Sobre "100% seguro":** não existe sistema 100% seguro — segurança é redução de risco, não um estado absoluto. Este relatório elimina as falhas conhecidas e fecha a superfície de ataque. Depois de aplicar as correções, re-rode `node security/pentest.mjs <url>` a cada deploy.

**Escopo:** análise estática do código (`server/`, Docker, Nginx, scripts EC2) + script de teste dinâmico (`pentest.mjs`).

### ✅ Já corrigido no código (commit desta auditoria)
- **M1 (PII/CPF):** `GET /api/usuarios` só devolve cpf/telefone/data_admissao para admin/rh — [usuarios.ts](../server/routes/usuarios.ts).
- **M2 (vazamento de erro):** middleware central sanitiza toda resposta 5xx em produção (`NODE_ENV=production`) — [index.ts](../server/index.ts). Cobre as 89 ocorrências de `err.message` sem tocar nas 20 rotas; em dev as mensagens completas continuam aparecendo.
- **M3 (headers):** adicionados Content-Security-Policy e (em produção) HSTS; removido o obsoleto X-XSS-Protection — [index.ts](../server/index.ts).
- **C1 (dados de teste):** `seedDadosExemplo` (clientes/funcionários fictícios com CPF e senha `Func@2025`) agora só roda fora de produção — [db.ts](../server/database/db.ts).
- **C2/C3 (docker):** senhas de Keycloak/Postgres agora são **obrigatórias** (sem default inseguro) e a API só escuta em `127.0.0.1` — [docker-compose.yml](../docker-compose.yml).

### ⚠️ Ainda depende de você (não dá pra fazer pelo código)
- **C1:** trocar a senha do admin `admin@dnlprojetos.com` (se o banco já foi semeado com `Admin@2025`).
- **C3/C2:** Security Group da EC2 — liberar só 80/443; bloquear 3001/8080/5432.
- **C4:** ativar HTTPS (Certbot ou ALB+ACM).
- Definir `NODE_ENV=production` no `.env` (senão as proteções acima de produção não ativam!).

**Boa notícia de cara:** **não há SQL Injection** — todas as queries usam parâmetros `?` (better-sqlite3) e os trechos dinâmicos (`UPDATE ... SET ${campos}`) montam nomes de coluna a partir de listas fixas no servidor, nunca de entrada do usuário. As senhas usam bcrypt. A base é sólida; os problemas estão em **configuração/deploy e exposição de dados**.

---

## 🔴 CRÍTICO — corrigir antes de qualquer uso real

### C1. Credenciais padrão embutidas no código-fonte
- **Onde:** [server/database/db.ts:426](../server/database/db.ts#L426) (`Admin@2025`) e [db.ts:483](../server/database/db.ts#L483) (`Func@2025`).
- **Risco:** qualquer pessoa que veja o repositório sabe o login do admin. Se o banco foi semeado e a senha não foi trocada, é takeover total.
- **Correção:**
  1. Troque a senha do admin **agora** (tela de perfil ou `/api/auth/resetar-senha`).
  2. Remova os usuários de exemplo (`ana.mendes`, `carlos.santos`) em produção — extraia `seedDadosExemplo` para rodar só em dev (`if (process.env.NODE_ENV !== 'production')`).
  3. Gere a senha do admin de uma env var na primeira inicialização, não um literal.

### C2. Keycloak/Postgres com senha padrão e portas expostas
- **Onde:** [docker-compose.yml:11,31](../docker-compose.yml#L11) — `KC_DB_PASSWORD:-keycloak_secret`, `KEYCLOAK_ADMIN_PASSWORD:-admin`, e `ports: 8080:8080` / `5432` no postgres.
- **Risco:** se a EC2 expõe a 8080, o console admin do Keycloak pode estar em `admin/admin` → controle de toda a identidade. Postgres com senha conhecida.
- **Correção:** defina `KC_ADMIN_PASSWORD`, `KC_DB_PASSWORD` fortes no `.env` (sem default). **Não publique** 8080/5432 — coloque o Keycloak atrás do Nginx (`/auth`) ou restrinja por Security Group.

### C3. API (porta 3001) exposta diretamente, furando o Nginx
- **Onde:** [docker-compose.yml:52](../docker-compose.yml#L52) `ports: 3001:3001`.
- **Risco:** acesso direto à API sem TLS e — combinado com `trust proxy 1` ([server/index.ts:35](../server/index.ts#L35)) — permite **forjar `X-Forwarded-For`** e zerar o rate limit de login (força bruta).
- **Correção:** remova `ports: 3001:3001` (deixe a API só na rede interna do Docker; o Nginx fala com ela via `dnl_net`). No EC2/Security Group, libere apenas 80 e 443.

### C4. Sem HTTPS — tudo em texto claro
- **Onde:** [nginx.conf:2](../nginx.conf#L2) só `listen 80`; [setup-ec2.sh](../setup-ec2.sh) não configura TLS.
- **Risco:** o JWT (válido por 8h) e as senhas trafegam sem criptografia. Captura na rede = sessão roubada.
- **Correção:** Certbot (`certbot --nginx`) ou ALB+ACM. Redirecione 80→443 e adicione HSTS.

---

## 🟠 ALTO

### A1. Rate limit frágil e contornável
- **Onde:** [server/routes/auth.ts:11-25](../server/routes/auth.ts#L11) — em memória, por IP.
- **Risco:** zera a cada restart do PM2; some em múltiplas instâncias; e é burlável via XFF se a 3001 estiver exposta (ver C3). 10 tentativas/15min ainda permite brute force lento.
- **Correção:** após fechar a 3001 (C3), o XFF deixa de ser problema. Considere bloqueio progressivo por conta (não só por IP) e persistência (ex.: tabela ou Redis).

---

## 🟡 MÉDIO

### M1. Exposição excessiva de PII (CPF) a qualquer usuário logado
- **Onde:** [server/routes/usuarios.ts:8-14](../server/routes/usuarios.ts#L8) — `GET /api/usuarios` devolve `cpf`, `telefone`, `email` de **todos**.
- **Risco:** um `funcionario` comum lê o CPF de todos os colegas (dado sensível sob a LGPD).
- **Correção:** nesse endpoint "para dropdowns", retorne só `id, nome, cargo, role`. Deixe `cpf/telefone` apenas em `/todos` (admin/rh).

### M2. Mensagens de erro vazam detalhes internos
- **Onde:** praticamente todas as rotas (`catch ... res.status(500).json({ error: err.message })`) e [server/index.ts:101](../server/index.ts#L101).
- **Risco:** erros de SQL, caminhos de arquivo e stack chegam ao cliente — ajuda no recon do atacante.
- **Correção:** logue `err` no servidor, mas devolva mensagem genérica ("Erro interno") em 500. Mantenha mensagens específicas só para 4xx de validação.

### M3. Faltam Content-Security-Policy e HSTS
- **Onde:** [server/index.ts:38-45](../server/index.ts#L38) — bons headers, mas sem CSP nem HSTS.
- **Risco:** sem CSP, um eventual XSS tem alcance total; sem HSTS, downgrade para HTTP.
- **Correção:** adicione `helmet` ou defina manualmente `Content-Security-Policy` (restritiva, sem `unsafe-inline` se possível) e `Strict-Transport-Security` (após TLS). `X-XSS-Protection` está obsoleto — pode remover.

### M4. JWT sem revogação
- **Onde:** [server/routes/auth.ts:54-58](../server/routes/auth.ts#L54) — token de 8h, stateless.
- **Risco:** desativar um usuário não invalida o token até expirar (o middleware checa `ativo=1` no banco a cada request — isso *mitiga* bastante, bom!). Ainda assim, não há logout server-side.
- **Correção:** o check de `ativo` já cobre o pior caso. Se quiser logout real, mantenha uma denylist de `jti` ou reduza a expiração + refresh token.

---

## 🔵 BAIXO / Higiene

- **B1.** Verifique a força do `JWT_SECRET` em produção (mínimo 64 chars aleatórios). Se vazar, todos os tokens são forjáveis. Gere com `openssl rand -base64 48`.
- **B2.** `app.get('*')` + `express.static` ([index.ts:86](../server/index.ts#L86)) servem o frontend; confirme que não há arquivos sensíveis em `dist/` (ex.: `.map` com código-fonte).
- **B3.** Rode `npm audit` e atualize dependências regularmente (CI).
- **B4.** Garanta que `.env` está no `.gitignore` (está) e que `DB_PATH` (`/data`) tem permissão restrita no host.
- **B5.** `client_max_body_size 20M` (Nginx) vs `limit: '10mb'` (Express) — alinhe e mantenha baixo para limitar DoS por payload.

---

## Como testar (caixa-preta, ao vivo)

```bash
# Sem login (testa TLS, headers, portas, creds padrão, rate limit, CORS, auth, JWT):
node security/pentest.mjs http://SEU-IP-OU-DOMINIO

# Com login (adiciona teste de exposição de PII) — use a senha JÁ TROCADA:
node security/pentest.mjs https://app.dnl.com.br admin@dnlprojetos.com 'SuaSenhaForte'
```

Saída com contagem por severidade; sai com código 2 se houver crítico/alto.

## Checklist de hardening na AWS

- [ ] Security Group: liberar **apenas 80 e 443** ao público; 22 restrito ao seu IP. **Bloquear 3001, 8080, 5432.**
- [ ] Trocar senha do admin e remover usuários de exemplo.
- [ ] `JWT_SECRET`, `KC_ADMIN_PASSWORD`, `KC_DB_PASSWORD` fortes e únicos no `.env`.
- [ ] HTTPS com redirect 80→443 + HSTS.
- [ ] `NODE_ENV=production` e seed de exemplo desativado.
- [ ] Backups do SQLite (`/data`) com criptografia em repouso (EBS encryption).
- [ ] CloudWatch/logs de acesso + alerta em picos de 401/429.
