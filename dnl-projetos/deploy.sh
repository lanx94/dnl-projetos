#!/bin/bash
# =============================================================================
# deploy.sh — Atualizar o sistema após mudanças no código
# Rodar dentro da EC2: bash deploy.sh
# =============================================================================
set -e

cd /home/ubuntu/dnl-projetos

echo "=== Baixando atualizações ==="
git pull origin main

echo "=== Instalando dependências ==="
npm install --production=false

echo "=== Build ==="
npm run build

echo "=== Reiniciando serviço ==="
pm2 restart dnl-projetos

echo ""
echo "Deploy concluído! $(date)"
pm2 status
