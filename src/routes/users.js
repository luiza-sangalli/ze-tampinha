const UserService = require('../services/userService');

async function userRoutes(fastify, options) {
  const userService = new UserService(fastify.db, fastify.redis);

  // Get user by phone
  fastify.get('/phone/:phone', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { phone } = request.params;
      const user = await userService.findUserByPhone(phone);

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return reply.send({
        success: true,
        user: user
      });

    } catch (error) {
      fastify.log.error('Error getting user by phone:', error);
      return reply.code(500).send({ error: 'Failed to get user' });
    }
  });

  // Get user statistics
  fastify.get('/:userId/stats', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { userId } = request.params;
      const stats = await userService.getUserStats(userId);

      if (!stats) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return reply.send({
        success: true,
        stats: stats
      });

    } catch (error) {
      fastify.log.error('Error getting user stats:', error);
      return reply.code(500).send({ error: 'Failed to get user statistics' });
    }
  });

  // Get leaderboard
  fastify.get('/leaderboard', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { limit = 100 } = request.query;
      const leaderboard = await userService.getLeaderboard(parseInt(limit));

      return reply.send({
        success: true,
        leaderboard: leaderboard
      });

    } catch (error) {
      fastify.log.error('Error getting leaderboard:', error);
      return reply.code(500).send({ error: 'Failed to get leaderboard' });
    }
  });
}

module.exports = userRoutes; 