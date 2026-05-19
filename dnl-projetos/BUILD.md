# Como gerar o instalador `.exe` (Windows)

Este guia explica como empacotar o app DNL Projetos num instalador `.exe` que pode ser distribuído pros funcionários — eles dão dois cliques e instala, **sem precisar de Node.js, Python ou Build Tools**.

---

## 📋 Pré-requisitos (apenas na máquina que vai fazer o build)

Você precisa ter rodado `npm install` com sucesso e o app rodando com `npm run electron:dev`. Se isso já funciona, tem tudo o que precisa.

---

## 🚀 Gerando o instalador

Na pasta do projeto, abra o **Prompt de Comando** e rode:

```cmd
npm run electron:build
```

Vai demorar **5 a 10 minutos**. O processo inclui:

1. Compila TypeScript → JavaScript
2. Compila React → bundle de produção
3. Compila Electron main + preload
4. Recompila better-sqlite3 pro Electron
5. Empacota tudo dentro de um `.exe` único
6. Cria o instalador NSIS com setup wizard

---

## 📂 Resultado

Quando terminar, vai aparecer uma pasta `release/` na raiz do projeto:

```
release/
├── DNL-Projetos-Setup-0.4.0.exe   ← INSTALADOR (este é o que você distribui!)
├── win-unpacked/                    ← versão portátil (sem instalar)
│   └── DNL Projetos.exe             ← pode rodar daqui também
├── builder-debug.yml
├── builder-effective-config.yaml
└── latest.yml
```

### O instalador (`DNL-Projetos-Setup-0.4.0.exe`)

- Tamanho aproximado: **80–120 MB**
- Funciona em Windows 10/11 (64 bits)
- Cria atalho na área de trabalho e no menu iniciar
- Permite escolher pasta de instalação (padrão: `C:\Program Files\DNL Projetos\`)
- Possui desinstalador

### Para funcionários

Distribua só o arquivo `DNL-Projetos-Setup-0.4.0.exe` por:
- Pen drive
- Pasta compartilhada na rede
- Email (se < 25 MB; provavelmente vai precisar de outro meio)
- Google Drive / Dropbox / WeTransfer
- Servidor interno

Eles dão **dois cliques no arquivo**, seguem o wizard, e o app aparece no menu iniciar.

---

## 🎯 Versão portátil (sem instalar)

Se você quiser uma versão que rode direto sem instalar, use:

```cmd
npm run electron:build:portable
```

Vai gerar `release/DNL-Projetos-Portable-0.4.0.exe` — um único `.exe` que roda direto, sem precisar instalar. Útil para testes ou usuários que não têm permissão de admin no Windows.

---

## ⚠️ Avisos do Windows na primeira execução

Como o `.exe` não está assinado digitalmente, o Windows pode mostrar:

> **Windows protegeu seu computador**
> O Microsoft Defender SmartScreen impediu...

Para rodar mesmo assim:
1. Clique em **"Mais informações"**
2. Clique em **"Executar mesmo assim"**

Isso é normal para softwares internos não publicados na Microsoft Store. Para **eliminar esse aviso**, seria necessário comprar um **certificado de assinatura de código** (~R$ 1.500 a R$ 3.000/ano de uma CA tipo Sectigo, DigiCert, etc.). Para uso interno, geralmente não vale a pena.

---

## 🐛 Problemas comuns

### "better-sqlite3 not built for this version of Node"

Reconstrua manualmente antes do build:

```cmd
npx electron-rebuild -f -w better-sqlite3
npm run electron:build
```

### O instalador não criou atalhos

Confirme que está usando o instalador (`Setup`) e não a versão portátil. Atalhos só são criados pelo NSIS.

### Antivírus apaga o `.exe`

Alguns antivírus (especialmente Avast, Kaspersky, AVG) marcam executáveis Electron não assinados como suspeitos. Soluções:
- Adicione a pasta `release/` como exceção do antivírus
- Ou compre certificado de assinatura

### Tela branca ao abrir

Aperte **Ctrl+Shift+I** dentro do app pra abrir DevTools e ver o erro. Geralmente é o better-sqlite3 não recompilado corretamente — rode `npx electron-rebuild` e empacote de novo.

---

## 🔄 Atualização do app

Cada vez que você quiser distribuir uma nova versão:

1. Mude a versão no `package.json` (ex: `0.4.0` → `0.4.1`)
2. Rode `npm run electron:build`
3. Distribua o novo `DNL-Projetos-Setup-0.4.1.exe`

Os funcionários instalam por cima — o NSIS detecta versão antiga e atualiza. **O banco de dados deles em `%APPDATA%\dnl-projetos\dnl-projetos.db` não é apagado** na atualização.

---

## 📦 Auto-update (opcional, mais complexo)

Se quiser que o app se atualize sozinho ao detectar nova versão online, é necessário:

1. Servidor web pra hospedar os arquivos `.exe` + `latest.yml`
2. Adicionar `electron-updater` no package.json
3. Configurar `publish` no `build` do package.json
4. Lógica de check de update no main.ts

Não está implementado. Se quiser, posso adicionar.

---

**Resumo prático:** rode `npm run electron:build`, espera 5-10 min, pega o `.exe` da pasta `release/`, distribui pros funcionários.
