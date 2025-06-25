const QRCodeService = require('../services/qrCodeService');
const Joi = require('joi');

async function qrCodeRoutes(fastify, options) {
  const qrCodeService = new QRCodeService(fastify.db, fastify.redis);

  // Schema validations
  const generateQRSchema = {
    body: Joi.object({
      barName: Joi.string().required().min(2).max(100),
      barId: Joi.string().required().min(2).max(50),
      pointsValue: Joi.number().integer().min(1).max(10).default(1),
      expiryHours: Joi.number().integer().min(1).max(168).default(24) // Max 1 week
    })
  };

  const validateRewardSchema = {
    body: Joi.object({
      rewardCode: Joi.string().required().length(8).pattern(/^[A-Z0-9]+$/)
    })
  };

  const redeemRewardSchema = {
    body: Joi.object({
      rewardCode: Joi.string().required().length(8).pattern(/^[A-Z0-9]+$/),
      barName: Joi.string().required().min(2).max(100),
      barId: Joi.string().required().min(2).max(50)
    })
  };

  // Generate QR code for bar
  fastify.post('/generate', {
    preHandler: [fastify.authenticate],
    schema: generateQRSchema
  }, async (request, reply) => {
    try {
      const { barName, barId, pointsValue, expiryHours } = request.body;

      // Generate QR code
      const result = await qrCodeService.generateQRCode(
        barName,
        barId,
        pointsValue,
        expiryHours
      );

      return reply.send({
        success: true,
        qrCode: {
          id: result.qrCode.id,
          barName: result.qrCode.bar_name,
          barId: result.qrCode.bar_id,
          pointsValue: result.qrCode.points_value,
          expiresAt: result.qrCode.expires_at,
          createdAt: result.qrCode.created_at
        },
        qrCodeImage: result.qrCodeImage,
        encryptedCode: result.encryptedCode
      });

    } catch (error) {
      fastify.log.error('Error generating QR code:', error);
      return reply.code(500).send({
        error: 'Failed to generate QR code',
        message: error.message
      });
    }
  });

  // Get QR codes for a specific bar
  fastify.get('/bar/:barId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { barId } = request.params;
      const { page = 1, limit = 20, active_only = 'true' } = request.query;
      
      const offset = (page - 1) * limit;
      const isActiveOnly = active_only === 'true';

      let query = `
        SELECT id, bar_name, bar_id, points_value, is_active, expires_at, created_at
        FROM qr_codes 
        WHERE bar_id = $1
      `;
      
      const params = [barId];
      
      if (isActiveOnly) {
        query += ` AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())`;
      }
      
      query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
      params.push(limit, offset);

      const result = await fastify.db.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM qr_codes WHERE bar_id = $1`;
      const countParams = [barId];
      
      if (isActiveOnly) {
        countQuery += ` AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())`;
      }
      
      const countResult = await fastify.db.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);

      return reply.send({
        success: true,
        qrCodes: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });

    } catch (error) {
      fastify.log.error('Error getting QR codes for bar:', error);
      return reply.code(500).send({
        error: 'Failed to get QR codes',
        message: error.message
      });
    }
  });

  // Deactivate QR code
  fastify.patch('/:qrCodeId/deactivate', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { qrCodeId } = request.params;

      const query = `
        UPDATE qr_codes 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await fastify.db.query(query, [qrCodeId]);

      if (result.rows.length === 0) {
        return reply.code(404).send({
          error: 'QR code not found'
        });
      }

      return reply.send({
        success: true,
        qrCode: result.rows[0]
      });

    } catch (error) {
      fastify.log.error('Error deactivating QR code:', error);
      return reply.code(500).send({
        error: 'Failed to deactivate QR code',
        message: error.message
      });
    }
  });

  // Validate reward code (for bars to check before accepting)
  fastify.post('/validate-reward', {
    preHandler: [fastify.authenticate],
    schema: validateRewardSchema
  }, async (request, reply) => {
    try {
      const { rewardCode } = request.body;

      const validation = await qrCodeService.validateRewardCode(rewardCode);

      return reply.send({
        success: true,
        valid: validation.valid,
        userPhone: validation.userPhone,
        expiresAt: validation.expiresAt
      });

    } catch (error) {
      fastify.log.error('Error validating reward code:', error);
      
      if (error.message.includes('not found') || error.message.includes('redeemed')) {
        return reply.code(404).send({
          error: 'Reward code not found or already redeemed'
        });
      }
      
      if (error.message.includes('expired')) {
        return reply.code(400).send({
          error: 'Reward code has expired'
        });
      }

      return reply.code(500).send({
        error: 'Failed to validate reward code',
        message: error.message
      });
    }
  });

  // Redeem reward code (when bar accepts the code)
  fastify.post('/redeem-reward', {
    preHandler: [fastify.authenticate],
    schema: redeemRewardSchema
  }, async (request, reply) => {
    try {
      const { rewardCode, barName, barId } = request.body;

      const redemption = await qrCodeService.redeemRewardCode(rewardCode, barName, barId);

      return reply.send({
        success: true,
        redemption: {
          id: redemption.id,
          rewardCode: redemption.reward_code,
          pointsUsed: redemption.points_used,
          redeemedAt: redemption.redeemed_at,
          barName: redemption.bar_name,
          barId: redemption.bar_id
        }
      });

    } catch (error) {
      fastify.log.error('Error redeeming reward code:', error);
      
      if (error.message.includes('not found') || error.message.includes('redeemed')) {
        return reply.code(404).send({
          error: 'Reward code not found or already redeemed'
        });
      }

      return reply.code(500).send({
        error: 'Failed to redeem reward code',
        message: error.message
      });
    }
  });

  // Get QR code scan statistics for a bar
  fastify.get('/bar/:barId/stats', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { barId } = request.params;
      const { days = 30 } = request.query;

      const statsQuery = `
        SELECT 
          COUNT(DISTINCT qr.id) as total_qr_codes,
          COUNT(DISTINCT CASE WHEN qr.is_active = true AND (qr.expires_at IS NULL OR qr.expires_at > NOW()) THEN qr.id END) as active_qr_codes,
          COUNT(s.id) as total_scans,
          COUNT(DISTINCT s.user_id) as unique_users,
          COALESCE(SUM(s.points_earned), 0) as total_points_distributed,
          COUNT(DISTINCT CASE WHEN s.scanned_at >= NOW() - INTERVAL '${parseInt(days)} days' THEN s.id END) as recent_scans
        FROM qr_codes qr
        LEFT JOIN scans s ON qr.id = s.qr_code_id
        WHERE qr.bar_id = $1
      `;

      const result = await fastify.db.query(statsQuery, [barId]);
      
      if (result.rows.length === 0) {
        return reply.code(404).send({
          error: 'Bar not found or no QR codes generated'
        });
      }

      const stats = result.rows[0];
      
      // Convert bigint to number for JSON serialization
      Object.keys(stats).forEach(key => {
        if (typeof stats[key] === 'bigint') {
          stats[key] = Number(stats[key]);
        }
      });

      return reply.send({
        success: true,
        barId: barId,
        stats: stats
      });

    } catch (error) {
      fastify.log.error('Error getting bar QR code stats:', error);
      return reply.code(500).send({
        error: 'Failed to get bar statistics',
        message: error.message
      });
    }
  });

  // Get recent scans for a bar
  fastify.get('/bar/:barId/scans', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { barId } = request.params;
      const { page = 1, limit = 50 } = request.query;
      
      const offset = (page - 1) * limit;

      const scansQuery = `
        SELECT 
          s.id,
          s.points_earned,
          s.scanned_at,
          u.whatsapp_phone,
          u.name as user_name,
          qr.bar_name
        FROM scans s
        JOIN qr_codes qr ON s.qr_code_id = qr.id
        JOIN users u ON s.user_id = u.id
        WHERE qr.bar_id = $1
        ORDER BY s.scanned_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await fastify.db.query(scansQuery, [barId, limit, offset]);

      // Get total count
      const countQuery = `
        SELECT COUNT(s.id) 
        FROM scans s
        JOIN qr_codes qr ON s.qr_code_id = qr.id
        WHERE qr.bar_id = $1
      `;
      
      const countResult = await fastify.db.query(countQuery, [barId]);
      const totalCount = parseInt(countResult.rows[0].count);

      return reply.send({
        success: true,
        scans: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });

    } catch (error) {
      fastify.log.error('Error getting bar scans:', error);
      return reply.code(500).send({
        error: 'Failed to get bar scans',
        message: error.message
      });
    }
  });
}

module.exports = qrCodeRoutes; 