#!/bin/bash
set -e

echo "==> Git pull..."
cd /home/ubuntu/dnl-projetos
git fetch origin
git reset --hard origin/master

echo "==> Sincronizando arquivos..."
cp -r /home/ubuntu/dnl-projetos/dnl-projetos/src /home/ubuntu/dnl-projetos/
cp -r /home/ubuntu/dnl-projetos/dnl-projetos/server /home/ubuntu/dnl-projetos/
cp -r /home/ubuntu/dnl-projetos/dnl-projetos/shared /home/ubuntu/dnl-projetos/

echo "==> Instalando dependências..."
npm install --omit=dev 2>/dev/null || npm install

echo "==> Build..."
npm run build

echo "==> Reiniciando servidor..."
pm2 restart dnl-projetos

echo "==> Deploy concluído!"
pm2 status
