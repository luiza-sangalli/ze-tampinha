const UserService = require('../services/userService');

async function rewardsRoutes(fastify, options) {
  const userService = new UserService(fastify.db, fastify.redis);

  // Get user rewards
  fastify.get('/user/:userId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { userId } = request.params;
      const { include_redeemed = 'false' } = request.query;
      
      const includeRedeemed = include_redeemed === 'true';
      const rewards = await userService.getUserRewards(userId, includeRedeemed);

      return reply.send({
        success: true,
        rewards: rewards
      });

    } catch (error) {
      fastify.log.error('Error getting user rewards:', error);
      return reply.code(500).send({ error: 'Failed to get user rewards' });
    }
  });

  // Get all rewards (admin only)
  fastify.get('/all', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { page = 1, limit = 50, status = 'all' } = request.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT r.*, u.whatsapp_phone, u.name as user_name
        FROM rewards r
        JOIN users u ON r.user_id = u.id
      `;
      
      const params = [];
      
      if (status === 'active') {
        query += ` WHERE r.is_redeemed = false AND r.expires_at > NOW()`;
      } else if (status === 'redeemed') {
        query += ` WHERE r.is_redeemed = true`;
      } else if (status === 'expired') {
        query += ` WHERE r.is_redeemed = false AND r.expires_at <= NOW()`;
      }
      
      query += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await fastify.db.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(r.id) FROM rewards r JOIN users u ON r.user_id = u.id`;
      const countParams = [];
      
      if (status === 'active') {
        countQuery += ` WHERE r.is_redeemed = false AND r.expires_at > NOW()`;
      } else if (status === 'redeemed') {
        countQuery += ` WHERE r.is_redeemed = true`;
      } else if (status === 'expired') {
        countQuery += ` WHERE r.is_redeemed = false AND r.expires_at <= NOW()`;
      }

      const countResult = await fastify.db.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);

      return reply.send({
        success: true,
        rewards: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });

    } catch (error) {
      fastify.log.error('Error getting all rewards:', error);
      return reply.code(500).send({ error: 'Failed to get rewards' });
    }
  });
}

module.exports = rewardsRoutes; 