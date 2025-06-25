const { Pool } = require('pg');
const fastifyPlugin = require('fastify-plugin');

// Only load .env in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

async function database(fastify, options) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection
  try {
    await pool.query('SELECT NOW()');
    fastify.log.info('Database connected successfully');
  } catch (err) {
    fastify.log.error('Database connection failed:', err);
    throw err;
  }

  // Add pool to fastify instance
  fastify.decorate('db', pool);

  // Graceful shutdown
  fastify.addHook('onClose', async (instance) => {
    await pool.end();
  });
}

module.exports = fastifyPlugin(database); 