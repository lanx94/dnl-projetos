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
read -p "Domínio (ex: dnlusucapiao.com.br): " DOMAIN
read -p "Email para o certificado Let's Encrypt: " LE_EMAIL

# Gera um JWT_SECRET forte automaticamente (não depende de digitação manual).
JWT_SECRET=$(openssl rand -base64 48)

cat > .env << EOF
PORT=3001
DB_PATH=/data/dnl-projetos.db
CORS_ORIGINS=https://$DOMAIN
JWT_SECRET=$JWT_SECRET
NODE_ENV=production
EOF

echo "=== [7/7] Build e inicialização ==="
npm install
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup | tail -1 | sudo bash

echo "=== Configurando Nginx + HTTPS (Let's Encrypt) ==="
sudo rm -f /etc/nginx/sites-enabled/default

# 1) Sobe um Nginx mínimo só na porta 80 para o desafio ACME do Certbot.
#    (O nginx.conf final referencia certificados que ainda não existem, então
#     não pode ser ativado antes da emissão.)
sudo mkdir -p /var/www/html
sudo tee /etc/nginx/sites-available/dnl-acme > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 404; }
}
EOF
sudo ln -sf /etc/nginx/sites-available/dnl-acme /etc/nginx/sites-enabled/dnl-acme
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

# 2) Instala o Certbot e emite o certificado (modo webroot, sem parar o Nginx).
sudo apt-get install -y certbot
sudo certbot certonly --webroot -w /var/www/html \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --email "$LE_EMAIL" --agree-tos --non-interactive

# 3) Agora que o certificado existe, ativa o config HTTPS definitivo.
sudo sed -i "s/dnlusucapiao\.com\.br/$DOMAIN/g" nginx.conf
sudo cp nginx.conf /etc/nginx/sites-available/dnl-projetos
sudo rm -f /etc/nginx/sites-enabled/dnl-acme
sudo ln -sf /etc/nginx/sites-available/dnl-projetos /etc/nginx/sites-enabled/dnl-projetos
sudo nginx -t && sudo systemctl restart nginx

# 4) Renovação automática: o Certbot já instala um timer systemd. Garante o reload do Nginx.
echo "Certbot renova o certificado automaticamente (timer systemd). Teste: sudo certbot renew --dry-run"

echo ""
echo "============================================"
echo "  Deploy concluído!"
echo "  Acesse: https://$DOMAIN"
echo "  Login:  admin@dnlprojetos.com"
echo "  >> Troque a senha do admin IMEDIATAMENTE no primeiro acesso. <<"
echo "============================================"
