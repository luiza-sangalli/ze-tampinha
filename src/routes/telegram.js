const crypto = require('crypto');
const TelegramService = require('../services/telegramService');
const UserService = require('../services/userService');
const QRCodeService = require('../services/qrCodeService');

async function telegramRoutes(fastify, options) {
  const telegramService = new TelegramService();
  const userService = new UserService(fastify.db, fastify.redis);
  const qrCodeService = new QRCodeService(fastify.db, fastify.redis);

  // Webhook para receber atualizações do Telegram
  fastify.post('/webhook', async (request, reply) => {
    try {
      const update = request.body;
      fastify.log.info('Telegram update received:', JSON.stringify(update, null, 2));

      if (update.message) {
        await processMessage(update.message, telegramService, userService, qrCodeService, fastify);
      } else if (update.callback_query) {
        await processCallbackQuery(update.callback_query, telegramService, userService, fastify);
      }

      return reply.code(200).send('OK');
    } catch (error) {
      fastify.log.error('Error processing Telegram webhook:', error);
      return reply.code(500).send('Internal Server Error');
    }
  });

  // Configurar webhook
  fastify.post('/set-webhook', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { webhookUrl } = request.body;
      const result = await telegramService.setWebhook(webhookUrl);
      return reply.send({ success: true, result });
    } catch (error) {
      fastify.log.error('Error setting webhook:', error);
      return reply.code(500).send({ error: 'Failed to set webhook' });
    }
  });

  // Delete webhook endpoint
  fastify.post('/delete-webhook', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const result = await telegramService.deleteWebhook();
      return reply.send({ success: true, result });
    } catch (error) {
      fastify.log.error('Error deleting Telegram webhook:', error);
      return reply.code(500).send({ error: 'Failed to delete webhook' });
    }
  });

  // Send test message endpoint (for development)
  fastify.post('/send-test', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { chatId, message } = request.body;
      
      if (!chatId || !message) {
        return reply.code(400).send({ error: 'Missing required fields: chatId, message' });
      }

      const result = await telegramService.sendMessage(chatId, message);
      return reply.send({ success: true, result });
    } catch (error) {
      fastify.log.error('Error sending test message:', error);
      return reply.code(500).send({ error: 'Failed to send message' });
    }
  });
}

async function processMessage(message, telegramService, userService, qrCodeService, fastify) {
  try {
    const chatId = message.chat.id;
    const user = message.from;

    const userIdentifier = telegramService.getUserIdentifier(user);
    let dbUser = await userService.findOrCreateUserByPlatform(
      userIdentifier.platform,
      userIdentifier.platformUserId,
      userIdentifier.name,
      userIdentifier.username
    );

    if (message.photo) {
      await processPhotoMessage(message, dbUser, telegramService, qrCodeService, fastify);
    } else if (message.text) {
      await processTextMessage(message, dbUser, telegramService, userService, fastify);
    } else {
      await telegramService.sendMessage(chatId, 'Por favor, envie uma foto do QR code! 📸');
    }
  } catch (error) {
    fastify.log.error('Error processing message:', error);
  }
}

async function processPhotoMessage(message, user, telegramService, qrCodeService, fastify) {
  try {
    const chatId = message.chat.id;
    const photo = message.photo[message.photo.length - 1];

    const imageBuffer = await telegramService.downloadFile(photo.file_id);
    
    let qrCodeData;
    try {
      qrCodeData = await telegramService.processQRCodeImage(imageBuffer);
    } catch (error) {
      await telegramService.sendErrorMessage(chatId, 'qr_not_found');
      return;
    }

    try {
      const scanResult = await qrCodeService.validateAndProcessScan(
        qrCodeData, 
        user.id, 
        user.platform_user_id
      );

      if (scanResult.success) {
        await telegramService.sendPointsUpdate(
          chatId,
          scanResult.currentPoints,
          scanResult.totalScans
        );

        if (scanResult.rewardCode) {
          await telegramService.sendRewardCode(chatId, scanResult.rewardCode);
        }
      }
    } catch (error) {
      let errorType = 'general';
      if (error.message.includes('already scanned')) errorType = 'already_scanned';
      else if (error.message.includes('expired')) errorType = 'expired_qr';
      else if (error.message.includes('invalid')) errorType = 'invalid_qr';

      await telegramService.sendErrorMessage(chatId, errorType);
    }
  } catch (error) {
    fastify.log.error('Error processing photo:', error);
    await telegramService.sendErrorMessage(message.chat.id, 'general');
  }
}

async function processTextMessage(message, user, telegramService, userService, fastify) {
  const chatId = message.chat.id;
  const text = message.text.toLowerCase().trim();

  switch (text) {
    case '/start':
      await telegramService.sendWelcomeMessage(chatId, message.from.first_name);
      break;
    case '/pontos':
    case 'pontos':
      await sendUserStatus(user, telegramService, userService, chatId);
      break;
    case '/menu':
      await sendMainMenu(telegramService, chatId);
      break;
    default:
      await telegramService.sendMessage(chatId, 'Digite /menu para ver as opções disponíveis.');
      break;
  }
}

async function processCallbackQuery(callbackQuery, telegramService, userService, fastify) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  
  await telegramService.answerCallbackQuery(callbackQuery.id);
  
  if (data === 'pontos') {
    const userIdentifier = telegramService.getUserIdentifier(callbackQuery.from);
    const dbUser = await userService.findUserByPlatform(
      userIdentifier.platform,
      userIdentifier.platformUserId
    );
    
    if (dbUser) {
      await sendUserStatus(dbUser, telegramService, userService, chatId);
    }
  }
}

async function sendMainMenu(telegramService, chatId) {
  const keyboard = telegramService.createInlineKeyboard([
    [{ text: '📊 Meus Pontos', callback_data: 'pontos' }]
  ]);

  const message = `🍺 *Menu Principal - Tampinha*\n\nEscolha uma opção:`;
  await telegramService.sendInlineKeyboard(chatId, message, keyboard);
}

async function sendUserStatus(user, telegramService, userService, chatId) {
  try {
    const stats = await userService.getUserStats(user.id);
    const statusMessage = `📊 *Seu Status*\n\n` +
      `🎯 Pontos: ${stats.points}/10\n` +
      `📈 Total de scans: ${stats.total_scans}\n\n` +
      `${stats.points >= 10 ? 
        '🎉 Você pode trocar por uma cerveja!' : 
        `Faltam ${10 - stats.points} pontos!`}`;

    await telegramService.sendMessage(chatId, statusMessage);
  } catch (error) {
    await telegramService.sendErrorMessage(chatId, 'general');
  }
}

module.exports = telegramRoutes; 