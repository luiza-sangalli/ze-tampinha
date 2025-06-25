const axios = require('axios');
const sharp = require('sharp');
const jsQR = require('jsqr');

class WhatsAppService {
  constructor() {
    this.apiToken = process.env.WHATSAPP_API_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.baseUrl = `https://graph.facebook.com/v18.0/${this.phoneNumberId}`;
  }

  async sendMessage(to, message) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: {
            body: message
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendTemplateMessage(to, templateName, parameters = []) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: 'pt_BR'
            },
            components: parameters.length > 0 ? [{
              type: 'body',
              parameters: parameters
            }] : []
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending WhatsApp template:', error.response?.data || error.message);
      throw error;
    }
  }

  async downloadMedia(mediaId) {
    try {
      // Get media URL
      const mediaResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`
          }
        }
      );

      const mediaUrl = mediaResponse.data.url;

      // Download media
      const imageResponse = await axios.get(mediaUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        responseType: 'arraybuffer'
      });

      return Buffer.from(imageResponse.data);
    } catch (error) {
      console.error('Error downloading media:', error.response?.data || error.message);
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

  async sendRewardCode(to, rewardCode) {
    const message = `🎉 Parabéns! Você completou 10 pontos!\n\n` +
      `Seu código de troca: *${rewardCode}*\n\n` +
      `📍 Apresente este código no bar para trocar por sua cerveja gratuita!\n` +
      `⏰ Válido por 30 dias.`;
    
    return this.sendMessage(to, message);
  }

  async sendPointsUpdate(to, currentPoints, totalScans) {
    const message = `✅ QR Code escaneado com sucesso!\n\n` +
      `📊 Seus pontos: ${currentPoints}/10\n` +
      `🔢 Total de scans: ${totalScans}\n\n` +
      `${currentPoints >= 10 ? 
        '🎉 Você já pode trocar por uma cerveja!' : 
        `Faltam ${10 - currentPoints} pontos para sua próxima cerveja!`}`;
    
    return this.sendMessage(to, message);
  }

  async sendWelcomeMessage(to) {
    const message = `🍺 Bem-vindo ao Tampinha!\n\n` +
      `Escaneie QR codes dos bares parceiros e ganhe cervejas grátis!\n\n` +
      `📱 Como funciona:\n` +
      `1. Tire foto do QR code\n` +
      `2. Ganhe 1 ponto por scan\n` +
      `3. Com 10 pontos, ganhe uma cerveja!\n\n` +
      `🚀 Comece agora enviando uma foto do QR code!`;
    
    return this.sendMessage(to, message);
  }

  async sendErrorMessage(to, errorType = 'general') {
    const errorMessages = {
      'qr_not_found': '❌ QR Code não encontrado na imagem. Tente novamente com uma foto mais clara.',
      'already_scanned': '⚠️ Você já escaneou este QR Code anteriormente.',
      'expired_qr': '⏰ Este QR Code expirou. Procure um código válido.',
      'invalid_qr': '❌ QR Code inválido. Verifique se é um código do Tampinha.',
      'general': '❌ Ocorreu um erro. Tente novamente em alguns minutos.'
    };

    const message = errorMessages[errorType] || errorMessages['general'];
    return this.sendMessage(to, message);
  }
}

module.exports = WhatsAppService; 