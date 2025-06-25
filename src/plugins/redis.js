const redis = require('redis');
const fastifyPlugin = require('fastify-plugin');

async function redisPlugin(fastify, options) {
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

  await client.connect();

  // Add Redis client to fastify instance
  fastify.decorate('redis', client);

  // Graceful shutdown
  fastify.addHook('onClose', async (instance) => {
    await client.quit();
  });
}

module.exports = fastifyPlugin(redisPlugin); 