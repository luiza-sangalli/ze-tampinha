const axios = require('axios');
const sharp = require('sharp');
const jsQR = require('jsqr');
const FormData = require('form-data');

class TelegramService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendMessage(chatId, message, parseMode = 'Markdown') {
    try {
      const response = await axios.post(
        `${this.baseUrl}/sendMessage`,
        {
          chat_id: chatId,
          text: message,
          parse_mode: parseMode
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending Telegram message:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendPhoto(chatId, photoBuffer, caption = '') {
    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', photoBuffer, { filename: 'qrcode.png' });
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'Markdown');
      }

      const response = await axios.post(
        `${this.baseUrl}/sendPhoto`,
        formData,
        {
          headers: formData.getHeaders()
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending Telegram photo:', error.response?.data || error.message);
      throw error;
    }
  }

  async downloadFile(fileId) {
    try {
      // Get file info
      const fileResponse = await axios.get(
        `${this.baseUrl}/getFile?file_id=${fileId}`
      );

      const filePath = fileResponse.data.result.file_path;

      // Download file
      const downloadResponse = await axios.get(
        `https://api.telegram.org/file/bot${this.botToken}/${filePath}`,
        { responseType: 'arraybuffer' }
      );

      return Buffer.from(downloadResponse.data);
    } catch (error) {
      console.error('Error downloading Telegram file:', error.response?.data || error.message);
      throw error;
    }
  }

  async processQRCodeImage(imageBuffer) {
    try {
      // Convert image to format suitable for QR code reading
      const { data, info } = await sharp(imageBuffer)
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });

      // Convert to RGBA format for jsQR
      const code = jsQR(data, info.width, info.height);
      
      if (code) {
        return code.data;
      } else {
        throw new Error('QR Code not found in image');
      }
    } catch (error) {
      console.error('Error processing QR code image:', error.message);
      throw error;
    }
  }

  async setWebhook(webhookUrl) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/setWebhook`,
        {
          url: webhookUrl,
          secret_token: process.env.TELEGRAM_WEBHOOK_SECRET
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting Telegram webhook:', error.response?.data || error.message);
      throw error;
    }
  }

  async deleteWebhook() {
    try {
      const response = await axios.post(
        `${this.baseUrl}/deleteWebhook`
      );
      return response.data;
    } catch (error) {
      console.error('Error deleting Telegram webhook:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendRewardCode(chatId, rewardCode) {
    const message = `🎉 *Parabéns! Você completou 10 pontos!*\n\n` +
      `Seu código de troca: \`${rewardCode}\`\n\n` +
      `📍 Apresente este código no bar para trocar por sua cerveja gratuita!\n` +
      `⏰ Válido por 30 dias.`;
    
    return this.sendMessage(chatId, message);
  }

  async sendPointsUpdate(chatId, currentPoints, totalScans) {
    const message = `✅ *QR Code escaneado com sucesso!*\n\n` +
      `📊 Seus pontos: ${currentPoints}/10\n` +
      `🔢 Total de scans: ${totalScans}\n\n` +
      `${currentPoints >= 10 ? 
        '🎉 Você já pode trocar por uma cerveja!' : 
        `Faltam ${10 - currentPoints} pontos para sua próxima cerveja!`}`;
    
    return this.sendMessage(chatId, message);
  }

  async sendWelcomeMessage(chatId, firstName = '') {
    const name = firstName ? `, ${firstName}` : '';
    const message = `🍺 *Bem-vindo ao Tampinha${name}!*\n\n` +
      `Escaneie QR codes dos bares parceiros e ganhe cervejas grátis!\n\n` +
      `📱 *Como funciona:*\n` +
      `1. Envie uma foto do QR code\n` +
      `2. Ganhe 1 ponto por scan\n` +
      `3. Com 10 pontos, ganhe uma cerveja!\n\n` +
      `🚀 Comece agora enviando uma foto do QR code!`;
    
    return this.sendMessage(chatId, message);
  }

  async sendErrorMessage(chatId, errorType = 'general') {
    const errorMessages = {
      'qr_not_found': '❌ QR Code não encontrado na imagem. Tente novamente com uma foto mais clara.',
      'already_scanned': '⚠️ Você já escaneou este QR Code anteriormente.',
      'expired_qr': '⏰ Este QR Code expirou. Procure um código válido.',
      'invalid_qr': '❌ QR Code inválido. Verifique se é um código do Tampinha.',
      'general': '❌ Ocorreu um erro. Tente novamente em alguns minutos.'
    };

    const message = errorMessages[errorType] || errorMessages['general'];
    return this.sendMessage(chatId, message);
  }

  async sendInlineKeyboard(chatId, message, keyboard) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/sendMessage`,
        {
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending Telegram inline keyboard:', error.response?.data || error.message);
      throw error;
    }
  }

  async answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/answerCallbackQuery`,
        {
          callback_query_id: callbackQueryId,
          text: text,
          show_alert: showAlert
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error answering callback query:', error.response?.data || error.message);
      throw error;
    }
  }

  // Helper method to create inline keyboard buttons
  createInlineKeyboard(buttons) {
    return buttons.map(row => 
      row.map(button => ({
        text: button.text,
        callback_data: button.callback_data || button.url ? undefined : button.text,
        url: button.url || undefined
      }))
    );
  }

  // Get user info from Telegram
  getUserIdentifier(telegramUser) {
    return {
      platform: 'telegram',
      platformUserId: telegramUser.id.toString(),
      name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || null,
      username: telegramUser.username || null
    };
  }
}

module.exports = TelegramService; 