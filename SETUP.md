# 🚀 Guia de Setup Rápido - Tampinha

## Pré-requisitos

- Docker e Docker Compose instalados
- Conta no WhatsApp Business API
- Bot do Telegram criado via @BotFather
- Domínio público com SSL (para webhooks)

## 1. Configuração Inicial

```bash
# Clonar repositório
git clone <repository-url>
cd tampinha

# Copiar arquivo de configuração
cp env.example .env
```

## 2. Configurar WhatsApp Business API

### Obter Credenciais
1. Acesse [Facebook Developers](https://developers.facebook.com/)
2. Crie uma aplicação WhatsApp Business
3. Obtenha o `ACCESS_TOKEN` e `PHONE_NUMBER_ID`

### Configurar no .env
```env
WHATSAPP_API_TOKEN=seu_token_aqui
WHATSAPP_PHONE_NUMBER_ID=seu_phone_id_aqui
WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu_verify_token_unico
WHATSAPP_WEBHOOK_SECRET=seu_webhook_secret_seguro
```

## 3. Configurar Telegram Bot

### Criar Bot
1. Abra o Telegram e procure por @BotFather
2. Envie `/newbot` e siga as instruções
3. Escolha um nome e username para o bot
4. Anote o `BOT_TOKEN` fornecido

### Configurar no .env
```env
TELEGRAM_BOT_TOKEN=seu_bot_token_aqui
TELEGRAM_WEBHOOK_SECRET=seu_webhook_secret_seguro
```

## 4. Configurar Outras Variáveis

```env
# Banco de dados
DATABASE_URL=postgresql://tampinha:password123@postgres:5432/tampinha_db

# Redis
REDIS_URL=redis://redis:6379

# Segurança
JWT_SECRET=sua_chave_secreta_jwt_super_segura
QR_CODE_SECRET=sua_chave_secreta_qr_code
```

## 5. Executar com Docker

```bash
# Iniciar todos os serviços
docker-compose up -d

# Verificar se está rodando
docker-compose ps

# Ver logs
docker-compose logs -f app
```

## 6. Executar Migrações

```bash
# Executar migrações do banco
docker-compose exec app npm run migrate

# Verificar se as tabelas foram criadas
docker-compose exec postgres psql -U tampinha -d tampinha_db -c '\dt'
```

## 7. Configurar Webhooks

### WhatsApp Webhook
```bash
# Configurar webhook no Facebook Developers
# URL: https://seudominio.com/api/whatsapp/webhook
# Verify Token: o mesmo que definiu no .env

# Ou via API:
curl -X POST "https://graph.facebook.com/v18.0/SEU_PHONE_ID/subscribed_apps" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"
```

### Telegram Webhook
```bash
# Fazer login na API para obter JWT
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Configurar webhook (use o JWT obtido)
curl -X POST http://localhost:3000/api/telegram/set-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -d '{"webhookUrl": "https://seudominio.com/api/telegram/webhook"}'
```

## 8. Testar Sistema

### Teste WhatsApp
1. Adicione o número do WhatsApp Business nos contatos
2. Envie uma mensagem para o número
3. Envie uma foto com QR code
4. Verifique se recebeu resposta

### Teste Telegram
1. Procure pelo bot no Telegram
2. Envie `/start`
3. Envie uma foto com QR code
4. Use `/menu` para ver as opções

## 9. Criar Primeiro Bar

```bash
# Fazer login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Gerar QR code para bar
curl -X POST http://localhost:3000/api/qr-codes/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -d '{
    "barName": "Bar do João",
    "barId": "bar001",
    "pointsValue": 1,
    "expiryHours": 24
  }'
```

## 10. Monitoramento

### Health Check
```bash
curl http://localhost:3000/health
```

### Logs
```bash
# Logs da aplicação
docker-compose logs -f app

# Logs do banco
docker-compose logs -f postgres

# Logs do Redis
docker-compose logs -f redis
```

### Métricas
```bash
# Verificar usuários cadastrados
docker-compose exec postgres psql -U tampinha -d tampinha_db -c "SELECT COUNT(*) FROM users;"

# Verificar QR codes escaneados
docker-compose exec postgres psql -U tampinha -d tampinha_db -c "SELECT COUNT(*) FROM scans;"

# Verificar recompensas geradas
docker-compose exec postgres psql -U tampinha -d tampinha_db -c "SELECT COUNT(*) FROM rewards;"
```

## 11. Configuração de Produção

### SSL/TLS
```bash
# Usar certbot para SSL gratuito
certbot --nginx -d seudominio.com
```

### Backup
```bash
# Backup do banco
docker-compose exec postgres pg_dump -U tampinha tampinha_db > backup.sql

# Backup dos dados do Redis
docker-compose exec redis redis-cli BGSAVE
```

### Monitoramento
```bash
# Configurar alertas para:
# - Uso de CPU/Memória
# - Conexões de banco
# - Erros de webhook
# - Rate limiting atingido
```

## 🔧 Comandos Úteis

```bash
# Reiniciar aplicação
docker-compose restart app

# Limpar cache Redis
docker-compose exec redis redis-cli FLUSHALL

# Ver configurações do Telegram
docker-compose exec app curl -X GET "https://api.telegram.org/botSEU_BOT_TOKEN/getWebhookInfo"

# Deletar webhook Telegram
docker-compose exec app curl -X POST "https://api.telegram.org/botSEU_BOT_TOKEN/deleteWebhook"

# Backup completo
docker-compose exec postgres pg_dump -U tampinha tampinha_db | gzip > tampinha_backup_$(date +%Y%m%d).sql.gz
```

## 🚨 Troubleshooting

### Problemas Comuns

1. **Webhook não recebe mensagens**
   - Verificar se o domínio tem SSL válido
   - Verificar se a porta está aberta
   - Verificar logs da aplicação

2. **Banco não conecta**
   - Verificar se o container PostgreSQL está rodando
   - Verificar credenciais no .env
   - Verificar rede do Docker

3. **Redis não conecta**
   - Verificar se o container Redis está rodando
   - Verificar configurações de rede
   - Verificar logs do Redis

4. **QR code não é detectado**
   - Verificar se a imagem tem boa qualidade
   - Verificar logs de processamento
   - Testar com diferentes tipos de QR code

## ✅ Sistema Pronto!

Se tudo funcionou corretamente, você deve ter:
- ✅ WhatsApp respondendo a mensagens
- ✅ Telegram bot funcionando
- ✅ QR codes sendo processados
- ✅ Pontos sendo acumulados
- ✅ Recompensas sendo geradas
- ✅ API endpoints funcionando

Agora o Tampinha está pronto para usar! 🍺 