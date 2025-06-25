const redis = require('redis');
const fastifyPlugin = require('fastify-plugin');

async function redisPlugin(fastify, options) {
  // Skip Redis if no URL is provided
  if (!process.env.REDIS_URL) {
    fastify.log.warn('REDIS_URL not provided, skipping Redis connection');
    // Add a mock redis client
    fastify.decorate('redis', {
      get: async () => null,
      set: async () => 'OK',
      del: async () => 1,
      exists: async () => 0
    });
    return;
  }

  const client = redis.createClient({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD || undefined,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
    }
  });

  client.on('error', (err) => {
    fastify.log.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    fastify.log.info('Redis connected successfully');
  });

  try {
    await client.connect();
    fastify.log.info('Redis connection established');
  } catch (error) {
    fastify.log.error('Failed to connect to Redis:', error);
    // Add a mock redis client as fallback
    fastify.decorate('redis', {
      get: async () => null,
      set: async () => 'OK',
      del: async () => 1,
      exists: async () => 0
    });
    return;
  }

  // Add Redis client to fastify instance
  fastify.decorate('redis', client);

  // Graceful shutdown
  fastify.addHook('onClose', async (instance) => {
    if (client.isOpen) {
      await client.quit();
    }
  });
}

module.exports = fastifyPlugin(redisPlugin); 