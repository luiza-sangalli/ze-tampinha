const QRCode = require('qrcode');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class QRCodeService {
  constructor(db, redis) {
    this.db = db;
    this.redis = redis;
    this.secret = process.env.QR_CODE_SECRET || 'default-secret';
  }

  // Generate QR code for bar
  async generateQRCode(barName, barId, pointsValue = 1, expiryHours = 24) {
    try {
      const codeId = uuidv4();
      const timestamp = Date.now();
      const expiresAt = new Date(Date.now() + (expiryHours * 60 * 60 * 1000));
      
      // Create code data with encryption
      const codeData = {
        id: codeId,
        barId: barId,
        timestamp: timestamp,
        points: pointsValue
      };

      const encryptedCode = this.encryptData(JSON.stringify(codeData));
      
      // Store in database
      const query = `
        INSERT INTO qr_codes (id, code, bar_name, bar_id, points_value, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const result = await this.db.query(query, [
        codeId,
        encryptedCode,
        barName,
        barId,
        pointsValue,
        expiresAt
      ]);

      // Generate QR code image
      const qrCodeData = `tampinha://${encryptedCode}`;
      const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Cache the QR code data in Redis for fast validation
      await this.redis.setEx(`qr:${encryptedCode}`, expiryHours * 3600, JSON.stringify({
        id: codeId,
        barName: barName,
        barId: barId,
        pointsValue: pointsValue,
        expiresAt: expiresAt.toISOString()
      }));

      return {
        qrCode: result.rows[0],
        qrCodeImage: qrCodeImage,
        encryptedCode: encryptedCode
      };
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  }

  // Validate and process QR code scan
  async validateAndProcessScan(qrCodeData, userId, userPhone) {
    try {
      // Extract code from QR data
      let encryptedCode;
      if (qrCodeData.startsWith('tampinha://')) {
        encryptedCode = qrCodeData.replace('tampinha://', '');
      } else {
        throw new Error('Invalid QR code format');
      }

      // Try to get from Redis cache first
      let qrCodeInfo = await this.redis.get(`qr:${encryptedCode}`);
      
      if (qrCodeInfo) {
        qrCodeInfo = JSON.parse(qrCodeInfo);
      } else {
        // Fallback to database
        const query = `
          SELECT * FROM qr_codes 
          WHERE code = $1 AND is_active = true
        `;
        const result = await this.db.query(query, [encryptedCode]);
        
        if (result.rows.length === 0) {
          throw new Error('QR code not found or inactive');
        }

        qrCodeInfo = result.rows[0];
      }

      // Check if QR code is expired
      const expiresAt = new Date(qrCodeInfo.expires_at || qrCodeInfo.expiresAt);
      if (expiresAt < new Date()) {
        throw new Error('QR code has expired');
      }

      // Check if user already scanned this QR code
      const scanCheckQuery = `
        SELECT id FROM scans 
        WHERE user_id = $1 AND qr_code_id = $2
      `;
      const scanCheck = await this.db.query(scanCheckQuery, [userId, qrCodeInfo.id]);
      
      if (scanCheck.rows.length > 0) {
        throw new Error('QR code already scanned by this user');
      }

      // Process the scan
      const client = await this.db.connect();
      
      try {
        await client.query('BEGIN');

        // Record the scan
        const scanQuery = `
          INSERT INTO scans (user_id, qr_code_id, points_earned)
          VALUES ($1, $2, $3)
          RETURNING *
        `;
        const scanResult = await client.query(scanQuery, [
          userId,
          qrCodeInfo.id,
          qrCodeInfo.points_value || qrCodeInfo.pointsValue || 1
        ]);

        // Update user points and total scans
        const updateUserQuery = `
          UPDATE users 
          SET points = points + $1, total_scans = total_scans + 1
          WHERE id = $2
          RETURNING points, total_scans
        `;
        const userResult = await client.query(updateUserQuery, [
          qrCodeInfo.points_value || qrCodeInfo.pointsValue || 1,
          userId
        ]);

        await client.query('COMMIT');

        const updatedUser = userResult.rows[0];
        
        // Check if user earned a reward
        let rewardCode = null;
        if (updatedUser.points >= 10) {
          rewardCode = await this.generateRewardCode(userId, userPhone, client);
        }

        return {
          success: true,
          pointsEarned: qrCodeInfo.points_value || qrCodeInfo.pointsValue || 1,
          currentPoints: updatedUser.points,
          totalScans: updatedUser.total_scans,
          rewardCode: rewardCode,
          barName: qrCodeInfo.bar_name || qrCodeInfo.barName
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error validating QR code scan:', error);
      throw error;
    }
  }

  // Generate reward code when user reaches 10 points
  async generateRewardCode(userId, userPhone, client = null) {
    try {
      const dbClient = client || this.db;
      
      // Generate unique reward code
      const rewardCode = this.generateUniqueCode();
      const expiresAt = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // 30 days

      const rewardQuery = `
        INSERT INTO rewards (user_id, reward_code, points_used, expires_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const rewardResult = await dbClient.query(rewardQuery, [
        userId,
        rewardCode,
        10,
        expiresAt
      ]);

      // Reset user points
      const resetPointsQuery = `
        UPDATE users SET points = points - 10 WHERE id = $1
      `;
      await dbClient.query(resetPointsQuery, [userId]);

      // Cache reward in Redis
      await this.redis.setEx(`reward:${rewardCode}`, 30 * 24 * 3600, JSON.stringify({
        userId: userId,
        userPhone: userPhone,
        expiresAt: expiresAt.toISOString()
      }));

      return rewardCode;
    } catch (error) {
      console.error('Error generating reward code:', error);
      throw error;
    }
  }

  // Validate reward code for redemption at bar
  async validateRewardCode(rewardCode) {
    try {
      // Try Redis first
      let rewardInfo = await this.redis.get(`reward:${rewardCode}`);
      
      if (rewardInfo) {
        rewardInfo = JSON.parse(rewardInfo);
        
        // Check if expired
        if (new Date(rewardInfo.expiresAt) < new Date()) {
          throw new Error('Reward code has expired');
        }
        
        return {
          valid: true,
          userPhone: rewardInfo.userPhone,
          expiresAt: rewardInfo.expiresAt
        };
      }

      // Fallback to database
      const query = `
        SELECT r.*, u.whatsapp_phone
        FROM rewards r
        JOIN users u ON r.user_id = u.id
        WHERE r.reward_code = $1 AND r.is_redeemed = false
      `;
      
      const result = await this.db.query(query, [rewardCode]);
      
      if (result.rows.length === 0) {
        throw new Error('Reward code not found or already redeemed');
      }

      const reward = result.rows[0];
      
      if (new Date(reward.expires_at) < new Date()) {
        throw new Error('Reward code has expired');
      }

      return {
        valid: true,
        userPhone: reward.whatsapp_phone,
        expiresAt: reward.expires_at
      };

    } catch (error) {
      console.error('Error validating reward code:', error);
      throw error;
    }
  }

  // Redeem reward code
  async redeemRewardCode(rewardCode, barName, barId) {
    try {
      const updateQuery = `
        UPDATE rewards 
        SET is_redeemed = true, redeemed_at = NOW(), bar_name = $1, bar_id = $2
        WHERE reward_code = $3 AND is_redeemed = false
        RETURNING *
      `;
      
      const result = await this.db.query(updateQuery, [barName, barId, rewardCode]);
      
      if (result.rows.length === 0) {
        throw new Error('Reward code not found or already redeemed');
      }

      // Remove from Redis cache
      await this.redis.del(`reward:${rewardCode}`);

      return result.rows[0];
    } catch (error) {
      console.error('Error redeeming reward code:', error);
      throw error;
    }
  }

  // Utility methods
  encryptData(data) {
    const cipher = crypto.createCipher('aes192', this.secret);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  decryptData(encryptedData) {
    const decipher = crypto.createDecipher('aes192', this.secret);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  generateUniqueCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }
}

module.exports = QRCodeService; 