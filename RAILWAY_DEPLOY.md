# 🚂 Deploy no Railway - Tampinha

## 🚀 Deploy Automático

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/tampinha)

## 📋 Passo a Passo

### 1. **Preparação (Já feito!)**
- ✅ `railway.json` configurado
- ✅ `Dockerfile.railway` otimizado
- ✅ `.railwayignore` criado
- ✅ Scripts de produção adicionados

### 2. **Deploy no Railway**

1. **Acesse:** https://railway.app
2. **Login com GitHub**
3. **"New Project" → "Deploy from GitHub repo"**
4. **Selecione:** repositório `tampinha`
5. **Railway detecta automaticamente** o Dockerfile

### 3. **Adicionar Banco de Dados**

No painel do Railway:

1. **PostgreSQL:**
   - Clique em **"+ New"**
   - Selecione **"Database"**
   - Escolha **"Add PostgreSQL"**

2. **Redis:**
   - Clique em **"+ New"**
   - Selecione **"Database"**
   - Escolha **"Add Redis"**

### 4. **Configurar Variáveis de Ambiente**

No painel **Variables**, adicione:

```env
# Aplicação
NODE_ENV=production
PORT=3000
JWT_SECRET=tampinha_super_secret_jwt_2024_railway
QR_CODE_SECRET=tampinha_qr_secret_2024_railway

# Telegram Bot
TELEGRAM_BOT_TOKEN=7785303759:AAEfOOOmRaic0Jbf_wHbcsZ3ZvCJRK2eGjo
TELEGRAM_WEBHOOK_SECRET=tampinha_webhook_secret_123

# Regras de Negócio
POINTS_PER_SCAN=1
POINTS_FOR_REWARD=10
REWARD_CODE_EXPIRY_DAYS=30

# WhatsApp (opcional, configurar depois)
WHATSAPP_API_TOKEN=your-token-here
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=verify-token
WHATSAPP_WEBHOOK_SECRET=webhook-secret

# Logs
LOG_LEVEL=info
```

**Observação:** As variáveis `DATABASE_URL` e `REDIS_URL` são criadas automaticamente pelo Railway.

### 5. **Configurar Webhook do Telegram**

Após o deploy, você terá uma URL como:
```
https://tampinha-production-xxxx.up.railway.app
```

Configure o webhook:
```bash
curl -X POST "https://api.telegram.org/bot7785303759:AAEfOOOmRaic0Jbf_wHbcsZ3ZvCJRK2eGjo/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://SUA_URL_RAILWAY.up.railway.app/api/telegram/webhook",
    "secret_token": "tampinha_webhook_secret_123"
  }'
```

### 6. **Verificar Deploy**

1. **Health Check:**
   ```bash
   curl https://SUA_URL_RAILWAY.up.railway.app/health
   ```

2. **Logs no Railway:**
   - Vá para **"Deployments"**
   - Clique no deploy mais recente
   - Veja os **"Logs"**

3. **Testar Telegram:**
   - Procure seu bot no Telegram
   - Envie `/start`
   - Envie uma foto com QR code

## 🔧 Comandos Úteis

### **Configurar Webhook (Substitua SUA_URL_RAILWAY)**
```bash
# Configurar
curl -X POST "https://api.telegram.org/bot7785303759:AAEfOOOmRaic0Jbf_wHbcsZ3ZvCJRK2eGjo/setWebhook" \
  -d '{"url": "https://SUA_URL_RAILWAY.up.railway.app/api/telegram/webhook", "secret_token": "tampinha_webhook_secret_123"}'

# Verificar
curl "https://api.telegram.org/bot7785303759:AAEfOOOmRaic0Jbf_wHbcsZ3ZvCJRK2eGjo/getWebhookInfo"

# Deletar (se necessário)
curl -X POST "https://api.telegram.org/bot7785303759:AAEfOOOmRaic0Jbf_wHbcsZ3ZvCJRK2eGjo/deleteWebhook"
```

### **Testar API**
```bash
# Health check
curl https://SUA_URL_RAILWAY.up.railway.app/health

# Login (usuário padrão: admin/admin123)
curl -X POST https://SUA_URL_RAILWAY.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

## 🎯 **Próximos Passos Após Deploy**

1. ✅ **Verificar logs** no Railway
2. ✅ **Configurar webhook** do Telegram
3. ✅ **Testar bot** no Telegram
4. ✅ **Gerar primeiro QR code** via API
5. ✅ **Testar fluxo completo** de pontos

## 🚨 **Troubleshooting**

### **Build falha:**
- Verificar logs no Railway
- Verificar se todas as dependências estão no `package.json`

### **App não inicia:**
- Verificar variáveis de ambiente
- Verificar se PostgreSQL e Redis estão conectados

### **Webhook não funciona:**
- Verificar se URL está correta
- Verificar se `TELEGRAM_BOT_TOKEN` está correto
- Verificar logs da aplicação

### **Banco não conecta:**
- Railway gera `DATABASE_URL` automaticamente
- Verificar se PostgreSQL foi adicionado ao projeto

## 🎉 **Deploy Concluído!**

Seu sistema Tampinha estará rodando em:
- 🌐 **URL:** `https://tampinha-production-xxxx.up.railway.app`
- 🤖 **Bot:** Funcionando no Telegram
- 📊 **Banco:** PostgreSQL + Redis no Railway
- 🔄 **CI/CD:** Deploy automático via GitHub

Agora é só testar e usar! 🍺 