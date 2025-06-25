const UserService = require('../services/userService');

async function pointsRoutes(fastify, options) {
  const userService = new UserService(fastify.db, fastify.redis);

  // Get user scan history
  fastify.get('/scans/:userId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { userId } = request.params;
      const { page = 1, limit = 50 } = request.query;
      
      const offset = (page - 1) * limit;
      const history = await userService.getUserScanHistory(userId, parseInt(limit), offset);

      return reply.send({
        success: true,
        scans: history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      fastify.log.error('Error getting user scan history:', error);
      return reply.code(500).send({ error: 'Failed to get scan history' });
    }
  });

  // Get system statistics
  fastify.get('/system-stats', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT CASE WHEN u.is_active = true THEN u.id END) as active_users,
          COUNT(s.id) as total_scans,
          COUNT(DISTINCT qr.id) as total_qr_codes,
          COUNT(r.id) as total_rewards_generated,
          COUNT(DISTINCT CASE WHEN r.is_redeemed = true THEN r.id END) as rewards_redeemed,
          COALESCE(SUM(u.points), 0) as total_active_points
        FROM users u
        LEFT JOIN scans s ON u.id = s.user_id
        LEFT JOIN qr_codes qr ON s.qr_code_id = qr.id
        LEFT JOIN rewards r ON u.id = r.user_id
      `;

      const result = await fastify.db.query(statsQuery);
      const stats = result.rows[0];

      // Convert bigint to number for JSON serialization
      Object.keys(stats).forEach(key => {
        if (typeof stats[key] === 'bigint') {
          stats[key] = Number(stats[key]);
        }
      });

      return reply.send({
        success: true,
        stats: stats
      });

    } catch (error) {
      fastify.log.error('Error getting system stats:', error);
      return reply.code(500).send({ error: 'Failed to get system statistics' });
    }
  });
}

module.exports = pointsRoutes; 