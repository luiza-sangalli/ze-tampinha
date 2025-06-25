# 🍺 Tampinha - Sistema de Fidelidade Escalável

Sistema de fidelidade que suporta milhões de usuários, integrado com **WhatsApp Business API** e **Telegram Bot API**, onde usuários escaneiam QR codes para ganhar pontos e trocar por cervejas grátis.

## 🚀 Funcionalidades

- **Múltiplas Plataformas**: Suporte completo para WhatsApp e Telegram
- **QR Code Scanning**: Processamento de imagens e decodificação de QR codes
- **Sistema de Pontos**: 1 ponto por scan, 10 pontos = 1 cerveja grátis
- **Códigos de Recompensa**: Códigos únicos para troca nos bares
- **Escalabilidade**: Suporta milhões de usuários com Redis e PostgreSQL
- **Segurança**: Autenticação JWT, rate limiting, validação de dados

## 📋 Pré-requisitos

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (opcional)
- WhatsApp Business API Token

## 🛠️ Configuração

### 1. Clonar repositório
```bash
git clone <repository-url>
cd tampinha
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
```bash
cp env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-here

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/tampinha_db

# Redis Configuration
REDIS_URL=redis://localhost:6379

# WhatsApp Business API Configuration
WHATSAPP_API_TOKEN=your-whatsapp-business-api-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-webhook-verify-token
WHATSAPP_WEBHOOK_SECRET=your-webhook-secret

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_WEBHOOK_SECRET=your-telegram-webhook-secret

# QR Code Configuration
QR_CODE_SECRET=your-qr-code-encryption-secret
```

### 4. Executar migrações
```bash
npm run migrate
```

### 5. Iniciar servidor
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## 🐳 Deploy com Docker

### Desenvolvimento
```bash
docker-compose up -d
```

### Produção
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 📱 Como Usar

### Para Usuários (WhatsApp)

1. **Enviar foto do QR code** para o número do WhatsApp Business
2. **Ganhar pontos** automaticamente (1 ponto por scan)
3. **Receber código de troca** ao atingir 10 pontos
4. **Apresentar código no bar** para trocar por cerveja

### Para Usuários (Telegram)

1. **Procurar o bot** (@tampinha_bot) no Telegram
2. **Enviar** `/start` para começar
3. **Enviar foto do QR code** para ganhar pontos
4. **Usar** `/menu` para ver opções
5. **Receber código de troca** ao atingir 10 pontos

### Comandos WhatsApp

- `pontos` - Ver pontos atuais
- `historico` - Ver últimos scans
- `recompensas` - Ver códigos ativos
- `ranking` - Ver top 10 usuários
- `ajuda` - Ver comandos disponíveis

### Comandos Telegram

- `/start` - Iniciar bot e receber boas-vindas
- `/pontos` - Ver pontos atuais
- `/menu` - Menu principal com botões
- **Enviar foto** - Escanear QR code automaticamente

### Para Bares (API)

#### Autenticação
```bash
POST /api/auth/login
{
  "username": "bar_owner",
  "password": "bar123"
}
```

#### Gerar QR Code
```bash
POST /api/qrcode/generate
Authorization: Bearer <token>
{
  "barName": "Bar do João",
  "barId": "bar001",
  "pointsValue": 1,
  "expiryHours": 24
}
```

#### Validar Código de Recompensa
```bash
POST /api/qrcode/validate-reward
Authorization: Bearer <token>
{
  "rewardCode": "ABC12345"
}
```

#### Resgatar Código de Recompensa
```bash
POST /api/qrcode/redeem-reward
Authorization: Bearer <token>
{
  "rewardCode": "ABC12345",
  "barName": "Bar do João",
  "barId": "bar001"
}
```

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WhatsApp      │    │   Fastify API   │    │   PostgreSQL    │
│   Users         │◄──►│   + Redis       │◄──►│   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   QR Code       │
                       │   Generation    │
                       └─────────────────┘
```

### Componentes Principais

1. **WhatsApp Service**: Gerencia comunicação com WhatsApp Business API
2. **QR Code Service**: Gera, valida e processa QR codes
3. **User Service**: Gerencia usuários e cache
4. **Database**: PostgreSQL com índices otimizados
5. **Cache**: Redis para alta performance
6. **Load Balancer**: Nginx para distribuição de carga

## 📊 Banco de Dados

### Tabelas Principais

- `users` - Usuários cadastrados
- `qr_codes` - QR codes gerados pelos bares
- `scans` - Histórico de scans realizados
- `rewards` - Códigos de recompensa gerados

### Índices para Performance

- Índices em campos de busca frequente
- Índices compostos para queries complexas
- Prevenção de duplicatas com índices únicos

## 🔐 Segurança

- **JWT Authentication** para API
- **Rate Limiting** por IP
- **Webhook Signature Verification**
- **Input Validation** com Joi
- **SQL Injection Protection**
- **XSS Protection Headers**

## 📈 Escalabilidade

### Otimizações Implementadas

1. **Connection Pooling** - PostgreSQL com pool de conexões
2. **Redis Caching** - Cache de usuários e QR codes
3. **Database Indexing** - Índices otimizados
4. **Rate Limiting** - Proteção contra spam
5. **Load Balancing** - Nginx com múltiplas instâncias
6. **Horizontal Scaling** - Docker Compose configurado

### Para Milhões de Usuários

```bash
# Escalar horizontalmente
docker-compose scale app=5

# Configurar database clustering
# Implementar sharding por região
# Usar CDN para imagens QR code
# Implementar queue system para processamento assíncrono
```

## 🧪 Testes

```bash
# Executar testes
npm test

# Executar com coverage
npm run test:coverage
```

## 📝 API Endpoints

### WhatsApp Webhook
- `GET /api/whatsapp/webhook` - Verificação do webhook
- `POST /api/whatsapp/webhook` - Receber mensagens

### QR Codes
- `POST /api/qrcode/generate` - Gerar QR code
- `GET /api/qrcode/bar/:barId` - Listar QR codes do bar
- `POST /api/qrcode/validate-reward` - Validar código de recompensa
- `POST /api/qrcode/redeem-reward` - Resgatar recompensa

### Usuários
- `GET /api/users/phone/:phone` - Buscar usuário por telefone
- `GET /api/users/:userId/stats` - Estatísticas do usuário
- `GET /api/users/leaderboard` - Ranking de usuários

### Estatísticas
- `GET /api/points/system-stats` - Estatísticas do sistema
- `GET /api/rewards/all` - Todas as recompensas

## 🚨 Monitoramento

### Health Check
```bash
GET /health
```

### Logs
- Logs estruturados com Winston
- Diferentes níveis por ambiente
- Logs de erro detalhados

### Métricas
- Total de usuários ativos
- Scans por período
- Recompensas geradas/resgatadas
- Performance de API

## 🔧 Troubleshooting

### Problemas Comuns

1. **WhatsApp webhook não funciona**
   - Verificar token de verificação
   - Confirmar URL pública acessível
   - Validar assinatura do webhook

2. **QR code não é detectado**
   - Verificar qualidade da imagem
   - Confirmar formato do QR code
   - Verificar logs de processamento

3. **Performance lenta**
   - Verificar conexões de database
   - Monitorar uso de Redis
   - Analisar queries lentas

## 📞 Suporte

Para dúvidas e suporte:
- Email: suporte@tampinha.com
- WhatsApp: +55 11 99999-9999

## 📄 Licença

MIT License - veja arquivo LICENSE para detalhes.

---

🍺 **Tampinha** - Transformando cada scan em uma nova experiência! 