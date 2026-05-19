#!/bin/bash
# =============================================================================
# setup-ec2.sh — Configuração inicial da EC2 (rodar UMA VEZ após criar a VM)
# Ubuntu 22.04 LTS
# =============================================================================
set -e

echo "=== [1/7] Atualizando sistema ==="
sudo apt-get update -y && sudo apt-get upgrade -y

echo "=== [2/7] Instalando Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== [3/7] Instalando PM2 e dependências ==="
sudo npm install -g pm2
sudo apt-get install -y git nginx

echo "=== [4/7] Criando diretório persistente para o banco ==="
sudo mkdir -p /data
sudo chown $USER:$USER /data

echo "=== [5/7] Clonando o repositório ==="
# Substitua pela URL do seu repositório GitHub
read -p "URL do repositório GitHub (ex: https://github.com/usuario/dnl-projetos.git): " REPO_URL
git clone "$REPO_URL" /home/ubuntu/dnl-projetos
cd /home/ubuntu/dnl-projetos

echo "=== [6/7] Configurando variáveis de ambiente ==="
echo ""
echo "Preencha as variáveis abaixo:"
read -p "JWT_SECRET (string longa e aleatória): " JWT_SECRET
read -p "IP ou domínio público da EC2 (ex: http://1.2.3.4 ou https://seudominio.com): " PUBLIC_URL

cat > .env << EOF
PORT=3001
DB_PATH=/data/dnl-projetos.db
CORS_ORIGINS=$PUBLIC_URL
JWT_SECRET=$JWT_SECRET
NODE_ENV=production
EOF

echo "=== [7/7] Build e inicialização ==="
npm install
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup | tail -1 | sudo bash

echo "=== Configurando Nginx ==="
sudo cp nginx.conf /etc/nginx/sites-available/dnl-projetos
sudo ln -sf /etc/nginx/sites-available/dnl-projetos /etc/nginx/sites-enabled/dnl-projetos
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "============================================"
echo "  Deploy concluído!"
echo "  Acesse: $PUBLIC_URL"
echo "  Login:  admin@dnlprojetos.com / Admin@2025"
echo "  TROQUE A SENHA IMEDIATAMENTE!"
echo "============================================"
