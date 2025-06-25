const crypto = require('crypto');
const WhatsAppService = require('../services/whatsappService');
const UserService = require('../services/userService');
const QRCodeService = require('../services/qrCodeService');

async function whatsappRoutes(fastify, options) {
  const whatsappService = new WhatsAppService();
  const userService = new UserService(fastify.db, fastify.redis);
  const qrCodeService = new QRCodeService(fastify.db, fastify.redis);

  // Webhook verification (GET)
  fastify.get('/webhook', async (request, reply) => {
    const mode = request.query['hub.mode'];
    const token = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      fastify.log.info('WhatsApp webhook verified successfully');
      return reply.code(200).send(challenge);
    } else {
      fastify.log.error('WhatsApp webhook verification failed');
      return reply.code(403).send('Forbidden');
    }
  });

  // Webhook for receiving messages (POST)
  fastify.post('/webhook', {
    preHandler: async (request, reply) => {
      // Verify webhook signature
      const signature = request.headers['x-hub-signature-256'];
      const payload = JSON.stringify(request.body);
      
      if (process.env.WHATSAPP_WEBHOOK_SECRET) {
        const expectedSignature = 'sha256=' + crypto
          .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET)
          .update(payload)
          .digest('hex');

        if (signature !== expectedSignature) {
          fastify.log.error('Invalid webhook signature');
          return reply.code(403).send('Forbidden');
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = request.body;

      // Process incoming webhook
      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.field === 'messages') {
              await processMessage(change.value, whatsappService, userService, qrCodeService, fastify);
            }
          }
        }
      }

      return reply.code(200).send('OK');
    } catch (error) {
      fastify.log.error('Error processing WhatsApp webhook:', error);
      return reply.code(500).send('Internal Server Error');
    }
  });

  // Endpoint to send test message (for development)
  fastify.post('/send-test', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { to, message } = request.body;
      
      if (!to || !message) {
        return reply.code(400).send({ error: 'Missing required fields: to, message' });
      }

      const result = await whatsappService.sendMessage(to, message);
      return reply.send({ success: true, result });
    } catch (error) {
      fastify.log.error('Error sending test message:', error);
      return reply.code(500).send({ error: 'Failed to send message' });
    }
  });
}

// Process incoming WhatsApp messages
async function processMessage(messageData, whatsappService, userService, qrCodeService, fastify) {
  try {
    const messages = messageData.messages;
    if (!messages || messages.length === 0) return;

    for (const message of messages) {
      const fromPhone = message.from;
      const messageType = message.type;

      fastify.log.info(`Processing message from ${fromPhone}, type: ${messageType}`);

      // Find or create user
      let user = await userService.findOrCreateUser(fromPhone);

      // If new user, send welcome message
      if (user && user.total_scans === 0) {
        await whatsappService.sendWelcomeMessage(fromPhone);
      }

      // Process different message types
      switch (messageType) {
        case 'image':
          await processImageMessage(message, user, whatsappService, qrCodeService, fastify);
          break;
        
        case 'text':
          await processTextMessage(message, user, whatsappService, userService, fastify);
          break;
        
        default:
          await whatsappService.sendMessage(fromPhone, 
            'Por favor, envie uma foto do QR code para ganhar pontos! 📸');
          break;
      }
    }
  } catch (error) {
    fastify.log.error('Error processing message:', error);
  }
}

// Process image messages (QR code scanning)
async function processImageMessage(message, user, whatsappService, qrCodeService, fastify) {
  try {
    const fromPhone = message.from;
    const imageId = message.image.id;

    fastify.log.info(`Processing image from ${fromPhone}, image ID: ${imageId}`);

    // Download image from WhatsApp
    const imageBuffer = await whatsappService.downloadMedia(imageId);

    // Process QR code from image
    let qrCodeData;
    try {
      qrCodeData = await whatsappService.processQRCodeImage(imageBuffer);
    } catch (error) {
      fastify.log.error('QR code not found in image:', error);
      await whatsappService.sendErrorMessage(fromPhone, 'qr_not_found');
      return;
    }

    // Validate and process QR code scan
    try {
      const scanResult = await qrCodeService.validateAndProcessScan(
        qrCodeData, 
        user.id, 
        user.whatsapp_phone
      );

      if (scanResult.success) {
        // Send points update
        await whatsappService.sendPointsUpdate(
          fromPhone,
          scanResult.currentPoints,
          scanResult.totalScans
        );

        // If user earned a reward, send reward code
        if (scanResult.rewardCode) {
          await whatsappService.sendRewardCode(fromPhone, scanResult.rewardCode);
        }
      }

    } catch (error) {
      fastify.log.error('Error processing QR code scan:', error);
      
      let errorType = 'general';
      if (error.message.includes('already scanned')) {
        errorType = 'already_scanned';
      } else if (error.message.includes('expired')) {
        errorType = 'expired_qr';
      } else if (error.message.includes('not found') || error.message.includes('invalid')) {
        errorType = 'invalid_qr';
      }

      await whatsappService.sendErrorMessage(fromPhone, errorType);
    }

  } catch (error) {
    fastify.log.error('Error processing image message:', error);
    await whatsappService.sendErrorMessage(message.from, 'general');
  }
}

// Process text messages (commands and interactions)
async function processTextMessage(message, user, whatsappService, userService, fastify) {
  try {
    const fromPhone = message.from;
    const text = message.text.body.toLowerCase().trim();

    fastify.log.info(`Processing text message from ${fromPhone}: ${text}`);

    // Handle different text commands
    switch (text) {
      case 'pontos':
      case 'meus pontos':
      case 'status':
        await sendUserStatus(user, whatsappService, userService);
        break;

      case 'historico':
      case 'histórico':
      case 'minhas compras':
        await sendUserHistory(user, whatsappService, userService);
        break;

      case 'recompensas':
      case 'premios':
      case 'prêmios':
      case 'códigos':
      case 'codigos':
        await sendUserRewards(user, whatsappService, userService);
        break;

      case 'ranking':
      case 'leaderboard':
        await sendLeaderboard(whatsappService, userService, fromPhone);
        break;

      case 'ajuda':
      case 'help':
      case '?':
        await sendHelpMessage(whatsappService, fromPhone);
        break;

      case 'start':
      case 'começar':
      case 'começar':
        await whatsappService.sendWelcomeMessage(fromPhone);
        break;

      default:
        await whatsappService.sendMessage(fromPhone, 
          'Comando não reconhecido. Digite "ajuda" para ver os comandos disponíveis.');
        break;
    }

  } catch (error) {
    fastify.log.error('Error processing text message:', error);
    await whatsappService.sendErrorMessage(message.from, 'general');
  }
}

// Send user status
async function sendUserStatus(user, whatsappService, userService) {
  try {
    const stats = await userService.getUserStats(user.id);
    
    const statusMessage = `📊 *Seu Status no Tampinha*\n\n` +
      `👤 Usuário: ${user.name || 'Usuário'}\n` +
      `🎯 Pontos atuais: ${stats.points}/10\n` +
      `📈 Total de scans: ${stats.total_scans}\n` +
      `🏆 QR codes únicos: ${stats.unique_qr_codes_scanned}\n` +
      `🎁 Recompensas ativas: ${stats.active_rewards}\n` +
      `✅ Recompensas resgatadas: ${stats.redeemed_rewards}\n\n` +
      `${stats.points >= 10 ? 
        '🎉 Você tem pontos para trocar por uma cerveja!' : 
        `Faltam ${10 - stats.points} pontos para sua próxima cerveja!`}`;

    await whatsappService.sendMessage(user.whatsapp_phone, statusMessage);
  } catch (error) {
    console.error('Error sending user status:', error);
    await whatsappService.sendErrorMessage(user.whatsapp_phone, 'general');
  }
}

// Send user scan history
async function sendUserHistory(user, whatsappService, userService) {
  try {
    const history = await userService.getUserScanHistory(user.id, 10);
    
    if (history.length === 0) {
      await whatsappService.sendMessage(user.whatsapp_phone, 
        'Você ainda não escaneou nenhum QR code. Comece agora enviando uma foto! 📸');
      return;
    }

    let historyMessage = `📋 *Seus Últimos Scans*\n\n`;
    
    history.forEach((scan, index) => {
      const date = new Date(scan.scanned_at).toLocaleDateString('pt-BR');
      historyMessage += `${index + 1}. ${scan.bar_name}\n`;
      historyMessage += `   📅 ${date} • +${scan.points_earned} ponto(s)\n\n`;
    });

    await whatsappService.sendMessage(user.whatsapp_phone, historyMessage);
  } catch (error) {
    console.error('Error sending user history:', error);
    await whatsappService.sendErrorMessage(user.whatsapp_phone, 'general');
  }
}

// Send user active rewards
async function sendUserRewards(user, whatsappService, userService) {
  try {
    const rewards = await userService.getUserRewards(user.id, false);
    
    if (rewards.length === 0) {
      await whatsappService.sendMessage(user.whatsapp_phone, 
        'Você não tem recompensas ativas. Continue escaneando QR codes para ganhar cervejas grátis! 🍺');
      return;
    }

    let rewardsMessage = `🎁 *Suas Recompensas Ativas*\n\n`;
    
    rewards.forEach((reward, index) => {
      const expiresAt = new Date(reward.expires_at).toLocaleDateString('pt-BR');
      rewardsMessage += `${index + 1}. Código: *${reward.reward_code}*\n`;
      rewardsMessage += `   📅 Válido até: ${expiresAt}\n\n`;
    });

    rewardsMessage += `📍 Apresente qualquer um destes códigos no bar para trocar por sua cerveja gratuita!`;

    await whatsappService.sendMessage(user.whatsapp_phone, rewardsMessage);
  } catch (error) {
    console.error('Error sending user rewards:', error);
    await whatsappService.sendErrorMessage(user.whatsapp_phone, 'general');
  }
}

// Send leaderboard
async function sendLeaderboard(whatsappService, userService, userPhone) {
  try {
    const leaderboard = await userService.getLeaderboard(10);
    
    if (leaderboard.length === 0) {
      await whatsappService.sendMessage(userPhone, 
        'O ranking ainda não foi estabelecido. Seja o primeiro! 🏆');
      return;
    }

    let leaderboardMessage = `🏆 *Top 10 - Ranking Tampinha*\n\n`;
    
    leaderboard.forEach((user, index) => {
      const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
      const name = user.name || 'Usuário';
      leaderboardMessage += `${medal} ${name}\n`;
      leaderboardMessage += `   📊 ${user.points} pontos • ${user.total_scans} scans\n\n`;
    });

    await whatsappService.sendMessage(userPhone, leaderboardMessage);
  } catch (error) {
    console.error('Error sending leaderboard:', error);
    await whatsappService.sendErrorMessage(userPhone, 'general');
  }
}

// Send help message
async function sendHelpMessage(whatsappService, userPhone) {
  const helpMessage = `🆘 *Comandos do Tampinha*\n\n` +
    `📸 *Escanear QR Code:* Envie uma foto do QR code\n` +
    `📊 *pontos* - Ver seus pontos atuais\n` +
    `📋 *historico* - Ver seus últimos scans\n` +
    `🎁 *recompensas* - Ver códigos ativos\n` +
    `🏆 *ranking* - Ver top 10 usuários\n` +
    `🆘 *ajuda* - Ver esta mensagem\n\n` +
    `💡 *Como funciona:*\n` +
    `1. Escaneie QR codes dos bares parceiros\n` +
    `2. Ganhe 1 ponto por scan\n` +
    `3. Com 10 pontos, ganhe uma cerveja grátis!\n\n` +
    `🚀 Comece agora enviando uma foto do QR code!`;

  await whatsappService.sendMessage(userPhone, helpMessage);
}

module.exports = whatsappRoutes; 